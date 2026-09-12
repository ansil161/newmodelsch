"""The embedding contract.

Everything downstream — retrieval, the vector store, the RAG pipeline —
knows only that it can hand over strings and get back equal-length unit
vectors. It never learns whether that happened over the network or in this
process, and it never learns the model's name except to record it.

Two invariants every implementation must hold, because the rest of the system
is built on them:

  1. ONE VECTOR PER INPUT, IN INPUT ORDER. Callers zip results back against
     the chunks they came from. A provider that reordered or dropped a result
     would attach a vector to the wrong chunk, and every citation built on it
     would name the wrong document.

  2. UNIT LENGTH. Vectors are L2-normalised, which makes cosine similarity a
     plain dot product everywhere downstream and lets Qdrant's Cosine
     distance and the reranker's arithmetic agree without either of them
     computing a magnitude.

BGE asymmetry: BAAI/bge-* was trained with an instruction prefix on the query
side only. `embed_query` applies it; `embed_documents` must not. Getting this
backwards costs several points of retrieval quality and is invisible in
testing unless you look for it — hence two methods rather than a flag.
"""

from __future__ import annotations

import math
from abc import ABC, abstractmethod
from collections.abc import Sequence


class EmbeddingProvider(ABC):
    """Turns text into unit vectors."""

    name: str = "unknown"

    @property
    @abstractmethod
    def model(self) -> str:
        """The model identifier, recorded alongside every stored vector.

        Vectors from different models occupy different spaces. Storing this
        is what lets retrieval refuse to rank across two of them.
        """

    @property
    @abstractmethod
    def dimensions(self) -> int: ...

    @abstractmethod
    async def embed_documents(self, texts: Sequence[str]) -> list[list[float]]:
        """Embed passages for storage. No query instruction."""

    @abstractmethod
    async def embed_query(self, text: str) -> list[float]:
        """Embed a question for search. Applies the query instruction."""

    # An optional hook, deliberately concrete: a provider that holds no
    # sockets and no model memory should not have to write an empty
    # override just to satisfy the ABC.
    async def aclose(self) -> None:  # noqa: B027
        """Release sockets or model memory. Called once at shutdown."""


def l2_normalize(vector: Sequence[float]) -> list[float]:
    """Scale to unit length.

    An all-zero vector — which a provider can legitimately return for input
    with no meaningful tokens — is returned unchanged rather than divided by
    zero. It matches nothing, which is the correct outcome.
    """
    magnitude = math.sqrt(sum(value * value for value in vector))
    if magnitude == 0.0:
        return list(vector)
    return [value / magnitude for value in vector]


def check_shape(vectors: list[list[float]], *, expected_count: int,
                expected_dimensions: int | None = None) -> None:
    """Fail loudly on a malformed provider response.

    Checked here rather than trusted, because the failure mode is silent: a
    short batch shifts every subsequent vector onto the wrong chunk, and the
    result is a knowledge base that answers confidently with the wrong
    source.
    """
    from app.core.exceptions import EmbeddingError

    if len(vectors) != expected_count:
        raise EmbeddingError(
            "The embedding service returned an incomplete result.",
            context={"expected": expected_count, "received": len(vectors)},
        )
    if not vectors:
        return

    widths = {len(vector) for vector in vectors}
    if len(widths) != 1:
        raise EmbeddingError(
            "The embedding service returned vectors of inconsistent size.",
            retryable=False,
            context={"widths": sorted(widths)},
        )
    width = widths.pop()
    if expected_dimensions is not None and width != expected_dimensions:
        raise EmbeddingError(
            "The embedding model does not match the configured dimensions.",
            retryable=False,
            context={"expected": expected_dimensions, "received": width},
        )
