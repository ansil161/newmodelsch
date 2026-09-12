"""Who is allowed to see which vectors.

This is the data-isolation boundary, and it is deliberately the only way to
express a query filter. `SearchFilter.for_caller` is built from the identity
Django vouched for; nothing constructs one from a request body, so a client
cannot widen its own scope by sending a different tenant.

`tenant_id` is always applied. It is not optional, not defaulted to a
wildcard, and not skippable — the failure mode of a missing tenant filter is
one customer reading another's documents, which is the worst thing this
service could do.

Everything else here only ever narrows: knowledge bases, documents, types,
categories, tags, language. Within a tenant, which knowledge bases a caller
may search is Django's decision — it sends the list — and an empty list is
honoured as "none", never read as "no constraint".
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass, field
from typing import Any

from app.core.security import CallerIdentity


@dataclass(frozen=True)
class SearchFilter:
    """Metadata constraints applied to every Qdrant query."""

    tenant_id: str
    knowledge_base_id: str | None = None
    # Any of these knowledge bases — how a chat that spans several is scoped.
    # None means no constraint beyond `knowledge_base_id`; an empty tuple
    # means no knowledge base at all, and is honoured as such.
    knowledge_base_ids: tuple[str, ...] | None = None
    # None means "any document this tenant owns". An empty tuple means
    # "no documents at all" and is honoured as such — an empty allow-list is
    # a real answer, not a missing one.
    document_ids: tuple[str, ...] | None = None
    document_types: tuple[str, ...] = ()
    source_types: tuple[str, ...] = ()
    categories: tuple[str, ...] = ()
    tags: tuple[str, ...] = ()
    language: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def for_caller(
        cls,
        caller: CallerIdentity,
        *,
        knowledge_base_id: str | None = None,
        knowledge_base_ids: Iterable[str] | None = None,
        document_ids: tuple[str, ...] | None = None,
        document_types: Iterable[str] = (),
        source_types: Iterable[str] = (),
        categories: Iterable[str] = (),
        tags: Iterable[str] = (),
        language: str | None = None,
    ) -> SearchFilter:
        """Build the filter for an authenticated caller.

        A `document_ids` argument from the request narrows the caller's own
        allow-list; it can never widen it. The intersection is taken rather
        than the union, so a client asking for a document it may not see
        gets nothing instead of an error that confirms the document exists.
        """
        allowed = caller.allowed_document_ids

        if document_ids is None:
            effective = allowed
        elif allowed is None:
            effective = tuple(document_ids)
        else:
            permitted = set(allowed)
            effective = tuple(
                document for document in document_ids if document in permitted
            )

        return cls(
            tenant_id=caller.tenant_id,
            knowledge_base_id=knowledge_base_id,
            knowledge_base_ids=(
                tuple(knowledge_base_ids) if knowledge_base_ids is not None else None
            ),
            document_ids=effective,
            document_types=tuple(document_types),
            source_types=tuple(source_types),
            categories=tuple(categories),
            tags=tuple(tags),
            language=language or None,
        )

    @property
    def matches_nothing(self) -> bool:
        """True when the filter can only ever return an empty result.

        Checked before a query is issued: an empty allow-list is a round trip
        whose answer is already known.
        """
        if self.document_ids is not None and len(self.document_ids) == 0:
            return True
        if self.knowledge_base_ids is not None:
            if not self.knowledge_base_ids:
                return True
            if (self.knowledge_base_id
                    and self.knowledge_base_id not in self.knowledge_base_ids):
                return True
        return False

    def describe(self) -> dict[str, Any]:
        """The filter as an operator reads it: for diagnostics, never for a query."""
        described: dict[str, Any] = {"tenantId": self.tenant_id}
        if self.knowledge_base_id:
            described["knowledgeBaseId"] = self.knowledge_base_id
        if self.knowledge_base_ids is not None:
            described["knowledgeBaseIds"] = list(self.knowledge_base_ids)
        if self.document_ids is not None:
            described["documentIds"] = list(self.document_ids)
        for key, values in (("documentTypes", self.document_types),
                            ("sourceTypes", self.source_types),
                            ("categories", self.categories),
                            ("tags", self.tags)):
            if values:
                described[key] = list(values)
        if self.language:
            described["language"] = self.language
        return described


# Payload keys. Written once here so the indexer and the searcher cannot
# disagree about a field name — a mismatch would silently return nothing.
class PayloadField:
    TENANT_ID = "tenant_id"
    KNOWLEDGE_BASE_ID = "knowledge_base_id"
    DOCUMENT_ID = "document_id"
    DOCUMENT_NAME = "document_name"
    DOCUMENT_TYPE = "document_type"
    DOCUMENT_VERSION = "document_version"
    # Which indexing run wrote a point. Distinct per run, which is what lets
    # a new version be written in full before the old one is removed — see
    # QdrantVectorStore.upsert_document.
    INDEX_GENERATION = "index_generation"
    SOURCE_TYPE = "source_type"
    SOURCE_URL = "source_url"
    CATEGORY = "category"
    TAGS = "tags"
    LANGUAGE = "language"
    CHUNK_ID = "chunk_id"
    CHUNK_INDEX = "chunk_index"
    CONTENT = "content"
    TOKEN_COUNT = "token_count"  # noqa: S105 — a payload field name
    METADATA = "metadata"


# Fields Qdrant should index for filtering. Without a payload index, a filter
# is a linear scan of the collection on every query.
INDEXED_KEYWORD_FIELDS = (
    PayloadField.TENANT_ID,
    PayloadField.KNOWLEDGE_BASE_ID,
    PayloadField.DOCUMENT_ID,
    PayloadField.DOCUMENT_TYPE,
    PayloadField.LANGUAGE,
    PayloadField.SOURCE_TYPE,
    PayloadField.CATEGORY,
    PayloadField.TAGS,
)

# Filtered on during writes: pruning superseded generations and trimming a
# generation's tail.
INDEXED_INTEGER_FIELDS = (
    PayloadField.INDEX_GENERATION,
    PayloadField.CHUNK_INDEX,
)
