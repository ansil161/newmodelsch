"""Cross-encoder reranking.

WHY A SECOND SCORING PASS. Retrieval and reranking answer different
questions. A bi-encoder embeds the query and the passage separately and
compares two points — fast enough to search a whole collection, but it never
sees the two texts together. A cross-encoder reads the query and one passage
as a single input and scores their relevance directly. It is far more
accurate and far too slow to run over a collection, which is exactly why it
runs over twenty candidates rather than twenty thousand.

This is the highest-leverage accuracy stage in the pipeline. Fusion produces
a decent ordering; reranking is what turns "the right passage is somewhere in
the top twenty" into "the right passage is first".

THREE IMPLEMENTATIONS, ONE INTERFACE:

    huggingface_api  hosted cross-encoder. No weights, no torch.
    cross_encoder    the same model in-process. Faster per call once warm,
                     no rate limit, needs requirements-local-models.txt.
    none             pass the fused ranking through unchanged. A legitimate
                     configuration — RRF over dense and sparse is already
                     reasonable, and this stage is the most expensive one.

A reranker failing must never fail the answer. Every implementation degrades
to the input ordering and logs, because a slightly worse ranking is a much
better outcome than no reply at all.
"""

from __future__ import annotations

import asyncio
import threading
from abc import ABC, abstractmethod
from collections.abc import Sequence
from typing import Any

import httpx

from app.core.config import RerankerSettings
from app.core.logging import Stopwatch, get_logger
from app.shared.types import RetrievedChunk

logger = get_logger(__name__)

# How much of a chunk the cross-encoder sees. Its input window is ~512
# tokens shared between query and passage; sending more just pays to have it
# truncated somewhere the model chooses.
_MAX_PASSAGE_CHARACTERS = 2_000


class Reranker(ABC):
    name: str = "unknown"

    @abstractmethod
    async def rerank(
        self, query: str, chunks: Sequence[RetrievedChunk], *, top_k: int,
    ) -> list[RetrievedChunk]: ...

    # An optional hook, deliberately concrete: a provider that holds no
    # sockets and no model memory should not have to write an empty
    # override just to satisfy the ABC.
    async def aclose(self) -> None:  # noqa: B027
        ...


class NoopReranker(Reranker):
    """Keeps the fused order. Also the fallback when a reranker breaks."""

    name = "none"

    async def rerank(
        self, query: str, chunks: Sequence[RetrievedChunk], *, top_k: int,
    ) -> list[RetrievedChunk]:
        return list(chunks[:top_k])


def _apply_scores(chunks: Sequence[RetrievedChunk], scores: Sequence[float],
                  *, top_k: int) -> list[RetrievedChunk]:
    for chunk, score in zip(chunks, scores, strict=True):
        chunk.rerank_score = float(score)
    return sorted(
        chunks,
        key=lambda chunk: (-(chunk.rerank_score or 0.0), chunk.chunk_id),
    )[:top_k]


def _passage(chunk: RetrievedChunk) -> str:
    return chunk.content[:_MAX_PASSAGE_CHARACTERS]


class HuggingFaceInferenceReranker(Reranker):
    """Cross-encoder scoring over Hugging Face hosted inference."""

    name = "huggingface_api"

    def __init__(self, settings: RerankerSettings,
                 client: httpx.AsyncClient | None = None) -> None:
        self._settings = settings
        self._owns_client = client is None
        self._client = client or httpx.AsyncClient(
            timeout=httpx.Timeout(settings.timeout_seconds),
            headers={
                "Authorization": (
                    f"Bearer {settings.api_key.get_secret_value()}"
                    if settings.api_key else ""
                ),
                "Content-Type": "application/json",
            },
        )

    async def rerank(
        self, query: str, chunks: Sequence[RetrievedChunk], *, top_k: int,
    ) -> list[RetrievedChunk]:
        if not chunks:
            return []

        try:
            scores = await self._score(query, chunks)
        except Exception as exc:
            # Degrade, never fail. The fused ordering is still an ordering.
            logger.warning(
                "Reranking failed; keeping the fused order",
                extra={"provider": self.name, "error_type": type(exc).__name__},
            )
            return list(chunks[:top_k])

        return _apply_scores(chunks, scores, top_k=top_k)

    async def _score(self, query: str, chunks: Sequence[RetrievedChunk]
                     ) -> list[float]:
        base = self._settings.api_base.rstrip("/")
        url = f"{base}/{self._settings.model}"

        # A cross-encoder is served as a TEXT-CLASSIFICATION pipeline, not a
        # sentence-similarity one: it scores a (query, passage) pair, which is
        # exactly what makes it more accurate than an embedding comparison and
        # is why the pair has to be sent as `text` and `text_pair`.
        #
        # The sentence-similarity payload this used to send is rejected with
        # 400 "TextClassificationPipeline.__call__() missing 1 required
        # positional argument", and since `rerank` degrades to the fused order
        # on any failure, the effect was reranking that silently never
        # happened.
        payload = {
            "inputs": [
                {"text": query, "text_pair": _passage(chunk)} for chunk in chunks
            ],
            "options": {"wait_for_model": True},
        }

        with Stopwatch() as timer:
            response = await self._client.post(url, json=payload)
            response.raise_for_status()
            body = response.json()

        scores = _parse_classification_scores(body, len(chunks))

        logger.debug(
            "Reranked candidates",
            extra={"provider": self.name, "count": len(chunks),
                   "rerank_ms": timer.milliseconds},
        )
        return scores

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()


