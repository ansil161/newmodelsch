"""
Response shapes: every field a client sees, chosen here, deliberately.

Like accounts' UserSerializer, nothing reaches a response by default. A new
model field is invisible until it is added below, which is what keeps file
paths, checksums, lock owners and chunk text out of list responses.
"""

from .constants import IN_PROGRESS, STAGE_PROGRESS, DocumentStatus, JobStatus, Stage


def present_workspace(workspace, role):
    return {"id": workspace.pk, "name": workspace.name, "slug": workspace.slug, "role": role}


def present_knowledge_base(knowledge_base, *, role=None, stats=None):
    data = {
        "id": knowledge_base.pk,
        "workspace": knowledge_base.workspace_id,
        "name": knowledge_base.name,
        "description": knowledge_base.description,
        "status": knowledge_base.status,
        "chat_enabled": knowledge_base.chat_enabled,
        "default_language": knowledge_base.default_language,
        "created_at": knowledge_base.created_at,
        "updated_at": knowledge_base.updated_at,
    }
    if role is not None:
        data["role"] = role
    if stats is not None:
        data["stats"] = stats
    return data


def _processing(document):
    if document.status in IN_PROGRESS:
        stage = Stage(document.stage) if document.stage in Stage.values else Stage.QUEUED
        return {"stage": stage.value, "label": stage.label, "progress": STAGE_PROGRESS[stage]}
    return None


def _error(code, message):
    return {"code": code, "message": message} if (code or message) else None


def present_document(document):
    return {
        "id": document.pk,
        "knowledge_base": document.knowledge_base_id,
        "title": document.title,
        "status": document.status,
        "processing": _processing(document),
        "error": _error(document.error_code, document.error_message),
        "is_live": document.active_version_id is not None,
        "active_version": document.active_version.number if document.active_version else None,
        "latest_version": document.latest_version.number if document.latest_version else None,
        "file_type": document.file_type,
        "source_type": document.source.source_type,
        "source_id": document.source_id,
        "source_url": document.source_url,
        "file_size": document.file_size,
        "chunk_count": document.chunk_count,
        "page_count": document.page_count,
        "category": document.category,
        "tags": document.tags,
        "language": document.language,
        "created_at": document.created_at,
        "updated_at": document.updated_at,
        "indexed_at": document.indexed_at,
    }


def present_version(version, *, active_id):
    return {
        "id": version.pk,
        "number": version.number,
        "status": version.status,
        "is_active": version.pk == active_id,
        "original_filename": version.original_filename,
        "source_url": version.source_url,
        "mime_type": version.mime_type,
        "format": version.format,
        "parser": version.parser,
        "file_size": version.file_size,
        "page_count": version.page_count,
        "character_count": version.character_count,
        "chunk_count": version.chunk_count,
        "token_count": version.token_count,
        "warnings": version.warnings,
        "embedding_model": version.embedding_model,
        "has_file": bool(version.file),
        "error": _error(version.error_code, version.error_message),
        "created_at": version.created_at,
        "processed_at": version.processed_at,
        "indexed_at": version.indexed_at,
    }


def present_document_detail(document, *, versions, jobs, created_by=None):
    return {
        **present_document(document),
        "description": document.description,
        "author": document.author,
        "created_by": _person(created_by),
        "versions": [present_version(version, active_id=document.active_version_id) for version in versions],
        "jobs": [present_job(job) for job in jobs],
    }


def present_chunk(chunk):
    return {
        "id": chunk.pk,
        "index": chunk.index,
        "content": chunk.content,
        "token_count": chunk.token_count,
        "page": chunk.page,
        "pages": chunk.pages,
        "heading": chunk.heading,
        "section": chunk.section,
    }


def present_job(job):
    return {
        "id": job.pk,
        "kind": job.kind,
        "status": job.status,
        "stage": job.stage,
        "stage_label": Stage(job.stage).label if job.stage in Stage.values else job.stage,
        "progress": 100 if job.status == JobStatus.SUCCEEDED else job.progress,
        "attempts": job.attempts,
        "max_attempts": job.max_attempts,
        "document": job.document_id,
        "document_title": job.payload.get("document_title") or job.payload.get("knowledge_base_name", ""),
        "error": _error(job.error_code, job.error_message),
        "cancel_requested": job.cancel_requested,
        "result": {key: value for key, value in (job.result or {}).items() if key in ("chunks", "unchanged", "skipped")},
        "created_at": job.created_at,
        "started_at": job.started_at,
        "finished_at": job.finished_at,
        "run_after": job.run_after if job.status == JobStatus.QUEUED else None,
        "duration_ms": job.duration_ms,
    }


def present_source(source, *, document=None):
    return {
        "id": source.pk,
        "source_type": source.source_type,
        "name": source.name,
        "url": source.url,
        "last_synced_at": source.last_synced_at,
        "created_at": source.created_at,
        "document": present_document(document) if document is not None else None,
    }


def present_audit(entry):
    return {
        "id": entry.pk,
        "action": entry.action,
        "target_type": entry.target_type,
        "target_id": entry.target_id,
        "target_label": entry.target_label,
        "actor": _person(entry.actor),
        "created_at": entry.created_at,
    }


def _person(user):
    if user is None:
        return None
    return {"id": user.pk, "name": user.get_full_name(), "email": user.email}


def document_status_counts(aggregate):
    return {
        "documents": aggregate.get("total") or 0,
        "ready": aggregate.get("ready") or 0,
        "processing": aggregate.get("processing") or 0,
        "failed": aggregate.get("failed") or 0,
        "deleting": aggregate.get("deleting") or 0,
        "live": aggregate.get("live") or 0,
        "chunks": aggregate.get("chunks") or 0,
    }


__all__ = [
    "DocumentStatus",
    "document_status_counts",
    "present_audit",
    "present_chunk",
    "present_document",
    "present_document_detail",
    "present_job",
    "present_knowledge_base",
    "present_source",
    "present_version",
    "present_workspace",
]
