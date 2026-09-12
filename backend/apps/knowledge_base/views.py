"""
The knowledge-base API.

Every view does the same four things, in the same order: resolve the object
and the caller's role through access.py, validate input with a serializer,
delegate the change to services.py, and present the result. Authorization is
decided here on every request; the console's hidden buttons are a courtesy.
"""

from django.conf import settings
from django.db.models import Count, Prefetch, Q, Sum
from django.http import FileResponse
from django.utils.cache import add_never_cache_headers
from rest_framework import status
from rest_framework.exceptions import NotFound
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.views import APIView

from apps.core.responses import success

from . import access, services
from .ai_client import AIServiceError, get_client, identity_for
from .constants import IN_PROGRESS, DocumentStatus, JobStatus, Messages, Role, SourceType
from .exceptions import KnowledgeBaseAPIError
from .models import Document, IngestionJob, KnowledgeBase, KnowledgeSource, WorkspaceMembership
from .overview import build_overview, document_counts
from .pagination import paginate
from .presenters import (
    document_status_counts,
    present_chunk,
    present_document,
    present_document_detail,
    present_job,
    present_knowledge_base,
    present_source,
    present_version,
    present_workspace,
)
from .serializers import (
    DocumentUpdateSerializer,
    KnowledgeBaseCreateSerializer,
    KnowledgeBaseUpdateSerializer,
    RagTestSerializer,
    SourceCreateSerializer,
    UploadSerializer,
    VersionUploadSerializer,
)
from .throttles import RagTestThrottle, SourceThrottle, UploadThrottle
from .upstream import log_test_query, snake_case, upstream_error

_DOCUMENT_ORDERING = {
    "updated_at", "-updated_at", "created_at", "-created_at", "title", "-title",
    "chunk_count", "-chunk_count", "file_size", "-file_size",
}
# Multipart framing on top of the file itself.
_MULTIPART_ALLOWANCE = 256 * 1024


class KnowledgeBaseAPIView(APIView):
    parser_classes = (JSONParser,)
    # Throttles by method, so listing documents does not spend the upload allowance.
    throttles_by_method = {}

    def get_throttles(self):
        return [throttle() for throttle in self.throttles_by_method.get(self.request.method, ())]

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        add_never_cache_headers(response)
        return response


def _refuse_oversized_body(request):
    """Refuse on the declared length, before the body is read, where that is possible."""
    try:
        length = int(request.META.get("CONTENT_LENGTH") or 0)
    except ValueError:
        length = 0
    if length > settings.KNOWLEDGE_BASE["MAX_UPLOAD_BYTES"] + _MULTIPART_ALLOWANCE:
        raise KnowledgeBaseAPIError(
            Messages.CONTENT_TOO_LARGE, code="file_too_large", status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
        )


def _with_stats(queryset):
    live = Q(documents__active_version__isnull=False)
    return queryset.annotate(
        document_total=Count("documents"),
        document_ready=Count("documents", filter=Q(documents__status=DocumentStatus.READY)),
        document_processing=Count("documents", filter=Q(documents__status__in=IN_PROGRESS)),
        document_failed=Count("documents", filter=Q(documents__status=DocumentStatus.FAILED)),
        document_live=Count("documents", filter=live),
        chunk_total=Sum("documents__chunk_count", filter=live),
    )


def _stats_of(knowledge_base):
    return document_status_counts({
        "total": knowledge_base.document_total,
        "ready": knowledge_base.document_ready,
        "processing": knowledge_base.document_processing,
        "failed": knowledge_base.document_failed,
        "live": knowledge_base.document_live,
        "chunks": knowledge_base.chunk_total,
    })


def _documents():
    return Document.objects.select_related("source", "active_version", "latest_version")


# ---------------------------------------------------------------------------
# Workspaces and knowledge bases
# ---------------------------------------------------------------------------

class WorkspaceListView(KnowledgeBaseAPIView):
    def get(self, request):
        roles = dict(
            WorkspaceMembership.objects.filter(user=request.user).values_list("workspace_id", "role")
        )
        workspaces = [
            present_workspace(workspace, Role.ADMIN if request.user.is_superuser else roles.get(workspace.pk))
            for workspace in access.accessible_workspaces(request.user).order_by("name")
        ]
        return success(Messages.LISTED, {"workspaces": workspaces})


