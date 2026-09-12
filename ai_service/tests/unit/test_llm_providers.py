"""The two HTTP providers, faked at the network boundary.

WHY AT THE HTTP BOUNDARY. A mocked client would only assert that the mock was
called. `respx` intercepts the transport, so what is asserted is the request
this service actually builds — the JSON body, the headers, the URL — which is
the thing that was wrong the last time a provider silently stopped working.

WHAT IS UNDER TEST, and why each one earns its place:

  request shape       Gemini carries the system prompt as a top-level
                      `systemInstruction` and calls the assistant "model";
                      the OpenAI dialect carries it as the first message.
                      Getting either wrong does not fail — it produces an
                      answer with the guardrails quietly missing.
  the API key header  Gemini's key goes in `x-goog-api-key`, never `?key=`,
                      because query strings are logged by everything in the
                      path.
  status mapping      `LLMError.retryable` is what decides whether
                      `fallback.py` tries the next provider. A 429 must fall
                      over; a 400 must not.
  streaming           SSE frames reassembled into deltas, `[DONE]` and
                      usage-only frames handled, a truncated frame skipped
                      rather than failing a half-written answer.
"""

from __future__ import annotations

import json

import httpx
import pytest
import respx

from app.core.config import LLMProviderSettings
from app.core.exceptions import LLMBadRequestError, LLMError, LLMTimeoutError
from app.modules.llm.base import ChatMessage, GenerationRequest
from app.modules.llm.gemini import GeminiProvider
from app.modules.llm.openai_compatible import GroqProvider
from app.shared.types import ChatRole

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"
GROQ_BASE = "https://api.groq.com/openai/v1"

GENERATE_URL = f"{GEMINI_BASE}/models/test-model:generateContent"
STREAM_URL = f"{GEMINI_BASE}/models/test-model:streamGenerateContent"
COMPLETIONS_URL = f"{GROQ_BASE}/chat/completions"


def provider_settings(**overrides: object) -> LLMProviderSettings:
    defaults: dict[str, object] = {
        "api_key": "test-key",
        "model": "test-model",
        "max_output_tokens": 512,
        "temperature": 0.2,
    }
    defaults.update(overrides)
    return LLMProviderSettings(**defaults)  # type: ignore[arg-type]


def a_request(
    *, system: str = "You are a test.", question: str = "Ping?"
) -> GenerationRequest:
    return GenerationRequest(
        messages=[
            ChatMessage(role=ChatRole.SYSTEM, content=system),
            ChatMessage(role=ChatRole.USER, content=question),
        ]
    )


def sse(*frames: str) -> str:
    return "".join(f"data: {frame}\n\n" for frame in frames)


def sent_body(route: respx.Route) -> dict:
    return json.loads(route.calls.last.request.content)


@pytest.fixture
def gemini() -> GeminiProvider:
    return GeminiProvider(provider_settings(base_url=GEMINI_BASE))


@pytest.fixture
def groq() -> GroqProvider:
    return GroqProvider(provider_settings(base_url=GROQ_BASE))


# ---------------------------------------------------------------------------
# Gemini — request shape
# ---------------------------------------------------------------------------

@respx.mock
async def test_gemini_sends_the_system_prompt_as_a_top_level_instruction(gemini):
    route = respx.post(GENERATE_URL).mock(
        return_value=httpx.Response(
            200,
            json={"candidates": [{"content": {"parts": [{"text": "Pong."}]}}]},
        )
    )

    await gemini.generate(a_request(system="Stay grounded."))

    body = sent_body(route)
    # Not a message. This is what keeps it above retrieved document text in
    # the model's priority order — see rag/prompts.py on prompt injection.
    assert body["systemInstruction"] == {"parts": [{"text": "Stay grounded."}]}
    assert all(part["role"] != "system" for part in body["contents"])


@respx.mock
async def test_gemini_calls_the_assistant_model(gemini):
    route = respx.post(GENERATE_URL).mock(
        return_value=httpx.Response(200, json={"candidates": []})
    )

    await gemini.generate(
        GenerationRequest(
            messages=[
                ChatMessage(role=ChatRole.ASSISTANT, content="Earlier."),
                ChatMessage(role=ChatRole.USER, content="And now?"),
            ]
        )
    )

    assert [part["role"] for part in sent_body(route)["contents"]] == [
        "model",
        "user",
    ]


