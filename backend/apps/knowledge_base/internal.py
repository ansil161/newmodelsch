"""
Internal endpoints, for the AI service's re-index worker. Not for browsers.

    GET /api/internal/knowledge-base/documents/
    GET /api/internal/knowledge-base/documents/<id>/chunks/

After an embedding model change every stored vector is incomparable with new
queries, and the AI service's `reindex` job re-embeds the whole collection.
It reads what to embed from here — this database is the system of record for
chunks — so a re-embed never re-parses a file.

The trust runs the other way from the rest of the API: the AI service holds
KB_INTERNAL_API_TOKEN and presents it as a bearer token, compared in constant
time. With no token configured the endpoints refuse every request. The tenant
is the X-Jaaz-Tenant-Id header, and only that workspace's live documents are
returned. The response format is the one app/workers/jobs/reindex.py reads,
not the envelope the console's endpoints use.
"""

import hmac
import math

from django.conf import settings
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed, NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .access import parse_uuid
from .constants import DocumentStatus, KnowledgeBaseStatus
from .models import Document, Workspace

_MAX_PAGE_SIZE = 100


class ServicePrincipal:
    """The AI service, as a caller. Holds no user and no role."""

    is_authenticated = True
    is_active = True
    is_superuser = False
    pk = None


class ServiceTokenAuthentication(BaseAuthentication):
    def authenticate(self, request):
        expected = settings.KNOWLEDGE_BASE["INTERNAL_API_TOKEN"]
        header = request.META.get("HTTP_AUTHORIZATION", "")
        if not expected or not header.startswith("Bearer "):
            raise AuthenticationFailed()
        if not hmac.compare_digest(header[7:].strip().encode(), expected.encode()):
            raise AuthenticationFailed()
        return ServicePrincipal(), None

    def authenticate_header(self, request):
        return 'Bearer realm="internal"'


class InternalView(APIView):
    authentication_classes = (ServiceTokenAuthentication,)
    permission_classes = (IsAuthenticated,)
    throttle_classes = ()

    def workspace(self, request):
        identifier = parse_uuid(request.META.get("HTTP_X_JAAZ_TENANT_ID"))
        workspace = Workspace.objects.filter(pk=identifier).first() if identifier else None
        if workspace is None:
            raise NotFound()
        return workspace

    def live_documents(self, workspace):
        return Document.objects.filter(
            knowledge_base__workspace=workspace,
            knowledge_base__status=KnowledgeBaseStatus.ACTIVE,
            status=DocumentStatus.READY,
            active_version__isnull=False,
        ).select_related("active_version", "source")


class InternalDocumentListView(InternalView):
    def get(self, request):
        documents = self.live_documents(self.workspace(request)).order_by("created_at", "id")
        try:
            size = max(1, min(int(request.query_params.get("pageSize", 25)), _MAX_PAGE_SIZE))
            page = max(1, int(request.query_params.get("page", 1)))
        except ValueError:
            size, page = 25, 1
        total = documents.count()
        pages = max(1, math.ceil(total / size))
        return Response({
            "results": [
                {
                    "id": str(document.pk),
                    "name": document.title,
                    "contentType": document.active_version.format or document.file_type,
                    "knowledgeBaseId": str(document.knowledge_base_id),
                    "language": document.language,
                    "documentVersion": document.active_version.number,
                    "sourceType": document.source.source_type,
                    "category": document.category or None,
                    "tags": document.tags,
                    "sourceUrl": document.source_url or None,
                }
                for document in documents[(page - 1) * size: page * size]
            ],
            "meta": {"page": page, "pageSize": size, "total": total, "totalPages": pages},
        })


class InternalDocumentChunksView(InternalView):
    def get(self, request, pk):
        document = self.live_documents(self.workspace(request)).filter(pk=pk).first()
        if document is None:
            raise NotFound()
        return Response({
            "results": [
                {
                    "id": str(chunk.pk),
                    "chunkIndex": chunk.index,
                    "content": chunk.content,
                    "tokenCount": chunk.token_count,
                    "metadata": {
                        "page": chunk.page,
                        "pages": list(chunk.pages),
                        "heading": chunk.heading or None,
                        "section": chunk.section or None,
                    },
                }
                for chunk in document.active_version.chunks.order_by("index")
            ],
        })