class KnowledgeBaseListView(KnowledgeBaseAPIView):
    def get(self, request):
        workspace_id = request.query_params.get("workspace")
        if not workspace_id:
            raise KnowledgeBaseAPIError("Choose a workspace.", code="workspace_required")
        workspace = access.workspace_for(request.user, workspace_id)
        role = access.role_for(request.user, workspace)
        knowledge_bases = _with_stats(KnowledgeBase.objects.filter(workspace=workspace)).order_by("name")
        return success(Messages.LISTED, {
            "knowledge_bases": [
                present_knowledge_base(knowledge_base, role=role, stats=_stats_of(knowledge_base))
                for knowledge_base in knowledge_bases
            ],
        })

    def post(self, request):
        serializer = KnowledgeBaseCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        workspace = access.workspace_for(request.user, data.pop("workspace"), Role.ADMIN)
        knowledge_base = services.create_knowledge_base(workspace, request.user, data, request=request)
        counts, _ = document_counts(Document.objects.none())
        return success(
            Messages.KB_CREATED,
            {"knowledge_base": present_knowledge_base(
                knowledge_base, role=access.role_for(request.user, workspace), stats=counts
            )},
            status=status.HTTP_201_CREATED,
        )


class KnowledgeBaseDetailView(KnowledgeBaseAPIView):
    def get(self, request, pk):
        knowledge_base = access.knowledge_base_for(request.user, pk, allow_deleting=True)
        counts, _ = document_counts(Document.objects.filter(knowledge_base=knowledge_base))
        return success(Messages.LISTED, {
            "knowledge_base": present_knowledge_base(
                knowledge_base, role=access.role_for(request.user, knowledge_base.workspace), stats=counts
            ),
        })

    def patch(self, request, pk):
        knowledge_base = access.knowledge_base_for(request.user, pk, Role.ADMIN)
        serializer = KnowledgeBaseUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        knowledge_base = services.update_knowledge_base(
            knowledge_base, request.user, serializer.validated_data, request=request
        )
        return success(Messages.KB_UPDATED, {"knowledge_base": present_knowledge_base(knowledge_base)})

    def delete(self, request, pk):
        knowledge_base = access.knowledge_base_for(request.user, pk, Role.ADMIN)
        job = services.delete_knowledge_base(knowledge_base, request.user, request=request)
        return success(Messages.KB_DELETING, {"job": present_job(job)}, status=status.HTTP_202_ACCEPTED)


class KnowledgeBaseOverviewView(KnowledgeBaseAPIView):
    def get(self, request, pk):
        knowledge_base = access.knowledge_base_for(request.user, pk, allow_deleting=True)
        role = access.role_for(request.user, knowledge_base.workspace)
        return success(Messages.LISTED, {
            "knowledge_base": present_knowledge_base(knowledge_base, role=role),
            **build_overview(knowledge_base),
        })


# ---------------------------------------------------------------------------
# Documents
# ---------------------------------------------------------------------------

def _filter_documents(queryset, params):
    search = params.get("search", "").strip()
    if search:
        queryset = queryset.filter(
            Q(title__icontains=search) | Q(source_url__icontains=search)
            | Q(versions__original_filename__icontains=search)
        ).distinct()

    wanted = params.get("status", "")
    if wanted == "processing":
        queryset = queryset.filter(status__in=IN_PROGRESS)
    elif wanted in DocumentStatus.values:
        queryset = queryset.filter(status=wanted)

    if params.get("type"):
        queryset = queryset.filter(file_type=params["type"])
    if params.get("source") in SourceType.values:
        queryset = queryset.filter(source__source_type=params["source"])
    if params.get("category"):
        queryset = queryset.filter(category=params["category"])
    if params.get("tag"):
        queryset = queryset.filter(tags__contains=[params["tag"].lower()])

    ordering = params.get("ordering", "-updated_at")
    return queryset.order_by(ordering if ordering in _DOCUMENT_ORDERING else "-updated_at", "id")


class DocumentCollectionView(KnowledgeBaseAPIView):
    parser_classes = (MultiPartParser,)
    throttles_by_method = {"POST": (UploadThrottle,)}

    def get(self, request, pk):
        knowledge_base = access.knowledge_base_for(request.user, pk, allow_deleting=True)
        queryset = _filter_documents(_documents().filter(knowledge_base=knowledge_base), request.query_params)
        return success(Messages.LISTED, paginate(request, queryset, present_document))

    def post(self, request, pk):
        knowledge_base = access.knowledge_base_for(request.user, pk, Role.EDITOR)
        _refuse_oversized_body(request)
        serializer = UploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        uploaded = data.pop("file")
        document = services.upload_document(knowledge_base, request.user, uploaded, data, request=request)
        return success(Messages.DOCUMENT_UPLOADED, {"document": present_document(document)},
                       status=status.HTTP_201_CREATED)


