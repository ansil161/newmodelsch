from django.urls import reverse

from apps.knowledge_base.ai_client import AIServiceError, AIServiceUnavailable
from apps.knowledge_base.constants import FAILURE_MESSAGES, DocumentStatus, JobKind, JobStatus, Stage
from apps.knowledge_base.jobs.runner import DELETE_FAILED
from apps.knowledge_base.models import AuditLog, Document, IngestionJob, KnowledgeBase, KnowledgeSource
from apps.knowledge_base.storage import get_storage

from .base import KnowledgeBaseTestCase


def detail(document):
    return reverse("knowledge_base:document", args=[document.pk])


class UploadTests(KnowledgeBaseTestCase):
    def test_an_upload_is_stored_privately_and_queued(self):
        response = self.upload()

        self.assertEqual(response.status_code, 201)
        body = self.data(response)["document"]
        self.assertEqual((body["status"], body["title"], body["file_type"]), ("queued", "guide", "md"))
        self.assertFalse(body["is_live"])

        document = Document.objects.get(pk=body["id"])
        version = document.latest_version
        self.assertTrue(version.file.name.startswith(f"{self.workspace.pk}/{self.knowledge_base.pk}/"))
        self.assertNotIn("guide", version.file.name)  # a user's filename never becomes a path
        self.assertEqual(version.original_filename, "guide.md")
        self.assertEqual(version.mime_type, "text/markdown")
        self.assertEqual(IngestionJob.objects.filter(document=document, kind=JobKind.INGEST).count(), 1)
        self.assertTrue(AuditLog.objects.filter(action="document.uploaded", target_id=str(document.pk)).exists())

    def test_processing_extracts_stores_indexes_and_goes_live(self):
        document = self.ready()

        self.assertEqual(document.status, DocumentStatus.READY)
        self.assertEqual(document.chunk_count, 2)
        self.assertEqual(document.active_version, document.latest_version)
        self.assertIsNotNone(document.indexed_at)

        (_, identity, details), = self.ai.calls_to("index_document")
        payload = details["payload"]
        job = IngestionJob.objects.get(document=document)
        self.assertEqual(identity.tenant_id, str(self.workspace.pk))
        self.assertEqual(payload["knowledgeBaseId"], str(self.knowledge_base.pk))
        self.assertEqual(payload["indexGeneration"], job.pk)
        self.assertEqual(
            [chunk["chunkId"] for chunk in payload["chunks"]],
            [str(chunk.pk) for chunk in document.active_version.chunks.order_by("index")],
        )
        self.assertEqual(job.status, JobStatus.SUCCEEDED)

    def test_refused_uploads_say_why_and_store_nothing(self):
        cases = [
            ("program.exe", b"MZ\x00\x00", "unsupported_file_type"),
            ("report.pdf", b"just text, not a pdf", "file_type_mismatch"),
            ("picture.txt", b"\x89PNG\r\n\x1a\n\x00\x00", "file_type_mismatch"),
            ("empty.txt", b"", "empty_file"),
            ("big.txt", b"a" * (1024 * 1024 + 1), "file_too_large"),
        ]
        for name, content, code in cases:
            with self.subTest(file=name):
                response = self.upload(name=name, content=content, content_type="application/octet-stream")
                self.assertEqual(response.status_code, 400, response.content)
                self.assertEqual(response.json()["code"], code)
                self.assertTrue(response.json()["message"])
        self.assertFalse(Document.objects.exists())

    def test_a_legacy_word_file_gets_advice(self):
        response = self.upload(name="letter.docx", content=b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1rest")
        self.assertEqual(response.status_code, 400)
        self.assertIn(".docx", response.json()["message"])

    def test_a_body_larger_than_the_limit_is_refused_before_it_is_read(self):
        response = self.upload(name="huge.txt", content=b"a" * (2 * 1024 * 1024))
        self.assertEqual(response.status_code, 413)
        self.assertEqual(response.json()["code"], "file_too_large")

    def test_the_same_file_twice_is_refused_as_a_duplicate(self):
        self.uploaded()
        response = self.upload(name="copy-of-guide.md")
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["code"], "duplicate_document")
        self.assertIn("guide", response.json()["message"])

    def test_the_same_file_may_go_into_another_knowledge_base(self):
        self.uploaded()
        other = KnowledgeBase.objects.create(workspace=self.workspace, name="Archive")
        self.assertEqual(self.upload(knowledge_base=other).status_code, 201)

    def test_metadata_travels_to_the_index(self):
        self.ready(category="fees", tags="Finance, Termly, finance", language="en")
        (_, _, details), = self.ai.calls_to("index_document")
        self.assertEqual(details["payload"]["category"], "fees")
        self.assertEqual(details["payload"]["tags"], ["finance", "termly"])
        self.assertEqual(details["payload"]["language"], "en")

    def test_invalid_metadata_is_refused_field_by_field(self):
        response = self.upload(language="english!")
        self.assertEqual(response.status_code, 400)
        self.assertIn("language", response.json()["errors"])


