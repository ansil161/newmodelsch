"""Wire contracts for the knowledge-base endpoints.

Sent by Django's ingestion worker, never by a browser. camelCase on the way
in and out, matching the rest of the product's API.

Extraction and chunking happen first, at the ingestion endpoints; Django
stores the chunks it gets back and sends them here to be embedded and
indexed. The metadata fields below travel onto every vector's payload, which
is what makes them usable as retrieval filters.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class IndexChunkIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    chunk_id: str = Field(alias="chunkId")
    chunk_index: int = Field(alias="chunkIndex")
    content: str
    token_count: int = Field(default=0, alias="tokenCount")
    metadata: dict[str, Any] = Field(default_factory=dict)


class IndexDocumentRequest(BaseModel):
    """A document's chunks, ready to embed and index.

    Every field after `chunks` is optional so a caller written before they
    existed keeps working; each defaults to what that caller meant.
    """

    model_config = ConfigDict(populate_by_name=True)

    document_id: str = Field(alias="documentId")
    document_name: str = Field(alias="documentName")
    document_type: str = Field(default="", alias="documentType")
    knowledge_base_id: str = Field(default="default", alias="knowledgeBaseId")
    language: str = "en"
    chunks: list[IndexChunkIn] = Field(min_length=1, max_length=5_000)

    document_version: int = Field(default=1, ge=1, alias="documentVersion")
    # Distinct per indexing run; a retry of the same run passes the same one.
    index_generation: int | None = Field(default=None, ge=0, alias="indexGeneration")
    source_type: str = Field(default="file", max_length=32, alias="sourceType")
    category: str | None = Field(default=None, max_length=100)
    tags: list[str] = Field(default_factory=list, max_length=50)
    source_url: str | None = Field(default=None, max_length=2_048, alias="sourceUrl")


class IndexDocumentResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    document_id: str = Field(alias="documentId")
    indexed_chunks: int = Field(alias="indexedChunks")
    embedding_model: str = Field(alias="embeddingModel")
    dimensions: int
    index_generation: int = Field(alias="indexGeneration")


class DeleteDocumentResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    document_id: str = Field(alias="documentId")
    deleted: bool = True


class DeleteKnowledgeBaseResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    knowledge_base_id: str = Field(alias="knowledgeBaseId")
    deleted: bool = True


class IndexStatsResponse(BaseModel):
    """How many vectors the index holds for a scope.

    Compared by Django against the chunk counts it recorded, this is the
    knowledge-base health check: a mismatch means the index and the system
    of record disagree about what is searchable.
    """

    model_config = ConfigDict(populate_by_name=True)

    knowledge_base_id: str | None = Field(default=None, alias="knowledgeBaseId")
    document_id: str | None = Field(default=None, alias="documentId")
    points: int