@respx.mock
async def test_gemini_puts_the_key_in_a_header_not_the_query_string(gemini):
    route = respx.post(GENERATE_URL).mock(
        return_value=httpx.Response(200, json={"candidates": []})
    )

    await gemini.generate(a_request())

    sent = route.calls.last.request
    assert sent.headers["x-goog-api-key"] == "test-key"
    # Query strings end up in access logs, proxy logs and browser history.
    assert "key=" not in str(sent.url)


@respx.mock
async def test_gemini_reports_the_text_usage_and_finish_reason(gemini):
    respx.post(GENERATE_URL).mock(
        return_value=httpx.Response(
            200,
            json={
                "candidates": [
                    {
                        "content": {"parts": [{"text": "Half. "}, {"text": "Half."}]},
                        "finishReason": "STOP",
                    }
                ],
                "usageMetadata": {
                    "promptTokenCount": 11,
                    "candidatesTokenCount": 3,
                    "totalTokenCount": 14,
                },
            },
        )
    )

    result = await gemini.generate(a_request())

    assert result.text == "Half. Half."
    assert result.provider == "gemini"
    assert result.finish_reason == "STOP"
    assert result.usage is not None
    assert result.usage.prompt_tokens == 11
    assert result.usage.completion_tokens == 3


# ---------------------------------------------------------------------------
# Status mapping — what decides whether fallback happens
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("status", [408, 429, 500, 502, 503, 504])
@respx.mock
async def test_a_transient_gemini_status_is_retryable(gemini, status):
    respx.post(GENERATE_URL).mock(return_value=httpx.Response(status, text="busy"))

    with pytest.raises(LLMError) as raised:
        await gemini.generate(a_request())

    assert raised.value.retryable is True


@pytest.mark.parametrize("status", [400, 401, 403, 404, 422])
@respx.mock
async def test_a_rejected_gemini_request_is_not_retryable(gemini, status):
    respx.post(GENERATE_URL).mock(return_value=httpx.Response(status, text="nope"))

    with pytest.raises(LLMBadRequestError) as raised:
        await gemini.generate(a_request())

    # Another provider would reject it identically, for twice the latency.
    assert raised.value.retryable is False


@respx.mock
async def test_409_is_retryable_for_the_openai_dialect_and_not_for_gemini(
    groq, gemini
):
    respx.post(COMPLETIONS_URL).mock(return_value=httpx.Response(409))
    respx.post(GENERATE_URL).mock(return_value=httpx.Response(409))

    with pytest.raises(LLMError) as openai_error:
        await groq.generate(a_request())
    with pytest.raises(LLMError) as gemini_error:
        await gemini.generate(a_request())

    assert openai_error.value.retryable is True
    assert gemini_error.value.retryable is False


@respx.mock
async def test_a_provider_error_body_never_reaches_the_message(gemini):
    respx.post(GENERATE_URL).mock(
        return_value=httpx.Response(
            400, text="prompt was: SECRET KNOWLEDGE BASE TEXT"
        )
    )

    with pytest.raises(LLMError) as raised:
        await gemini.generate(a_request())

    assert "SECRET" not in str(raised.value)


@respx.mock
async def test_a_timeout_becomes_an_llm_timeout_error(gemini):
    respx.post(GENERATE_URL).mock(side_effect=httpx.ReadTimeout("slow"))

    with pytest.raises(LLMTimeoutError):
        await gemini.generate(a_request())


@respx.mock
async def test_a_connection_failure_is_retryable(groq):
    respx.post(COMPLETIONS_URL).mock(side_effect=httpx.ConnectError("refused"))

    with pytest.raises(LLMError) as raised:
        await groq.generate(a_request())

    assert raised.value.retryable is True


# ---------------------------------------------------------------------------
# OpenAI-compatible — request shape
# ---------------------------------------------------------------------------

@respx.mock
async def test_the_openai_dialect_sends_the_system_prompt_first(groq):
    route = respx.post(COMPLETIONS_URL).mock(
        return_value=httpx.Response(
            200, json={"choices": [{"message": {"content": "ok"}}]}
        )
    )

    await groq.generate(a_request(system="Stay grounded."))

    messages = sent_body(route)["messages"]
    assert messages[0] == {"role": "system", "content": "Stay grounded."}


