"""Provider selection.

The one place that knows which embedding implementations exist. Adding a
third — a self-hosted TEI server, say — is a class implementing
EmbeddingProvider and one branch here.
"""

from __future__ import annotations

from app.core.config import EmbeddingSettings
from app.core.exceptions import EmbeddingError

from .base import EmbeddingProvider


def build_embedding_provider(settings: EmbeddingSettings) -> EmbeddingProvider:
    if settings.provider == "huggingface_api":
        from .huggingface_api import HuggingFaceInferenceEmbeddings

        return HuggingFaceInferenceEmbeddings(settings)

    if settings.provider == "sentence_transformers":
        # Imported here, not at module scope: this branch pulls torch, and a
        # deployment using hosted inference should not need it installed.
        from .sentence_transformers import SentenceTransformersEmbeddings

        return SentenceTransformersEmbeddings(settings)

    raise EmbeddingError(
        f"Unknown embedding provider {settings.provider!r}.", retryable=False
    )
