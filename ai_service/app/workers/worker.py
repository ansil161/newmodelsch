"""The worker process.

    python -m app.workers.worker                    # serve the job queue
    python -m app.workers.worker reindex            # run one reindex and exit

Runs as its own process, never inside the API. A long job sharing an event
loop with request handling means a reindex competes with every user's chat
for the same loop — and a worker crash takes the API down with it.

Shutdown is graceful: SIGTERM stops the loop from claiming new work and lets
the job in hand finish, so a deploy does not leave a document half-indexed.
"""

from __future__ import annotations

import asyncio
import os
import signal
import sys
from typing import Any

from app.core.config import get_settings
from app.core.exceptions import AIServiceError
from app.core.lifecycle import AppResources
from app.core.logging import configure_logging, get_logger, request_context
from app.workers.jobs.reindex import (
    DjangoKnowledgeBaseClient,
    ReindexProgress,
    run_reindex,
)
from app.workers.queue import InMemoryJobQueue, Job, JobQueue

logger = get_logger(__name__)

JOB_REINDEX = "reindex"


class Worker:
    def __init__(self, resources: AppResources, queue: JobQueue) -> None:
        self._resources = resources
        self._queue = queue
        self._running = True

    def request_stop(self) -> None:
        logger.info("Stop requested; finishing the current job")
        self._running = False

    async def run_forever(self) -> None:
        logger.info("Worker started")
        while self._running:
            try:
                job = await asyncio.wait_for(self._queue.dequeue(), timeout=1.0)
            except TimeoutError:
                # Idle. Loop so the stop flag is checked.
                continue

            if job is None:
                continue
            await self._run_job(job)

        logger.info("Worker stopped")

    async def _run_job(self, job: Job) -> None:
        with request_context(request_id=job.id):
            try:
                result = await self._dispatch(job)
            except AIServiceError as error:
                await self._queue.fail(job, error.message, retryable=error.retryable)
            except Exception as error:
                logger.exception("Job raised an unexpected error")
                # Unknown failures are treated as retryable once or twice —
                # a transient network fault looks exactly like this — but the
                # attempt cap stops it becoming a loop.
                await self._queue.fail(
                    job, "The job failed unexpectedly.", retryable=True
                )
                del error
            else:
                await self._queue.complete(job, result)

    async def _dispatch(self, job: Job) -> dict[str, Any]:
        if job.kind == JOB_REINDEX:
            return await self._reindex(job)
        raise AIServiceError(f"Unknown job kind {job.kind!r}", retryable=False)

    async def _reindex(self, job: Job) -> dict[str, Any]:
        base_url = os.environ.get("MAIN_BACKEND_URL", "http://localhost:8000")
        token = os.environ.get("MAIN_BACKEND_TOKEN", "")
        tenant_id = str(job.payload.get("tenant_id", "default"))

        source = DjangoKnowledgeBaseClient(base_url, token)
        try:
            progress = await run_reindex(
                self._resources.indexing, source,
                tenant_id=tenant_id, progress=ReindexProgress(),
            )
        finally:
            await source.aclose()

        job.progress = progress.as_dict()
        return progress.as_dict()


async def _main(argv: list[str]) -> int:
    settings = get_settings()
    configure_logging(
        settings.observability.log_level, settings.observability.log_format
    )

    resources = AppResources.build(settings)
    await resources.start()

    queue = InMemoryJobQueue()
    worker = Worker(resources, queue)

    # SIGINT and SIGTERM stop the loop rather than killing the process, so a
    # document being embedded finishes rather than being abandoned mid-write.
    loop = asyncio.get_running_loop()
    for name in ("SIGINT", "SIGTERM"):
        handler = getattr(signal, name, None)
        if handler is None:
            continue
        try:
            loop.add_signal_handler(handler, worker.request_stop)
        except NotImplementedError:
            # Windows has no add_signal_handler for the proactor loop.
            signal.signal(handler, lambda *_: worker.request_stop())

    try:
        if len(argv) > 1 and argv[1] == JOB_REINDEX:
            # One-shot mode, for an operator running a migration by hand.
            job = await queue.enqueue(
                JOB_REINDEX,
                {"tenant_id": os.environ.get("REINDEX_TENANT_ID", "default")},
                max_attempts=1,
            )
            claimed = await queue.dequeue()
            assert claimed is not None
            await worker._run_job(claimed)
            return 0 if job.status == "succeeded" else 1

        await worker.run_forever()
        return 0
    finally:
        await resources.aclose()


def main() -> None:
    raise SystemExit(asyncio.run(_main(sys.argv)))


if __name__ == "__main__":
    main()
