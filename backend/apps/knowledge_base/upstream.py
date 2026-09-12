"""
Handing AI service results to the browser, and its failures too.

The AI service speaks camelCase; this API speaks snake_case, like the rest of
the backend. Keys are converted on the way through so the console reads one
convention. Values are never touched.

Its error messages are written for people and are shown as they are — they
are the most useful thing to say about why a document or a question failed.
A 5xx is different: that message describes the AI service's own trouble and
is replaced with a generic one.
"""

import re

from .ai_client import AIServiceUnavailable
from .constants import Messages, QueryKind
from .exceptions import KnowledgeBaseAPIError, ServiceUnavailable, UpstreamRejected
from .models import RagQueryLog

_BOUNDARY = re.compile(r"(?<=[a-z0-9])(?=[A-Z])")


def snake_case(value):
    if isinstance(value, dict):
        return {_snake(key): snake_case(item) for key, item in value.items()}
    if isinstance(value, list):
        return [snake_case(item) for item in value]
    return value


def _snake(key):
    return _BOUNDARY.sub("_", key).lower() if isinstance(key, str) else key


def upstream_error(error):
    if isinstance(error, AIServiceUnavailable) or error.status >= 500:
        return ServiceUnavailable(Messages.AI_UNAVAILABLE)
    if error.status == 429:
        return KnowledgeBaseAPIError(
            "The assistant is busy. Please try again in a moment.", code="throttled", status_code=429
        )
    return UpstreamRejected(error.message, code=error.code.lower())


def log_test_query(*, knowledge_base, user, result=None, error_code=""):
    result = result or {}
    timings = result.get("timings") or {}
    strategy = (result.get("trace") or {}).get("strategy") or {}
    RagQueryLog.objects.create(
        workspace=knowledge_base.workspace,
        knowledge_base=knowledge_base,
        user=user,
        kind=QueryKind.TEST,
        support=str(result.get("support") or "")[:32],
        grounded=bool(result.get("grounded")),
        retrieval_count=int(strategy.get("fusedCount") or 0),
        context_chunks=len((result.get("trace") or {}).get("context") or []),
        retrieval_ms=timings.get("retrievalMs"),
        rerank_ms=timings.get("rerankMs"),
        generation_ms=timings.get("generationMs"),
        total_ms=timings.get("totalMs"),
        provider=str(result.get("provider") or "")[:64],
        model=str(result.get("model") or "")[:128],
        error_code=error_code[:64],
    )


def log_chat_query(*, workspace, knowledge_base, user, metadata=None, error_code=""):
    metadata = metadata or {}
    RagQueryLog.objects.create(
        workspace=workspace,
        knowledge_base=knowledge_base,
        user=user,
        kind=QueryKind.CHAT,
        support=str(metadata.get("support") or "")[:32],
        grounded=bool(metadata.get("grounded")),
        retrieval_count=int(metadata.get("retrievalCount") or 0),
        context_chunks=int(metadata.get("contextChunkCount") or 0),
        retrieval_ms=metadata.get("retrievalMs"),
        rerank_ms=metadata.get("rerankMs"),
        generation_ms=metadata.get("generationMs"),
        total_ms=metadata.get("totalMs"),
        provider=str(metadata.get("provider") or "")[:64],
        model=str(metadata.get("model") or "")[:128],
        error_code=error_code[:64],
    )
