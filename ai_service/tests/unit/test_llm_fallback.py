"""Provider fallback.

The distinction under test: fall over on failures another provider could
survive, and do not on failures it could not. Getting this wrong either
doubles the time to fail on a bad request, or fails a request that a second
provider would have served.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

import pytest

from app.core.exceptions import LLMBadRequestError, LLMError, LLMTimeoutError
from app.modules.llm.base import (
    ChatMessage,
    GenerationRequest,
    GenerationResult,
    LLMProvider,
    StreamChunk,
)
from app.modules.llm.fallback import FallbackLLMProvider
from app.shared.types import ChatRole


class ScriptedProvider(LLMProvider):
    """Fails a set number of times, then succeeds."""

    def __init__(self, name: str, *, error: Exception | None = None,
                 fail_times: int | None = None,
                 fail_after_tokens: int | None = None) -> None:
        self.name = name
        self._error = error
        self._fail_times = fail_times
        self._fail_after_tokens = fail_after_tokens
        self.calls = 0

    @property
    def model(self) -> str:
        return f"{self.name}-model"

    def _should_fail(self) -> bool:
        if self._error is None:
            return False
        if self._fail_times is None:
            return True
        return self.calls <= self._fail_times

    async def generate(self, request: GenerationRequest) -> GenerationResult:
        self.calls += 1
        if self._should_fail():
            raise self._error
        return GenerationResult(text=f"answer from {self.name}",
                                provider=self.name, model=self.model)

    async def stream(self, request: GenerationRequest) -> AsyncIterator[StreamChunk]:
        self.calls += 1
        if self._fail_after_tokens is not None:
            for index in range(self._fail_after_tokens):
                yield StreamChunk(delta=f"token{index} ")
            raise self._error or LLMError(provider=self.name)
        if self._should_fail():
            raise self._error
        yield StreamChunk(delta=f"answer from {self.name}")
        yield StreamChunk(done=True)


def request() -> GenerationRequest:
    return GenerationRequest(
        messages=[ChatMessage(role=ChatRole.USER, content="hello")]
    )


# -- complete responses ----------------------------------------------------

async def test_the_primary_answers_when_it_can():
    primary = ScriptedProvider("gemini")
    fallback = ScriptedProvider("groq")

    result = await FallbackLLMProvider([primary, fallback]).generate(request())

    assert result.provider == "gemini"
    assert fallback.calls == 0


async def test_a_timeout_falls_over_to_the_second_provider():
    primary = ScriptedProvider("gemini", error=LLMTimeoutError())
    fallback = ScriptedProvider("groq")

    result = await FallbackLLMProvider(
        [primary, fallback], max_attempts_per_provider=1
    ).generate(request())

    assert result.provider == "groq"


async def test_a_rate_limit_falls_over():
    primary = ScriptedProvider(
        "gemini", error=LLMError(provider="gemini", context={"status": 429})
    )
    fallback = ScriptedProvider("groq")

    result = await FallbackLLMProvider(
        [primary, fallback], max_attempts_per_provider=1
    ).generate(request())

    assert result.provider == "groq"


async def test_a_bad_request_does_not_fall_over():
    """The rule that keeps a malformed prompt from costing two failures.

    The second provider will reject it just as fast; trying only doubles how
    long the user waits to be told.
    """
    primary = ScriptedProvider("gemini", error=LLMBadRequestError(provider="gemini"))
    fallback = ScriptedProvider("groq")

    with pytest.raises(LLMBadRequestError):
        await FallbackLLMProvider([primary, fallback]).generate(request())

    assert fallback.calls == 0


async def test_a_provider_is_retried_before_falling_over():
    primary = ScriptedProvider("gemini", error=LLMTimeoutError(), fail_times=1)
    fallback = ScriptedProvider("groq")

    result = await FallbackLLMProvider(
        [primary, fallback], max_attempts_per_provider=2
    ).generate(request())

    assert result.provider == "gemini"
    assert primary.calls == 2
    assert fallback.calls == 0


async def test_both_failing_raises_the_last_error():
    primary = ScriptedProvider("gemini", error=LLMTimeoutError())
    fallback = ScriptedProvider("groq", error=LLMError(provider="groq"))

    with pytest.raises(LLMError):
        await FallbackLLMProvider(
            [primary, fallback], max_attempts_per_provider=1
        ).generate(request())


async def test_a_single_provider_chain_still_works():
    result = await FallbackLLMProvider([ScriptedProvider("gemini")]).generate(
        request()
    )
    assert result.provider == "gemini"


def test_an_empty_chain_is_rejected():
    with pytest.raises(ValueError):
        FallbackLLMProvider([])


# -- streaming -------------------------------------------------------------

async def test_a_stream_falls_over_when_it_fails_before_any_token():
    primary = ScriptedProvider("gemini", error=LLMTimeoutError())
    fallback = ScriptedProvider("groq")

    chain = FallbackLLMProvider([primary, fallback], max_attempts_per_provider=1)
    chunks = [chunk async for chunk in chain.stream(request())]

    assert "answer from groq" in "".join(c.delta for c in chunks)


async def test_a_stream_does_not_fall_over_after_output_has_been_sent():
    """Switching mid-answer would splice two different answers together.

    The partial answer is finished with an error instead, and the client
    decides whether to retry — it is the only party that knows what the user
    has already read.
    """
    primary = ScriptedProvider(
        "gemini", error=LLMError(provider="gemini"), fail_after_tokens=3
    )
    fallback = ScriptedProvider("groq")

    chain = FallbackLLMProvider([primary, fallback], max_attempts_per_provider=1)

    received = []
    with pytest.raises(LLMError):
        async for chunk in chain.stream(request()):
            received.append(chunk.delta)

    assert len(received) == 3
    assert fallback.calls == 0


async def test_a_streamed_bad_request_does_not_fall_over():
    primary = ScriptedProvider("gemini", error=LLMBadRequestError(provider="gemini"))
    fallback = ScriptedProvider("groq")

    chain = FallbackLLMProvider([primary, fallback])
    with pytest.raises(LLMBadRequestError):
        async for _ in chain.stream(request()):
            pass

    assert fallback.calls == 0


async def test_health_is_true_when_any_provider_is_healthy():
    class Unhealthy(ScriptedProvider):
        async def health(self) -> bool:
            return False

    chain = FallbackLLMProvider([Unhealthy("gemini"), ScriptedProvider("groq")])
    assert await chain.health() is True
