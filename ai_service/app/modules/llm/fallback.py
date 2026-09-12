"""Primary provider, then fallback — and only for the right failures.

WHEN IT FALLS OVER. Only when `LLMError.retryable` is true: a timeout, a rate
limit, a 5xx. Those say "this provider cannot serve you right now", and
another one might.

WHEN IT DOES NOT. A 400 because the prompt was malformed, a 401 because the
key is wrong, a content filter refusing the request. The second provider will
reject those just as fast, so trying it turns one failure into two and
doubles how long the user waits to be told.

STREAMING IS THE HARD PART. A fallback is only safe while nothing has been
sent to the browser. Once the first token of Gemini's answer is on the wire,
switching to Groq would splice two different answers together mid-sentence.
So `stream` will fall over on a failure *before* the first token and never
after it — after that the partial answer is finished with an error event and
the client decides whether to retry, which is the honest thing to do because
only the client knows what the user has already read.

RETRIES WITHIN A PROVIDER come first, bounded by
`max_attempts_per_provider`, with exponential backoff. Kept low on purpose:
past one retry, the fallback provider is usually faster than waiting.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator, Sequence
from dataclasses import replace

from app.core.exceptions import LLMError
from app.core.logging import get_logger

from .base import (
    GenerationRequest,
    GenerationResult,
    LLMProvider,
    StreamChunk,
)

logger = get_logger(__name__)


class FallbackLLMProvider(LLMProvider):
    """An LLMProvider that delegates to others in order.

    Being an LLMProvider itself is the point: the RAG pipeline calls
    `generate` and `stream` and never learns that more than one provider
    exists.
    """

    name = "fallback"

    def __init__(self, providers: Sequence[LLMProvider], *,
                 max_attempts_per_provider: int = 2) -> None:
        if not providers:
            raise ValueError("At least one LLM provider is required.")
        self._providers = list(providers)
        self._max_attempts = max(1, max_attempts_per_provider)

    @property
    def model(self) -> str:
        return self._providers[0].model

    @property
    def primary(self) -> LLMProvider:
        return self._providers[0]

    # -- complete responses ----------------------------------------------

    async def generate(self, request: GenerationRequest) -> GenerationResult:
        last: LLMError | None = None

        for index, provider in enumerate(self._providers):
            try:
                result = await self._attempt(provider, request)
            except LLMError as error:
                last = error
                if not error.retryable:
                    # A request this provider rejected outright. Another
                    # provider will reject it too.
                    logger.warning(
                        "LLM request rejected; not falling back",
                        extra={"provider": provider.name, "code": error.code},
                    )
                    raise
                logger.warning(
                    "LLM provider unavailable",
                    extra={"provider": provider.name,
                           "has_fallback": index < len(self._providers) - 1},
                )
                continue

            if index > 0:
                logger.info(
                    "Answered by the fallback provider",
                    extra={"provider": provider.name},
                )
            return result

        assert last is not None
        raise last

    async def _attempt(self, provider: LLMProvider,
                       request: GenerationRequest) -> GenerationResult:
        last: LLMError | None = None
        for attempt in range(1, self._max_attempts + 1):
            try:
                return await provider.generate(request)
            except LLMError as error:
                last = error
                if not error.retryable or attempt == self._max_attempts:
                    raise
                # Exponential backoff. A rate limit retried immediately is a
                # rate limit still hit.
                await asyncio.sleep(min(2.0 ** (attempt - 1), 4.0))
        assert last is not None
        raise last

    # -- streaming --------------------------------------------------------

    async def stream(self, request: GenerationRequest) -> AsyncIterator[StreamChunk]:
        last: LLMError | None = None

        for index, provider in enumerate(self._providers):
            emitted = False
            try:
                async for chunk in provider.stream(request):
                    # The moment anything reaches the caller, this provider
                    # owns the answer. See the module docstring.
                    emitted = emitted or bool(chunk.delta)
                    # Stamped here because this is the only place that knows
                    # which member of the chain served the request. Without
                    # it the pipeline reads `name` off this wrapper and
                    # reports the answer as coming from "fallback", which is
                    # useless for cost attribution and actively misleading
                    # when the primary answered.
                    yield replace(chunk, provider=provider.name, model=provider.model)
                if index > 0:
                    logger.info(
                        "Streamed by the fallback provider",
                        extra={"provider": provider.name},
                    )
                return

            except LLMError as error:
                last = error
                if emitted:
                    logger.warning(
                        "LLM stream failed after partial output; not falling back",
                        extra={"provider": provider.name, "code": error.code},
                    )
                    raise
                if not error.retryable:
                    logger.warning(
                        "LLM stream rejected; not falling back",
                        extra={"provider": provider.name, "code": error.code},
                    )
                    raise
                logger.warning(
                    "LLM stream unavailable before any output; "
                    "trying the next provider",
                    extra={"provider": provider.name},
                )
                continue

            except asyncio.CancelledError:
                # The client went away. Not a provider failure, and not
                # something to retry — let it propagate so the HTTP response
                # to the provider is closed.
                logger.info(
                    "LLM stream cancelled by the caller",
                    extra={"provider": provider.name},
                )
                raise

        assert last is not None
        raise last

    # -- lifecycle ---------------------------------------------------------

    async def health(self) -> bool:
        for provider in self._providers:
            if await provider.health():
                return True
        return False

    async def aclose(self) -> None:
        for provider in self._providers:
            await provider.aclose()
