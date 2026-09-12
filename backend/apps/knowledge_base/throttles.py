"""
Limits on the knowledge base's expensive actions.

Uploads cost storage and an ingestion run; a Test RAG question or a chat
message costs an embedding call and a model call. The AI service has its own
limits as well — these stop a runaway client before it gets that far.

Signed-in actions are limited per user. The website's public chatbot has no
users, so it is limited per client IP, bucketed the way sign-in is.
"""

from django.conf import settings
from rest_framework.throttling import SimpleRateThrottle

from apps.core.http import get_client_ip, rate_limit_key


class _KnowledgeBaseThrottle(SimpleRateThrottle):
    cache_format = "kb-throttle:%(scope)s:%(ident)s"

    def get_rate(self):
        return settings.KNOWLEDGE_BASE["THROTTLE_RATES"][self.scope]

    def get_cache_key(self, request, view):
        if not request.user.is_authenticated:
            return None
        return self.cache_format % {"scope": self.scope, "ident": request.user.pk}


class _VisitorThrottle(_KnowledgeBaseThrottle):
    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": rate_limit_key(get_client_ip(request))}


class UploadThrottle(_KnowledgeBaseThrottle):
    scope = "upload"


class SourceThrottle(_KnowledgeBaseThrottle):
    scope = "source"


class RagTestThrottle(_KnowledgeBaseThrottle):
    scope = "rag_test"


class ChatThrottle(_KnowledgeBaseThrottle):
    scope = "chat"


class PublicChatBurstThrottle(_VisitorThrottle):
    scope = "public_chat_burst"


class PublicChatSustainedThrottle(_VisitorThrottle):
    scope = "public_chat_sustained"
