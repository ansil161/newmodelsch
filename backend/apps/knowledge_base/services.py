"""
Everything an administrator can do to a knowledge base, as functions.

Views validate input and resolve permissions; these change state. Each one
checks that the action makes sense for the object's current state, writes
its rows in one transaction, queues whatever background work follows, and
records an audit entry — so a view is three lines and the rules live in one
place.
"""

from pathlib import PurePosixPath

from django.core.files.base import ContentFile
from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound

from . import audit, scanning, validators
from .constants import (
    ACTIVE_JOB_STATUSES,
    IN_PROGRESS,
    WRITING_KINDS,
    DocumentStatus,
    JobKind,
    JobStatus,
    KnowledgeBaseStatus,
    Messages,
    SourceType,
)
from .exceptions import DuplicateDocument, InvalidState
from .jobs import queue
from .jobs.runner import DELETE_FAILED
from .models import Document, DocumentVersion, IngestionJob, KnowledgeBase, KnowledgeSource
from .storage import get_storage

# Changing any of these changes what a retrieval filter or a citation says
# about a live document, so its vectors are rewritten.
_INDEXED_FIELDS = ("title", "category", "tags", "language")


# ---------------------------------------------------------------------------
# Knowledge bases
# ---------------------------------------------------------------------------

def create_knowledge_base(workspace, user, data, *, request):
    try:
        with transaction.atomic():
            knowledge_base = KnowledgeBase.objects.create(
                workspace=workspace, created_by=user, updated_by=user, **data
            )
    except IntegrityError as exc:
        raise InvalidState(Messages.DUPLICATE_NAME, code="duplicate_name") from exc
    audit.record("knowledge_base.created", request=request, target=knowledge_base)
    return knowledge_base


def update_knowledge_base(knowledge_base, user, data, *, request):
    for field, value in data.items():
        setattr(knowledge_base, field, value)
    knowledge_base.updated_by = user
    try:
        with transaction.atomic():
            knowledge_base.save()
    except IntegrityError as exc:
        raise InvalidState(Messages.DUPLICATE_NAME, code="duplicate_name") from exc
    audit.record("knowledge_base.updated", request=request, target=knowledge_base, fields=sorted(data))
    return knowledge_base


def delete_knowledge_base(knowledge_base, user, *, request):
    # Documents keep their own statuses: if the AI service refuses the
    # deletion, the knowledge base comes back exactly as it was.
    with transaction.atomic():
        knowledge_base.status = KnowledgeBaseStatus.DELETING
        knowledge_base.updated_by = user
        knowledge_base.save(update_fields=["status", "updated_by", "updated_at"])
        IngestionJob.objects.filter(knowledge_base=knowledge_base, status=JobStatus.RUNNING).update(
            cancel_requested=True
        )
        job = queue.enqueue(
            JobKind.DELETE_KNOWLEDGE_BASE, workspace=knowledge_base.workspace, knowledge_base=knowledge_base,
            created_by=user, payload={"knowledge_base_name": knowledge_base.name},
        )
    audit.record("knowledge_base.deleted", request=request, target=knowledge_base)
    return job


# ---------------------------------------------------------------------------
# Adding documents
# ---------------------------------------------------------------------------

def upload_document(knowledge_base, user, uploaded, metadata, *, request):
    file_format = validators.validate_upload(uploaded)
    digest = validators.checksum(uploaded)
    _refuse_duplicate_file(knowledge_base, digest)
    scanning.scan_upload(uploaded)

    filename = validators.display_filename(uploaded.name)
    title = metadata.get("title") or PurePosixPath(filename).stem or filename
    return _create_document(
        knowledge_base, user, request=request,
        source=dict(source_type=SourceType.FILE, name=filename),
        document=dict(title=title, file_type=file_format, file_size=uploaded.size, **_document_fields(metadata, knowledge_base)),
        version=dict(original_filename=filename, mime_type=_mime(uploaded, file_format), file_size=uploaded.size, checksum=digest),
        file=uploaded,
        payload={"auto_language": not metadata.get("language")},
        action="document.uploaded",
    )


