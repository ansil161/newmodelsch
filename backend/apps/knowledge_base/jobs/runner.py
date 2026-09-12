"""
What each kind of job does.

    ingest                 extract (file or page) → store chunks → index → go live
    reindex                index the live version's stored chunks again
    delete_document        remove its vectors → remove its rows and files
    delete_knowledge_base  remove all of its vectors → remove its rows and files

Every write to the AI service is idempotent there — an index write carries the
job id as its generation, so a retried job overwrites its own vectors — and
every write here commits atomically. A job interrupted at any point is safe to
run again from the start, which is what the queue does.

ORDER MATTERS FOR DELETION. Vectors go first, rows second. The other order
would leave vectors behind that nothing in this database can name any more:
still retrievable, still citable, and impossible to delete from the console.

One failed document never touches another. A job fails into its own
document's status, with a message written for an administrator, and the
worker moves on.
"""

import hashlib
import logging
import time
import uuid

from django.core.cache import cache
from django.db import transaction
from django.utils import timezone

from ..ai_client import AIServiceError, AIServiceUnavailable, get_client, identity_for
from ..constants import (
    FAILURE_MESSAGES,
    WRITING_KINDS,
    DocumentStatus,
    JobKind,
    JobStatus,
    KnowledgeBaseStatus,
    SourceType,
    Stage,
)
from ..models import Document, DocumentChunk, DocumentVersion, IngestionJob, KnowledgeBase, KnowledgeSource
from ..storage import get_storage
from . import queue

logger = logging.getLogger(__name__)

DELETE_FAILED = "DELETE_FAILED"


class JobFailed(Exception):
    def __init__(self, code, message, *, retryable=False):
        super().__init__(message)
        self.code = code
        self.message = message
        self.retryable = retryable


class JobCancelled(Exception):
    pass


class NotYet(Exception):
    """The job cannot run until another finishes. Requeued without costing an attempt."""

    def __init__(self, delay_seconds=15):
        super().__init__(delay_seconds)
        self.delay_seconds = delay_seconds


def run_next_job(owner):
    """Claim and run one job. Returns False when the queue had nothing ready."""
    job = queue.claim_next(owner)
    if job is None:
        return False

    started = time.monotonic()
    logger.info(
        "kb_job_started",
        extra={"event": "kb_job_started", "job_id": job.pk, "kind": job.kind, "attempt": job.attempts},
    )
    try:
        result = _HANDLERS[job.kind](job)
    except NotYet as wait:
        queue.retry_later(job, delay_seconds=wait.delay_seconds, count_attempt=False)
    except JobCancelled:
        _on_cancelled(job)
    except JobFailed as failure:
        _on_failure(job, failure)
    except AIServiceError as error:
        _on_failure(job, JobFailed(error.code, _message_for(error), retryable=error.retryable))
    except Exception:
        logger.exception("kb_job_crashed", extra={"event": "kb_job_crashed", "job_id": job.pk, "kind": job.kind})
        _on_failure(job, JobFailed("INTERNAL_ERROR", FAILURE_MESSAGES["INTERNAL_ERROR"], retryable=True))
    else:
        queue.complete(job, result)
        logger.info(
            "kb_job_succeeded",
            extra={"event": "kb_job_succeeded", "job_id": job.pk, "kind": job.kind,
                   "duration_ms": int((time.monotonic() - started) * 1000)},
        )
    return True


# ---------------------------------------------------------------------------
# Ingest
# ---------------------------------------------------------------------------

