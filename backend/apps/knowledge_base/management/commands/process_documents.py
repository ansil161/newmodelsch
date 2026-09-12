"""
manage.py process_documents — the knowledge-base ingestion worker.

Run one or several; they coordinate through the database. SIGTERM and SIGINT
stop the loop after the job in hand, so a deploy never abandons a document
half-processed — and if a worker is killed outright, its job is reclaimed
once its heartbeat goes stale.
"""

import signal
import threading

from django.conf import settings
from django.core.management.base import BaseCommand

from apps.knowledge_base.jobs.queue import refresh_connection, worker_id
from apps.knowledge_base.jobs.runner import run_next_job


class Command(BaseCommand):
    help = "Process knowledge-base ingestion jobs."

    def add_arguments(self, parser):
        parser.add_argument("--once", action="store_true", help="Process every job that is ready now, then exit.")
        parser.add_argument("--poll-interval", type=float, default=None, help="Seconds to wait when idle.")

    def handle(self, *args, once=False, poll_interval=None, **options):
        interval = poll_interval or settings.KNOWLEDGE_BASE["WORKER_POLL_SECONDS"]
        owner = worker_id()
        stop = threading.Event()

        for name in ("SIGINT", "SIGTERM"):
            number = getattr(signal, name, None)
            if number is not None:
                signal.signal(number, lambda *_: stop.set())

        self.stdout.write(f"Knowledge-base worker {owner} started.")
        processed = 0
        while not stop.is_set():
            refresh_connection()
            if run_next_job(owner):
                processed += 1
                continue
            if once:
                break
            stop.wait(interval)
        self.stdout.write(f"Worker stopped after {processed} job(s).")