def add_url_source(knowledge_base, user, data, *, request):
    url = validators.validate_source_url(data["url"])
    existing = KnowledgeSource.objects.filter(knowledge_base=knowledge_base, source_type=SourceType.URL, url=url).first()
    if existing is not None:
        document = existing.documents.exclude(status=DocumentStatus.DELETING).first()
        if document is not None:
            raise DuplicateDocument(document)

    return _create_document(
        knowledge_base, user, request=request,
        source=dict(source_type=SourceType.URL, name=data.get("title") or url, url=url),
        document=dict(title=data.get("title") or url[:300], file_type="html", source_url=url,
                      **_document_fields(data, knowledge_base)),
        version=dict(source_url=url),
        file=None,
        payload={"auto_title": not data.get("title"), "auto_language": not data.get("language")},
        action="source.added",
    )


def add_text_source(knowledge_base, user, data, *, request):
    content = data["content"]
    encoded = content.encode("utf-8")
    uploaded = ContentFile(encoded, name="text.md")
    digest = validators.checksum(uploaded)
    _refuse_duplicate_file(knowledge_base, digest)

    return _create_document(
        knowledge_base, user, request=request,
        source=dict(source_type=SourceType.TEXT, name=data["title"]),
        document=dict(title=data["title"], file_type="md", file_size=len(encoded), **_document_fields(data, knowledge_base)),
        version=dict(original_filename=f"{data['title'][:80]}.md", mime_type="text/markdown",
                     file_size=len(encoded), checksum=digest),
        file=uploaded,
        payload={"auto_language": not data.get("language")},
        action="source.added",
    )


def upload_version(document, user, uploaded, *, request):
    if document.source.source_type != SourceType.FILE:
        raise InvalidState(Messages.VERSIONS_FILE_ONLY)
    _refuse_if_busy(document)
    file_format = validators.validate_upload(uploaded)
    digest = validators.checksum(uploaded)
    if document.versions.filter(checksum=digest).exists():
        raise DuplicateDocument(document)
    scanning.scan_upload(uploaded)

    filename = validators.display_filename(uploaded.name)
    version = _new_version(
        document, user, file=uploaded,
        original_filename=filename, mime_type=_mime(uploaded, file_format), file_size=uploaded.size, checksum=digest,
    )
    _queue_ingest(document, version, user, request=request, action="document.version_uploaded", number=version.number)
    return document


def _create_document(knowledge_base, user, *, request, source, document, version, file, payload, action):
    """Source, document, first version and ingestion job, in one transaction."""
    stored_name = None
    try:
        with transaction.atomic():
            source_row = KnowledgeSource.objects.create(knowledge_base=knowledge_base, created_by=user, **source)
            document_row = Document.objects.create(
                knowledge_base=knowledge_base, source=source_row, status=DocumentStatus.QUEUED,
                created_by=user, updated_by=user, **document,
            )
            version_row = DocumentVersion(document=document_row, number=1, status=DocumentStatus.QUEUED,
                                          created_by=user, **version)
            if file is not None:
                version_row.file.save(file.name, file, save=False)
                stored_name = version_row.file.name
            version_row.save()
            document_row.latest_version = version_row
            document_row.save(update_fields=["latest_version"])
            queue.enqueue(
                JobKind.INGEST, workspace=knowledge_base.workspace, knowledge_base=knowledge_base,
                document=document_row, version=version_row, created_by=user,
                payload={"document_title": document_row.title, **payload},
            )
    except Exception:
        if stored_name:
            get_storage().delete(stored_name)
        raise
    audit.record(action, request=request, target=document_row, source_type=source_row.source_type)
    return document_row


def _new_version(document, user, *, file=None, **fields):
    stored_name = None
    try:
        with transaction.atomic():
            number = (document.versions.order_by("-number").values_list("number", flat=True).first() or 0) + 1
            version = DocumentVersion(document=document, number=number, status=DocumentStatus.QUEUED,
                                      created_by=user, **fields)
            if file is not None:
                version.file.save(file.name, file, save=False)
                stored_name = version.file.name
            version.save()
            document.latest_version = version
            document.status = DocumentStatus.QUEUED
            document.error_code = document.error_message = ""
            document.updated_by = user
            document.save(update_fields=["latest_version", "status", "error_code", "error_message", "updated_by", "updated_at"])
    except Exception:
        if stored_name:
            get_storage().delete(stored_name)
        raise
    return version


