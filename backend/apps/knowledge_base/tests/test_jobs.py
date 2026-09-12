import io
from datetime import timedelta

from django.core.management import call_command
from django.db import IntegrityError, transaction
from django.urls import reverse
from django.utils import timezone

from apps.knowledge_base.ai_client import AIServiceError
from apps.knowledge_base.constants import DocumentStatus, JobKind, JobStatus, KnowledgeBaseStatus
from apps.knowledge_base.jobs import queue
from apps.knowledge_base.models import Document, IngestionJob, KnowledgeBase

from .base import KnowledgeBaseTestCase


class QueueTests(KnowledgeBaseTestCase):
    def test_a_job_whose_worker_died_is_reclaimed_as_a_new_attempt(self):
        self.uploaded()
        job = IngestionJob.objects.get()
        IngestionJob.objects.filter(pk=job.pk).update(
            status=JobStatus.RUNNING, attempts=1, heartbeat_at=timezone.now() - timedelta(hours=1)
        )

        claimed = queue.claim_next("second-worker")

        self.assertEqual(claimed.pk, job.pk)
        self.assertEqual((claimed.attempts, claimed.locked_by), (2, "second-worker"))

    def test_a_job_with_a_live_heartbeat_is_left_alone(self):
        self.uploaded()
        IngestionJob.objects.update(status=JobStatus.RUNNING, heartbeat_at=timezone.now())
        self.assertIsNone(queue.claim_next("second-worker"))

    def test_the_database_refuses_a_second_writer_for_one_document(self):
        document = self.uploaded()
        with self.assertRaises(IntegrityError), transaction.atomic():
            IngestionJob.objects.create(
                kind=JobKind.REINDEX, workspace=self.workspace, knowledge_base=self.knowledge_base, document=document
            )

    def test_a_deletion_waits_for_a_writer_that_is_still_running(self):
        document = self.ready()
        IngestionJob.objects.create(
            kind=JobKind.REINDEX, workspace=self.workspace, knowledge_base=self.knowledge_base,
            document=document, status=JobStatus.RUNNING, heartbeat_at=timezone.now(),
        )
        self.client.delete(reverse("knowledge_base:document", args=[document.pk]))

        self.run_jobs()

        self.assertTrue(Document.objects.filter(pk=document.pk).exists())
        self.assertEqual(self.ai.calls_to("delete_document"), [])
        waiting = IngestionJob.objects.get(kind=JobKind.DELETE_DOCUMENT)
        self.assertEqual((waiting.status, waiting.attempts), (JobStatus.QUEUED, 0))

    def test_the_worker_command_drains_the_queue(self):
        document = self.uploaded()
        output = io.StringIO()
        call_command("process_documents", "--once", stdout=output)
        document.refresh_from_db()
        self.assertEqual(document.status, DocumentStatus.READY)
        self.assertIn("after 1 job(s)", output.getvalue())


class KnowledgeBaseDeletionTests(KnowledgeBaseTestCase):
    def test_deleting_a_knowledge_base_removes_everything_in_it_and_nothing_else(self):
        self.ready()
        other = KnowledgeBase.objects.create(workspace=self.workspace, name="Archive")
        self.ready("keep.md", b"Keep this.", knowledge_base=other)
        self.login(self.admin)

        response = self.client.delete(reverse("knowledge_base:knowledge-base", args=[self.knowledge_base.pk]))
        self.assertEqual(response.status_code, 202)
        self.run_jobs()

        self.assertFalse(KnowledgeBase.objects.filter(pk=self.knowledge_base.pk).exists())
        self.assertEqual(list(Document.objects.values_list("title", flat=True)), ["keep"])
        (_, identity, details), = self.ai.calls_to("delete_knowledge_base")
        self.assertEqual(identity.tenant_id, str(self.workspace.pk))
        self.assertEqual(len(self.ai.vectors), 1)

    def test_a_knowledge_base_whose_vectors_cannot_be_deleted_comes_back(self):
        self.ready()
        self.ai.fail("delete_knowledge_base", AIServiceError("Refused.", code="X", status=422))
        self.login(self.admin)
        self.client.delete(reverse("knowledge_base:knowledge-base", args=[self.knowledge_base.pk]))
        self.run_jobs()

        self.knowledge_base.refresh_from_db()
        self.assertEqual(self.knowledge_base.status, KnowledgeBaseStatus.ACTIVE)
        self.assertEqual(Document.objects.get().status, DocumentStatus.READY)

    def test_a_knowledge_base_being_deleted_accepts_no_changes(self):
        KnowledgeBase.objects.filter(pk=self.knowledge_base.pk).update(status=KnowledgeBaseStatus.DELETING)
        response = self.upload()
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["code"], "invalid_state")


class IndexVerificationTests(KnowledgeBaseTestCase):
    """A document goes live only when every chunk is confirmed in the vector store."""

    # The default upload extracts to two chunks: one per paragraph.

    def test_a_document_whose_vectors_were_not_all_stored_is_not_made_ready(self):
        self.ai.indexed_shortfall = 1
        document = self.uploaded()
        self.run_jobs()

        document.refresh_from_db()
        job = IngestionJob.objects.get()
        self.assertNotEqual(document.status, DocumentStatus.READY)
        self.assertIsNone(document.active_version_id)
        self.assertEqual(document.error_code, "INDEX_VERIFICATION_FAILED")
        self.assertEqual((job.status, job.error_code), (JobStatus.QUEUED, "INDEX_VERIFICATION_FAILED"))

    def test_a_write_that_never_verifies_fails_once_its_retries_run_out(self):
        self.ai.indexed_shortfall = 1
        document = self.uploaded()
        for _ in range(3):
            self.make_ready()
            self.run_jobs()

        document.refresh_from_db()
        self.assertEqual((document.status, document.error_code), (DocumentStatus.FAILED, "INDEX_VERIFICATION_FAILED"))
        self.assertEqual(IngestionJob.objects.get().status, JobStatus.FAILED)

    def test_a_write_that_verifies_on_retry_goes_live(self):
        self.ai.indexed_shortfall = 1
        document = self.uploaded()
        self.run_jobs()

        self.ai.indexed_shortfall = 0
        self.make_ready()
        self.run_jobs()

        document.refresh_from_db()
        self.assertEqual((document.status, document.chunk_count), (DocumentStatus.READY, 2))
