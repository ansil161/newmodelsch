"""Wire contracts for the retrieval endpoint.

Retrieval without generation: the query half of RAG, exposed on its own for
the admin console's knowledge-base search and for anyone tuning the pipeline.

`stats` is the reason this response is worth having. "dense 30, sparse 0,
fused 30, final 6" says the lexical half found nothing, which is a completely
different problem from the reverse — and neither is visible from an answer.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from app.shared.schemas import RetrievalFiltersIn, SourceOut


class SearchRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    query: str = Field(min_length=1, max_length=2_000)
    top_k: int | None = Field(default=None, ge=1, le=50, alias="topK")
    document_ids: list[str] | None = Field(default=None, alias="documentIds")
    knowledge_base_id: str | None = Field(default=None, alias="knowledgeBaseId")
    filters: RetrievalFiltersIn | None = None


class SearchStats(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    dense_count: int = Field(alias="denseCount")
    sparse_count: int = Field(alias="sparseCount")
    fused_count: int = Field(alias="fusedCount")
    final_count: int = Field(alias="finalCount")
    retrieval_ms: int = Field(alias="retrievalMs")
    rerank_ms: int = Field(alias="rerankMs")


class SearchResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    query: str
    model: str
    hits: list[SourceOut]
    stats: SearchStats