class FailureTests(KnowledgeBaseTestCase):
    def test_a_refused_document_fails_with_the_ai_services_explanation(self):
        self.ai.fail("extract_file", AIServiceError(
            "This PDF is password-protected. Remove the password and upload it again.",
            code="DOCUMENT_ENCRYPTED", status=422,
        ))
        document = self.ready()

        self.assertEqual(document.status, DocumentStatus.FAILED)
        self.assertEqual(document.error_code, "DOCUMENT_ENCRYPTED")
        body = self.data(self.client.get(detail(document)))["document"]
        self.assertIn("password-protected", body["error"]["message"])
        self.assertEqual(IngestionJob.objects.get(document=document).status, JobStatus.FAILED)
        self.assertEqual(self.ai.calls_to("index_document"), [])

    def test_an_unreachable_ai_service_is_retried_and_then_reported(self):
        self.ai.fail("extract_file", AIServiceUnavailable(), AIServiceUnavailable(), AIServiceUnavailable())
        document = self.uploaded()

        self.run_jobs()
        document.refresh_from_db()
        self.assertEqual((document.status, document.stage), (DocumentStatus.QUEUED, Stage.RETRYING))
        self.assertIn("retried automatically", document.error_message)

        for _ in range(2):
            self.make_ready()
            self.run_jobs()
        document.refresh_from_db()
        job = IngestionJob.objects.get(document=document)
        self.assertEqual(document.status, DocumentStatus.FAILED)
        self.assertEqual((job.status, job.attempts), (JobStatus.FAILED, 3))

    def test_a_transient_failure_that_clears_ends_ready(self):
        self.ai.fail("index_document", AIServiceUnavailable())
        document = self.uploaded()
        self.run_jobs()
        self.make_ready()
        self.run_jobs()
        document.refresh_from_db()
        self.assertEqual(document.status, DocumentStatus.READY)

    def test_one_failed_document_does_not_stop_the_others(self):
        self.ai.file_failures["b.md"] = AIServiceError("Unreadable.", code="DOCUMENT_CORRUPT", status=422)
        first = self.uploaded("a.md", b"Alpha text.")
        broken = self.uploaded("b.md", b"Beta text.")
        last = self.uploaded("c.md", b"Gamma text.")

        self.run_jobs()

        statuses = {doc.title: doc.status for doc in Document.objects.filter(pk__in=[first.pk, broken.pk, last.pk])}
        self.assertEqual(statuses, {"a": "ready", "b": "failed", "c": "ready"})

    def test_a_failed_document_can_be_retried(self):
        self.ai.fail("extract_file", AIServiceError("Try again later.", code="EMBEDDING_UNAVAILABLE", status=422))
        document = self.ready()
        self.assertEqual(document.status, DocumentStatus.FAILED)

        response = self.client.post(reverse("knowledge_base:document-retry", args=[document.pk]))
        self.assertEqual(response.status_code, 202)
        self.assertEqual(self.data(response)["document"]["status"], "queued")
        self.run_jobs()
        document.refresh_from_db()
        self.assertEqual(document.status, DocumentStatus.READY)

    def test_a_healthy_document_cannot_be_retried(self):
        document = self.ready()
        response = self.client.post(reverse("knowledge_base:document-retry", args=[document.pk]))
        self.assertEqual(response.status_code, 409)

    def test_an_unexpected_crash_is_reported_without_its_details(self):
        self.ai.fail("extract_file", RuntimeError("secret internals at /srv/app/config.py"))
        document = self.uploaded()
        self.run_jobs()
        document.refresh_from_db()
        self.assertEqual(document.error_message, FAILURE_MESSAGES["INTERNAL_ERROR"])
        self.assertNotIn("secret", document.error_message)


