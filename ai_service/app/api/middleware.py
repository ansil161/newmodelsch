"""Request-scoped context, timing, and the error boundary.

Every request gets an id — reused from `X-Request-ID` if the caller sent one,
so a trace started in Django continues here rather than restarting. It is
bound into the logging context, returned in the response header, and appears
on every log line the request produces.

The error boundary is the last thing between an exception and a response
body. It exists so that no code path anywhere in the service can accidentally
return a traceback: an unhandled exception becomes a logged traceback and a
generic envelope, always.
"""

from __future__ import annotations

import uuid
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse

from app.core.exceptions import AIServiceError, ErrorCode
from app.core.logging import Stopwatch, bind_context, get_logger, request_context

logger = get_logger(__name__)

REQUEST_ID_HEADER = "X-Request-ID"

# Health checks are polled every few seconds by orchestrators. Logging them
# buries everything that matters.
_QUIET_PATHS = frozenset({"/health", "/health/live", "/health/ready"})


def install(app: FastAPI) -> None:
    @app.middleware("http")
    async def context_and_timing(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        incoming = request.headers.get(REQUEST_ID_HEADER)
        quiet = request.url.path in _QUIET_PATHS

        with request_context(request_id=incoming or uuid.uuid4().hex) as request_id:
            bind_context(path=request.url.path, method=request.method)

            with Stopwatch() as timer:
                try:
                    response = await call_next(request)
                except AIServiceError as error:
                    logger.warning(
                        "Request failed",
                        extra={"code": error.code, "status": error.status_code,
                               **error.context},
                    )
                    response = _error_response(error)
                except Exception:
                    # The traceback goes here. It never goes to the client.
                    logger.exception("Unhandled error")
                    response = JSONResponse(
                        status_code=500,
                        content={
                            "error": {
                                "code": ErrorCode.INTERNAL_ERROR,
                                "message": (
                                    "Something went wrong. Please try again."
                                ),
                            }
                        },
                    )

            response.headers[REQUEST_ID_HEADER] = request_id
            if not quiet:
                logger.info(
                    "Request complete",
                    extra={"status": response.status_code,
                           "duration_ms": timer.milliseconds},
                )
            return response


def _error_response(error: AIServiceError) -> JSONResponse:
    headers = {}
    retry_after = getattr(error, "retry_after_seconds", None)
    if retry_after is not None:
        headers["Retry-After"] = str(retry_after)
    return JSONResponse(
        status_code=error.status_code, content=error.to_payload(), headers=headers
    )


def install_exception_handlers(app: FastAPI) -> None:
    """Handlers for exceptions raised inside a route.

    The middleware above catches what escapes the router; these catch what is
    raised within it, where FastAPI has already begun handling the request.
    Both are needed, and both produce the same envelope.
    """

    @app.exception_handler(AIServiceError)
    async def _handle_service_error(
        _request: Request, error: AIServiceError
    ) -> JSONResponse:
        logger.warning(
            "Request failed",
            extra={"code": error.code, "status": error.status_code, **error.context},
        )
        return _error_response(error)
