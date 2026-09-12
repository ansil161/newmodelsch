"""Groq and xAI, which speak the same dialect.

Both expose `POST /chat/completions` with OpenAI's request and response
shape, including SSE streaming with `data: {...}` frames terminated by
`data: [DONE]`. Two classes would be the same eighty lines twice, differing
only in a base URL and a default model — so there is one implementation and
two thin subclasses that exist to carry a name.

Worth stating because the two are constantly confused, including in the
credentials handed to this project: **Groq** (`gsk_…`, api.groq.com) runs
open-weight models on custom silicon. **xAI** (`xai-…`, api.x.ai) is Grok.
Different companies, different keys, same wire format.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

import httpx

from app.core.exceptions import LLMError, LLMTimeoutError
from app.core.logging import get_logger
from app.shared.types import TokenUsage

from .base import (
    GenerationRequest,
    GenerationResult,
    StreamChunk,
)
from .http import HttpLLMProvider

logger = get_logger(__name__)


class OpenAICompatibleProvider(HttpLLMProvider):
    name = "openai_compatible"

    # Construction, the base URL, per-request timeouts, health, shutdown
    # and status-to-error mapping are shared with Gemini — see http.py.
    #
    # The retryable set is the base's plus 409, which is what this dialect
    # has always treated as retryable here and Gemini has not. Kept as it
    # was rather than unified: the two were deliberately different.
    retryable_statuses = frozenset({408, 409, 429, 500, 502, 503, 504})
    _logger = logger

    # -- public ----------------------------------------------------------

    async def generate(self, request: GenerationRequest) -> GenerationResult:
        payload = self._payload(request, stream=False)

        try:
            response = await self._client.post(
                f"{self._base}/chat/completions",
                json=payload, headers=self._headers(),
                timeout=self._timeout(request),
            )
        except httpx.TimeoutException as exc:
            raise LLMTimeoutError(provider=self.name) from exc
        except httpx.HTTPError as exc:
            raise LLMError(provider=self.name,
                           context={"cause": type(exc).__name__}) from exc

        self._raise_for_status(response)
        body = response.json()
        choice = (body.get("choices") or [{}])[0]

        return GenerationResult(
            text=(choice.get("message") or {}).get("content") or "",
            provider=self.name,
            model=body.get("model", self.model),
            usage=_extract_usage(body),
            finish_reason=str(choice.get("finish_reason") or ""),
        )

    async def stream(self, request: GenerationRequest) -> AsyncIterator[StreamChunk]:
        payload = self._payload(request, stream=True)
        # Ask for a usage frame at the end of the stream. Without it, a
        # streamed answer reports no token counts and cost tracking has a
        # hole exactly where the traffic is.
        payload["stream_options"] = {"include_usage": True}

        try:
            async with self._client.stream(
                "POST", f"{self._base}/chat/completions",
                json=payload, headers=self._headers(),
                timeout=self._timeout(request),
            ) as response:
                if response.status_code >= 400:
                    await response.aread()
                    self._raise_for_status(response)

                usage: TokenUsage | None = None
                finish = ""

                async for line in response.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if not data:
                        continue
                    if data == "[DONE]":
                        break

                    try:
                        event = json.loads(data)
                    except json.JSONDecodeError:
                        continue

                    usage = _extract_usage(event) or usage

                    choices = event.get("choices") or []
                    if not choices:
                        # A usage-only frame, which is what
                        # include_usage produces at the end.
                        continue

                    choice = choices[0]
                    delta = (choice.get("delta") or {}).get("content") or ""
                    if delta:
                        yield StreamChunk(delta=delta)
                    if choice.get("finish_reason"):
                        finish = str(choice["finish_reason"])

                yield StreamChunk(done=True, usage=usage, finish_reason=finish)

        except httpx.TimeoutException as exc:
            raise LLMTimeoutError(provider=self.name) from exc
        except httpx.HTTPError as exc:
            raise LLMError(provider=self.name,
                           context={"cause": type(exc).__name__}) from exc

    # -- internals -------------------------------------------------------

    def _headers(self) -> dict[str, str]:
        key = self._settings.api_key
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {key.get_secret_value() if key else ''}",
        }

    def _payload(self, request: GenerationRequest, *, stream: bool
                 ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "model": self.model,
            # The system prompt is an ordinary message here, and must stay
            # first — see rag/prompts.py.
            "messages": [
                {"role": message.role.value, "content": message.content}
                for message in request.messages
            ],
            "temperature": (
                request.temperature
                if request.temperature is not None
                else self._settings.temperature
            ),
            "max_tokens": (
                request.max_output_tokens or self._settings.max_output_tokens
            ),
            "stream": stream,
        }
        if request.stop:
            payload["stop"] = list(request.stop)
        return payload


class GroqProvider(OpenAICompatibleProvider):
    """Groq — api.groq.com, keys begin `gsk_`."""

    name = "groq"


class XAIProvider(OpenAICompatibleProvider):
    """xAI (Grok) — api.x.ai, keys begin `xai-`."""

    name = "xai"


def _extract_usage(body: dict[str, Any]) -> TokenUsage | None:
    usage = body.get("usage")
    if not usage:
        return None
    return TokenUsage(
        prompt_tokens=usage.get("prompt_tokens"),
        completion_tokens=usage.get("completion_tokens"),
        total_tokens=usage.get("total_tokens"),
    )