def _ingest(job):
    version = _version_of(job)
    if version is None:
        return {"skipped": "The document no longer exists."}
    document = version.document
    knowledge_base = document.knowledge_base
    if document.status == DocumentStatus.DELETING or knowledge_base.is_deleting:
        raise JobCancelled()

    client = get_client()
    identity = identity_for(knowledge_base.workspace, job.created_by)
    request_id = f"kb-job-{job.pk}"
    is_page = document.source.source_type == SourceType.URL

    _enter(job, document, version, Stage.FETCHING if is_page else Stage.EXTRACTING, DocumentStatus.PROCESSING)
    if is_page:
        extraction = client.extract_url(identity, version.source_url, request_id=request_id)
    else:
        extraction = client.extract_file(
            identity,
            filename=version.original_filename or "document",
            content_type=version.mime_type,
            data=_read_file(version),
            request_id=request_id,
        )
    _check_cancelled(job)

    _enter(job, document, version, Stage.STORING, DocumentStatus.PROCESSING)
    _store_extraction(job, document, version, extraction)

    if job.payload.get("sync") and _unchanged(document, version):
        return _discard_unchanged(document, version)

    _check_cancelled(job)
    _enter(job, document, version, Stage.INDEXING, DocumentStatus.INDEXING)
    document.refresh_from_db(fields=["status"])
    if document.status == DocumentStatus.DELETING:
        raise JobCancelled()

    response = client.index_document(
        identity, index_payload(document, version, generation=job.pk), request_id=request_id
    )
    _go_live(document, version, response, generation=job.pk)
    return {
        "chunks": version.chunk_count,
        "index_generation": job.pk,
        "embedding_model": response.get("embeddingModel", ""),
    }


def _read_file(version):
    if not version.file:
        raise JobFailed("SOURCE_FILE_MISSING", FAILURE_MESSAGES["SOURCE_FILE_MISSING"])
    try:
        with version.file.open("rb") as handle:
            return handle.read()
    except FileNotFoundError as exc:
        raise JobFailed("SOURCE_FILE_MISSING", FAILURE_MESSAGES["SOURCE_FILE_MISSING"]) from exc


def chunk_id(version_id, index):
    return uuid.uuid5(version_id, str(index))


def _store_extraction(job, document, version, extraction):
    chunks = extraction.get("chunks") or []
    now = timezone.now()
    with transaction.atomic():
        DocumentChunk.objects.filter(version=version).delete()
        DocumentChunk.objects.bulk_create(
            [_chunk_row(version, chunk) for chunk in chunks], batch_size=500
        )

        version.format = str(extraction.get("format") or "")[:16]
        version.parser = str(extraction.get("parser") or "")[:32]
        version.extracted_title = str(extraction.get("title") or "")[:300]
        version.page_count = extraction.get("pageCount")
        version.character_count = int(extraction.get("characterCount") or 0)
        version.chunk_count = len(chunks)
        version.token_count = int(extraction.get("tokenCount") or 0)
        version.warnings = [str(warning)[:500] for warning in extraction.get("warnings") or []][:20]
        version.processed_at = now
        if document.source.source_type == SourceType.URL:
            # A page has no file to hash, so its fingerprint is its content:
            # the chunk hashes in order. What an unchanged re-fetch is
            # recognised by.
            digest = hashlib.sha256("".join(chunk.get("contentHash", "") for chunk in chunks).encode())
            version.checksum = digest.hexdigest()
        version.save()

        fields = ["updated_at"]
        if job.payload.get("auto_title") and version.extracted_title:
            document.title = version.extracted_title
            fields.append("title")
        final_url = extraction.get("sourceUrl")
        if final_url and document.source.source_type == SourceType.URL:
            document.source_url = str(final_url)[:2048]
            fields.append("source_url")
        language = (extraction.get("metadata") or {}).get("language")
        if job.payload.get("auto_language") and language:
            document.language = str(language)[:16]
            fields.append("language")
        document.save(update_fields=fields)


def _chunk_row(version, chunk):
    metadata = chunk.get("metadata") or {}
    index = int(chunk["chunkIndex"])
    return DocumentChunk(
        id=chunk_id(version.pk, index),
        version=version,
        index=index,
        content=chunk.get("content", ""),
        token_count=int(chunk.get("tokenCount") or 0),
        content_hash=str(chunk.get("contentHash") or "")[:64],
        page=metadata.get("page"),
        pages=[int(page) for page in metadata.get("pages") or []],
        heading=str(metadata.get("heading") or "")[:300],
        section=str(metadata.get("section") or "")[:1000],
    )


def _unchanged(document, version):
    active = document.active_version
    return active is not None and active.pk != version.pk and active.checksum == version.checksum


