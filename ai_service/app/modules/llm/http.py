"""Shared plumbing for the providers reached over plain HTTP.

Gemini and the OpenAI-compatible providers differ in their request shape,
their response shape and their streaming frames — which is why they are two
files. What they do *not* differ in is everything around that: how the client
is owned, how a per-request timeout is derived, what "healthy" means without
spending a token to find out, and how an HTTP status becomes an `LLMError`
whose `retryable` flag decides whether `fallback.py` tries the next provider.

Those eight members were identical in both files. They live here once.

TWO THINGS ARE DELIBERATELY LEFT TO THE SUBCLASS, because moving them would
be an observability regression rather than a simplification:

  * `_logger` — every log record carries the logger's name, so a rejection
    logged from here would say `app.modules.llm.http` for every provider
    instead of naming the module that made the call.
  * `_failure_message` — the message a provider's failures are already
    grepped and alerted on.

`_headers` is abstract: it is the one piece of the request that is genuinely
per-provider (Gemini uses `x-goog-api-key`, the others a bearer token) and
the one that must never be got wrong.
"""

from __future__ import annotations

import logging
from abc import abstractmethod

import httpx

from app.core.config import LLMProviderSettings
from app.core.exceptions import LLMBadRequestError, LLMError
from app.core.logging import get_logger

from .base import GenerationRequest, LLMProvider

logger = get_logger(__name__)


class HttpLLMProvider(LLMProvider):
    """An `LLMProvider` that speaks REST over the shared `httpx` client."""

    # Statuses that say "not right now" rather than "not ever". A 429 or a
    # 5xx is worth sending to the next provider; a 400 is not, because the
    # second provider will reject it just as fast.
    retryable_statuses: frozenset[int] = frozenset({408, 429, 500, 502, 503, 504})

    _logger: logging.Logger = logger
    _failure_message: str = "LLM request failed"

    def __init__(
        self,
        settings: LLMProviderSettings,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self._settings = settings
        # The application shares one client across every provider, so
        # connections and TLS sessions are reused. A provider that built its
        # own — a script, a test — is the only one that may close it.
        self._owns_client = client is None
        self._client = client or httpx.AsyncClient(
            timeout=httpx.Timeout(settings.timeout_seconds, connect=10.0),
            limits=httpx.Limits(max_connections=32, max_keepalive_connections=16),
        )

    @property
    def model(self) -> str:
        return self._settings.model

    @property
    def _base(self) -> str:
        return self._settings.base_url.rstrip("/")

    @abstractmethod
    def _headers(self) -> dict[str, str]:
        """Authentication and content type, in this provider's dialect."""

    def _timeout(self, request: GenerationRequest) -> httpx.Timeout:
        """A per-request deadline, falling back to the provider's default.

        Query rewriting sets a short one: it is a latency tax on every turn,
        and a rewrite that takes as long as an answer is not worth waiting
        for.
        """
        seconds = request.timeout_seconds or self._settings.timeout_seconds
        return httpx.Timeout(seconds, connect=10.0)

    def _raise_for_status(self, response: httpx.Response) -> None:
        """Turn a failed response into the right kind of `LLMError`.

        The retryable/not distinction is the load-bearing part — see
        `fallback.py`. The body is logged and never raised: it can echo the
        prompt back, and the prompt contains retrieved document text.
        """
        if response.status_code < 400:
            return

        self._logger.warning(
            self._failure_message,
            extra={
                "provider": self.name,
                "status": response.status_code,
                "detail": response.text[:500],
            },
        )

        if response.status_code in self.retryable_statuses:
            raise LLMError(
                provider=self.name, context={"status": response.status_code}
            )
        raise LLMBadRequestError(
            provider=self.name, context={"status": response.status_code}
        )

    async def health(self) -> bool:
        """Configured and plausible. Deliberately does not call the model.

        A readiness probe that costs a token on every poll is a readiness
        probe nobody can afford to run often.
        """
        return bool(self._settings.api_key and self._settings.model)

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()
