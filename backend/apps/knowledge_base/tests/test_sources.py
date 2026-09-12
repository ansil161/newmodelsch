from django.urls import reverse

from apps.knowledge_base.constants import DocumentStatus, JobStatus
from apps.knowledge_base.models import Document, IngestionJob, KnowledgeSource

from .base import KnowledgeBaseTestCase

PAGE = "https://school.example/fees"


class SourceTests(KnowledgeBaseTestCase):
    def add(self, **payload):
        return self.client.post(
            reverse("knowledge_base:sources", args=[self.knowledge_base.pk]), payload, format="json"
        )

    def added_page(self, url=PAGE):
        response = self.add(type="url", url=url)
        self.assertEqual(response.status_code, 201, response.content)
        self.run_jobs()
        return Document.objects.get(source_id=self.data(response)["source"]["id"])

    def test_a_web_page_is_fetched_and_titled_from_the_page(self):
        document = self.added_page()

        self.assertEqual(document.status, DocumentStatus.READY)
        self.assertEqual(document.title, "Fetched page title")
        self.assertEqual(self.ai.calls_to("extract_url")[0][2]["url"], PAGE)
        payload = self.ai.calls_to("index_document")[0][2]["payload"]
        self.assertEqual((payload["sourceType"], payload["sourceUrl"]), ("url", PAGE))

    def test_links_into_private_networks_or_with_credentials_are_refused(self):
        cases = {
            "http://127.0.0.1/admin": "blocked_url",
            "http://localhost:8000/": "blocked_url",
            "http://169.254.169.254/latest/meta-data/": "blocked_url",
            "http://printer.local/": "blocked_url",
            "ftp://files.example.org/handbook.pdf": "invalid_url",
            "https://user:secret@example.org/": "invalid_url",
        }
        for url, code in cases.items():
            with self.subTest(url=url):
                response = self.add(type="url", url=url)
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.json()["code"], code)
        self.assertFalse(KnowledgeSource.objects.exists())

    def test_the_same_page_twice_is_refused(self):
        self.added_page()
        self.assertEqual(self.add(type="url", url=PAGE).status_code, 409)

    def test_refreshing_an_unchanged_page_keeps_the_live_version(self):
        document = self.added_page()
        response = self.client.post(reverse("knowledge_base:source-sync", args=[document.source_id]))
        self.assertEqual(response.status_code, 202)
        self.run_jobs()

        document.refresh_from_db()
        self.assertEqual(document.versions.count(), 1)
        self.assertEqual(document.status, DocumentStatus.READY)
        self.assertEqual(len(self.ai.calls_to("index_document")), 1)
        sync = IngestionJob.objects.filter(document=document).order_by("-pk").first()
        self.assertEqual((sync.status, sync.result.get("unchanged")), (JobStatus.SUCCEEDED, True))

    def test_refreshing_a_changed_page_publishes_a_new_version(self):
        document = self.added_page()
        self.ai.pages[PAGE] = "Visiting hours are now eight to five."
        self.client.post(reverse("knowledge_base:source-sync", args=[document.source_id]))
        self.run_jobs()

        document.refresh_from_db()
        self.assertEqual((document.versions.count(), document.active_version.number), (2, 2))
        self.assertEqual(document.chunk_count, 1)

    def test_pasted_text_becomes_a_document(self):
        response = self.add(type="text", title="Office hours",
                            content="The office opens at nine.\n\nIt closes at four.")
        self.assertEqual(response.status_code, 201)
        self.run_jobs()

        document = Document.objects.get(title="Office hours")
        self.assertEqual((document.status, document.chunk_count, document.file_type), ("ready", 2, "md"))

    def test_text_needs_a_title_and_content(self):
        response = self.add(type="text", title="", content="  ")
        self.assertEqual(response.status_code, 400)
        self.assertIn("title", response.json()["errors"])

    def test_deleting_a_source_deletes_its_documents_and_their_vectors(self):
        document = self.added_page()
        response = self.client.delete(reverse("knowledge_base:source", args=[document.source_id]))
        self.assertEqual(response.status_code, 202)
        self.run_jobs()

        self.assertFalse(KnowledgeSource.objects.exists())
        self.assertFalse(Document.objects.exists())
        self.assertEqual(self.ai.vectors, {})

    def test_only_web_pages_can_be_refreshed(self):
        self.add(type="text", title="Note", content="Some text.")
        source = KnowledgeSource.objects.get()
        response = self.client.post(reverse("knowledge_base:source-sync", args=[source.pk]))
        self.assertEqual(response.status_code, 409)

    def test_sources_list_with_their_document(self):
        self.added_page()
        body = self.data(self.client.get(reverse("knowledge_base:sources", args=[self.knowledge_base.pk])))
        (source,) = body["results"]
        self.assertEqual((source["source_type"], source["url"]), ("url", PAGE))
        self.assertEqual(source["document"]["status"], "ready")
