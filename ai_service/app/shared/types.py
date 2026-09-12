"""Domain types shared across modules.

These are the nouns the whole service agrees on. Keeping them here rather
than in whichever module happened to need them first is what stops
`retrieval` importing from `chat` and `rag` importing from both.

The one that matters most is `RetrievedChunk`. It carries its source with it
from the moment Qdrant returns it to the moment a citation is rendered.
Nothing in the pipeline is permitted to produce a piece of context that has
lost the document it came from — an answer built on anonymous text cannot be
cited, and an uncitable answer is indistinguishable from an invented one.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ChatRole(StrEnum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class RetrievalMethod(StrEnum):
    DENSE = "dense"
    SPARSE = "sparse"
    HYBRID = "hybrid"


class ChunkMetadata(BaseModel):
    """Everything a citation could need, carried on the vector's payload.

    Optional throughout: a plain-text document has no page number, a DOCX has
    no page but may have a heading. A citation renders what it has.
    """

    model_config = ConfigDict(extra="allow")

    page: int | None = None
    pages: list[int] = Field(default_factory=list)
    heading: str | None = None
    section: str | None = None


class DocumentChunkInput(BaseModel):
    """One chunk arriving for indexing, from the Django knowledge base.

    Django owns extraction and chunking — it has the file bytes and a tested
    pipeline. This service owns everything from here: embedding, sparse
    encoding, and the write to Qdrant.
    """

    chunk_id: str
    chunk_index: int
    content: str
    token_count: int = 0
    metadata: ChunkMetadata = Field(default_factory=ChunkMetadata)


class DocumentIndexRequest(BaseModel):
    tenant_id: str
    document_id: str
    document_name: str
    # Free-form: "pdf", "docx", "md", "txt". Used as a retrieval filter, not
    # as a dispatch key — the indexer never parses files.
    document_type: str = ""
    knowledge_base_id: str = "default"
    language: str = "en"
    # The document version these chunks came from, as the console numbers it.
    document_version: int = 1
    # Which indexing run this is. Distinct per run; None lets the indexing
    # service assign one. See QdrantVectorStore.upsert_document for why a
    # run needs an identity of its own.
    index_generation: int | None = None
    # file, url, text — and later website, notion, drive. A filter, not a
    # dispatch key.
    source_type: str = "file"
    category: str | None = None
    tags: list[str] = Field(default_factory=list)
    # Where a URL source's content came from, so a citation can link to it.
    source_url: str | None = None
    chunks: list[DocumentChunkInput]


class RetrievedChunk(BaseModel):
    """A candidate passage, with its provenance and its scores.

    Scores accumulate as the pipeline runs rather than replacing each other,
    so a low-quality answer can be traced to the stage that let the wrong
    chunk through.
    """

    chunk_id: str
    document_id: str
    document_name: str
    chunk_index: int
    content: str
    metadata: ChunkMetadata = Field(default_factory=ChunkMetadata)
    source_url: str | None = None
    source_type: str | None = None
    document_version: int | None = None

    dense_score: float | None = None
    sparse_score: float | None = None
    fusion_score: float | None = None
    rerank_score: float | None = None
    # Which retriever(s) surfaced it. A chunk found by both is usually a
    # better answer than one found by either alone.
    methods: list[RetrievalMethod] = Field(default_factory=list)

    @property
    def final_score(self) -> float:
        """The score the pipeline last had an opinion about."""
        for score in (self.rerank_score, self.fusion_score, self.dense_score,
                      self.sparse_score):
            if score is not None:
                return score
        return 0.0


class Source(BaseModel):
    """A citation, as the frontend renders it.

    Built from a retrieved chunk. The model is never asked to produce one and
    is never given the opportunity to invent one — see rag/citations.py.
    """

    document_id: str
    document_name: str
    chunk_id: str
    chunk_index: int
    page: int | None = None
    pages: list[int] = Field(default_factory=list)
    heading: str | None = None
    # The full heading path, "Admissions › Fees › Deadlines".
    section: str | None = None
    source_url: str | None = None
    document_version: int | None = None
    # 1-based, matching the [1] marker in the answer text.
    citation_number: int = 0
    score: float = 0.0
    # A short verbatim window from the chunk, so a reader can judge the
    # citation without opening the document.
    excerpt: str = ""


class TokenUsage(BaseModel):
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    total_tokens: int | None = None


class GenerationMetadata(BaseModel):
    """What the answer cost and where it came from.

    Returned to the caller and logged. Deliberately contains no prompt text,
    no API endpoint and no key — it is diagnostics a user may safely see.
    """

    provider: str = ""
    model: str = ""
    query_rewritten: bool = False
    rewritten_query: str | None = None
    retrieval_count: int = 0
    context_chunk_count: int = 0
    retrieval_ms: int | None = None
    rerank_ms: int | None = None
    generation_ms: int | None = None
    total_ms: int | None = None
    usage: TokenUsage | None = None
    # SUPPORTED, PARTIALLY_SUPPORTED or INSUFFICIENT_CONTEXT — see
    # rag/grounding.py for how it is decided.
    support: str = ""
    extra: dict[str, Any] = Field(default_factory=dict)