# ---------------------------------------------------------------------------
# Changing documents
# ---------------------------------------------------------------------------

def update_document(document, user, data, *, request):
    changed = [field for field, value in data.items() if getattr(document, field) != value]
    if not changed:
        return document
    for field in changed:
        setattr(document, field, data[field])
    document.updated_by = user
    document.save()

    reindexing = bool(set(changed) & set(_INDEXED_FIELDS)) and document.active_version_id is not None
    if reindexing and document.status not in IN_PROGRESS and document.status != DocumentStatus.DELETING:
        try:
            with transaction.atomic():
                queue.enqueue(
                    JobKind.REINDEX, workspace=document.knowledge_base.workspace,
                    knowledge_base=document.knowledge_base, document=document,
                    version=document.active_version, created_by=user,
                    payload={"document_title": document.title},
                )
                Document.objects.filter(pk=document.pk).update(status=DocumentStatus.QUEUED)
                document.status = DocumentStatus.QUEUED
        except IntegrityError:
            # A writer is already running; it reads the new metadata when it indexes.
            pass
    audit.record("document.updated", request=request, target=document, fields=changed)
    return document


def reprocess_document(document, user, *, request):
    _refuse_if_busy(document)
    if document.source.source_type == SourceType.URL:
        return sync_source(document.source, user, request=request, force=True)
    version = document.active_version or document.latest_version
    if version is None:
        raise InvalidState(Messages.NOTHING_TO_REPROCESS)
    return _queue_ingest(document, version, user, request=request, action="document.reprocessed", number=version.number)


def retry_document(document, user, *, request):
    if document.status == DocumentStatus.FAILED and document.error_code == DELETE_FAILED:
        # It failed on its way out, not on processing: retrying means
        # deleting again.
        return delete_document(document, user, request=request)
    _refuse_if_busy(document)
    version = document.latest_version
    if document.status != DocumentStatus.FAILED or version is None:
        raise InvalidState(Messages.NOT_FAILED)
    return _queue_ingest(document, version, user, request=request, action="document.retried", number=version.number)


def activate_version(document, version_id, user, *, request):
    version = document.versions.filter(pk=version_id).first()
    if version is None:
        raise NotFound()
    if version.pk == document.active_version_id:
        raise InvalidState(Messages.VERSION_ALREADY_ACTIVE)
    if not version.file:
        raise InvalidState(Messages.VERSION_NOT_RESTORABLE)
    _refuse_if_busy(document)
    return _queue_ingest(document, version, user, request=request, action="document.version_restored", number=version.number)


def cancel_document(document, user, *, request):
    job = IngestionJob.objects.filter(document=document, status__in=ACTIVE_JOB_STATUSES, kind__in=WRITING_KINDS).first()
    if job is None:
        raise InvalidState(Messages.NOTHING_TO_CANCEL)

    if job.status == JobStatus.QUEUED:
        from .jobs.runner import _on_cancelled

        with transaction.atomic():
            locked = IngestionJob.objects.select_for_update().get(pk=job.pk)
            if locked.status == JobStatus.QUEUED:
                _on_cancelled(locked)
                audit.record("document.cancelled", request=request, target=document)
                return Messages.CANCELLED
    IngestionJob.objects.filter(pk=job.pk).update(cancel_requested=True)
    audit.record("document.cancel_requested", request=request, target=document)
    return Messages.CANCEL_REQUESTED


