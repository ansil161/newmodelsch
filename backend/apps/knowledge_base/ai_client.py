"""
The one way this backend talks to the AI service.

Server to server, with a shared bearer token — the browser never reaches the
AI service and never holds anything that could. Every call carries the
identity the AI service is to act for:

    X-Jaaz-Tenant-Id   the workspace id. The AI service builds every vector
                       filter and every write from this header, so it is the
                       isolation boundary, and it comes from the database
                       row being acted on — never from a request body.
    X-Jaaz-User-Id     who asked, for the AI service's logs and rate limits
    X-Jaaz-Is-Admin    whether the caller may see retrieval diagnostics

Errors come back as AIServiceError with the AI service's code and message.
Those messages are written by the AI service for administrators and are safe
to show; 5xx responses and transport failures become AIServiceUnavailable,
which is retryable and carries a generic message.
"""

import json
import logging
import uuid
from contextlib import contextmanager
from dataclasses import dataclass
from functools import lru_cache

import httpx
from django.conf import settings
from django.utils.crypto import salted_hmac

from apps.core.http import rate_limit_key

logger = logging.getLogger(__name__)

_RETRYABLE_STATUS = frozenset({408, 425, 429, 500, 502, 503, 504})
_RETRYABLE_CODES = frozenset({
    "EMBEDDING_UNAVAILABLE", "VECTOR_STORE_UNAVAILABLE", "LLM_UNAVAILABLE", "LLM_TIMEOUT",
    "TOO_MANY_REQUESTS", "URL_TIMEOUT", "URL_UNREACHABLE",
})


class AIServiceError(Exception):
    def __init__(self, message, *, code="AI_SERVICE_ERROR", status=502, retryable=False):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status = status
        self.retryable = retryable


class AIServiceUnavailable(AIServiceError):
    def __init__(self, message="The AI service could not be reached.", *, code="AI_SERVICE_UNAVAILABLE"):
        super().__init__(message, code=code, status=503, retryable=True)


@dataclass(frozen=True)
class Identity:
    tenant_id: str
    user_id: str
    is_admin: bool = False

    def headers(self):
        return {
            "X-Jaaz-Tenant-Id": self.tenant_id,
            "X-Jaaz-User-Id": self.user_id,
            "X-Jaaz-Is-Admin": "true" if self.is_admin else "false",
        }


def identity_for(workspace, user=None, *, is_admin=False):
    user_id = f"user:{user.pk}" if user is not None and user.pk else "system:ingestion"
    return Identity(tenant_id=str(workspace.pk), user_id=user_id, is_admin=is_admin)


def visitor_identity(workspace, ip):
    """
    A website visitor who is not signed in. The AI service logs and rate
    limits per user id, so each visitor gets their own: a keyed hash of their
    address, stable for as long as the address is, and never the address.
    """
    digest = salted_hmac("apps.knowledge_base.visitor", rate_limit_key(ip)).hexdigest()[:20]
    return Identity(tenant_id=str(workspace.pk), user_id=f"visitor:{digest}")