class LifecycleTests(KnowledgeBaseTestCase):
    def test_deleting_removes_the_vectors_then_the_rows_then_the_file(self):
        document = self.ready()
        stored = document.latest_version.file.name

        response = self.client.delete(detail(document))
        self.assertEqual(response.status_code, 202)
        self.assertEqual(self.data(response)["document"]["status"], "deleting")

        self.run_jobs()
        self.assertEqual(len(self.ai.calls_to("delete_document")), 1)
        self.assertEqual(self.ai.vectors, {})
        self.assertFalse(Document.objects.filter(pk=document.pk).exists())
        self.assertFalse(KnowledgeSource.objects.filter(knowledge_base=self.knowledge_base).exists())
        self.assertFalse(get_storage().exists(stored))

    def test_a_failed_vector_delete_keeps_the_document_and_can_be_retried(self):
        document = self.ready()
        self.ai.fail("delete_document", AIServiceError("Index unavailable.", code="X", status=422))

        self.client.delete(detail(document))
        self.run_jobs()
        document.refresh_from_db()
        self.assertEqual((document.status, document.error_code), (DocumentStatus.FAILED, DELETE_FAILED))

        self.client.post(reverse("knowledge_base:document-retry", args=[document.pk]))
        self.run_jobs()
        self.assertFalse(Document.objects.filter(pk=document.pk).exists())

    def test_deleting_cancels_processing_that_has_not_started(self):
        document = self.uploaded()
        self.client.delete(detail(document))
        self.run_jobs()

        self.assertFalse(Document.objects.filter(pk=document.pk).exists())
        self.assertEqual(self.ai.calls_to("extract_file"), [])
        self.assertEqual(IngestionJob.objects.get(kind=JobKind.INGEST).status, JobStatus.CANCELLED)

    def test_reprocessing_rewrites_the_index_under_a_new_generation(self):
        document = self.ready()
        response = self.client.post(reverse("knowledge_base:document-reprocess", args=[document.pk]))
        self.assertEqual(response.status_code, 202)
        self.run_jobs()

        generations = [call[2]["payload"]["indexGeneration"] for call in self.ai.calls_to("index_document")]
        self.assertEqual(len(generations), 2)
        self.assertLess(generations[0], generations[1])
        document.refresh_from_db()
        self.assertEqual(document.status, DocumentStatus.READY)

    def test_reprocessing_is_refused_while_the_document_is_processing(self):
        document = self.uploaded()
        response = self.client.post(reverse("knowledge_base:document-reprocess", args=[document.pk]))
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["code"], "already_processing")

    def test_cancelling_before_processing_starts(self):
        document = self.uploaded()
        response = self.client.post(reverse("knowledge_base:document-cancel", args=[document.pk]))

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json()["message"], "Processing was cancelled.")
        self.assertEqual(self.data(response)["document"]["status"], "failed")
        self.assertEqual(self.run_jobs(), 0)

    def test_cancelling_during_processing_stops_before_indexing(self):
        document = self.uploaded()
        self.ai.before["extract_file"] = lambda: IngestionJob.objects.update(cancel_requested=True)
        self.run_jobs()

        document.refresh_from_db()
        self.assertEqual((document.status, document.error_code), (DocumentStatus.FAILED, "CANCELLED"))
        self.assertEqual(self.ai.calls_to("index_document"), [])
        self.assertEqual(IngestionJob.objects.get().status, JobStatus.CANCELLED)

    def test_a_new_version_goes_live_only_once_processed_and_a_failure_keeps_the_old_one(self):
        document = self.ready()
        first = document.active_version

        response = self.client.post(
            reverse("knowledge_base:document-versions", args=[document.pk]),
            {"file": self._file("guide.md", b"# Fees\n\nTuition is paid monthly now.")}, format="multipart",
        )
        self.assertEqual(response.status_code, 201)
        body = self.data(response)["document"]
        self.assertEqual((body["latest_version"], body["active_version"], body["is_live"]), (2, 1, True))

        self.ai.fail("index_document", AIServiceError("Refused.", code="X", status=422))
        self.run_jobs()
        document.refresh_from_db()
        self.assertEqual(document.status, DocumentStatus.FAILED)
        self.assertEqual(document.active_version, first)  # still answering from v1

        self.client.post(
            reverse("knowledge_base:document-versions", args=[document.pk]),
            {"file": self._file("guide.md", b"# Fees\n\nTuition is paid weekly.")}, format="multipart",
        )
        self.run_jobs()
        document.refresh_from_db()
        self.assertEqual((document.status, document.active_version.number), (DocumentStatus.READY, 3))
        self.assertFalse(first.chunks.exists())

    def test_restoring_an_earlier_version(self):
        document = self.ready(content=b"Original wording.")
        self.client.post(
            reverse("knowledge_base:document-versions", args=[document.pk]),
            {"file": self._file("guide.md", b"Revised wording.")}, format="multipart",
        )
        self.run_jobs()
        first = document.versions.get(number=1)

        response = self.client.post(
            reverse("knowledge_base:document-version-activate", args=[document.pk, first.pk])
        )
        self.assertEqual(response.status_code, 202)
        self.run_jobs()

        document.refresh_from_db()
        self.assertEqual(document.active_version, first)
        self.assertEqual(self.ai.calls_to("extract_file")[-1][2]["data"], b"Original wording.")

    def test_editing_retrieval_metadata_rewrites_the_index_without_re_extracting(self):
        document = self.ready()
        response = self.client.patch(detail(document), {"category": "fees"}, format="json")
        self.assertEqual(self.data(response)["document"]["status"], "queued")
        self.run_jobs()

        self.assertEqual(len(self.ai.calls_to("extract_file")), 1)
        self.assertEqual(self.ai.calls_to("index_document")[-1][2]["payload"]["category"], "fees")
        document.refresh_from_db()
        self.assertEqual(document.status, DocumentStatus.READY)

    def test_editing_only_the_description_leaves_the_index_alone(self):
        document = self.ready()
        self.client.patch(detail(document), {"description": "The fee schedule."}, format="json")
        self.assertEqual(IngestionJob.objects.filter(kind=JobKind.REINDEX).count(), 0)

    def _file(self, name, content):
        from django.core.files.uploadedfile import SimpleUploadedFile

        return SimpleUploadedFile(name, content, content_type="text/markdown")


