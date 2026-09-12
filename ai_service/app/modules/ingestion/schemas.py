"""Wire contracts for the ingestion endpoints.

Sent by Django's ingestion worker, never by a browser. camelCase, matching
the rest of this service's API.

The response carries every chunk in full. Django stores them — it is the
system of record for a document's chunks, which is what lets a re-embed after
a model change skip re-parsing, and what lets the admin console show an
administrator exactly what was extracted from their file.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

from .models import ExtractionResult


class ExtractUrlRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    url: str = Field(min_length=1, max_length=2_048)


class ExtractedChunkMetadataOut(BaseModel):
    page: int | None = None
    pages: list[int] = Field(default_factory=list)
    heading: str | None = None
    section: str | None = None


class ExtractedChunkOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    chunk_index: int = Field(alias="chunkIndex")
    content: str
    token_count: int = Field(alias="tokenCount")
    content_hash: str = Field(alias="contentHash")
    metadata: ExtractedChunkMetadataOut


class ExtractionTimingsOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    fetch_ms: int = Field(alias="fetchMs")
    extraction_ms: int = Field(alias="extractionMs")
    chunking_ms: int = Field(alias="chunkingMs")


class ExtractionResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    format: str
    parser: str
    title: str | None = None
    page_count: int | None = Field(default=None, alias="pageCount")
    character_count: int = Field(alias="characterCount")
    chunk_count: int = Field(alias="chunkCount")
    token_count: int = Field(alias="tokenCount")
    source_url: str | None = Field(default=None, alias="sourceUrl")
    content_type: str | None = Field(default=None, alias="contentType")
    warnings: list[str] = Field(default_factory=list)
    metadata: dict[str, str] = Field(default_factory=dict)
    chunks: list[ExtractedChunkOut]
    timings: ExtractionTimingsOut

    @classmethod
    def of(cls, result: ExtractionResult) -> ExtractionResponse:
        return cls(
            format=result.format,
            parser=result.parser,
            title=result.title,
            pageCount=result.page_count,
            characterCount=result.character_count,
            chunkCount=len(result.chunks),
            tokenCount=result.token_count,
            sourceUrl=result.source_url,
            contentType=result.content_type,
            warnings=list(result.warnings),
            metadata=dict(result.metadata),
            chunks=[
                ExtractedChunkOut(
                    chunkIndex=chunk.index,
                    content=chunk.content,
                    tokenCount=chunk.token_count,
                    contentHash=chunk.content_hash,
                    metadata=ExtractedChunkMetadataOut(
                        page=chunk.page,
                        pages=list(chunk.pages),
                        heading=chunk.heading,
                        section=chunk.section,
                    ),
                )
                for chunk in result.chunks
            ],
            timings=ExtractionTimingsOut(
                fetchMs=result.fetch_ms,
                extractionMs=result.extraction_ms,
                chunkingMs=result.chunking_ms,
            ),
        )
