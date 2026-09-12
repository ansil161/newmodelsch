"""Building the LLM stack from configuration.

The service asks for one `LLMProvider`. What it gets is the primary wrapped
in `FallbackLLMProvider` alongside the fallback — so callers never branch on
whether a fallback is configured.
"""

from __future__ import annotations

import httpx

from app.core.config import LLMProviderName, LLMSettings
from app.core.logging import get_logger

from .base import LLMProvider
from .fallback import FallbackLLMProvider
from .gemini import GeminiProvider
from .openai_compatible import GroqProvider, XAIProvider

logger = get_logger(__name__)

_PROVIDERS: dict[LLMProviderName, type[GeminiProvider | GroqProvider | XAIProvider]] = {
    "gemini": GeminiProvider,
    "groq": GroqProvider,
    "xai": XAIProvider,
}


def build_llm_provider(settings: LLMSettings,
                       client: httpx.AsyncClient | None = None) -> LLMProvider:
    """Primary, plus fallback if one is configured and usable."""
    chain: list[LLMProvider] = [_build_one(settings, settings.primary, client)]

    if settings.fallback is not None:
        fallback_settings = settings.provider_settings(settings.fallback)
        if fallback_settings.api_key:
            chain.append(_build_one(settings, settings.fallback, client))
        else:
            # Not fatal. A missing fallback key means no fallback, and
            # saying so once at startup is more useful than discovering it
            # during the first outage.
            logger.warning(
                "No API key for the fallback provider; running without a fallback",
                extra={"fallback": settings.fallback},
            )

    logger.info(
        "LLM chain ready",
        extra={"providers": [provider.name for provider in chain],
               "models": [provider.model for provider in chain]},
    )
    return FallbackLLMProvider(
        chain, max_attempts_per_provider=settings.max_attempts_per_provider
    )


def _build_one(settings: LLMSettings, name: LLMProviderName,
               client: httpx.AsyncClient | None) -> LLMProvider:
    provider_class = _PROVIDERS.get(name)
    if provider_class is None:
        raise ValueError(f"Unknown LLM provider {name!r}")
    return provider_class(settings.provider_settings(name), client=client)
