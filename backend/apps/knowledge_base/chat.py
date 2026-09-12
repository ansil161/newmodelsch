"""
The chatbot API: a complete answer, or the same answer as a stream.

Scope is decided here, from the database, never from the request:

    knowledge_base   one knowledge base the caller may view — how an
                     administrator tests one before it is enabled for chat
    workspace        every chat-enabled knowledge base in a workspace the
                     caller belongs to — the chatbot for signed-in members
    public           every chat-enabled knowledge base in the workspace named
                     by KB_PUBLIC_CHAT_WORKSPACE — the website's chatbot, for
                     visitors who are not signed in

The AI service receives the workspace id as its tenant and the resolved list
of knowledge-base ids as a filter. An empty list is refused here with a
message rather than sent: "no knowledge base is enabled" is a configuration
problem for an administrator, not a question for a model.

STREAMING. The AI service's Server-Sent Events are relayed frame by frame,
with keys converted to this API's snake_case. Nothing is buffered, so a token
reaches the browser as soon as the model produces it; a keep-alive comment is
passed through so proxies do not close a connection waiting on retrieval.
Under WSGI each open stream holds a worker thread — run gunicorn with a
threaded worker class, or ASGI, where chat traffic matters.
"""

import json
import logging

import httpx
from django.conf import settings
from django.http import StreamingHttpResponse
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from apps.core.http import get_client_ip
from apps.core.responses import success

from . import access
from .ai_client import AIServiceError, get_client, identity_for, visitor_identity
from .constants import KnowledgeBaseStatus, Messages
from .exceptions import InvalidState
from .models import KnowledgeBase, Workspace
from .serializers import ChatSerializer, PublicChatSerializer
from .throttles import ChatThrottle, PublicChatBurstThrottle, PublicChatSustainedThrottle
from .upstream import log_chat_query, snake_case, upstream_error
from .views import KnowledgeBaseAPIView

logger = logging.getLogger(__name__)


def chat_enabled_ids(workspace):
    """The knowledge bases a workspace's chatbot may search; refused when there are none."""
    ids = [
        str(pk) for pk in KnowledgeBase.objects.filter(
            workspace=workspace, status=KnowledgeBaseStatus.ACTIVE, chat_enabled=True
        ).values_list("pk", flat=True)
    ]
    if not ids:
        raise InvalidState(Messages.NO_CHAT_KNOWLEDGE, code="no_chat_knowledge")
    return ids


def resolve_scope(user, data):
    """(workspace, knowledge-base ids, the one knowledge base if exactly one was named)."""
    if data.get("knowledge_base"):
        knowledge_base = access.knowledge_base_for(user, data["knowledge_base"])
        return knowledge_base.workspace, [str(knowledge_base.pk)], knowledge_base

    workspace = access.workspace_for(user, data["workspace"])
    return workspace, chat_enabled_ids(workspace), None


def public_workspace():
    """The workspace the website's chatbot answers from, or 404 when it is switched off."""
    slug = settings.KNOWLEDGE_BASE["PUBLIC_CHAT_WORKSPACE"]
    workspace = Workspace.objects.filter(slug=slug).first() if slug else None
    if workspace is None:
        raise NotFound()
    return workspace


def chat_payload(data, knowledge_base_ids):
    return {
        "message": data["message"],
        "history": data.get("history", []),
        "conversationId": data.get("conversation_id") or None,
        "filters": {"knowledgeBaseIds": knowledge_base_ids},
    }


def open_stream(identity, payload, *, workspace, knowledge_base, user):
    """
    Start the AI service's stream and hand it to the browser.

    An error before the stream opens is raised, so it is answered as this
    API's ordinary JSON envelope; once it is open, failures travel inside it.
    """
    stream = get_client().stream_chat(identity, payload)
    try:
        lines = stream.__enter__()
    except AIServiceError as error:
        log_chat_query(workspace=workspace, knowledge_base=knowledge_base, user=user, error_code=error.code)
        raise upstream_error(error) from error

    def on_complete(result, error_code=""):
        log_chat_query(workspace=workspace, knowledge_base=knowledge_base, user=user,
                       metadata=result.get("metadata") if result else None, error_code=error_code)

    response = StreamingHttpResponse(relay(stream, lines, on_complete), content_type="text/event-stream")
    response["Cache-Control"] = "no-cache, no-transform"
    response["X-Accel-Buffering"] = "no"
    return response