@respx.mock
async def test_the_openai_dialect_asks_for_a_usage_frame_when_streaming(groq):
    route = respx.post(COMPLETIONS_URL).mock(
        return_value=httpx.Response(200, text=sse("[DONE]"))
    )

    async for _ in groq.stream(a_request()):
        pass

    body = sent_body(route)
    # Without it a streamed answer reports no token counts, and cost tracking
    # has a hole exactly where the traffic is.
    assert body["stream_options"] == {"include_usage": True}
    assert body["stream"] is True


# ---------------------------------------------------------------------------
# Streaming
# ---------------------------------------------------------------------------

@respx.mock
async def test_gemini_streams_deltas_and_a_final_usage_chunk(gemini):
    respx.post(STREAM_URL).mock(
        return_value=httpx.Response(
            200,
            text=sse(
                json.dumps(
                    {"candidates": [{"content": {"parts": [{"text": "Hello"}]}}]}
                ),
                json.dumps(
                    {
                        "candidates": [
                            {"content": {"parts": [{"text": " there"}]}}
                        ],
                        "usageMetadata": {
                            "promptTokenCount": 5,
                            "candidatesTokenCount": 2,
                        },
                    }
                ),
            ),
        )
    )

    chunks = [chunk async for chunk in gemini.stream(a_request())]

    assert "".join(chunk.delta for chunk in chunks) == "Hello there"
    assert chunks[-1].done is True
    assert chunks[-1].usage is not None
    assert chunks[-1].usage.prompt_tokens == 5


@respx.mock
async def test_a_truncated_stream_frame_is_skipped_not_fatal(gemini):
    respx.post(STREAM_URL).mock(
        return_value=httpx.Response(
            200,
            text=sse(
                json.dumps(
                    {"candidates": [{"content": {"parts": [{"text": "Good"}]}}]}
                ),
                '{"candidates": [{"content"',
                json.dumps(
                    {"candidates": [{"content": {"parts": [{"text": " end"}]}}]}
                ),
            ),
        )
    )

    chunks = [chunk async for chunk in gemini.stream(a_request())]

    # Skipping one increment beats failing a half-written answer.
    assert "".join(chunk.delta for chunk in chunks) == "Good end"


@respx.mock
async def test_the_openai_dialect_stops_at_done_and_keeps_the_usage_frame(groq):
    respx.post(COMPLETIONS_URL).mock(
        return_value=httpx.Response(
            200,
            text=sse(
                json.dumps({"choices": [{"delta": {"content": "One"}}]}),
                json.dumps(
                    {
                        "choices": [
                            {"delta": {"content": " two"}, "finish_reason": "stop"}
                        ]
                    }
                ),
                json.dumps(
                    {
                        "choices": [],
                        "usage": {"prompt_tokens": 9, "completion_tokens": 2},
                    }
                ),
                "[DONE]",
            ),
        )
    )

    chunks = [chunk async for chunk in groq.stream(a_request())]

    assert "".join(chunk.delta for chunk in chunks) == "One two"
    assert chunks[-1].finish_reason == "stop"
    assert chunks[-1].usage is not None
    assert chunks[-1].usage.prompt_tokens == 9


@respx.mock
async def test_a_streaming_error_is_raised_before_any_delta(groq):
    respx.post(COMPLETIONS_URL).mock(return_value=httpx.Response(503, text="down"))

    with pytest.raises(LLMError) as raised:
        async for _ in groq.stream(a_request()):
            pass

    # Retryable and emitted nothing, which is what lets fallback.py switch
    # providers without splicing two answers together.
    assert raised.value.retryable is True


# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------

async def test_a_shared_client_is_not_closed_by_the_provider():
    shared = httpx.AsyncClient()
    provider = GroqProvider(provider_settings(base_url=GROQ_BASE), client=shared)

    await provider.aclose()

    # The application owns the shared client; closing it here would take
    # every other provider's connection pool with it.
    assert shared.is_closed is False
    await shared.aclose()


async def test_a_provider_that_built_its_own_client_closes_it():
    provider = GroqProvider(provider_settings(base_url=GROQ_BASE))

    await provider.aclose()

    assert provider._client.is_closed is True


async def test_health_is_configuration_only_and_makes_no_call():
    configured = GroqProvider(provider_settings(base_url=GROQ_BASE))
    unconfigured = GroqProvider(provider_settings(api_key=None, base_url=GROQ_BASE))

    # No respx mock is registered: a health check that called the model would
    # fail here rather than answering.
    assert await configured.health() is True
    assert await unconfigured.health() is False
