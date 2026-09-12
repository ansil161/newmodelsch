"""One error shape, and a rule about what may go in it.

Mirrors the Django API's envelope so the console handles a failure from
either service identically:

    {"error": {"code": "LLM_UNAVAILABLE", "message": "..."}}

The rule: `message` is written for a person and is chosen at the raise site.
Provider response bodies, request URLs, model names, Qdrant errors, tracebacks
and API keys never reach it. They go to the log, which is where someone
debugging can see them and a user cannot.
"""

from __future__ import annotations

from typing import Any


class ErrorCode:
    INVALID_REQUEST = "INVALID_REQUEST"
    NOT_AUTHENTICATED = "NOT_AUTHENTICATED"
    FORBIDDEN = "FORBIDDEN"
    NOT_FOUND = "NOT_FOUND"
    TOO_MANY_REQUESTS = "TOO_MANY_REQUESTS"

    EMBEDDING_UNAVAILABLE = "EMBEDDING_UNAVAILABLE"
    VECTOR_STORE_UNAVAILABLE = "VECTOR_STORE_UNAVAILABLE"
    LLM_UNAVAILABLE = "LLM_UNAVAILABLE"
    LLM_TIMEOUT = "LLM_TIMEOUT"

    # Ingestion. Each names the rule that was broken, so the admin console
    # can tell someone what to do about it rather than "processing failed".
    DOCUMENT_REJECTED = "DOCUMENT_REJECTED"
    UNSUPPORTED_FILE_TYPE = "UNSUPPORTED_FILE_TYPE"
    FILE_TYPE_MISMATCH = "FILE_TYPE_MISMATCH"
    FILE_TOO_LARGE = "FILE_TOO_LARGE"
    DOCUMENT_ENCRYPTED = "DOCUMENT_ENCRYPTED"
    NO_EXTRACTABLE_TEXT = "NO_EXTRACTABLE_TEXT"
    DOCUMENT_TOO_LARGE = "DOCUMENT_TOO_LARGE"
    DOCUMENT_CORRUPT = "DOCUMENT_CORRUPT"

    URL_INVALID = "URL_INVALID"
    URL_BLOCKED = "URL_BLOCKED"
    URL_UNREACHABLE = "URL_UNREACHABLE"
    URL_FETCH_FAILED = "URL_FETCH_FAILED"
    URL_CONTENT_UNSUPPORTED = "URL_CONTENT_UNSUPPORTED"
    URL_TOO_LARGE = "URL_TOO_LARGE"
    URL_TIMEOUT = "URL_TIMEOUT"

    INTERNAL_ERROR = "INTERNAL_ERROR"


class AIServiceError(Exception):
    """Base for every failure this service describes to a caller."""

    status_code: int = 500
    code: str = ErrorCode.INTERNAL_ERROR
    # Safe to render. Deliberately vague where the truth would be a leak.
    message: str = "Something went wrong. Please try again."
    # Whether a caller retrying immediately could plausibly succeed. Drives
    # LLM fallback and worker backoff — not a cosmetic flag.
    retryable: bool = False

    def __init__(
        self,
        message: str | None = None,
        *,
        code: str | None = None,
        status_code: int | None = None,
        retryable: bool | None = None,
        context: dict[str, Any] | None = None,
    ) -> None:
        self.message = message or self.message
        self.code = code or self.code
        self.status_code = status_code or self.status_code
        if retryable is not None:
            self.retryable = retryable
        # Structured detail for the log. NEVER serialised into a response.
        self.context = context or {}
        super().__init__(self.message)

    def to_payload(self) -> dict[str, Any]:
        return {"error": {"code": self.code, "message": self.message}}


class InvalidRequestError(AIServiceError):
    status_code = 400
    code = ErrorCode.INVALID_REQUEST
    message = "The request was invalid."


class NotAuthenticatedError(AIServiceError):
    status_code = 401
    code = ErrorCode.NOT_AUTHENTICATED
    message = "Authentication is required."


class ForbiddenError(AIServiceError):
    status_code = 403
    code = ErrorCode.FORBIDDEN
    message = "You do not have access to this resource."


class RateLimitedError(AIServiceError):
    status_code = 429
    code = ErrorCode.TOO_MANY_REQUESTS
    message = "Too many requests. Please try again shortly."
    retryable = True

    def __init__(self, retry_after_seconds: int = 60, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self.retry_after_seconds = retry_after_seconds


class EmbeddingError(AIServiceError):
    status_code = 503
    code = ErrorCode.EMBEDDING_UNAVAILABLE
    message = "The assistant is temporarily unable to process text."
    retryable = True


class VectorStoreError(AIServiceError):
    status_code = 503
    code = ErrorCode.VECTOR_STORE_UNAVAILABLE
    message = "The knowledge base is temporarily unavailable."
    retryable = True


class LLMError(AIServiceError):
    """A language-model failure.

    `retryable` is the whole point of this class. A 429 or a 503 from Gemini
    is worth sending to Groq; a 400 because the prompt was malformed is a bug
    that the second provider will reject just as fast, and trying it only
    doubles the latency of failing.
    """

    status_code = 503
    code = ErrorCode.LLM_UNAVAILABLE
    message = "The assistant is temporarily unavailable. Please try again."
    retryable = True

    def __init__(self, message: str | None = None, *, provider: str = "",
                 **kwargs: Any) -> None:
        super().__init__(message, **kwargs)
        self.provider = provider


class LLMTimeoutError(LLMError):
    code = ErrorCode.LLM_TIMEOUT
    message = "The assistant took too long to respond. Please try again."
    retryable = True


class LLMBadRequestError(LLMError):
    """The provider rejected the request itself. Another provider will too."""

    status_code = 502
    code = ErrorCode.LLM_UNAVAILABLE
    retryable = False


class DocumentRejectedError(AIServiceError):
    """A document this service will not, or cannot, turn into chunks.

    Never retryable: the same bytes fail the same way every time. `code`
    names the rule that was broken — a password, a scanned PDF, a file that
    is not what its extension claims — and `message` says what to do about
    it, in words an administrator can act on.
    """

    status_code = 422
    code = ErrorCode.DOCUMENT_REJECTED
    message = "The document could not be processed."
    retryable = False


class UrlRejectedError(AIServiceError):
    """A link that could not, or may not, be fetched.

    Most are permanent — a blocked address, an unsupported content type. The
    raise site marks the transient ones (a timeout, a 503) retryable, which
    is what lets Django's worker retry those and give up on the rest.
    """

    status_code = 422
    code = ErrorCode.URL_INVALID
    message = "The link could not be fetched."
    retryable = False

