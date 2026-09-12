"""Wire contracts for the chat API.

camelCase on the way out, matching the Django API the console already
consumes, so the frontend has one convention rather than two.

CONVERSATION HISTORY ARRIVES IN THE REQUEST. This service stores nothing.
Django owns conversations and messages — it has the database, the users and
the admin — and passes the relevant turns through. That keeps ai_service
horizontally scalable with no shared database, and keeps chat history subject
to exactly one set of access rules instead of two that can disagree.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.shared.schemas import ChatMessageInput, RetrievalFiltersIn, SourceOut
from app.shared.types import GenerationMetadata

# A question longer than this is not a question. The cap exists because the
# text is embedded and then put in a prompt, both of which cost money in
# proportion to length.
MAX_QUESTION_CHARACTERS = 4_000
MAX_HISTORY_MESSAGES = 100

__all__ = [
    "MAX_HISTORY_MESSAGES",
    "MAX_QUESTION_CHARACTERS",
    "ChatMessageInput",
    "ChatMetadataOut",
    "ChatRequest",
    "ChatResponse",
]


class ChatRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    message: str = Field(min_length=1, max_length=MAX_QUESTION_CHARACTERS)
    history: list[ChatMessageInput] = Field(
        default_factory=list, max_length=MAX_HISTORY_MESSAGES
    )

    # Echoed back so the caller can correlate; this service does not persist
    # them and does not use them for access decisions.
    conversation_id: str | None = Field(default=None, alias="conversationId")
    message_id: str | None = Field(default=None, alias="messageId")

    # Narrows retrieval. Can only ever be intersected with what the caller is
    # already allowed to see — see vector_store/filters.py.
    document_ids: list[str] | None = Field(default=None, alias="documentIds")
    knowledge_base_id: str | None = Field(default=None, alias="knowledgeBaseId")
    # Categories, tags, language, source types, a set of knowledge bases.
    filters: RetrievalFiltersIn | None = None

    @field_validator("message")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Enter a question.")
        return stripped


class ChatMetadataOut(BaseModel):
    """Diagnostics a user may safely see.

    Deliberately excludes the prompt, the retrieved text, provider endpoints
    and anything derived from a credential.
    """

    model_config = ConfigDict(populate_by_name=True)

    provider: str
    model: str
    grounded: bool
    # SUPPORTED | PARTIALLY_SUPPORTED | INSUFFICIENT_CONTEXT
    support: str = ""
    query_rewritten: bool = Field(alias="queryRewritten")
    retrieval_count: int = Field(alias="retrievalCount")
    context_chunk_count: int = Field(alias="contextChunkCount")
    retrieval_ms: int | None = Field(default=None, alias="retrievalMs")
    rerank_ms: int | None = Field(default=None, alias="rerankMs")
    generation_ms: int | None = Field(default=None, alias="generationMs")
    total_ms: int | None = Field(default=None, alias="totalMs")
    prompt_tokens: int | None = Field(default=None, alias="promptTokens")
    completion_tokens: int | None = Field(default=None, alias="completionTokens")

    @classmethod
    def of(cls, metadata: GenerationMetadata) -> ChatMetadataOut:
        usage = metadata.usage
        return cls(
            provider=metadata.provider,
            model=metadata.model,
            grounded=bool(metadata.extra.get("grounded", False)),
            support=metadata.support,
            queryRewritten=metadata.query_rewritten,
            retrievalCount=metadata.retrieval_count,
            contextChunkCount=metadata.context_chunk_count,
            retrievalMs=metadata.retrieval_ms,
            rerankMs=metadata.rerank_ms,
            generationMs=metadata.generation_ms,
            totalMs=metadata.total_ms,
            promptTokens=usage.prompt_tokens if usage else None,
            completionTokens=usage.completion_tokens if usage else None,
        )


class ChatResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    conversation_id: str | None = Field(default=None, alias="conversationId")
    message_id: str | None = Field(default=None, alias="messageId")
    answer: str
    sources: list[SourceOut] = Field(default_factory=list)
    metadata: ChatMetadataOut
