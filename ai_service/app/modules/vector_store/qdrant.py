"""Qdrant Cloud, holding both halves of hybrid search in one collection.

COLLECTION SHAPE. One collection, two named vectors per point:

    "dense"   768-dimensional, Cosine  — BAAI/bge-base-en-v1.5
    "sparse"  term-frequency, IDF modifier — see embeddings/sparse.py

Named vectors rather than two collections, because a chunk is one thing. Two
collections would mean two writes to keep consistent, two deletes, and a
window during which a document is retrievable by keyword but not by meaning.

THE IDF MODIFIER IS THE SPARSE SCORER. Declaring the sparse field with
`modifier=IDF` makes Qdrant compute inverse document frequency across the
live collection at query time. That is what turns the plain term-frequency
vectors this service sends into BM25-like scoring, with no corpus statistics
to maintain here and no drift as documents come and go.

POINT IDS ARE DERIVED, NOT RANDOM. A point's id is a UUID5 of
(tenant, document, index generation, chunk index). Re-running the same
indexing run overwrites its own points rather than adding duplicates, and a
new run — a new version, a reprocess — writes a disjoint set of points.

WRITE THE NEW, THEN REMOVE THE OLD. `upsert_document` writes every point of
the new generation first, and only once all of them are stored deletes the
document's points from any other generation. A failure part-way through
deletes the partial new generation and leaves the previous one exactly as it
was, still answering. The earlier delete-then-write order had a window in
which the document had no vectors at all, and a crash inside that window
left it that way; this order has no such window. The one intermediate state
— both generations present, for the length of one delete call — is resolved
by the retry, which is idempotent.

THE CLIENT IS SYNCHRONOUS, CALLED FROM A THREAD. qdrant-client ships an async
client, but its sync client is the better-tested path and this service's
calls are short. `asyncio.to_thread` keeps them off the event loop; the
alternative — a blocking network call inside an async handler — stalls every
other in-flight request.
"""

from __future__ import annotations

import asyncio
import uuid
from collections.abc import Sequence
from typing import Any

from qdrant_client import QdrantClient, models

from app.core.config import QdrantSettings
from app.core.exceptions import VectorStoreError
from app.core.logging import Stopwatch, get_logger
from app.modules.embeddings.sparse import SparseVector
from app.shared.types import (
    ChunkMetadata,
    DocumentIndexRequest,
    RetrievalMethod,
    RetrievedChunk,
)

from .base import VectorStore
from .filters import (
    INDEXED_INTEGER_FIELDS,
    INDEXED_KEYWORD_FIELDS,
    PayloadField,
    SearchFilter,
)

logger = get_logger(__name__)

DENSE_VECTOR = "dense"
SPARSE_VECTOR = "sparse"

# Stable namespace for point ids. Fixed forever: changing it would orphan
# every point already written.
_POINT_NAMESPACE = uuid.UUID("6f6b1f4c-2a0f-4a5b-9d3e-7c1f0a5b2d84")

_UPSERT_BATCH = 128


def point_id(tenant_id: str, document_id: str, chunk_index: int,
             generation: int | None = None) -> str:
    # Without a generation, the original scheme — points written before
    # generations existed keep their ids, and are pruned like any other
    # superseded generation the next time their document is indexed.
    key = (f"{tenant_id}/{document_id}/{chunk_index}" if generation is None
           else f"{tenant_id}/{document_id}/g{generation}/{chunk_index}")
    return str(uuid.uuid5(_POINT_NAMESPACE, key))


