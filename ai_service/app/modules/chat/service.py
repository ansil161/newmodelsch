"""ChatService — request in, answer (or event stream) out.

Thin by design. It converts wire types to domain types, builds the retrieval
filter from the *authenticated* caller rather than from the request body,
asks the pipeline for an answer, and converts back. Every decision about
retrieval, prompting or generation belongs to the pipeline; every decision
about who may see what belongs to the filter.

CANCELLATION. When a browser closes a streaming connection, FastAPI cancels
the task, `asyncio.CancelledError` propagates into the generator, and the
`finally` clause closes the provider's HTTP response. Without that, a
cancelled request would keep an answer generating — and billing — with
nobody reading it. It is logged rather than swallowed, because a high rate of
cancellations is a signal about latency.
"""

from __future__ import annotations

from collections.abc import AsyncIterator

from app.core.exceptions import AIServiceError
from app.core.logging import bind_context, get_logger
from app.core.security import CallerIdentity
from app.modules.llm.base import ChatMessage
from app.modules.rag.pipeline import RagAnswer, RagPipeline
from app.modules.vector_store.filters import SearchFilter
from app.shared.schemas import SourceOut, build_search_filter

from . import streaming
from .schemas import ChatMetadataOut, ChatRequest, ChatResponse

logger = get_logger(__name__)


class ChatService:
    def __init__(self, pipeline: RagPipeline) -> None:
        self._pipeline = pipeline

    # -- complete answer --------------------------------------------------

    async def answer(self, request: ChatRequest, caller: CallerIdentity
                     ) -> ChatResponse:
        bind_context(
            conversation_id=request.conversation_id,
            user_id=caller.user_id,
            tenant_id=caller.tenant_id,
        )

        prepared = await self._pipeline.prepare(
            request.message, self._history(request), self._filter(request, caller)
        )
        result = await self._pipeline.generate(prepared)
        return self._to_response(request, result)

    # -- streamed answer --------------------------------------------------

    async def stream(self, request: ChatRequest, caller: CallerIdentity
                     ) -> AsyncIterator[str]:
        """Yield encoded SSE frames.

        Errors become an `error` frame rather than an HTTP status, because by
        the time most of them can happen the response has already been sent
        with a 200 and the headers are long gone.
        """
        bind_context(
            conversation_id=request.conversation_id,
            user_id=caller.user_id,
            tenant_id=caller.tenant_id,
        )

        yield streaming.message_start(
            request.conversation_id, request.message_id
        ).encode()

        try:
            prepared = await self._pipeline.prepare(
                request.message, self._history(request),
                self._filter(request, caller),
            )

            # Sources first. Retrieval is finished and the model has not
            # started, so this is the earliest the UI can show anything —
            # typically a second or two before the first token.
            yield streaming.sources_event(
                [
                    SourceOut.of(source).model_dump(by_alias=True)
                    for source in prepared.provisional_sources
                ]
            ).encode()

            async for item in self._pipeline.generate_stream(prepared):
                if isinstance(item, RagAnswer):
                    yield streaming.message_complete(
                        self._to_response(request, item).model_dump(by_alias=True)
                    ).encode()
                elif item.delta:
                    yield streaming.token(item.delta).encode()

        except AIServiceError as error:
            logger.warning(
                "Chat stream failed",
                extra={"code": error.code, **error.context},
            )
            yield streaming.error_event(error).encode()

        except Exception as error:
            # Logged with the traceback here; the client gets the generic
            # envelope and nothing else.
            logger.exception("Unhandled error during chat streaming")
            yield streaming.error_event(error).encode()

        finally:
            # Reached on cancellation too. Closing the async generator is
            # what releases the provider's connection when a browser walks
            # away mid-answer.
            logger.debug("Chat stream closed")

    # -- internals ---------------------------------------------------------

    @staticmethod
    def _history(request: ChatRequest) -> list[ChatMessage]:
        return [
            ChatMessage(role=message.role, content=message.content)
            for message in request.history
        ]

    @staticmethod
    def _filter(request: ChatRequest, caller: CallerIdentity) -> SearchFilter:
        # Built from the caller, narrowed by the request. Never the reverse:
        # a client cannot widen its own scope by naming a document.
        return build_search_filter(
            caller,
            knowledge_base_id=request.knowledge_base_id,
            document_ids=request.document_ids,
            filters=request.filters,
        )

    @staticmethod
    def _to_response(request: ChatRequest, result: RagAnswer) -> ChatResponse:
        return ChatResponse(
            conversationId=request.conversation_id,
            messageId=request.message_id,
            answer=result.answer,
            sources=[SourceOut.of(source) for source in result.sources],
            metadata=ChatMetadataOut.of(result.metadata),
        )
