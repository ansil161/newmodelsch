"""The job queue interface, and an in-process implementation.

WHY THIS IS SMALL, AND WHY THAT IS DELIBERATE
=============================================
There is already a durable queue in this system. Django's knowledge-base
worker claims documents with `SELECT … FOR UPDATE SKIP LOCKED`, survives
restarts, reclaims work abandoned by a dead worker, and counts attempts. It
drives document ingestion end to end and calls this service to embed and
index.

Putting a second queue behind that one would mean Django could no longer tell
a document it marked READY from one still sitting in this service's queue —
a status-tracking problem, in exchange for latency the user never
experiences, since their HTTP request ended before Django's worker even
picked the document up.

So this queue exists for the work Django's does *not* cover: bulk operations
initiated here, principally re-embedding the whole collection after a model
or chunking change. That is genuinely long-running, genuinely belongs to this
service, and genuinely needs to be interruptible and observable.

WHAT THE IN-MEMORY IMPLEMENTATION IS AND IS NOT
-----------------------------------------------
It is: bounded, cancellable, observable, and correct for one process.
It is not: durable. Jobs are lost on restart.

For a reindex that is acceptable — it is idempotent and restartable by
definition, and it is an operator action, not user traffic. For anything
where loss matters, `JobQueue` is the seam: a Redis or Postgres
implementation fits behind it without touching a job's code.
"""

from __future__ import annotations

import asyncio
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any

from app.core.logging import get_logger

logger = get_logger(__name__)


class JobStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class Job:
    kind: str
    payload: dict[str, Any]
    id: str = field(default_factory=lambda: uuid.uuid4().hex)
    status: JobStatus = JobStatus.QUEUED
    attempts: int = 0
    max_attempts: int = 3
    # Safe to show an operator. Provider details and tracebacks go to the log.
    error: str = ""
    result: dict[str, Any] = field(default_factory=dict)
    progress: dict[str, Any] = field(default_factory=dict)


class JobQueue(ABC):
    @abstractmethod
    async def enqueue(self, kind: str, payload: dict[str, Any], *,
                      max_attempts: int = 3) -> Job: ...

    @abstractmethod
    async def dequeue(self) -> Job | None: ...

    @abstractmethod
    async def complete(self, job: Job, result: dict[str, Any]) -> None: ...

    @abstractmethod
    async def fail(self, job: Job, error: str, *, retryable: bool) -> None: ...

    @abstractmethod
    def get(self, job_id: str) -> Job | None: ...


class InMemoryJobQueue(JobQueue):
    """Bounded, single-process. See the module docstring for the trade."""

    def __init__(self, max_size: int = 100) -> None:
        # Bounded on purpose: an unbounded queue turns a runaway producer
        # into an out-of-memory kill instead of a rejected request.
        self._queue: asyncio.Queue[Job] = asyncio.Queue(maxsize=max_size)
        self._jobs: dict[str, Job] = {}

    async def enqueue(self, kind: str, payload: dict[str, Any], *,
                      max_attempts: int = 3) -> Job:
        job = Job(kind=kind, payload=payload, max_attempts=max_attempts)
        self._jobs[job.id] = job
        await self._queue.put(job)
        logger.info("Job queued", extra={"job_id": job.id, "kind": kind})
        return job

    async def dequeue(self) -> Job | None:
        job = await self._queue.get()
        job.status = JobStatus.RUNNING
        job.attempts += 1
        return job

    async def complete(self, job: Job, result: dict[str, Any]) -> None:
        job.status = JobStatus.SUCCEEDED
        job.result = result
        job.error = ""
        self._queue.task_done()
        logger.info(
            "Job succeeded",
            extra={"job_id": job.id, "kind": job.kind, "attempts": job.attempts},
        )

    async def fail(self, job: Job, error: str, *, retryable: bool) -> None:
        self._queue.task_done()

        if retryable and job.attempts < job.max_attempts:
            job.status = JobStatus.QUEUED
            # Exponential backoff before re-queueing. Immediate retries turn
            # a rate limit into a tighter rate limit.
            delay = min(2.0 ** job.attempts, 30.0)
            logger.warning(
                "Job failed; retrying",
                extra={"job_id": job.id, "kind": job.kind,
                       "attempt": job.attempts, "retry_in_s": delay},
            )
            await asyncio.sleep(delay)
            await self._queue.put(job)
            return

        # Permanent failure, or out of attempts. Not retried forever — a job
        # that has failed three times will fail a fourth, and an endless
        # retry loop is an endless bill.
        job.status = JobStatus.FAILED
        job.error = error
        logger.error(
            "Job failed permanently",
            extra={"job_id": job.id, "kind": job.kind,
                   "attempts": job.attempts, "retryable": retryable},
        )

    def get(self, job_id: str) -> Job | None:
        return self._jobs.get(job_id)
