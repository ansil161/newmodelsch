"""Chat endpoints.

Two routes, one pipeline. `/chat` returns a complete answer; `/chat/stream`
returns the same thing as SSE. They share `ChatService` entirely — the only
difference is how the result is serialised, which is the point of splitting
`prepare` from `generate` in the pipeline.

No business logic lives here. A route validates, delegates, and returns.
"""

from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from app.api.dependencies import ChatCallerDep, ResourcesDep
from app.core.logging import get_logger
from app.modules.chat.schemas import ChatRequest, ChatResponse
from app.modules.chat.streaming import with_keepalive

logger = get_logger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("", response_model=ChatResponse, response_model_by_alias=True)
async def chat(
    payload: ChatRequest, caller: ChatCallerDep, resources: ResourcesDep
) -> ChatResponse:
    """A complete answer.

    Simpler for callers that cannot consume a stream — an evaluation run, a
    scheduled report, another service. The user-facing path uses the
    streaming route.
    """
    return await resources.chat.answer(payload, caller)


@router.post("/stream")
async def chat_stream(
    payload: ChatRequest,
    caller: ChatCallerDep,
    resources: ResourcesDep,
    request: Request,
) -> StreamingResponse:
    """The same answer, streamed as Server-Sent Events.

    The headers matter as much as the body:

      * `Cache-Control: no-cache` — nothing about a generated answer is
        cacheable, and a proxy that buffers one destroys the streaming.
      * `X-Accel-Buffering: no` — nginx buffers proxied responses by default,
        which turns a token stream into one delivery at the end. This is the
        header that turns it off, and forgetting it is the single most common
        reason SSE "does not work in production but works locally".
      * `Connection: keep-alive` — kept explicit for the same class of
        intermediary.
    """
    events = with_keepalive(resources.chat.stream(payload, caller))

    return StreamingResponse(
        events,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
