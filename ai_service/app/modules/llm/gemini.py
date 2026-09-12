"""Google Gemini, over the REST API.

No SDK. The surface used here is two endpoints — `:generateContent` and
`:streamGenerateContent?alt=sse` — and going direct means one HTTP client
shared with every other provider, one retry policy, one timeout policy, and
cancellation that behaves the same everywhere. An SDK would add a dependency
whose streaming and cancellation semantics differ from the OpenAI-compatible
path's, which is precisely the difference `fallback.py` must not have to care
about.

Two shape differences from the OpenAI dialect, both handled here so nothing
above this file knows about them:

  * the system prompt is a top-level `systemInstruction`, not a message;
  * roles are "user" and "model" — there is no "assistant".

The API key goes in a header (`x-goog-api-key`), never the query string.
Query strings end up in access logs, proxy logs and browser history.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

import httpx

from app.core.exceptions import LLMError, LLMTimeoutError
from app.core.logging import get_logger
from app.shared.types import ChatRole, TokenUsage

from .base import (
    ChatMessage,
    GenerationRequest,
    GenerationResult,
    StreamChunk,
)
from .http import HttpLLMProvider

logger = get_logger(__name__)


class GeminiProvider(HttpLLMProvider):
    name = "gemini"

    # Construction, the base URL, per-request timeouts, health, shutdown
    # and status-to-error mapping are shared with the OpenAI-compatible
    # providers — see http.py.
    _logger = logger
    _failure_message = "Gemini request failed"

    # -- public ----------------------------------------------------------

    async def generate(self, request: GenerationRequest) -> GenerationResult:
        payload = self._payload(request)
        url = f"{self._base}/models/{self.model}:generateContent"

        try:
            response = await self._client.post(
                url, json=payload, headers=self._headers(),
                timeout=self._timeout(request),
            )
        except httpx.TimeoutException as exc:
            raise LLMTimeoutError(provider=self.name) from exc
        except httpx.HTTPError as exc:
            raise LLMError(provider=self.name,
                           context={"cause": type(exc).__name__}) from exc

        self._raise_for_status(response)
        body = response.json()

        return GenerationResult(
            text=_extract_text(body),
            provider=self.name,
            model=self.model,
            usage=_extract_usage(body),
            finish_reason=_finish_reason(body),
        )

    async def stream(self, request: GenerationRequest) -> AsyncIterator[StreamChunk]:
        payload = self._payload(request)
        url = f"{self._base}/models/{self.model}:streamGenerateContent"

        try:
            async with self._client.stream(
                "POST", url, json=payload, headers=self._headers(),
                params={"alt": "sse"}, timeout=self._timeout(request),
            ) as response:
                if response.status_code >= 400:
                    # The body has not been read yet on a streaming response.
                    await response.aread()
                    self._raise_for_status(response)

                usage: TokenUsage | None = None
                finish = ""

                async for line in response.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if not data or data == "[DONE]":
                        continue

                    try:
                        event = json.loads(data)
                    except json.JSONDecodeError:
                        # A truncated frame. Skipping one increment is better
                        # than failing a half-written answer.
                        continue

                    text = _extract_text(event)
                    if text:
                        yield StreamChunk(delta=text)

                    usage = _extract_usage(event) or usage
                    finish = _finish_reason(event) or finish

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
            # Header, not `?key=`. Query strings are logged by everything in
            # the path.
            "x-goog-api-key": key.get_secret_value() if key else "",
        }

    def _payload(self, request: GenerationRequest) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "contents": [_to_content(m) for m in request.conversation],
            "generationConfig": {
                "temperature": (
                    request.temperature
                    if request.temperature is not None
                    else self._settings.temperature
                ),
                "maxOutputTokens": (
                    request.max_output_tokens or self._settings.max_output_tokens
                ),
            },
        }

        system = request.system_prompt
        if system:
            # A top-level instruction, not a message. This is also what keeps
            # it above retrieved document text in the model's priority order
            # — see rag/prompts.py on prompt injection.
            payload["systemInstruction"] = {"parts": [{"text": system}]}

        if request.stop:
            payload["generationConfig"]["stopSequences"] = list(request.stop)

        return payload


def _to_content(message: ChatMessage) -> dict[str, Any]:
    # Gemini says "model" where everyone else says "assistant".
    role = "model" if message.role is ChatRole.ASSISTANT else "user"
    return {"role": role, "parts": [{"text": message.content}]}


def _extract_text(body: dict[str, Any]) -> str:
    candidates = body.get("candidates") or []
    if not candidates:
        return ""
    parts = (candidates[0].get("content") or {}).get("parts") or []
    return "".join(part.get("text", "") for part in parts)


def _finish_reason(body: dict[str, Any]) -> str:
    candidates = body.get("candidates") or []
    return str(candidates[0].get("finishReason", "")) if candidates else ""


def _extract_usage(body: dict[str, Any]) -> TokenUsage | None:
    usage = body.get("usageMetadata")
    if not usage:
        return None
    return TokenUsage(
        prompt_tokens=usage.get("promptTokenCount"),
        completion_tokens=usage.get("candidatesTokenCount"),
        total_tokens=usage.get("totalTokenCount"),
    )