class AIServiceClient:
    def __init__(self, base_url, token, *, timeout=30.0, ingest_timeout=600.0, chat_timeout=120.0, transport=None):
        self._timeout = timeout
        self._ingest_timeout = ingest_timeout
        self._chat_timeout = chat_timeout
        headers = {"Accept": "application/json", "User-Agent": "nmhs-backend"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        self._client = httpx.Client(
            base_url=base_url.rstrip("/"),
            headers=headers,
            timeout=httpx.Timeout(timeout, connect=10.0),
            transport=transport,
            # Never an environment proxy: the token must not be sent anywhere
            # but the configured AI service.
            trust_env=False,
        )

    # -- ingestion ---------------------------------------------------------

    def extract_file(self, identity, *, filename, content_type, data, request_id=None):
        return self._json(
            "POST", "/api/v1/ingestion/extract", identity,
            timeout=self._ingest_timeout, request_id=request_id,
            files={"file": (filename, data, content_type or "application/octet-stream")},
            data={"filename": filename},
        )

    def extract_url(self, identity, url, *, request_id=None):
        return self._json("POST", "/api/v1/ingestion/extract-url", identity,
                          timeout=self._ingest_timeout, request_id=request_id, json={"url": url})

    def index_document(self, identity, payload, *, request_id=None):
        return self._json("POST", "/api/v1/knowledge-base/documents", identity,
                          timeout=self._ingest_timeout, request_id=request_id, json=payload)

    def delete_document(self, identity, document_id, *, request_id=None):
        return self._json("DELETE", f"/api/v1/knowledge-base/documents/{document_id}", identity,
                          request_id=request_id)

    def delete_knowledge_base(self, identity, knowledge_base_id, *, request_id=None):
        return self._json("DELETE", f"/api/v1/knowledge-base/bases/{knowledge_base_id}", identity,
                          request_id=request_id)

    def index_stats(self, identity, *, knowledge_base_id, timeout=None):
        body = self._json("GET", "/api/v1/knowledge-base/stats", identity,
                          timeout=timeout, params={"knowledgeBaseId": str(knowledge_base_id)})
        return int(body.get("points", 0))

    # -- retrieval and chat ------------------------------------------------

    def rag_test(self, identity, payload):
        return self._json("POST", "/api/v1/rag/test", identity, timeout=self._chat_timeout, json=payload)

    def chat(self, identity, payload):
        return self._json("POST", "/api/v1/chat", identity, timeout=self._chat_timeout, json=payload)

    @contextmanager
    def stream_chat(self, identity, payload):
        """
        The SSE stream, as an iterator of text lines.

        Errors that happen before the stream opens raise here, so the view
        can answer with a proper HTTP status. Once it is open, the AI service
        reports failures as `error` events inside the stream.
        """
        headers = {**identity.headers(), "X-Request-ID": uuid.uuid4().hex, "Accept": "text/event-stream"}
        try:
            with self._client.stream(
                "POST", "/api/v1/chat/stream", json=payload, headers=headers,
                timeout=httpx.Timeout(self._chat_timeout, connect=10.0),
            ) as response:
                if response.status_code >= 400:
                    response.read()
                    raise _error_from(response)
                yield response.iter_lines()
        except httpx.TransportError as exc:
            logger.warning("ai_service_unreachable", extra={"event": "ai_service_unreachable", "error": type(exc).__name__})
            raise AIServiceUnavailable() from exc

    def health(self):
        try:
            response = self._client.get("/health/ready", timeout=3.0)
        except httpx.TransportError:
            return False
        return response.status_code == 200

    def close(self):
        self._client.close()

    # -- internals ----------------------------------------------------------

    def _json(self, method, path, identity, *, timeout=None, request_id=None, **kwargs):
        headers = {**identity.headers(), "X-Request-ID": request_id or uuid.uuid4().hex}
        try:
            response = self._client.request(
                method, path, headers=headers,
                timeout=httpx.Timeout(timeout or self._timeout, connect=10.0), **kwargs,
            )
        except httpx.TransportError as exc:
            logger.warning(
                "ai_service_unreachable",
                extra={"event": "ai_service_unreachable", "path": path, "error": type(exc).__name__},
            )
            raise AIServiceUnavailable() from exc

        if response.status_code >= 400:
            raise _error_from(response)
        try:
            return response.json()
        except ValueError as exc:
            raise AIServiceUnavailable("The AI service returned an unreadable response.") from exc


def _error_from(response):
    code, message = "AI_SERVICE_ERROR", "The AI service could not complete the request."
    try:
        error = response.json().get("error") or {}
        code = str(error.get("code") or code)
        message = str(error.get("message") or message)
    except (ValueError, AttributeError, json.JSONDecodeError):
        pass

    status = response.status_code
    retryable = status in _RETRYABLE_STATUS or code in _RETRYABLE_CODES
    logger.warning(
        "ai_service_error",
        extra={"event": "ai_service_error", "status": status, "code": code, "retryable": retryable},
    )
    if status >= 500 and code in ("AI_SERVICE_ERROR", "INTERNAL_ERROR"):
        return AIServiceUnavailable(code=code)
    return AIServiceError(message, code=code, status=status, retryable=retryable)


@lru_cache(maxsize=1)
def get_client():
    """The process-wide client: one connection pool, built on first use."""
    config = settings.KNOWLEDGE_BASE
    return AIServiceClient(
        config["AI_SERVICE_URL"],
        config["AI_SERVICE_TOKEN"],
        timeout=config["AI_SERVICE_TIMEOUT"],
        ingest_timeout=config["INGEST_TIMEOUT"],
        chat_timeout=config["CHAT_TIMEOUT"],
    )
