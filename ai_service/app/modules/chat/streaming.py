"""The Server-Sent Events protocol for a streamed answer.

WHY SSE. The stream is one-directional, text, and over plain HTTP. WebSockets
would add a second protocol, a second auth path and a second thing for a
reverse proxy to be configured wrongly, in exchange for an upstream channel
nothing needs — cancellation is just closing the connection.

THE EVENT TYPES, in the order they occur:

    message_start     generation is beginning; carries the ids
    sources           the excerpts retrieval found, before any token. This is
                      what lets source cards render a second or two before
                      the answer starts arriving.
    token             one increment of text. `delta` is new text only, never
                      the accumulated answer — cumulative frames would make
                      every event larger than the last.
    message_complete  the finished answer, the resolved citations, timings
    error             a failure, in the same envelope as every HTTP error

Every frame is JSON with a named event type. A client can branch on the type
without parsing prose, which is the whole difference between a protocol and a
stream of strings.

KEEPALIVES. Retrieval and the first token can take several seconds, and a
proxy that sees no bytes will close an idle connection. A comment frame
(`: keepalive`) is sent periodically while nothing else is; SSE ignores
comment lines, so the client never sees them.
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any

from app.core.exceptions import AIServiceError, ErrorCode
from app.core.logging import get_logger

logger = get_logger(__name__)

KEEPALIVE_INTERVAL_SECONDS = 15.0


class EventType:
    MESSAGE_START = "message_start"
    SOURCES = "sources"
    TOKEN = "token"  # noqa: S105 — an event name, not a credential
    MESSAGE_COMPLETE = "message_complete"
    ERROR = "error"


@dataclass(frozen=True)
class SSEEvent:
    event: str
    data: dict[str, Any]

    def encode(self) -> str:
        # `separators` keeps frames compact; a token event is mostly overhead
        # otherwise. json.dumps also guarantees no raw newline reaches the
        # data field, which would terminate the frame early.
        payload = json.dumps(self.data, separators=(",", ":"), default=str)
        return f"event: {self.event}\ndata: {payload}\n\n"


def keepalive() -> str:
    return ": keepalive\n\n"


def message_start(conversation_id: str | None, message_id: str | None) -> SSEEvent:
    return SSEEvent(
        EventType.MESSAGE_START,
        {"conversationId": conversation_id, "messageId": message_id},
    )


def sources_event(sources: list[dict[str, Any]]) -> SSEEvent:
    return SSEEvent(EventType.SOURCES, {"sources": sources})


def token(delta: str) -> SSEEvent:
    return SSEEvent(EventType.TOKEN, {"delta": delta})


def message_complete(payload: dict[str, Any]) -> SSEEvent:
    return SSEEvent(EventType.MESSAGE_COMPLETE, payload)


def error_event(exc: Exception) -> SSEEvent:
    """A failure, in the same shape as an HTTP error response.

    An unrecognised exception becomes a generic INTERNAL_ERROR. Nothing
    derived from the original message reaches the client — the traceback is
    already in the log by the time this is called.
    """
    if isinstance(exc, AIServiceError):
        return SSEEvent(EventType.ERROR, exc.to_payload())
    return SSEEvent(
        EventType.ERROR,
        {
            "error": {
                "code": ErrorCode.INTERNAL_ERROR,
                "message": "Something went wrong. Please try again.",
            }
        },
    )


async def with_keepalive(
    events: AsyncIterator[str], *, interval: float = KEEPALIVE_INTERVAL_SECONDS
) -> AsyncIterator[str]:
    """Interleave keepalive comments into a stream that may go quiet.

    Wrapping the source iterator in a task lets this wait on *either* the
    next event or the timer, which a plain `async for` cannot do.
    """
    iterator = events.__aiter__()
    pending: asyncio.Task[str] | None = None

    try:
        while True:
            if pending is None:
                pending = asyncio.ensure_future(_next(iterator))

            done, _ = await asyncio.wait({pending}, timeout=interval)
            if not done:
                yield keepalive()
                continue

            try:
                chunk = pending.result()
            except StopAsyncIteration:
                return
            finally:
                pending = None

            yield chunk
    finally:
        # The consumer went away — cancel the outstanding read so the
        # upstream generator is closed rather than left waiting on a socket.
        if pending is not None and not pending.done():
            pending.cancel()
        aclose = getattr(iterator, "aclose", None)
        if aclose is not None:
            await aclose()


async def _next(iterator: AsyncIterator[str]) -> str:
    return await iterator.__anext__()
