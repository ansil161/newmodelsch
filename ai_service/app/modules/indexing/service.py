"""Embedding and indexing one document's chunks.

The write half of the knowledge base. Django extracts text and splits it —
it holds the file bytes and already has a tested pipeline for that — and
hands the chunks here. This service embeds them (dense and sparse) and writes
them to Qdrant.

IDEMPOTENT BY CONSTRUCTION. Every indexing run has a generation number —
Django passes its job id; a caller that passes none is given a fresh one —
and point ids are derived from (tenant, document, generation, chunk index).
The vector store writes the new generation in full and only then removes
every other one. Retrying a run overwrites its own points; a new version
replaces the old without a moment in which the document has no vectors; a
run that fails half-way leaves the previous version answering.

BOUNDED CONCURRENCY. A semaphore caps how many documents are embedded at
once. Without it, ten simultaneous uploads of a large PDF would issue
hundreds of parallel inference calls — enough to hit a rate limit with the
hosted provider, or to exhaust memory with the local one. The limit is on
documents rather than chunks because the embedding service already batches
chunks internally.
"""

from __future__ import annotations

import asyncio
import threading
import time
from dataclasses import dataclass

from app.core.logging import Stopwatch, get_logger
from app.modules.embeddings.service import EmbeddingService
from app.modules.vector_store.base import VectorStore
from app.modules.vector_store.filters import SearchFilter
from app.shared.types import DocumentIndexRequest

logger = get_logger(__name__)

DEFAULT_MAX_CONCURRENT_DOCUMENTS = 2

_generation_lock = threading.Lock()
_last_generation = 0


def new_generation() -> int:
    """A generation number no earlier call in this process has returned.

    Millisecond time, bumped past the previous value, so two runs started in
    the same millisecond still get distinct generations — and therefore
    disjoint point ids.
    """
    global _last_generation
    with _generation_lock:
        _last_generation = max(_last_generation + 1, time.time_ns() // 1_000_000)
        return _last_generation


@dataclass(frozen=True)
class IndexResult:
    document_id: str
    indexed_chunks: int
    embedding_model: str
    dimensions: int
    embedding_ms: int
    index_ms: int
    index_generation: int


class IndexingService:
    def __init__(
        self,
        embeddings: EmbeddingService,
        vector_store: VectorStore,
        *,
        max_concurrent_documents: int = DEFAULT_MAX_CONCURRENT_DOCUMENTS,
    ) -> None:
        self._embeddings = embeddings
        self._store = vector_store
        self._gate = asyncio.Semaphore(max(1, max_concurrent_documents))

    async def index_document(self, request: DocumentIndexRequest) -> IndexResult:
        if request.index_generation is None:
            request = request.model_copy(update={"index_generation": new_generation()})
        async with self._gate:
            return await self._index(request)

    async def _index(self, request: DocumentIndexRequest) -> IndexResult:
        logger.info(
            "Indexing started",
            extra={"document_id": request.document_id,
                   "tenant_id": request.tenant_id,
                   "chunks": len(request.chunks)},
        )

        with Stopwatch() as embedding_timer:
            encoded = await self._embeddings.encode_chunks(
                [chunk.content for chunk in request.chunks]
            )

        with Stopwatch() as index_timer:
            # Counted back from the store, not the number sent: this is what
            # the knowledge base checks before it marks the document ready.
            stored = await self._store.upsert_document(
                request, encoded.dense, encoded.sparse
            )

        logger.info(
            "Indexing complete",
            extra={"document_id": request.document_id,
                   "chunks": stored,
                   "generation": request.index_generation,
                   "embedding_model": encoded.model,
                   "embedding_ms": embedding_timer.milliseconds,
                   "index_ms": index_timer.milliseconds},
        )

        return IndexResult(
            document_id=request.document_id,
            indexed_chunks=written,
            embedding_model=encoded.model,
            dimensions=encoded.dimensions,
            embedding_ms=embedding_timer.milliseconds,
            index_ms=index_timer.milliseconds,
            index_generation=int(request.index_generation or 0),
        )

    async def delete_document(self, tenant_id: str, document_id: str) -> None:
        await self._store.delete_document(tenant_id, document_id)

    async def delete_knowledge_base(self, tenant_id: str,
                                    knowledge_base_id: str) -> None:
        await self._store.delete_knowledge_base(tenant_id, knowledge_base_id)

    async def count(self, filters: SearchFilter) -> int:
        return await self._store.count(filters)