def _discard_unchanged(document, version):
    """A refresh that found the same page: keep the live version, drop the copy."""
    now = timezone.now()
    with transaction.atomic():
        active = document.active_version
        version.delete()
        Document.objects.filter(pk=document.pk).update(
            latest_version=active, status=DocumentStatus.READY, stage="",
            error_code="", error_message="", updated_at=now,
        )
        KnowledgeSource.objects.filter(pk=document.source_id).update(last_synced_at=now, updated_at=now)
    return {"unchanged": True}


INDEX_VERIFICATION_FAILED = "INDEX_VERIFICATION_FAILED"


def _verify_indexed(version, response):
    """
    Refuse to go live on an index write the vector store did not keep in full.

    `indexedChunks` is the count the AI service read back from Qdrant after
    the write, not the number it sent. A document marked READY that answers
    from half its text is worse than one still processing, so anything short
    of every stored chunk fails the job — retryably, since the AI service has
    already rolled the incomplete write back and a re-run usually lands.
    """
    indexed = response.get("indexedChunks")
    if indexed is None or int(indexed) != version.chunk_count:
        logger.warning(
            "kb_index_incomplete",
            extra={"event": "kb_index_incomplete", "version_id": str(version.pk),
                   "chunks": version.chunk_count, "indexed": indexed},
        )
        raise JobFailed(
            INDEX_VERIFICATION_FAILED, FAILURE_MESSAGES[INDEX_VERIFICATION_FAILED], retryable=True
        )


def _go_live(document, version, response, *, generation):
    _verify_indexed(version, response)
    now = timezone.now()
    with transaction.atomic():
        version.status = DocumentStatus.READY
        version.indexed_at = now
        version.embedding_model = str(response.get("embeddingModel") or "")[:128]
        version.embedding_dimensions = response.get("dimensions")
        version.index_generation = response.get("indexGeneration") or generation
        version.error_code = version.error_message = ""
        version.save()

        Document.objects.filter(pk=document.pk).update(
            active_version=version,
            status=DocumentStatus.READY,
            stage="",
            error_code="",
            error_message="",
            chunk_count=version.chunk_count,
            page_count=version.page_count,
            file_type=version.format or document.file_type,
            file_size=version.file_size or document.file_size,
            indexed_at=now,
            updated_at=now,
        )
        # Only the live version's chunks are kept: restoring an older
        # version re-parses its stored file, which is the honest way to get
        # its chunks under the current chunking settings anyway.
        DocumentChunk.objects.filter(version__document=document).exclude(version=version).delete()
        if document.source.source_type == SourceType.URL:
            KnowledgeSource.objects.filter(pk=document.source_id).update(last_synced_at=now, updated_at=now)
    cache.delete(health_cache_key(document.knowledge_base_id))


