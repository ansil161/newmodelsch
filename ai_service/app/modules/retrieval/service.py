"""Hybrid retrieval: dense ∥ sparse → RRF → rerank.

    query
      ├── embed ──► Qdrant dense  (top 30, cosine ≥ threshold)
      └── tokenise ► Qdrant sparse (top 30, IDF-weighted)
                            │
                          RRF (k=60, weighted)
                            │
                     cross-encoder rerank (top 20 → top 6)
                            │
                        final chunks

The two searches run concurrently. They are independent network calls of
similar duration, so `gather` makes hybrid retrieval cost roughly what a
single search costs — without it, adding the lexical half would double
retrieval latency and the feature would be quietly disabled the first time
anyone looked at a latency graph.

ONE HALF FAILING IS NOT THE QUERY FAILING. If sparse search errors, the dense
results are still a usable answer. `gather(return_exceptions=True)` plus a
logged warning degrades to whichever half survived; only both failing is an
error. A knowledge base that answers slightly worse beats one that answers
"try again".
"""

from __future__ import annotations

import asyncio
from collections.abc import Sequence

from app.core.config import RetrievalSettings
from app.core.exceptions import VectorStoreError
from app.core.logging import Stopwatch, get_logger
from app.modules.embeddings.service import EmbeddingService
from app.modules.embeddings.sparse import SparseVector
from app.modules.vector_store.base import VectorStore
from app.shared.types import RetrievedChunk

from .fusion import RankedList, reciprocal_rank_fusion
from .models import RetrievalQuery, RetrievalResult, RetrievalTrace
from .reranking import Reranker

logger = get_logger(__name__)


class RetrievalService:
    def __init__(
        self,
        embeddings: EmbeddingService,
        vector_store: VectorStore,
        reranker: Reranker,
        settings: RetrievalSettings,
    ) -> None:
        self._embeddings = embeddings
        self._store = vector_store
        self._reranker = reranker
        self._settings = settings

    async def retrieve(self, query: RetrievalQuery) -> RetrievalResult:
        result = RetrievalResult()

        text = query.text.strip()
        if not text:
            return result
        if query.filters.matches_nothing:
            # The caller is allowed to see no documents. Not an error, and
            # not worth two round trips to confirm.
            logger.info("Retrieval skipped: the caller's filter matches nothing")
            return result

        with Stopwatch() as retrieval_timer:
            with Stopwatch() as embedding_timer:
                dense_vector, sparse_vector = await self._embeddings.encode_query(text)
            result.embedding_ms = embedding_timer.milliseconds

            dense_k = query.dense_top_k or self._settings.dense_top_k
            sparse_k = query.sparse_top_k or self._settings.sparse_top_k

            dense_hits, sparse_hits = await self._search_both(
                dense_vector, sparse_vector, dense_k, sparse_k, query
            )

            result.dense_count = len(dense_hits)
            result.sparse_count = len(sparse_hits)

            fused = reciprocal_rank_fusion(
                [
                    RankedList(dense_hits, weight=self._settings.dense_weight),
                    RankedList(sparse_hits, weight=self._settings.sparse_weight),
                ],
                k=self._settings.fusion_k,
            )
            result.fused_count = len(fused)

        result.retrieval_ms = retrieval_timer.milliseconds

        rerank_k = query.rerank_top_k or self._settings.rerank_top_k
        final_k = query.final_k or self._settings.final_context_chunks
        candidates = fused[:rerank_k]

        if query.trace:
            result.trace = RetrievalTrace(
                dense=_copies(dense_hits),
                sparse=_copies(sparse_hits),
                fused=_copies(candidates),
                parameters={
                    "denseTopK": dense_k,
                    "sparseTopK": sparse_k,
                    "fusionK": self._settings.fusion_k,
                    "denseWeight": self._settings.dense_weight,
                    "sparseWeight": self._settings.sparse_weight,
                    "rerankTopK": rerank_k,
                    "finalK": final_k,
                    "similarityThreshold": self._settings.similarity_threshold,
                    "rerankScoreThreshold": self._settings.rerank_score_threshold,
                    "reranker": self._reranker.name,
                    "embeddingModel": self._embeddings.model,
                },
            )

        if not fused:
            logger.info("Retrieval found nothing", extra=result.as_log_fields())
            return result

        with Stopwatch() as rerank_timer:
            reranked = await self._reranker.rerank(text, candidates, top_k=final_k)
        result.rerank_ms = rerank_timer.milliseconds
        result.reranked_count = len(reranked)

        result.chunks = self._apply_score_floor(reranked)
        if result.trace is not None:
            result.trace.reranked = _copies(reranked)

        logger.info(
            "Retrieval complete",
            extra={**result.as_log_fields(),
                   "reranker": self._reranker.name,
                   "top_document": result.chunks[0].document_name
                   if result.chunks else None},
        )
        return result

    # -- internals -------------------------------------------------------

    async def _search_both(
        self, dense_vector: Sequence[float], sparse_vector: SparseVector,
        dense_k: int, sparse_k: int, query: RetrievalQuery,
    ) -> tuple[list[RetrievedChunk], list[RetrievedChunk]]:
        dense_task = self._store.search_dense(
            dense_vector,
            limit=dense_k,
            filters=query.filters,
            # Applied by Qdrant, before fusion. A chunk below the floor is
            # noise, and letting it into RRF costs a rank slot that a real
            # candidate should have had.
            score_threshold=self._settings.similarity_threshold,
        )
        sparse_task = self._store.search_sparse(
            sparse_vector, limit=sparse_k, filters=query.filters
        )

        dense_result, sparse_result = await asyncio.gather(
            dense_task, sparse_task, return_exceptions=True
        )

        dense_hits = self._unwrap(dense_result, "dense")
        sparse_hits = self._unwrap(sparse_result, "sparse")

        if dense_hits is None and sparse_hits is None:
            raise VectorStoreError()

        return dense_hits or [], sparse_hits or []

    @staticmethod
    def _unwrap(
        outcome: list[RetrievedChunk] | BaseException, half: str
    ) -> list[RetrievedChunk] | None:
        if isinstance(outcome, BaseException):
            logger.warning(
                "One half of hybrid retrieval failed; continuing with the other",
                extra={"half": half, "error_type": type(outcome).__name__},
            )
            return None
        return outcome

    def _apply_score_floor(self, chunks: list[RetrievedChunk]
                           ) -> list[RetrievedChunk]:
        """Drop chunks the reranker judged irrelevant.

        Only applied when the reranker actually scored them — with the
        reranker disabled, every `rerank_score` is None and this would
        otherwise discard the entire result set.
        """
        floor = self._settings.rerank_score_threshold
        scored = [chunk for chunk in chunks if chunk.rerank_score is not None]
        if not scored:
            return chunks

        kept = [chunk for chunk in chunks
                if (chunk.rerank_score or 0.0) >= floor]

        # If the floor rejected everything, keep the single best chunk rather
        # than returning nothing. "Here is the closest thing I found" is more
        # useful than silence, and the RAG prompt is what decides whether the
        # context is good enough to answer from.
        if not kept and chunks:
            return chunks[:1]
        return kept


def _copies(chunks: Sequence[RetrievedChunk]) -> list[RetrievedChunk]:
    return [chunk.model_copy(deep=True) for chunk in chunks]