class _StreamView(APIView):
    def perform_content_negotiation(self, request, force=False):
        # A browser asks for text/event-stream, which no DRF renderer offers,
        # so ordinary negotiation answers 406 before post() runs. Negotiate as
        # if nothing had been asked for: the stream is a StreamingHttpResponse
        # DRF never renders, and an error raised before it starts is rendered
        # as this API's ordinary JSON envelope.
        return super().perform_content_negotiation(request, force=True)


class ChatView(KnowledgeBaseAPIView):
    throttles_by_method = {"POST": (ChatThrottle,)}

    def post(self, request):
        serializer = ChatSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        workspace, ids, knowledge_base = resolve_scope(request.user, serializer.validated_data)

        try:
            result = get_client().chat(
                identity_for(workspace, request.user), chat_payload(serializer.validated_data, ids)
            )
        except AIServiceError as error:
            log_chat_query(workspace=workspace, knowledge_base=knowledge_base, user=request.user,
                           error_code=error.code)
            raise upstream_error(error) from error

        log_chat_query(workspace=workspace, knowledge_base=knowledge_base, user=request.user,
                       metadata=result.get("metadata"))
        return success(Messages.ANSWER, snake_case(result))


class ChatStreamView(_StreamView):
    throttle_classes = (ChatThrottle,)

    def post(self, request):
        serializer = ChatSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        workspace, ids, knowledge_base = resolve_scope(request.user, serializer.validated_data)
        return open_stream(
            identity_for(workspace, request.user), chat_payload(serializer.validated_data, ids),
            workspace=workspace, knowledge_base=knowledge_base, user=request.user,
        )


class PublicChatStreamView(_StreamView):
    """
    The website's chatbot. Anyone may ask; nobody chooses what is searched.

    No authentication runs at all — there is no session to read, so there is
    no cookie to ride along on a forged request and no CSRF check to make.
    The body carries a question and the conversation so far; anything else in
    it is ignored. Limited per IP here, and per visitor by the AI service.
    """

    authentication_classes = ()
    permission_classes = (AllowAny,)
    throttle_classes = (PublicChatBurstThrottle, PublicChatSustainedThrottle)

    def post(self, request):
        serializer = PublicChatSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        workspace = public_workspace()
        ids = chat_enabled_ids(workspace)
        return open_stream(
            visitor_identity(workspace, get_client_ip(request)), chat_payload(serializer.validated_data, ids),
            workspace=workspace, knowledge_base=None, user=None,
        )


def relay(stream, lines, on_complete):
    """Re-emit the AI service's SSE frames with snake_case keys, as they arrive."""
    event, data = None, []
    finished = False
    try:
        for line in lines:
            if line == "":
                if event is not None:
                    payload = _parse(data)
                    yield _frame(event, snake_case(payload))
                    if event == "message_complete":
                        finished = True
                        on_complete(payload)
                    elif event == "error":
                        finished = True
                        on_complete(None, str((payload.get("error") or {}).get("code", "STREAM_ERROR")))
                event, data = None, []
            elif line.startswith(":"):
                yield b": keepalive\n\n"
            elif line.startswith("event:"):
                event = line[6:].strip()
            elif line.startswith("data:"):
                data.append(line[5:].lstrip())
    except httpx.HTTPError:
        logger.warning("chat_stream_interrupted", extra={"event": "chat_stream_interrupted"})
        yield _frame("error", {"error": {"code": "ai_service_unavailable", "message": Messages.AI_UNAVAILABLE}})
        if not finished:
            on_complete(None, "STREAM_INTERRUPTED")
    finally:
        stream.__exit__(None, None, None)


def _parse(lines):
    try:
        value = json.loads("\n".join(lines) or "{}")
    except ValueError:
        return {}
    return value if isinstance(value, dict) else {}


def _frame(event, payload):
    return f"event: {event}\ndata: {json.dumps(payload, separators=(',', ':'), default=str)}\n\n".encode()
