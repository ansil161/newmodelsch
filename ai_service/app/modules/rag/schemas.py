"""Wire contracts for the RAG diagnostics endpoint.

Everything the admin console's Test RAG page shows, and nothing it should
not: rankings, scores, chunk ids, the filter that was applied, stage timings,
the answer and its citations. Never the prompt text, and never anything a
model produced other than the answer itself.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.shared.schemas import ChatMessageInput, RetrievalFiltersIn, SourceOut
from app.shared.types import RetrievedChunk

MAX_QUESTION_CHARACTERS = 4_000
_EXCERPT_CHARACTERS = 280


class RagTestOptionsIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    # False runs retrieval only — no model call, no cost — which is what
    # tuning retrieval needs most of the time.
    generate: bool = True
    dense_top_k: int | None = Field(default=None, ge=1, le=100, alias="denseTopK")
    sparse_top_k: int | None = Field(default=None, ge=1, le=100, alias="sparseTopK")
    rerank_top_k: int | None = Field(default=None, ge=1, le=100, alias="rerankTopK")
    final_k: int | None = Field(default=None, ge=1, le=20, alias="finalK")


class RagTestRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    question: str = Field(min_length=1, max_length=MAX_QUESTION_CHARACTERS)
    history: list[ChatMessageInput] = Field(default_factory=list, max_length=20)
    knowledge_base_id: str | None = Field(default=None, alias="knowledgeBaseId",
                                          max_length=64)
    document_ids: list[str] | None = Field(default=None, alias="documentIds",
                                           max_length=500)
    filters: RetrievalFiltersIn | None = None
    options: RagTestOptionsIn = Field(default_factory=RagTestOptionsIn)

    @field_validator("question")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Enter a question.")
        return stripped


class TraceHitOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    rank: int
    chunk_id: str = Field(alias="chunkId")
    document_id: str = Field(alias="documentId")
    document_name: str = Field(alias="documentName")
    chunk_index: int = Field(alias="chunkIndex")
    page: int | None = None
    heading: str | None = None
    section: str | None = None
    methods: list[str] = Field(default_factory=list)
    dense_score: float | None = Field(default=None, alias="denseScore")
    sparse_score: float | None = Field(default=None, alias="sparseScore")
    fusion_score: float | None = Field(default=None, alias="fusionScore")
    rerank_score: float | None = Field(default=None, alias="rerankScore")
    excerpt: str

    @classmethod
    def of(cls, chunk: RetrievedChunk, rank: int) -> TraceHitOut:
        metadata = chunk.metadata
        page = metadata.pages[0] if metadata.pages else metadata.page
        return cls(
            rank=rank,
            chunkId=chunk.chunk_id,
            documentId=chunk.document_id,
            documentName=chunk.document_name,
            chunkIndex=chunk.chunk_index,
            page=page,
            heading=metadata.heading,
            section=metadata.section,
            methods=[method.value for method in chunk.methods],
            denseScore=_rounded(chunk.dense_score),
            sparseScore=_rounded(chunk.sparse_score),
            fusionScore=_rounded(chunk.fusion_score),
            rerankScore=_rounded(chunk.rerank_score),
            excerpt=_excerpt(chunk.content),
        )


class RagTraceOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    original_query: str = Field(alias="originalQuery")
    search_query: str = Field(alias="searchQuery")
    rewritten: bool
    rewrite_reason: str = Field(alias="rewriteReason")
    filters: dict[str, Any]
    strategy: dict[str, Any]
    dense: list[TraceHitOut]
    sparse: list[TraceHitOut]
    fused: list[TraceHitOut]
    reranked: list[TraceHitOut]
    # What reached the prompt, numbered as the model saw it.
    context: list[TraceHitOut]
    duplicates_dropped: int = Field(alias="duplicatesDropped")
    dropped_for_budget: int = Field(alias="droppedForBudget")
    context_characters: int = Field(alias="contextCharacters")


class RagTimingsOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    rewrite_ms: int = Field(alias="rewriteMs")
    embedding_ms: int = Field(alias="embeddingMs")
    retrieval_ms: int = Field(alias="retrievalMs")
    rerank_ms: int = Field(alias="rerankMs")
    generation_ms: int | None = Field(default=None, alias="generationMs")
    total_ms: int = Field(alias="totalMs")


class RagTestResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    question: str
    answer: str | None = None
    support: str | None = None
    grounded: bool
    sources: list[SourceOut]
    provider: str | None = None
    model: str | None = None
    prompt_tokens: int | None = Field(default=None, alias="promptTokens")
    completion_tokens: int | None = Field(default=None, alias="completionTokens")
    invalid_citations: int = Field(default=0, alias="invalidCitations")
    timings: RagTimingsOut
    trace: RagTraceOut


def _rounded(value: float | None) -> float | None:
    return round(value, 6) if value is not None else None


def _excerpt(content: str) -> str:
    text = " ".join(content.split())
    if len(text) <= _EXCERPT_CHARACTERS:
        return text
    window = text[:_EXCERPT_CHARACTERS]
    space = window.rfind(" ")
    return f"{window[:space] if space > _EXCERPT_CHARACTERS // 2 else window}…"
