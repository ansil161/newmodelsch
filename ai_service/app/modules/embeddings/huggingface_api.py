"""Embeddings from Hugging Face's hosted inference.

Same model as the local provider — BAAI/bge-base-en-v1.5, 768 dimensions —
with no weights on disk and no torch. The trade is a network round trip per
call, a rate limit, cold starts, and document text leaving the machine.

Three things this handles that a naive `httpx.post` would not:

COLD STARTS. Serverless inference unloads idle models and answers 503 with an
`estimated_time` while it reloads. That is a wait, not a failure, and failing
a document ingest because a model was asleep would be wrong.

RESPONSE SHAPE. The feature-extraction pipeline returns sentence vectors for
models that declare a pooling layer (BGE does) and token-level matrices for
models that do not. Both shapes are accepted and mean-pooled if needed, so a
model swap does not silently produce garbage.

NORMALISATION. Applied here, client-side, rather than trusted. The local
provider normalises too, which is what makes vectors from the two providers
interchangeable in the same collection.
"""

from __future__ import annotations

import asyncio
from collections.abc import Sequence
from typing import Any

import httpx

from app.core.config import EmbeddingSettings
from app.core.exceptions import EmbeddingError
from app.core.logging import get_logger

from .base import EmbeddingProvider, check_shape, l2_normalize

logger = get_logger(__name__)

# Worth waiting out rather than failing.
_RETRYABLE_STATUS = frozenset({408, 429, 500, 502, 503, 504})


class HuggingFaceInferenceEmbeddings(EmbeddingProvider):
    name = "huggingface_api"

    def __init__(self, settings: EmbeddingSettings,
                 client: httpx.AsyncClient | None = None) -> None:
        if settings.api_key is None:
            raise EmbeddingError(
                "The embedding provider is not configured. Set "
                "EMBEDDING__API_KEY to a Hugging Face access token.",
                retryable=False,
            )
        self._settings = settings
        # A single pooled client for the process. Constructing one per
        # request would give up connection reuse and TLS session resumption,
        # which is most of the latency on a short call like this.
        self._owns_client = client is None
        self._client = client or httpx.AsyncClient(
            timeout=httpx.Timeout(settings.timeout_seconds),
            headers={
                "Authorization": f"Bearer {settings.api_key.get_secret_value()}",
                "Content-Type": "application/json",
            },
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
        )

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

        vectors: list[list[float]] = []
        size = max(1, self._settings.batch_size)
        for start in range(0, len(texts), size):
            batch = list(texts[start:start + size])
            vectors.extend(await self._embed(batch))

        check_shape(vectors, expected_count=len(texts),
                    expected_dimensions=self._settings.dimensions)
        return vectors

    async def embed_query(self, text: str) -> list[float]:
        # The instruction prefix belongs on the query side only — see base.py.
        prefixed = f"{self._settings.query_instruction}{text}"
        vectors = await self._embed([prefixed])
        check_shape(vectors, expected_count=1,
                    expected_dimensions=self._settings.dimensions)
        return vectors[0]

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    # -- internals -------------------------------------------------------

    @property
    def _url(self) -> str:
        base = self._settings.api_base.rstrip("/")
        return f"{base}/{self._settings.model}/pipeline/feature-extraction"

    async def _embed(self, batch: list[str]) -> list[list[float]]:
        payload = {
            "inputs": batch,
            # Tells the API to hold the request open while a cold model
            # loads, rather than returning 503 immediately.
            "options": {"wait_for_model": True},
        }

        last_error: Exception | None = None
        for attempt in range(1, self._settings.max_retries + 1):
            try:
                response = await self._client.post(self._url, json=payload)
            except httpx.TimeoutException as exc:
                last_error = exc
                logger.warning(
                    "Embedding request timed out",
                    extra={"attempt": attempt, "provider": self.name},
                )
            except httpx.HTTPError as exc:
                last_error = exc
                logger.warning(
                    "Embedding request failed",
                    extra={"attempt": attempt, "provider": self.name,
                           "error_type": type(exc).__name__},
                )
            else:
                if response.status_code < 400:
                    return self._parse(response.json(), expected=len(batch))

                # The body can quote the request. It is logged, never raised.
                detail = response.text[:500]
                logger.warning(
                    "Embedding request rejected",
                    extra={"attempt": attempt, "provider": self.name,
                           "status": response.status_code, "detail": detail},
                )
                if response.status_code not in _RETRYABLE_STATUS:
                    raise EmbeddingError(
                        self._message_for(response.status_code),
                        retryable=False,
                        context={"status": response.status_code},
                    )
                last_error = httpx.HTTPStatusError(
                    "retryable", request=response.request, response=response
                )

            if attempt < self._settings.max_retries:
                # Exponential, capped. A model that is loading takes tens of
                # seconds, and hammering it does not speed that up.
                delay = min(2.0 ** attempt, self._settings.cold_start_wait_seconds)
                await asyncio.sleep(delay)

        raise EmbeddingError(
            "The embedding service is not responding. Please try again shortly.",
            retryable=True,
            context={"provider": self.name, "cause": type(last_error).__name__},
        )

    def _parse(self, body: Any, *, expected: int) -> list[list[float]]:
        """Accept a sentence-vector response or a token-matrix response."""
        if not isinstance(body, list) or not body:
            raise EmbeddingError(
                "The embedding service returned an unexpected response.",
                context={"provider": self.name},
            )

        first = body[0]

        # [[float, ...], ...] — one pooled vector per input. What BGE returns.
        if isinstance(first, list) and first and isinstance(first[0], (int, float)):
            vectors = [[float(value) for value in row] for row in body]

        # [[[float, ...], ...], ...] — token-level. Mean-pool to a sentence
        # vector, which is what the pooling layer would have done.
        elif isinstance(first, list) and first and isinstance(first[0], list):
            vectors = [_mean_pool(tokens) for tokens in body]

        else:
            raise EmbeddingError(
                "The embedding service returned an unexpected response.",
                context={"provider": self.name},
            )

        if len(vectors) != expected:
            raise EmbeddingError(
                "The embedding service returned an incomplete result.",
                context={"expected": expected, "received": len(vectors)},
            )
        return [l2_normalize(vector) for vector in vectors]

    @staticmethod
    def _message_for(status: int) -> str:
        if status in (401, 403):
            return "The embedding service rejected our credentials."
        if status == 404:
            return "The configured embedding model was not found."
        if status == 413:
            return "The text sent for embedding was too large."
        return "The embedding service returned an error."


def _mean_pool(token_vectors: list[list[float]]) -> list[float]:
    if not token_vectors:
        return []
    width = len(token_vectors[0])
    totals = [0.0] * width
    for token in token_vectors:
        for index, value in enumerate(token):
            totals[index] += value
    count = float(len(token_vectors))
    return [total / count for total in totals]
