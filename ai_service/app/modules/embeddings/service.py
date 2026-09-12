"""EmbeddingService — the only thing the rest of the service calls for vectors.

Owns the two concerns that are the same whichever provider is underneath:

  * the query cache, and
  * the sparse encoding that rides alongside every dense vector.

WHY QUERIES ARE CACHED AND DOCUMENTS ARE NOT. A query embedding is small,
repeats constantly (the same question asked twice, a regenerate, a follow-up
that rewrites to a string already seen) and is on the latency path of every
single chat turn — with hosted inference it is 100-400ms of the user's wait.
Document embeddings are large, essentially never repeat, and happen on a
worker where nobody is watching. Caching them would spend memory to speed up
the one path that does not need it.

The cache is keyed on the exact text and is only ever *added* to, so there is
no invalidation problem: a given string always embeds to the same vector for
a given model. Changing the model changes the service instance, which
discards the cache with it.
"""

from __future__ import annotations

from collections import OrderedDict
from collections.abc import Sequence
from dataclasses import dataclass

from app.core.config import EmbeddingSettings
from app.core.logging import Stopwatch, get_logger

from . import sparse
from .base import EmbeddingProvider
from .factory import build_embedding_provider

logger = get_logger(__name__)


@dataclass(frozen=True)
class EncodedChunks:
    """Dense and sparse vectors for a batch, positionally aligned to input."""

    dense: list[list[float]]
    sparse: list[sparse.SparseVector]
    model: str
    dimensions: int


class EmbeddingService:
    def __init__(self, settings: EmbeddingSettings,
                 provider: EmbeddingProvider | None = None) -> None:
        self._settings = settings
        # Injectable so tests substitute a deterministic fake and never
        # reach a network or load a model.
        self._provider = provider or build_embedding_provider(settings)
        self._query_cache: OrderedDict[str, list[float]] = OrderedDict()
        self._cache_hits = 0
        self._cache_misses = 0

    @property
    def provider_name(self) -> str:
        return self._provider.name

    @property
    def model(self) -> str:
        return self._provider.model

    @property
    def dimensions(self) -> int:
        return self._provider.dimensions

    # -- documents -------------------------------------------------------

    async def encode_chunks(self, texts: Sequence[str]) -> EncodedChunks:
        """Both vectors for a batch of passages, ready to upsert.

        Sparse encoding is pure Python and microseconds per chunk, so it
        rides along with the dense call rather than being a separate pass —
        a chunk must never be indexed with one and not the other, or hybrid
        search silently degrades to whichever half it has.
        """
        if not texts:
            return EncodedChunks([], [], self.model, self.dimensions)

        with Stopwatch() as timer:
            dense = await self._provider.embed_documents(texts)

        logger.info(
            "Embedded chunks",
            extra={"count": len(texts), "provider": self.provider_name,
                   "model": self.model, "embedding_ms": timer.milliseconds},
        )
        return EncodedChunks(
            dense=dense,
            sparse=sparse.encode_many(texts),
            model=self.model,
            dimensions=self.dimensions,
        )

    # -- queries ---------------------------------------------------------

    async def encode_query(self, text: str) -> tuple[list[float], sparse.SparseVector]:
        return await self.embed_query(text), sparse.encode(text)

    async def embed_query(self, text: str) -> list[float]:
        key = text.strip()
        cached = self._query_cache.get(key)
        if cached is not None:
            self._cache_hits += 1
            # Move to the end: plain LRU eviction order.
            self._query_cache.move_to_end(key)
            return cached

        self._cache_misses += 1
        with Stopwatch() as timer:
            vector = await self._provider.embed_query(key)

        logger.debug(
            "Embedded query",
            extra={"provider": self.provider_name, "embedding_ms": timer.milliseconds},
        )

        self._query_cache[key] = vector
        while len(self._query_cache) > self._settings.query_cache_size:
            self._query_cache.popitem(last=False)
        return vector

    # -- lifecycle / diagnostics -----------------------------------------

    def warm_up(self) -> None:
        warm = getattr(self._provider, "warm_up", None)
        if callable(warm):
            warm()

    async def aclose(self) -> None:
        await self._provider.aclose()

    def stats(self) -> dict[str, object]:
        total = self._cache_hits + self._cache_misses
        return {
            "provider": self.provider_name,
            "model": self.model,
            "dimensions": self.dimensions,
            "query_cache_size": len(self._query_cache),
            "query_cache_hit_rate": (
                round(self._cache_hits / total, 3) if total else None
            ),
        }