def delete_document(document, user, *, request):
    if document.status == DocumentStatus.DELETING and IngestionJob.objects.filter(
        document=document, kind=JobKind.DELETE_DOCUMENT, status__in=ACTIVE_JOB_STATUSES
    ).exists():
        raise InvalidState(Messages.ALREADY_DELETING)

    with transaction.atomic():
        Document.objects.filter(pk=document.pk).update(
            status=DocumentStatus.DELETING, stage="", error_code="", error_message="", updated_at=timezone.now()
        )
        IngestionJob.objects.filter(document=document, status=JobStatus.QUEUED, kind__in=WRITING_KINDS).update(
            status=JobStatus.CANCELLED, finished_at=timezone.now(),
            error_code="CANCELLED", error_message="The document was deleted.",
        )
        IngestionJob.objects.filter(document=document, status=JobStatus.RUNNING).update(cancel_requested=True)
        job = queue.enqueue(
            JobKind.DELETE_DOCUMENT, workspace=document.knowledge_base.workspace,
            knowledge_base=document.knowledge_base, document=document, created_by=user,
            payload={"document_title": document.title},
        )
    document.status = DocumentStatus.DELETING
    audit.record("document.deleted", request=request, target=document)
    return job


# ---------------------------------------------------------------------------
# Sources
# ---------------------------------------------------------------------------

def delete_source(source, user, *, request):
    documents = list(source.documents.exclude(status=DocumentStatus.DELETING))
    for document in documents:
        delete_document(document, user, request=request)
    if not source.documents.exists():
        source.delete()
    audit.record("source.deleted", request=request, target=source, knowledge_base=source.knowledge_base,
                 documents=len(documents))


def sync_source(source, user, *, request, force=False):
    """Fetch a web page again. An unchanged page leaves the live version as it is."""
    if source.source_type != SourceType.URL:
        raise InvalidState(Messages.SYNC_URL_ONLY)
    document = source.documents.exclude(status=DocumentStatus.DELETING).first()
    if document is None:
        raise InvalidState(Messages.NOTHING_TO_REPROCESS)
    _refuse_if_busy(document)

    version = _new_version(document, user, source_url=source.url)
    return _queue_ingest(
        document, version, user, request=request, action="source.synced", number=version.number,
        payload={"sync": not force},
    )


# ---------------------------------------------------------------------------
# Internals
# ---------------------------------------------------------------------------

def _queue_ingest(document, version, user, *, request, action, payload=None, **audit_fields):
    try:
        with transaction.atomic():
            job = queue.enqueue(
                JobKind.INGEST, workspace=document.knowledge_base.workspace,
                knowledge_base=document.knowledge_base, document=document, version=version, created_by=user,
                payload={"document_title": document.title, **(payload or {})},
            )
            DocumentVersion.objects.filter(pk=version.pk).update(
                status=DocumentStatus.QUEUED, error_code="", error_message=""
            )
            Document.objects.filter(pk=document.pk).update(
                status=DocumentStatus.QUEUED, stage="", error_code="", error_message="", updated_at=timezone.now()
            )
    except IntegrityError as exc:
        raise InvalidState(Messages.ALREADY_PROCESSING, code="already_processing") from exc
    document.status = DocumentStatus.QUEUED
    audit.record(action, request=request, target=document, **audit_fields)
    return job


def _refuse_if_busy(document):
    if document.status == DocumentStatus.DELETING:
        raise InvalidState(Messages.ALREADY_DELETING)
    if IngestionJob.objects.filter(
        document=document, status__in=ACTIVE_JOB_STATUSES, kind__in=WRITING_KINDS
    ).exists():
        raise InvalidState(Messages.ALREADY_PROCESSING, code="already_processing")


def _refuse_duplicate_file(knowledge_base, digest):
    existing = (
        Document.objects.filter(knowledge_base=knowledge_base, versions__checksum=digest)
        .exclude(status=DocumentStatus.DELETING)
        .first()
    )
    if existing is not None:
        raise DuplicateDocument(existing)


def _document_fields(data, knowledge_base):
    return {
        "description": data.get("description", ""),
        "category": data.get("category", ""),
        "tags": data.get("tags", []),
        "language": data.get("language") or knowledge_base.default_language,
        "author": data.get("author", ""),
    }


_MIME_BY_FORMAT = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "txt": "text/plain",
    "md": "text/markdown",
    "csv": "text/csv",
    "json": "application/json",
    "html": "text/html",
}


def _mime(uploaded, file_format):
    # The format was verified against the bytes; the browser's Content-Type
    # was not, so it is not what is stored.
    return _MIME_BY_FORMAT.get(file_format, "application/octet-stream")
