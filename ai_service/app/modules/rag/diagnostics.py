"""Retrieval diagnostics — what the Test RAG page runs.

The production pipeline, not a copy of it: the same rewriter, the same hybrid
retrieval, the same reranker, the same context builder, prompt and citation
resolution a chat answer goes through, with tracing switched on. A test page
that exercised different code would tell an administrator how some other
system behaves.

What it reports is operational: which chunks each retriever returned and
with what score, what fusion and reranking made of them, what reached the
prompt, the filter that bounded the search, and how long each stage took.
Never the prompt text, and never model reasoning — the answer and its
citations are the only model output that leaves this service, here as
everywhere else.

Administrators only: the route checks `CallerIdentity.is_admin`, which Django
sets from the user's workspace role.
"""

from __future__ import annotations

from typing import Any

from app.core.logging import Stopwatch, bind_context, get_logger
from app.core.security import CallerIdentity
from app.modules.llm.base import ChatMessage
from app.modules.retrieval.models import RetrievalOverrides, RetrievalTrace
from app.modules.vector_store.filters import SearchFilter
from app.shared.schemas import SourceOut, build_search_filter
from app.shared.types import RetrievedChunk

from .pipeline import PreparedAnswer, RagAnswer, RagPipeline
from .schemas import (
    RagTestRequest,
    RagTestResponse,
    RagTimingsOut,
    RagTraceOut,
    TraceHitOut,
)

logger = get_logger(__name__)


class RagDiagnostics:
    def __init__(self, pipeline: RagPipeline) -> None:
        self._pipeline = pipeline

    async def run(self, request: RagTestRequest,
                  caller: CallerIdentity) -> RagTestResponse:
        bind_context(user_id=caller.user_id, tenant_id=caller.tenant_id)

        filters = build_search_filter(
            caller,
            knowledge_base_id=request.knowledge_base_id,
            document_ids=request.document_ids,
            filters=request.filters,
        )
        options = request.options
        overrides = RetrievalOverrides(
            dense_top_k=options.dense_top_k,
            sparse_top_k=options.sparse_top_k,
            rerank_top_k=options.rerank_top_k,
            final_k=options.final_k,
        )
        history = [
            ChatMessage(role=message.role, content=message.content)
            for message in request.history
        ]

        with Stopwatch() as total:
            prepared = await self._pipeline.prepare(
                request.question, history, filters, trace=True, overrides=overrides
            )
            answer = (await self._pipeline.generate(prepared)
                      if options.generate else None)

        response = _build_response(
            request, prepared, answer, filters, total.milliseconds
        )
        logger.info(
            "RAG diagnostics run",
            extra={"generated": answer is not None, "support": response.support,
                   "context_chunks": len(prepared.context.chunks),
                   "total_ms": total.milliseconds},
        )
        return response


def _build_response(
    request: RagTestRequest,
    prepared: PreparedAnswer,
    answer: RagAnswer | None,
    filters: SearchFilter,
    total_ms: int,
) -> RagTestResponse:
    retrieval = prepared.retrieval
    trace = retrieval.trace or RetrievalTrace()
    metadata = answer.metadata if answer is not None else None
    sources = answer.sources if answer is not None else prepared.provisional_sources
    usage = metadata.usage if metadata is not None else None

    return RagTestResponse(
        question=request.question,
        answer=answer.answer if answer is not None else None,
        support=metadata.support if metadata is not None else None,
        grounded=prepared.grounded,
        sources=[SourceOut.of(source) for source in sources],
        provider=metadata.provider if metadata is not None else None,
        model=metadata.model if metadata is not None else None,
        promptTokens=usage.prompt_tokens if usage else None,
        completionTokens=usage.completion_tokens if usage else None,
        invalidCitations=(
            int(metadata.extra.get("invalid_citations", 0))
            if metadata is not None else 0
        ),
        timings=RagTimingsOut(
            rewriteMs=prepared.rewrite_ms,
            embeddingMs=retrieval.embedding_ms,
            retrievalMs=retrieval.retrieval_ms,
            rerankMs=retrieval.rerank_ms,
            generationMs=metadata.generation_ms if metadata is not None else None,
            totalMs=total_ms,
        ),
        trace=RagTraceOut(
            originalQuery=prepared.question,
            searchQuery=prepared.search_query,
            rewritten=prepared.rewritten,
            rewriteReason=prepared.rewrite_reason,
            filters=filters.describe(),
            strategy=_strategy(prepared, trace),
            dense=_hits(trace.dense),
            sparse=_hits(trace.sparse),
            fused=_hits(trace.fused),
            reranked=_hits(trace.reranked),
            context=_hits(prepared.context.chunks),
            duplicatesDropped=prepared.context.dropped_duplicates,
            droppedForBudget=prepared.context.dropped_for_budget,
            contextCharacters=prepared.context.text_characters,
        ),
    )


def _strategy(prepared: PreparedAnswer, trace: RetrievalTrace) -> dict[str, Any]:
    retrieval = prepared.retrieval
    halves = [name for name, count in (("dense", retrieval.dense_count),
                                       ("sparse", retrieval.sparse_count)) if count]
    return {
        # What actually contributed, which is not always what was configured:
        # a query of stopwords has no sparse half, a strict threshold can
        # leave no dense one.
        "mode": "hybrid" if len(halves) == 2 else (halves[0] if halves else "none"),
        "fusion": "reciprocal-rank",
        "denseCount": retrieval.dense_count,
        "sparseCount": retrieval.sparse_count,
        "fusedCount": retrieval.fused_count,
        "rerankedCount": retrieval.reranked_count,
        "contextCount": len(prepared.context.chunks),
        **trace.parameters,
    }


def _hits(chunks: list[RetrievedChunk]) -> list[TraceHitOut]:
    return [TraceHitOut.of(chunk, rank) for rank, chunk in enumerate(chunks, start=1)]