class QdrantVectorStore(VectorStore):
    name = "qdrant"

    def __init__(self, settings: QdrantSettings,
                 client: QdrantClient | None = None) -> None:
        self._settings = settings
        self._owns_client = client is None
        if client is None and settings.local_path:
            # Embedded Qdrant on disk (development only; see QdrantSettings).
            client = QdrantClient(path=settings.local_path)
        # One client for the process. It holds a connection pool; building
        # one per request would pay TLS setup on every retrieval.
        self._client = client or QdrantClient(
            url=settings.url,
            api_key=(
                settings.api_key.get_secret_value() if settings.api_key else None
            ),
            timeout=int(settings.timeout_seconds),
            prefer_grpc=settings.prefer_grpc,
        )

    @property
    def collection(self) -> str:
        return self._settings.collection

    # -- schema ----------------------------------------------------------

    async def ensure_collection(self) -> None:
        try:
            await asyncio.to_thread(self._ensure_collection_sync)
        except VectorStoreError:
            raise
        except Exception as exc:
            logger.exception("Failed to prepare the Qdrant collection")
            raise VectorStoreError(
                "The knowledge base could not be prepared.",
                context={"collection": self.collection},
            ) from exc

    def _ensure_collection_sync(self) -> None:
        if self._client.collection_exists(self.collection):
            self._verify_shape()
        else:
            self._client.create_collection(
                collection_name=self.collection,
                vectors_config={
                    DENSE_VECTOR: models.VectorParams(
                        size=self._settings.vector_size,
                        distance=models.Distance[self._settings.distance.upper()],
                    )
                },
                sparse_vectors_config={
                    SPARSE_VECTOR: models.SparseVectorParams(
                        # Qdrant supplies the IDF half of BM25 from live
                        # collection statistics.
                        modifier=models.Modifier.IDF,
                    )
                },
            )
            logger.info(
                "Created Qdrant collection",
                extra={"collection": self.collection,
                       "vector_size": self._settings.vector_size,
                       "distance": self._settings.distance},
            )

        if self._settings.local_path:
            # Embedded Qdrant has no payload indexes; it scans, and warns
            # once per field if asked to create one.
            return

        # Filtering without a payload index is a full scan per query.
        indexes = [
            *((field, models.PayloadSchemaType.KEYWORD)
              for field in INDEXED_KEYWORD_FIELDS),
            *((field, models.PayloadSchemaType.INTEGER)
              for field in INDEXED_INTEGER_FIELDS),
        ]
        for field, schema in indexes:
            try:
                self._client.create_payload_index(
                    collection_name=self.collection,
                    field_name=field,
                    field_schema=schema,
                )
            except Exception as exc:
                # Usually "already exists" — Qdrant has no create-if-absent
                # for a payload index. But it is also how a permission error
                # or a lost connection arrives, and a filter running without
                # its index is a full collection scan per query. Too minor to
                # refuse to start over, too important to discard silently.
                logger.debug(
                    "Payload index not created",
                    extra={"field": field, "error_type": type(exc).__name__},
                )

    def _verify_shape(self) -> None:
        """Refuse to use a collection whose width disagrees with the model.

        Writing 768-dimensional vectors into a 384-dimensional collection
        fails per point with a message that does not mention the model, and
        reading from one silently returns nothing useful. Better to say so at
        startup.
        """
        info = self._client.get_collection(self.collection)
        vectors = info.config.params.vectors
        if isinstance(vectors, dict):
            dense = vectors.get(DENSE_VECTOR)
            if dense is not None and dense.size != self._settings.vector_size:
                raise VectorStoreError(
                    f"Collection {self.collection!r} stores {dense.size}-"
                    f"dimensional vectors but this service produces "
                    f"{self._settings.vector_size}. Re-create the collection "
                    f"or point QDRANT__COLLECTION elsewhere.",
                    retryable=False,
                )

    # -- writes ----------------------------------------------------------

    async def upsert_document(
        self,
        request: DocumentIndexRequest,
        dense_vectors: Sequence[Sequence[float]],
        sparse_vectors: Sequence[SparseVector],
    ) -> int:
        if not (len(request.chunks) == len(dense_vectors) == len(sparse_vectors)):
            raise VectorStoreError(
                "Chunk and vector counts disagree.",
                retryable=False,
                context={"chunks": len(request.chunks),
                         "dense": len(dense_vectors),
                         "sparse": len(sparse_vectors)},
            )

        points = [
            models.PointStruct(
                id=point_id(request.tenant_id, request.document_id,
                            chunk.chunk_index, request.index_generation),
                vector={
                    DENSE_VECTOR: list(dense),
                    SPARSE_VECTOR: models.SparseVector(
                        indices=lexical.indices, values=lexical.values
                    ),
                },
                payload={
                    PayloadField.TENANT_ID: request.tenant_id,
                    PayloadField.KNOWLEDGE_BASE_ID: request.knowledge_base_id,
                    PayloadField.DOCUMENT_ID: request.document_id,
                    PayloadField.DOCUMENT_NAME: request.document_name,
                    PayloadField.DOCUMENT_TYPE: request.document_type,
                    PayloadField.DOCUMENT_VERSION: request.document_version,
                    PayloadField.INDEX_GENERATION: request.index_generation,
                    PayloadField.SOURCE_TYPE: request.source_type,
                    PayloadField.SOURCE_URL: request.source_url,
                    PayloadField.CATEGORY: request.category,
                    PayloadField.TAGS: list(request.tags),
                    PayloadField.LANGUAGE: request.language,
                    PayloadField.CHUNK_ID: chunk.chunk_id,
                    PayloadField.CHUNK_INDEX: chunk.chunk_index,
                    # The text lives on the payload because retrieval must
                    # return something citable, and a second round trip to
                    # Postgres for every candidate would double query latency.
                    PayloadField.CONTENT: chunk.content,
                    PayloadField.TOKEN_COUNT: chunk.token_count,
                    PayloadField.METADATA: chunk.metadata.model_dump(
                        exclude_none=True
                    ),
                },
            )
            for chunk, dense, lexical in zip(
                request.chunks, dense_vectors, sparse_vectors, strict=True
            )
        ]

        try:
            stored = await asyncio.to_thread(self._upsert_sync, request, points)
        except VectorStoreError:
            raise
        except Exception as exc:
            logger.exception(
                "Qdrant upsert failed",
                extra={"document_id": request.document_id,
                       "chunks": len(points)},
            )
            raise VectorStoreError(
                "The knowledge base could not be updated."
            ) from exc

        logger.info(
            "Indexed document",
            extra={"document_id": request.document_id,
                   "tenant_id": request.tenant_id,
                   "chunks": stored, "collection": self.collection},
        )
        return stored

    def _upsert_sync(self, request: DocumentIndexRequest,
                     points: list[models.PointStruct]) -> int:
        tenant, document = request.tenant_id, request.document_id
        generation = request.index_generation

        if generation is None:
            # Replace in place — the behaviour for a caller that does not
            # identify its run. The indexing service always does.
            self._delete_document_sync(tenant, document)
            self._write_sync(points)
            return self._verify_sync(
                self._document_filter(tenant, document), request, len(points)
            )

        this_run = self._document_filter(tenant, document, generation=generation)
        try:
            self._write_sync(points)
            # Any tail of this generation beyond its chunk count — which a
            # retry of a run that once produced more chunks would otherwise
            # leave behind — goes before the count, so the count is exact.
            self._delete_sync(
                self._document_filter(tenant, document, generation=generation,
                                      chunk_index_from=len(points))
            )
            stored = self._verify_sync(this_run, request, len(points))
        except Exception:
            # Undo this run's partial or unverified write. The previous
            # generation was never touched and keeps answering.
            try:
                self._delete_sync(this_run)
            except Exception:
                logger.exception(
                    "Could not roll back a partial index write",
                    extra={"document_id": document, "generation": generation},
                )
            raise

        # The new generation is complete and counted. Only now remove every
        # other one.
        self._delete_sync(
            self._document_filter(tenant, document, exclude_generation=generation)
        )
        return stored

    def _verify_sync(self, selector: models.Filter, request: DocumentIndexRequest,
                     expected: int) -> int:
        """How many of this write's points the store holds, read back.

        `wait=True` means each batch was acknowledged, not that every point
        is there to be searched. The number reported as indexed — the number
        the knowledge base marks a document ready on — is taken from the
        store rather than from what was sent, and a shortfall is a failed
        write: a document that answers from part of its text is worse than
        one that is still processing.
        """
        stored = int(self._client.count(
            collection_name=self.collection, count_filter=selector, exact=True,
        ).count)
        if stored != expected:
            logger.error(
                "Qdrant holds fewer points than were written",
                extra={"document_id": request.document_id,
                       "generation": request.index_generation,
                       "expected": expected, "stored": stored},
            )
            raise VectorStoreError(
                "The knowledge base did not keep every chunk of this document.",
                context={"expected": expected, "stored": stored},
            )
        return stored

    def _write_sync(self, points: list[models.PointStruct]) -> None:
        for start in range(0, len(points), _UPSERT_BATCH):
            self._client.upsert(
                collection_name=self.collection,
                points=points[start:start + _UPSERT_BATCH],
                wait=True,
            )

    def _delete_sync(self, selector: models.Filter) -> None:
        self._client.delete(
            collection_name=self.collection,
            points_selector=models.FilterSelector(filter=selector),
            wait=True,
        )

    @staticmethod
    def _document_filter(
        tenant_id: str, document_id: str, *, generation: int | None = None,
        exclude_generation: int | None = None, chunk_index_from: int | None = None,
    ) -> models.Filter:
        must: list[models.Condition] = [
            models.FieldCondition(key=PayloadField.TENANT_ID,
                                  match=models.MatchValue(value=tenant_id)),
            models.FieldCondition(key=PayloadField.DOCUMENT_ID,
                                  match=models.MatchValue(value=document_id)),
        ]
        must_not: list[models.Condition] = []
        if generation is not None:
            must.append(models.FieldCondition(
                key=PayloadField.INDEX_GENERATION,
                match=models.MatchValue(value=generation)))
        if chunk_index_from is not None:
            must.append(models.FieldCondition(
                key=PayloadField.CHUNK_INDEX, range=models.Range(gte=chunk_index_from)))
        if exclude_generation is not None:
            # Points with no generation at all — written before generations
            # existed — match `must_not` and are removed too, which is right:
            # they are a superseded copy of this document.
            must_not.append(models.FieldCondition(
                key=PayloadField.INDEX_GENERATION,
                match=models.MatchValue(value=exclude_generation)))
        return models.Filter(must=must, must_not=must_not or None)

    async def delete_knowledge_base(self, tenant_id: str,
                                    knowledge_base_id: str) -> None:
        selector = models.Filter(must=[
            models.FieldCondition(key=PayloadField.TENANT_ID,
                                  match=models.MatchValue(value=tenant_id)),
            models.FieldCondition(key=PayloadField.KNOWLEDGE_BASE_ID,
                                  match=models.MatchValue(value=knowledge_base_id)),
        ])
        try:
            await asyncio.to_thread(self._delete_sync, selector)
        except Exception as exc:
            logger.exception(
                "Qdrant knowledge-base delete failed",
                extra={"knowledge_base_id": knowledge_base_id},
            )
            raise VectorStoreError(
                "The knowledge base could not be removed from the index."
            ) from exc
        logger.info(
            "Removed knowledge base from index",
            extra={"knowledge_base_id": knowledge_base_id, "tenant_id": tenant_id},
        )

    async def count(self, filters: SearchFilter) -> int:
        if filters.matches_nothing:
            return 0
        try:
            response = await asyncio.to_thread(
                self._client.count,
                collection_name=self.collection,
                count_filter=self._build_filter(filters),
                exact=True,
            )
        except Exception as exc:
            logger.exception("Qdrant count failed")
            raise VectorStoreError() from exc
        return int(response.count)

    async def delete_document(self, tenant_id: str, document_id: str) -> None:
        try:
            await asyncio.to_thread(
                self._delete_document_sync, tenant_id, document_id
            )
        except Exception as exc:
            logger.exception(
                "Qdrant delete failed", extra={"document_id": document_id}
            )
            raise VectorStoreError(
                "The document could not be removed from the knowledge base."
            ) from exc
        logger.info(
            "Removed document from index",
            extra={"document_id": document_id, "tenant_id": tenant_id},
        )

    def _delete_document_sync(self, tenant_id: str, document_id: str) -> None:
        self._client.delete(
            collection_name=self.collection,
            points_selector=models.FilterSelector(
                # Tenant is part of the delete filter too. A document id is a
                # UUID and collisions are not the concern — writing the
                # boundary into every operation, so no path can omit it, is.
                filter=models.Filter(
                    must=[
                        models.FieldCondition(
                            key=PayloadField.TENANT_ID,
                            match=models.MatchValue(value=tenant_id),
                        ),
                        models.FieldCondition(
                            key=PayloadField.DOCUMENT_ID,
                            match=models.MatchValue(value=document_id),
                        ),
                    ]
                )
            ),
            wait=True,
        )

    # -- reads -----------------------------------------------------------

    async def search_dense(
        self, vector: Sequence[float], *, limit: int, filters: SearchFilter,
        score_threshold: float | None = None,
    ) -> list[RetrievedChunk]:
        if filters.matches_nothing or limit <= 0:
            return []

        try:
            with Stopwatch() as timer:
                response = await asyncio.to_thread(
                    self._client.query_points,
                    collection_name=self.collection,
                    query=list(vector),
                    using=DENSE_VECTOR,
                    limit=limit,
                    query_filter=self._build_filter(filters),
                    score_threshold=score_threshold,
                    with_payload=True,
                )
        except Exception as exc:
            logger.exception("Qdrant dense search failed")
            raise VectorStoreError() from exc

        logger.debug(
            "Dense search complete",
            extra={"hits": len(response.points), "dense_ms": timer.milliseconds},
        )
        return [
            _to_chunk(point, method=RetrievalMethod.DENSE)
            for point in response.points
        ]

    async def search_sparse(
        self, vector: SparseVector, *, limit: int, filters: SearchFilter,
    ) -> list[RetrievedChunk]:
        if filters.matches_nothing or limit <= 0 or vector.is_empty:
            # An empty sparse vector means the query was all stopwords. There
            # is nothing to match lexically, and asking Qdrant costs a round
            # trip to be told so.
            return []

        try:
            with Stopwatch() as timer:
                response = await asyncio.to_thread(
                    self._client.query_points,
                    collection_name=self.collection,
                    query=models.SparseVector(
                        indices=vector.indices, values=vector.values
                    ),
                    using=SPARSE_VECTOR,
                    limit=limit,
                    query_filter=self._build_filter(filters),
                    with_payload=True,
                )
        except Exception as exc:
            logger.exception("Qdrant sparse search failed")
            raise VectorStoreError() from exc

        logger.debug(
            "Sparse search complete",
            extra={"hits": len(response.points), "sparse_ms": timer.milliseconds},
        )
        return [
            _to_chunk(point, method=RetrievalMethod.SPARSE)
            for point in response.points
        ]

    # -- health ----------------------------------------------------------

    async def health(self) -> bool:
        try:
            await asyncio.to_thread(self._client.get_collection, self.collection)
            return True
        except Exception as exc:
            logger.warning(
                "Qdrant health check failed",
                extra={"error_type": type(exc).__name__},
            )
            return False

    async def aclose(self) -> None:
        if self._owns_client:
            await asyncio.to_thread(self._client.close)

    # -- internals -------------------------------------------------------

    @staticmethod
    def _build_filter(filters: SearchFilter) -> models.Filter:
        conditions: list[models.Condition] = [
            models.FieldCondition(
                key=PayloadField.TENANT_ID,
                match=models.MatchValue(value=filters.tenant_id),
            )
        ]

        if filters.knowledge_base_id:
            conditions.append(
                models.FieldCondition(
                    key=PayloadField.KNOWLEDGE_BASE_ID,
                    match=models.MatchValue(value=filters.knowledge_base_id),
                )
            )
        if filters.knowledge_base_ids:
            conditions.append(
                models.FieldCondition(
                    key=PayloadField.KNOWLEDGE_BASE_ID,
                    match=models.MatchAny(any=list(filters.knowledge_base_ids)),
                )
            )
        for key, values in ((PayloadField.SOURCE_TYPE, filters.source_types),
                            (PayloadField.CATEGORY, filters.categories),
                            # `tags` is an array on the payload; MatchAny
                            # matches a point carrying any one of them.
                            (PayloadField.TAGS, filters.tags)):
            if values:
                conditions.append(models.FieldCondition(
                    key=key, match=models.MatchAny(any=list(values))
                ))
        if filters.document_ids:
            conditions.append(
                models.FieldCondition(
                    key=PayloadField.DOCUMENT_ID,
                    match=models.MatchAny(any=list(filters.document_ids)),
                )
            )
        if filters.document_types:
            conditions.append(
                models.FieldCondition(
                    key=PayloadField.DOCUMENT_TYPE,
                    match=models.MatchAny(any=list(filters.document_types)),
                )
            )
        if filters.language:
            conditions.append(
                models.FieldCondition(
                    key=PayloadField.LANGUAGE,
                    match=models.MatchValue(value=filters.language),
                )
            )
        for key, value in filters.extra.items():
            conditions.append(
                models.FieldCondition(
                    key=key, match=models.MatchValue(value=value)
                )
            )

        return models.Filter(must=conditions)


def _to_chunk(point: Any, *, method: RetrievalMethod) -> RetrievedChunk:
    payload = point.payload or {}
    raw_metadata = payload.get(PayloadField.METADATA) or {}

    version = payload.get(PayloadField.DOCUMENT_VERSION)
    chunk = RetrievedChunk(
        chunk_id=str(payload.get(PayloadField.CHUNK_ID, point.id)),
        document_id=str(payload.get(PayloadField.DOCUMENT_ID, "")),
        document_name=str(payload.get(PayloadField.DOCUMENT_NAME, "")),
        chunk_index=int(payload.get(PayloadField.CHUNK_INDEX, 0)),
        content=str(payload.get(PayloadField.CONTENT, "")),
        metadata=ChunkMetadata.model_validate(raw_metadata),
        source_url=payload.get(PayloadField.SOURCE_URL) or None,
        source_type=payload.get(PayloadField.SOURCE_TYPE) or None,
        document_version=int(version) if isinstance(version, int) else None,
        methods=[method],
    )
    if method is RetrievalMethod.DENSE:
        chunk.dense_score = float(point.score)
    else:
        chunk.sparse_score = float(point.score)
    return chunk