def _parse_classification_scores(body: Any, expected: int) -> list[float]:
    """One score per (query, passage) pair, in the order they were sent.

    Two shapes are accepted because the hosted API has returned both: the
    results wrapped in a single outer list, and the bare list. Anything else
    raises rather than being coerced — a reranker that silently mis-parses
    its scores reorders the answer's evidence, which is worse than one that
    fails and leaves the fused ordering alone.
    """
    if not isinstance(body, list):
        raise ValueError("reranker response was not a list")

    if len(body) == 1 and isinstance(body[0], list) and len(body[0]) == expected:
        rows = body[0]
    elif len(body) == expected:
        rows = body
    else:
        raise ValueError(
            f"reranker returned {len(body)} result(s) for {expected} passage(s)"
        )

    scores: list[float] = []
    for row in rows:
        if isinstance(row, dict) and "score" in row:
            scores.append(float(row["score"]))
        elif isinstance(row, list) and row and isinstance(row[0], dict):
            # Some deployments return the full label distribution per input.
            scores.append(float(row[0]["score"]))
        elif isinstance(row, int | float):
            scores.append(float(row))
        else:
            raise ValueError("unexpected reranker result shape")
    return scores


class CrossEncoderReranker(Reranker):
    """The same model in this process, via sentence-transformers.

    Lazily imported and lazily loaded for the same reasons as the local
    embedding provider: torch is a gigabyte, and a deployment using hosted
    inference should not need it.
    """

    name = "cross_encoder"

    def __init__(self, settings: RerankerSettings, model: Any | None = None) -> None:
        self._settings = settings
        self._model = model
        self._load_lock = threading.Lock()

    async def rerank(
        self, query: str, chunks: Sequence[RetrievedChunk], *, top_k: int,
    ) -> list[RetrievedChunk]:
        if not chunks:
            return []

        try:
            scores = await asyncio.to_thread(self._score, query, list(chunks))
        except Exception as exc:
            logger.warning(
                "Reranking failed; keeping the fused order",
                extra={"provider": self.name, "error_type": type(exc).__name__},
            )
            return list(chunks[:top_k])

        return _apply_scores(chunks, scores, top_k=top_k)

    def warm_up(self) -> None:
        self._ensure_model()

    def _ensure_model(self) -> Any:
        if self._model is not None:
            return self._model
        with self._load_lock:
            if self._model is not None:
                return self._model
            from sentence_transformers import CrossEncoder

            with Stopwatch() as timer:
                model = CrossEncoder(
                    self._settings.model, device=self._settings.device
                )
            logger.info(
                "Reranker model loaded",
                extra={"model": self._settings.model,
                       "load_ms": timer.milliseconds},
            )
            self._model = model
            return model

    def _score(self, query: str, chunks: list[RetrievedChunk]) -> list[float]:
        model = self._ensure_model()
        pairs = [(query, _passage(chunk)) for chunk in chunks]
        with Stopwatch() as timer:
            scores = model.predict(
                pairs, batch_size=self._settings.batch_size, show_progress_bar=False
            )
        logger.debug(
            "Reranked candidates",
            extra={"provider": self.name, "count": len(pairs),
                   "rerank_ms": timer.milliseconds},
        )
        return [float(value) for value in scores]

    async def aclose(self) -> None:
        self._model = None


def build_reranker(settings: RerankerSettings) -> Reranker:
    if settings.provider == "none":
        return NoopReranker()
    if settings.provider == "huggingface_api":
        if settings.api_key is None:
            logger.warning(
                "RERANKER__API_KEY is not set; reranking is disabled and the "
                "fused ranking will be used as-is."
            )
            return NoopReranker()
        return HuggingFaceInferenceReranker(settings)
    if settings.provider == "cross_encoder":
        return CrossEncoderReranker(settings)
    raise ValueError(f"Unknown reranker provider {settings.provider!r}")