class ListingTests(KnowledgeBaseTestCase):
    def test_documents_can_be_searched_filtered_sorted_and_paged(self):
        self.ready("admissions.md", b"Admissions open in January.")
        self.ready("fees.csv", b"Term,Amount\nFirst,12000", content_type="text/csv")
        self.uploaded("transport.txt", b"Buses leave at seven.", content_type="text/plain")
        url = reverse("knowledge_base:documents", args=[self.knowledge_base.pk])

        def titles(**params):
            return [item["title"] for item in self.data(self.client.get(url, params))["results"]]

        self.assertEqual(titles(search="fee"), ["fees"])
        self.assertEqual(titles(status="processing"), ["transport"])
        self.assertEqual(titles(type="csv"), ["fees"])
        self.assertEqual(titles(ordering="title"), ["admissions", "fees", "transport"])

        page = self.data(self.client.get(url, {"ordering": "title", "page_size": 1, "page": 2}))
        self.assertEqual([item["title"] for item in page["results"]], ["fees"])
        self.assertEqual(page["pagination"], {"page": 2, "page_size": 1, "total": 3, "total_pages": 3})

    def test_the_live_versions_chunks_are_listed(self):
        document = self.ready()
        body = self.data(self.client.get(reverse("knowledge_base:document-chunks", args=[document.pk])))
        self.assertEqual([chunk["content"] for chunk in body["results"]], ["# Fees", "Tuition is paid termly."])
        self.assertTrue(body["version"]["is_active"])

    def test_the_original_file_downloads_as_an_attachment(self):
        document = self.ready()
        response = self.client.get(reverse("knowledge_base:document-download", args=[document.pk]))

        self.assertEqual(response.status_code, 200)
        self.assertIn("attachment", response["Content-Disposition"])
        self.assertEqual(response["X-Content-Type-Options"], "nosniff")
        self.assertEqual(b"".join(response.streaming_content), b"# Fees\n\nTuition is paid termly.")
