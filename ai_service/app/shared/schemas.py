"""Wire types used by more than one API surface.

`shared/types.py` holds the domain nouns; this holds their camelCase
projections for the ones that appear in more than one endpoint. A wire type
used by exactly one endpoint stays with that endpoint's module — this file is
for the ones that would otherwise force one module to import another's
schemas.

`SourceOut` is the case that forced it: a citation is returned by the chat
endpoints, the retrieval endpoint and the diagnostics endpoint. The same goes
for `RetrievalFiltersIn` and `ChatMessageInput`, which all three accept.
"""

from __future__ import annotations

from collections.abc import Sequence

from pydantic import BaseModel, ConfigDict, Field

from app.core.security import CallerIdentity
from app.modules.vector_store.filters import SearchFilter

from .types import ChatRole, Source


class ChatMessageInput(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    role: ChatRole
    content: str = Field(max_length=32_000)


# A citation, as the frontend renders it. Documented as a comment rather
# than a docstring: pydantic publishes a model's docstring as the OpenAPI
# schema description, and this one is part of a contract Django consumes.
class SourceOut(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    document_id: str = Field(alias="documentId")
    document_name: str = Field(alias="documentName")
    chunk_id: str = Field(alias="chunkId")
    chunk_index: int = Field(alias="chunkIndex")
    page: int | None = None
    pages: list[int] = Field(default_factory=list)
    heading: str | None = None
    section: str | None = None
    source_url: str | None = Field(default=None, alias="sourceUrl")
    document_version: int | None = Field(default=None, alias="documentVersion")
    citation_number: int = Field(alias="citationNumber")
    score: float
    excerpt: str

    @classmethod
    def of(cls, source: Source) -> SourceOut:
        # Built field by field rather than `model_validate(source.model_dump())`:
        # the domain type uses snake_case and this one is alias-first, and
        # relying on pydantic to bridge the two silently depends on validation
        # flags that changed between minor versions.
        return cls(
            documentId=source.document_id,
            documentName=source.document_name,
            chunkId=source.chunk_id,
            chunkIndex=source.chunk_index,
            page=source.page,
            pages=list(source.pages),
            heading=source.heading,
            section=source.section,
            sourceUrl=source.source_url,
            documentVersion=source.document_version,
            citationNumber=source.citation_number,
            score=source.score,
            excerpt=source.excerpt,
        )


# Metadata narrowing for a retrieval, as a request states it. Every field
# can only narrow what the caller's identity already permits; see
# `build_search_filter`.
class RetrievalFiltersIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    knowledge_base_ids: list[str] | None = Field(
        default=None, alias="knowledgeBaseIds", max_length=50
    )
    document_ids: list[str] | None = Field(default=None, alias="documentIds",
                                           max_length=500)
    document_types: list[str] = Field(default_factory=list, alias="documentTypes",
                                      max_length=20)
    source_types: list[str] = Field(default_factory=list, alias="sourceTypes",
                                    max_length=20)
    categories: list[str] = Field(default_factory=list, max_length=50)
    tags: list[str] = Field(default_factory=list, max_length=50)
    language: str | None = Field(default=None, max_length=16)


def build_search_filter(
    caller: CallerIdentity,
    *,
    knowledge_base_id: str | None = None,
    document_ids: Sequence[str] | None = None,
    filters: RetrievalFiltersIn | None = None,
) -> SearchFilter:
    """The one place a request's narrowing becomes a SearchFilter.

    The tenant always comes from the caller. The older top-level
    `knowledgeBaseId` and `documentIds` fields and the `filters` object
    combine by intersection, so neither can widen the other: a document id
    named in both places must be in both to be searched.
    """
    narrowed = filters or RetrievalFiltersIn()

    documents: tuple[str, ...] | None = tuple(document_ids) if document_ids else None
    if narrowed.document_ids is not None:
        requested = tuple(narrowed.document_ids)
        documents = (
            requested if documents is None
            else tuple(document for document in requested if document in set(documents))
        )

    return SearchFilter.for_caller(
        caller,
        knowledge_base_id=knowledge_base_id,
        knowledge_base_ids=narrowed.knowledge_base_ids,
        document_ids=documents,
        document_types=narrowed.document_types,
        source_types=narrowed.source_types,
        categories=narrowed.categories,
        tags=narrowed.tags,
        language=narrowed.language,
    )
