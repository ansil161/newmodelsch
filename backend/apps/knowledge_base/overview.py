"""
The knowledge-base dashboard: counts, health, activity.

HEALTH IS A COMPARISON, NOT A PING. The AI service reports how many vectors
it holds for the knowledge base; this database knows how many chunks its live
documents recorded. Equal means the index and the system of record agree
about what is searchable. Unequal means they do not — a failed delete, an
interrupted write, a collection reset — and the answer to "why is the
assistant citing something we removed" starts there. The check is cached for
half a minute so a dashboard left open does not poll the AI service.
"""

from datetime import timedelta

from django.core.cache import cache
from django.db.models import Avg, Count, Max, Q, Sum
from django.utils import timezone

from .ai_client import AIServiceError, get_client, identity_for
from .constants import ACTIVE_JOB_STATUSES, IN_PROGRESS, DocumentStatus
from .jobs.runner import health_cache_key
from .models import AuditLog, Document, IngestionJob, KnowledgeSource, RagQueryLog
from .presenters import document_status_counts, present_audit, present_document

_HEALTH_TTL_SECONDS = 30
_HEALTH_TIMEOUT_SECONDS = 3.0


def document_counts(queryset):
    """Status counts for a queryset of documents, in one query."""
    live = Q(active_version__isnull=False)
    aggregate = queryset.aggregate(
        total=Count("id"),
        ready=Count("id", filter=Q(status=DocumentStatus.READY)),
        processing=Count("id", filter=Q(status__in=IN_PROGRESS)),
        failed=Count("id", filter=Q(status=DocumentStatus.FAILED)),
        deleting=Count("id", filter=Q(status=DocumentStatus.DELETING)),
        live=Count("id", filter=live),
        chunks=Sum("chunk_count", filter=live),
        last_indexed_at=Max("indexed_at"),
    )
    return document_status_counts(aggregate), aggregate["last_indexed_at"]


def build_overview(knowledge_base):
    documents = Document.objects.filter(knowledge_base=knowledge_base)
    counts, last_indexed_at = document_counts(documents)

    sources = dict(
        KnowledgeSource.objects.filter(knowledge_base=knowledge_base)
        .values_list("source_type")
        .annotate(total=Count("id"))
    )

    since = timezone.now() - timedelta(days=7)
    queries = RagQueryLog.objects.filter(knowledge_base=knowledge_base, created_at__gte=since).aggregate(
        total=Count("id"),
        average_ms=Avg("total_ms"),
        supported=Count("id", filter=Q(support="SUPPORTED")),
        partial=Count("id", filter=Q(support="PARTIALLY_SUPPORTED")),
        insufficient=Count("id", filter=Q(support="INSUFFICIENT_CONTEXT")),
        errors=Count("id", filter=~Q(error_code="")),
    )

    recent_failures = (
        documents.filter(status=DocumentStatus.FAILED)
        .select_related("source", "active_version", "latest_version")
        .order_by("-updated_at")[:5]
    )
    activity = (
        AuditLog.objects.filter(knowledge_base_id_ref=knowledge_base.pk).select_related("actor")[:10]
    )

    return {
        "counts": counts,
        "sources": {"total": sum(sources.values()), "by_type": sources},
        "last_ingestion_at": last_indexed_at,
        "active_jobs": IngestionJob.objects.filter(
            knowledge_base=knowledge_base, status__in=ACTIVE_JOB_STATUSES
        ).count(),
        "health": index_health(knowledge_base, expected_points=counts["chunks"], failed=counts["failed"]),
        "queries": {
            "period_days": 7,
            "total": queries["total"],
            "average_ms": round(queries["average_ms"]) if queries["average_ms"] is not None else None,
            "supported": queries["supported"],
            "partially_supported": queries["partial"],
            "insufficient_context": queries["insufficient"],
            "errors": queries["errors"],
        },
        "recent_failures": [present_document(document) for document in recent_failures],
        "recent_activity": [present_audit(entry) for entry in activity],
    }


def index_health(knowledge_base, *, expected_points, failed=0):
    cached = cache.get(health_cache_key(knowledge_base.pk))
    if cached is None:
        try:
            points = get_client().index_stats(
                identity_for(knowledge_base.workspace), knowledge_base_id=knowledge_base.pk,
                timeout=_HEALTH_TIMEOUT_SECONDS,
            )
        except AIServiceError:
            points = None
        cached = {"points": points, "checked_at": timezone.now().isoformat()}
        cache.set(health_cache_key(knowledge_base.pk), cached, _HEALTH_TTL_SECONDS)

    points = cached["points"]
    if points is None:
        status, message = "unavailable", "The AI service could not be reached, so the index could not be checked."
    elif points != expected_points:
        status = "degraded"
        message = (
            f"The search index holds {points:,} passages but {expected_points:,} were recorded. "
            "Reprocessing the affected documents will bring them back into line."
        )
    elif expected_points == 0:
        status, message = "empty", "Nothing has been indexed yet."
    elif failed:
        status, message = "attention", f"{failed} document(s) failed to process and are not searchable."
    else:
        status, message = "healthy", "Every live document is indexed and searchable."

    return {
        "status": status,
        "message": message,
        "indexed_points": points,
        "expected_points": expected_points,
        "checked_at": cached["checked_at"],
    }
