"""Embeddings computed in this process with Sentence Transformers.

    SentenceTransformer("BAAI/bge-base-en-v1.5")
        .encode(texts, normalize_embeddings=True)

768 dimensions, unit length, cosine similarity — identical vectors to the
hosted provider, so the two can be swapped without reindexing.

WHY THE IMPORT IS LAZY. `sentence_transformers` pulls torch, which is about a
gigabyte installed. Importing it at module scope would make it a hard
dependency of the whole service, including for deployments that use the
hosted provider and never touch it. It is imported the first time a model is
actually needed, and a missing install produces a message that says what to
install.

WHY ENCODING RUNS IN A THREAD. `SentenceTransformer.encode` is synchronous
and CPU-bound for tens to hundreds of milliseconds. Calling it directly from
an async handler would block the event loop and stall every other in-flight
request — the classic way an async service ends up slower than a sync one.
It is dispatched to a worker thread; torch releases the GIL during the actual
matrix work, so this genuinely parallelises.

WHY THE MODEL IS LOADED ONCE. Construction reads ~440MB from disk and takes
seconds. One instance is built at startup and shared; a per-request instance
would be the single most expensive mistake available in this file.
"""

from __future__ import annotations

import asyncio
import threading
from collections.abc import Sequence
from typing import Any

from app.core.config import EmbeddingSettings
from app.core.exceptions import EmbeddingError
from app.core.logging import Stopwatch, get_logger

from .base import EmbeddingProvider, check_shape

logger = get_logger(__name__)


class SentenceTransformersEmbeddings(EmbeddingProvider):
    name = "sentence_transformers"

    def __init__(self, settings: EmbeddingSettings, model: Any | None = None) -> None:
        self._settings = settings
        self._model = model
        # Guards the one-time load against two concurrent first requests both
        # deciding to build a model.
        self._load_lock = threading.Lock()

    @property
    def model(self) -> str:
        return self._settings.model

    @property
    def dimensions(self) -> int:
        return self._settings.dimensions

    # -- public ----------------------------------------------------------

    async def embed_documents(self, texts: Sequence[str]) -> list[list[float]]:
        if not texts:
            return []
        vectors = await asyncio.to_thread(self._encode, list(texts))
        check_shape(vectors, expected_count=len(texts),
                    expected_dimensions=self._settings.dimensions)
        return vectors

    async def embed_query(self, text: str) -> list[float]:
        prefixed = f"{self._settings.query_instruction}{text}"
        vectors = await asyncio.to_thread(self._encode, [prefixed])
        check_shape(vectors, expected_count=1,
                    expected_dimensions=self._settings.dimensions)
        return vectors[0]

    def warm_up(self) -> None:
        """Load the weights now rather than on the first user's request.

        Called from the application lifespan. Without it the first question
        of the process pays several seconds of model loading, which looks
        exactly like a hung request.
        """
        self._ensure_model()

    async def aclose(self) -> None:
        self._model = None

    # -- internals -------------------------------------------------------

    def _ensure_model(self) -> Any:
        if self._model is not None:
            return self._model

        with self._load_lock:
            if self._model is not None:  # won the race while waiting
                return self._model

            try:
                from sentence_transformers import SentenceTransformer
            except ImportError as exc:
                raise EmbeddingError(
                    "Local embedding support is not installed. Either run "
                    "`pip install -r requirements-local-models.txt`, or set "
                    "EMBEDDING__PROVIDER=huggingface_api.",
                    retryable=False,
                ) from exc

            with Stopwatch() as timer:
                model = SentenceTransformer(
                    self._settings.model,
                    device=self._settings.device,
                    cache_folder=self._settings.cache_dir,
                )
                model.max_seq_length = self._settings.max_sequence_length

            width = model.get_sentence_embedding_dimension()
            if width != self._settings.dimensions:
                raise EmbeddingError(
                    f"{self._settings.model} produces {width}-dimensional "
                    f"vectors but EMBEDDING__DIMENSIONS is "
                    f"{self._settings.dimensions}.",
                    retryable=False,
                )

            logger.info(
                "Embedding model loaded",
                extra={"model": self._settings.model, "dimensions": width,
                       "device": str(model.device), "load_ms": timer.milliseconds},
            )
            self._model = model
            return model

    def _encode(self, texts: list[str]) -> list[list[float]]:
        model = self._ensure_model()
        try:
            vectors = model.encode(
                texts,
                batch_size=self._settings.batch_size,
                # Unit length, so cosine similarity is a dot product for
                # every consumer downstream.
                normalize_embeddings=True,
                convert_to_numpy=True,
                show_progress_bar=False,
            )
        except Exception as exc:  # torch raises a wide variety
            logger.exception("Local embedding failed")
            raise EmbeddingError(
                "The assistant could not process that text.",
                retryable=False,
                context={"provider": self.name},
            ) from exc

        return [[float(value) for value in row] for row in vectors]
