"""Retrieval without generation.

The query half of RAG, exposed on its own. Two callers want it:

  * the admin console's knowledge-base search, which existed before the
    chatbot and should keep working now that vectors live in Qdrant rather
    than Postgres;
  * anyone tuning retrieval, who needs to see what the pipeline would hand a
    model without paying for a completion to find out.

No LLM is involved. That is the point — it isolates retrieval quality from
generation quality, which are two different problems with two different
fixes.

No business logic lives here. A route validates, delegates, and returns; the
request and response shapes are in modules/retrieval/schemas.py.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.dependencies import ChatCallerDep, ResourcesDep
from app.modules.rag import citations
from app.modules.retrieval.models import RetrievalQuery
from app.modules.retrieval.schemas import SearchRequest, SearchResponse, SearchStats
from app.shared.schemas import SourceOut, build_search_filter

router = APIRouter(prefix="/retrieval", tags=["retrieval"])


@router.post("/search", response_model=SearchResponse, response_model_by_alias=True)
async def search(
    payload: SearchRequest, caller: ChatCallerDep, resources: ResourcesDep
) -> SearchResponse:
    filters = build_search_filter(
        caller,
        knowledge_base_id=payload.knowledge_base_id,
        document_ids=payload.document_ids,
        filters=payload.filters,
    )

    result = await resources.retrieval.retrieve(
        RetrievalQuery(text=payload.query, filters=filters, final_k=payload.top_k)
    )

    return SearchResponse(
        query=payload.query,
        model=resources.embeddings.model,
        hits=[
            SourceOut.of(source)
            for source in citations.provisional_sources(result.chunks)
        ],
        stats=SearchStats(
            denseCount=result.dense_count,
            sparseCount=result.sparse_count,
            fusedCount=result.fused_count,
            finalCount=len(result.chunks),
            retrievalMs=result.retrieval_ms,
            rerankMs=result.rerank_ms,
        ),
    )