class DocumentDetailView(KnowledgeBaseAPIView):
    def get(self, request, pk):
        document = access.document_for(request.user, pk)
        jobs = document.jobs.order_by("-created_at")[:10]
        return success(Messages.LISTED, {
            "document": present_document_detail(
                document, versions=document.versions.all(), jobs=jobs, created_by=document.created_by
            ),
        })

    def patch(self, request, pk):
        document = access.document_for(request.user, pk, Role.EDITOR)
        serializer = DocumentUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        document = services.update_document(document, request.user, serializer.validated_data, request=request)
        return success(Messages.DOCUMENT_UPDATED, {"document": present_document(document)})

    def delete(self, request, pk):
        document = access.document_for(request.user, pk, Role.EDITOR)
        services.delete_document(document, request.user, request=request)
        return success(Messages.DOCUMENT_DELETING, {"document": present_document(document)},
                       status=status.HTTP_202_ACCEPTED)


class DocumentActionView(KnowledgeBaseAPIView):
    operation = ""

    def post(self, request, pk):
        document = access.document_for(request.user, pk, Role.EDITOR)
        if self.operation == "reprocess":
            services.reprocess_document(document, request.user, request=request)
            message = Messages.REPROCESSING
        elif self.operation == "retry":
            services.retry_document(document, request.user, request=request)
            message = Messages.RETRYING
        else:
            message = services.cancel_document(document, request.user, request=request)
        document = _documents().get(pk=document.pk)
        return success(message, {"document": present_document(document)}, status=status.HTTP_202_ACCEPTED)


class DocumentVersionCollectionView(KnowledgeBaseAPIView):
    parser_classes = (MultiPartParser,)
    throttles_by_method = {"POST": (UploadThrottle,)}

    def post(self, request, pk):
        document = access.document_for(request.user, pk, Role.EDITOR)
        _refuse_oversized_body(request)
        serializer = VersionUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.upload_version(document, request.user, serializer.validated_data["file"], request=request)
        document = _documents().get(pk=document.pk)
        return success(Messages.VERSION_UPLOADED, {"document": present_document(document)},
                       status=status.HTTP_201_CREATED)


class DocumentVersionActivateView(KnowledgeBaseAPIView):
    def post(self, request, pk, version_pk):
        document = access.document_for(request.user, pk, Role.EDITOR)
        services.activate_version(document, version_pk, request.user, request=request)
        document = _documents().get(pk=document.pk)
        return success(Messages.VERSION_ACTIVATING, {"document": present_document(document)},
                       status=status.HTTP_202_ACCEPTED)


class DocumentChunkListView(KnowledgeBaseAPIView):
    def get(self, request, pk):
        document = access.document_for(request.user, pk)
        number = request.query_params.get("version")
        if number:
            try:
                version = document.versions.filter(number=int(number)).first()
            except ValueError:
                version = None
            if version is None:
                raise NotFound()
        else:
            version = document.active_version or document.latest_version

        if version is None:
            return success(Messages.LISTED, {
                "version": None, "results": [],
                "pagination": {"page": 1, "page_size": 25, "total": 0, "total_pages": 1},
            })

        chunks = version.chunks.order_by("index")
        search = request.query_params.get("search", "").strip()
        if search:
            chunks = chunks.filter(content__icontains=search)
        data = paginate(request, chunks, present_chunk, default_size=25)
        data["version"] = present_version(version, active_id=document.active_version_id)
        return success(Messages.LISTED, data)


class DocumentDownloadView(APIView):
    """The original file, to the members of its workspace and no one else."""

    def get(self, request, pk):
        document = access.document_for(request.user, pk)
        number = request.query_params.get("version")
        version = (
            document.versions.filter(number=int(number)).first() if number and number.isdigit()
            else document.latest_version
        )
        if version is None or not version.file:
            raise NotFound()
        try:
            handle = version.file.open("rb")
        except FileNotFoundError as exc:
            raise NotFound() from exc

        filename = version.original_filename or f"{document.title}.{version.format or 'bin'}"
        response = FileResponse(
            handle, as_attachment=True, filename=filename,
            content_type=version.mime_type or "application/octet-stream",
        )
        # Served as a download and never rendered, whatever it contains.
        response["X-Content-Type-Options"] = "nosniff"
        response["Content-Security-Policy"] = "default-src 'none'; sandbox"
        add_never_cache_headers(response)
        return response


