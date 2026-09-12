"""
The durable job queue, on PostgreSQL.

Claiming uses SELECT … FOR UPDATE SKIP LOCKED, so any number of workers can
poll the same table: each claims a different row, and none waits on another's
lock. A job whose worker died — process killed, machine lost — stops sending
heartbeats and is reclaimed once KB_JOB_STALE_SECONDS has passed. That is why
the stale threshold must exceed the longest single call a job makes (a system
check enforces it): a heartbeat cannot be sent from inside that call.

No Celery, no Redis. The database is already durable, already backed up, and
already the system of record for the documents these jobs act on, so a job
and the status it reports can never disagree the way a separate broker and a
database can.
"""

import logging
import os
import socket
import threading
import time
from datetime import timedelta

from django.conf import settings
from django.db import close_old_connections, connection, transaction
from django.db.models import Min, Q
from django.utils import timezone

from ..constants import STAGE_PROGRESS, JobStatus, Stage
from ..models import IngestionJob

logger = logging.getLogger(__name__)

# In thread mode, how far ahead a scheduled retry is waited for before the
# drainer gives up and leaves it to the next dispatch.
_THREAD_RETRY_HORIZON_SECONDS = 600


def worker_id(prefix="worker"):
    return f"{prefix}:{socket.gethostname()}:{os.getpid()}"


def refresh_connection():
    """
    Drop a database connection that has gone stale between jobs.

    A long-lived worker is not a request, so nothing else calls this for it.
    Never inside an atomic block, where closing the connection would mark the
    enclosing transaction for rollback.
    """
    if not connection.in_atomic_block:
        close_old_connections()


def enqueue(kind, *, workspace, knowledge_base=None, document=None, version=None, created_by=None, payload=None):
    job = IngestionJob.objects.create(
        kind=kind,
        workspace=workspace,
        knowledge_base=knowledge_base,
        document=document,
        version=version,
        created_by=created_by if created_by is not None and created_by.is_authenticated else None,
        max_attempts=settings.KNOWLEDGE_BASE["JOB_MAX_ATTEMPTS"],
        payload=payload or {},
        stage=Stage.QUEUED,
        progress=STAGE_PROGRESS[Stage.QUEUED],
    )
    # After commit: a worker must never see a job whose document row the
    # enqueuing transaction might still roll back.
    transaction.on_commit(dispatch)
    logger.info("kb_job_queued", extra={"event": "kb_job_queued", "job_id": job.pk, "kind": kind})
    return job


def claim_next(owner):
    """Claim the next runnable job, or None. A reclaimed stale job counts as a new attempt."""
    now = timezone.now()
    stale_before = now - timedelta(seconds=settings.KNOWLEDGE_BASE["JOB_STALE_SECONDS"])
    with transaction.atomic():
        job = (
            IngestionJob.objects.select_for_update(skip_locked=True)
            .filter(
                Q(status=JobStatus.QUEUED, run_after__lte=now)
                | Q(status=JobStatus.RUNNING, heartbeat_at__lt=stale_before)
            )
            .order_by("run_after", "id")
            .first()
        )
        if job is None:
            return None
        reclaimed = job.status == JobStatus.RUNNING
        job.status = JobStatus.RUNNING
        job.attempts += 1
        job.locked_by = owner
        job.locked_at = job.heartbeat_at = now
        job.started_at = job.started_at or now
        job.save(update_fields=["status", "attempts", "locked_by", "locked_at", "heartbeat_at", "started_at"])

    if reclaimed:
        logger.warning("kb_job_reclaimed", extra={"event": "kb_job_reclaimed", "job_id": job.pk, "owner": owner})
    return job


def heartbeat(job, *, stage=None):
    fields = {"heartbeat_at": timezone.now()}
    if stage is not None:
        fields.update(stage=stage, progress=STAGE_PROGRESS[stage])
    IngestionJob.objects.filter(pk=job.pk).update(**fields)
    for name, value in fields.items():
        setattr(job, name, value)


def cancel_requested(job):
    return IngestionJob.objects.filter(pk=job.pk, cancel_requested=True).exists()


def complete(job, result=None):
    _finish(job, JobStatus.SUCCEEDED, stage=Stage.DONE, progress=100, result=result or {},
            error_code="", error_message="")


def fail(job, code, message):
    _finish(job, JobStatus.FAILED, error_code=code, error_message=message)


def cancel(job, message="Processing was cancelled."):
    _finish(job, JobStatus.CANCELLED, error_code="CANCELLED", error_message=message)


def retry_later(job, *, delay_seconds, code="", message="", count_attempt=True):
    """Put a claimed job back in the queue, to run no earlier than `delay_seconds` from now."""
    attempts = job.attempts if count_attempt else max(0, job.attempts - 1)
    IngestionJob.objects.filter(pk=job.pk).update(
        status=JobStatus.QUEUED,
        stage=Stage.RETRYING if count_attempt else Stage.QUEUED,
        progress=STAGE_PROGRESS[Stage.QUEUED],
        attempts=attempts,
        run_after=timezone.now() + timedelta(seconds=delay_seconds),
        locked_by="",
        heartbeat_at=None,
        error_code=code,
        error_message=message,
    )
    transaction.on_commit(dispatch)


def has_ready_jobs():
    return IngestionJob.objects.filter(status=JobStatus.QUEUED, run_after__lte=timezone.now()).exists()


def _finish(job, status, **fields):
    now = timezone.now()
    duration = int((now - job.started_at).total_seconds() * 1000) if job.started_at else None
    IngestionJob.objects.filter(pk=job.pk).update(
        status=status, finished_at=now, duration_ms=duration, locked_by="", heartbeat_at=None, **fields
    )
    job.status = status
    logger.info(
        "kb_job_finished",
        extra={"event": "kb_job_finished", "job_id": job.pk, "kind": job.kind, "status": status,
               "attempts": job.attempts, "duration_ms": duration, "code": fields.get("error_code", "")},
    )


# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------
# "worker": nothing happens here; `manage.py process_documents` polls.
# "thread": a background thread in this process drains the queue. For local
# development only — it dies with the web process, and a system check warns
# when it is used with DEBUG off.

_drain_lock = threading.Lock()


def dispatch():
    if settings.KNOWLEDGE_BASE["DISPATCH"] != "thread":
        return
    threading.Thread(target=_drain, name="kb-inline-worker", daemon=True).start()


def _drain():
    from .runner import run_next_job

    owner = worker_id("thread")
    try:
        while True:
            if not _drain_lock.acquire(blocking=False):
                return  # another drainer is running and will pick this job up
            try:
                refresh_connection()
                while run_next_job(owner):
                    refresh_connection()
            except Exception:
                logger.exception("kb_inline_worker_failed", extra={"event": "kb_inline_worker_failed"})
            finally:
                _drain_lock.release()

            wait = _seconds_until_next_job()
            if wait is None or wait > _THREAD_RETRY_HORIZON_SECONDS:
                return
            time.sleep(max(0.5, wait))
    finally:
        connection.close()


def _seconds_until_next_job():
    earliest = IngestionJob.objects.filter(status=JobStatus.QUEUED).aggregate(at=Min("run_after"))["at"]
    if earliest is None:
        return None
    return max(0.0, (earliest - timezone.now()).total_seconds())