def index_payload(document, version, *, generation):
    chunks = version.chunks.order_by("index")
    return {
        "documentId": str(document.pk),
        "documentName": document.title,
        "documentType": version.format or document.file_type,
        "knowledgeBaseId": str(document.knowledge_base_id),
        "language": document.language or "en",
        "documentVersion": version.number,
        "indexGeneration": generation,
        "sourceType": document.source.source_type,
        "category": document.category or None,
        "tags": list(document.tags),
        "sourceUrl": document.source_url or version.source_url or None,
        "chunks": [
            {
                "chunkId": str(chunk.id),
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
            for chunk in chunks
        ],
    }


# ---------------------------------------------------------------------------
# Re-index: metadata changed, chunks did not
# ---------------------------------------------------------------------------

def _reindex(job):
    document = _document_of(job)
    if document is None or document.active_version is None:
        return {"skipped": "Nothing is live to re-index."}
    if document.status == DocumentStatus.DELETING:
        raise JobCancelled()
    version = document.active_version

    queue.heartbeat(job, stage=Stage.INDEXING)
    Document.objects.filter(pk=document.pk).update(
        status=DocumentStatus.INDEXING, stage=Stage.INDEXING, updated_at=timezone.now()
    )
    response = get_client().index_document(
        identity_for(document.knowledge_base.workspace, job.created_by),
        index_payload(document, version, generation=job.pk),
        request_id=f"kb-job-{job.pk}",
    )
    _go_live(document, version, response, generation=job.pk)
    return {"chunks": version.chunk_count, "index_generation": job.pk}


# ---------------------------------------------------------------------------
# Deletion
# ---------------------------------------------------------------------------

def _delete_document(job):
    document = _document_of(job)
    if document is None:
        return {"skipped": "Already deleted."}
    # A writer that is mid-index would put vectors back after this deletes
    # them. It checks for DELETING before indexing and stops; wait for it.
    if IngestionJob.objects.filter(
        document=document, status=JobStatus.RUNNING, kind__in=WRITING_KINDS
    ).exclude(pk=job.pk).exists():
        raise NotYet()

    queue.heartbeat(job, stage=Stage.DELETING)
    get_client().delete_document(
        identity_for(document.knowledge_base.workspace, job.created_by), str(document.pk),
        request_id=f"kb-job-{job.pk}",
    )

    files = list(document.versions.exclude(file="").values_list("file", flat=True))
    knowledge_base_id = document.knowledge_base_id
    with transaction.atomic():
        IngestionJob.objects.filter(document=document, status=JobStatus.QUEUED).exclude(pk=job.pk).update(
            status=JobStatus.CANCELLED, finished_at=timezone.now(),
            error_code="CANCELLED", error_message="The document was deleted.",
        )
        source = document.source
        document.delete()
        if not source.documents.exists():
            source.delete()
    _delete_files(files)
    cache.delete(health_cache_key(knowledge_base_id))
    return {"deleted": True, "files": len(files)}


def _delete_knowledge_base(job):
    knowledge_base = job.knowledge_base
    if knowledge_base is None:
        return {"skipped": "Already deleted."}
    if IngestionJob.objects.filter(
        knowledge_base=knowledge_base, status=JobStatus.RUNNING
    ).exclude(pk=job.pk).exists():
        raise NotYet()

    # Stop queued work first, so nothing indexes into it after the delete.
    IngestionJob.objects.filter(knowledge_base=knowledge_base, status=JobStatus.QUEUED).exclude(pk=job.pk).update(
        status=JobStatus.CANCELLED, finished_at=timezone.now(),
        error_code="CANCELLED", error_message="The knowledge base was deleted.",
    )
    queue.heartbeat(job, stage=Stage.DELETING)
    get_client().delete_knowledge_base(
        identity_for(knowledge_base.workspace, job.created_by), str(knowledge_base.pk),
        request_id=f"kb-job-{job.pk}",
    )

    files = list(
        DocumentVersion.objects.filter(document__knowledge_base=knowledge_base)
        .exclude(file="").values_list("file", flat=True)
    )
    with transaction.atomic():
        Document.objects.filter(knowledge_base=knowledge_base).delete()
        KnowledgeSource.objects.filter(knowledge_base=knowledge_base).delete()
        knowledge_base.delete()
    _delete_files(files)
    return {"deleted": True, "files": len(files)}


def _delete_files(names):
    storage = get_storage()
    for name in names:
        try:
            storage.delete(name)
        except OSError:
            # The row is gone; a file left behind is invisible and harmless,
            # and not worth failing a finished deletion over.
            logger.warning("kb_file_not_deleted", extra={"event": "kb_file_not_deleted"})


# ---------------------------------------------------------------------------
# Outcomes
# ---------------------------------------------------------------------------

def _on_failure(job, failure):
    if failure.retryable and job.attempts < job.max_attempts:
        delay = min(30 * 2 ** (job.attempts - 1), 600)
        queue.retry_later(job, delay_seconds=delay, code=failure.code, message=failure.message)
        _document_update(job, status=DocumentStatus.QUEUED, stage=Stage.RETRYING,
                         error_code=failure.code, error_message=failure.message)
        logger.warning(
            "kb_job_retrying",
            extra={"event": "kb_job_retrying", "job_id": job.pk, "code": failure.code,
                   "attempt": job.attempts, "retry_in_s": delay},
        )
        return

    queue.fail(job, failure.code, failure.message)
    if job.kind == JobKind.DELETE_DOCUMENT:
        # DELETE_FAILED, whatever the cause: it is what tells Retry to delete
        # again rather than to process the document again.
        _document_update(
            job, status=DocumentStatus.FAILED, stage="", error_code=DELETE_FAILED,
            error_message=f"The document could not be removed from the index: {failure.message} "
                          "Retry to try again.",
        )
        return
    if job.kind == JobKind.DELETE_KNOWLEDGE_BASE:
        # Nothing was removed — the AI service call is the step that failed —
        # so the knowledge base is usable again and can be deleted again.
        KnowledgeBase.objects.filter(pk=job.knowledge_base_id).update(
            status=KnowledgeBaseStatus.ACTIVE, updated_at=timezone.now()
        )
        return
    if job.version_id:
        DocumentVersion.objects.filter(pk=job.version_id).update(
            status=DocumentStatus.FAILED, error_code=failure.code, error_message=failure.message
        )
    _document_update(job, status=DocumentStatus.FAILED, stage="",
                     error_code=failure.code, error_message=failure.message)


def _on_cancelled(job):
    queue.cancel(job)
    if job.version_id:
        DocumentVersion.objects.filter(pk=job.version_id).update(
            status=DocumentStatus.FAILED, error_code="CANCELLED", error_message=FAILURE_MESSAGES["CANCELLED"]
        )
    document = Document.objects.filter(pk=job.document_id).first() if job.document_id else None
    if document is None or document.status == DocumentStatus.DELETING:
        return
    # Cancelling a new version leaves the live one live.
    live = document.active_version_id is not None
    Document.objects.filter(pk=document.pk).update(
        status=DocumentStatus.READY if live else DocumentStatus.FAILED,
        stage="",
        error_code="" if live else "CANCELLED",
        error_message="" if live else FAILURE_MESSAGES["CANCELLED"],
        updated_at=timezone.now(),
    )


def _enter(job, document, version, stage, status):
    queue.heartbeat(job, stage=stage)
    now = timezone.now()
    Document.objects.filter(pk=document.pk).exclude(status=DocumentStatus.DELETING).update(
        status=status, stage=stage, error_code="", error_message="", updated_at=now
    )
    DocumentVersion.objects.filter(pk=version.pk).update(status=status, error_code="", error_message="")
    DocumentVersion.objects.filter(pk=version.pk, processing_started_at__isnull=True).update(
        processing_started_at=now
    )


def _document_update(job, **fields):
    if not job.document_id:
        return
    documents = Document.objects.filter(pk=job.document_id)
    if job.kind != JobKind.DELETE_DOCUMENT:
        # A document being deleted keeps saying so. A processing job that
        # fails on its way out must not overwrite that with FAILED.
        documents = documents.exclude(status=DocumentStatus.DELETING)
    documents.update(updated_at=timezone.now(), **fields)


def _check_cancelled(job):
    if queue.cancel_requested(job):
        raise JobCancelled()


def _version_of(job):
    if job.version_id is None:
        return None
    return (
        DocumentVersion.objects.select_related(
            "document__knowledge_base__workspace", "document__source", "document__active_version"
        )
        .filter(pk=job.version_id)
        .first()
    )


def _document_of(job):
    if job.document_id is None:
        return None
    return (
        Document.objects.select_related("knowledge_base__workspace", "source", "active_version")
        .filter(pk=job.document_id)
        .first()
    )


def _message_for(error):
    if isinstance(error, AIServiceUnavailable):
        return FAILURE_MESSAGES["AI_SERVICE_UNAVAILABLE"]
    return error.message


def health_cache_key(knowledge_base_id):
    return f"kb-health:{knowledge_base_id}"


_HANDLERS = {
    JobKind.INGEST: _ingest,
    JobKind.REINDEX: _reindex,
    JobKind.DELETE_DOCUMENT: _delete_document,
    JobKind.DELETE_KNOWLEDGE_BASE: _delete_knowledge_base,
}