# ---------------------------------------------------------------------------
# Sources and jobs
# ---------------------------------------------------------------------------

class SourceCollectionView(KnowledgeBaseAPIView):
    throttles_by_method = {"POST": (SourceThrottle,)}

    def get(self, request, pk):
        knowledge_base = access.knowledge_base_for(request.user, pk, allow_deleting=True)
        queryset = KnowledgeSource.objects.filter(knowledge_base=knowledge_base).prefetch_related(
            Prefetch("documents", queryset=_documents().order_by("created_at"))
        )
        wanted = request.query_params.get("type")
        if wanted in SourceType.values:
            queryset = queryset.filter(source_type=wanted)
        search = request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(Q(name__icontains=search) | Q(url__icontains=search))

        def present(source):
            documents = list(source.documents.all())
            return present_source(source, document=documents[0] if documents else None)

        return success(Messages.LISTED, paginate(request, queryset.order_by("-created_at"), present))

    def post(self, request, pk):
        knowledge_base = access.knowledge_base_for(request.user, pk, Role.EDITOR)
        serializer = SourceCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        if data["type"] == SourceType.URL:
            document = services.add_url_source(knowledge_base, request.user, data, request=request)
        else:
            document = services.add_text_source(knowledge_base, request.user, data, request=request)
        return success(
            Messages.SOURCE_ADDED,
            {"source": present_source(document.source, document=document)},
            status=status.HTTP_201_CREATED,
        )


class SourceDetailView(KnowledgeBaseAPIView):
    def delete(self, request, pk):
        source = access.source_for(request.user, pk, Role.EDITOR)
        services.delete_source(source, request.user, request=request)
        return success(Messages.SOURCE_DELETING, status=status.HTTP_202_ACCEPTED)


class SourceSyncView(KnowledgeBaseAPIView):
    throttles_by_method = {"POST": (SourceThrottle,)}

    def post(self, request, pk):
        source = access.source_for(request.user, pk, Role.EDITOR)
        job = services.sync_source(source, request.user, request=request)
        return success(Messages.SOURCE_SYNCING, {"job": present_job(job)}, status=status.HTTP_202_ACCEPTED)


class JobListView(KnowledgeBaseAPIView):
    def get(self, request, pk):
        knowledge_base = access.knowledge_base_for(request.user, pk, allow_deleting=True)
        jobs = IngestionJob.objects.filter(knowledge_base=knowledge_base)
        wanted = request.query_params.get("status", "")
        if wanted == "active":
            jobs = jobs.filter(status__in=(JobStatus.QUEUED, JobStatus.RUNNING))
        elif wanted in JobStatus.values:
            jobs = jobs.filter(status=wanted)
        return success(Messages.LISTED, paginate(request, jobs.order_by("-created_at"), present_job))


# ---------------------------------------------------------------------------
# Test RAG
# ---------------------------------------------------------------------------

class RagTestView(KnowledgeBaseAPIView):
    """The production pipeline, traced. See ai_service/app/modules/rag/diagnostics.py."""

    throttles_by_method = {"POST": (RagTestThrottle,)}

    def post(self, request):
        serializer = RagTestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        knowledge_base = access.knowledge_base_for(request.user, data["knowledge_base"])

        filters = data.get("filters") or {}
        options = data.get("options") or {}
        payload = {
            "question": data["question"],
            "history": data.get("history", []),
            # The knowledge base comes from the row the caller was authorised
            # for, never from anything they could name.
            "knowledgeBaseId": str(knowledge_base.pk),
            "filters": {
                "documentIds": [str(item) for item in filters["document_ids"]] if filters.get("document_ids") else None,
                "categories": filters.get("categories", []),
                "tags": [tag.lower() for tag in filters.get("tags", [])],
                "sourceTypes": filters.get("source_types", []),
                "language": filters.get("language") or None,
            },
            "options": {
                "generate": options.get("generate", True),
                "finalK": options.get("final_k"),
                "rerankTopK": options.get("rerank_top_k"),
                "denseTopK": options.get("dense_top_k"),
                "sparseTopK": options.get("sparse_top_k"),
            },
        }
        identity = identity_for(knowledge_base.workspace, request.user, is_admin=True)
        try:
            result = get_client().rag_test(identity, payload)
        except AIServiceError as error:
            log_test_query(knowledge_base=knowledge_base, user=request.user, error_code=error.code)
            raise upstream_error(error) from error

        log_test_query(knowledge_base=knowledge_base, user=request.user, result=result)
        return success(Messages.ANSWER, snake_case(result))
