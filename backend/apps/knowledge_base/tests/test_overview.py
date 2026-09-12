from django.core.cache import cache
from django.urls import reverse

from apps.knowledge_base.ai_client import AIServiceUnavailable
from apps.knowledge_base.constants import QueryKind
from apps.knowledge_base.models import RagQueryLog

from .base import KnowledgeBaseTestCase


class OverviewTests(KnowledgeBaseTestCase):
    def overview(self):
        cache.clear()
        response = self.client.get(reverse("knowledge_base:overview", args=[self.knowledge_base.pk]))
        self.assertEqual(response.status_code, 200)
        return self.data(response)

    def test_counts_and_a_healthy_index(self):
        self.ready()
        self.uploaded("pending.md", b"Not yet processed.")

        body = self.overview()

        self.assertEqual(body["counts"]["documents"], 2)
        self.assertEqual((body["counts"]["ready"], body["counts"]["processing"]), (1, 1))
        self.assertEqual(body["counts"]["chunks"], 2)
        self.assertEqual(body["health"]["status"], "healthy")
        self.assertEqual(body["sources"]["by_type"], {"file": 2})
        self.assertEqual(body["recent_activity"][0]["action"], "document.uploaded")
        self.assertIsNotNone(body["last_ingestion_at"])

    def test_an_index_that_disagrees_with_the_records_is_degraded(self):
        self.ready()
        self.ai.vectors.clear()  # the vectors vanished behind this database's back
        health = self.overview()["health"]
        self.assertEqual((health["status"], health["indexed_points"], health["expected_points"]), ("degraded", 0, 2))

    def test_an_unreachable_ai_service_is_reported_as_such(self):
        self.ai.fail("index_stats", AIServiceUnavailable())
        self.assertEqual(self.overview()["health"]["status"], "unavailable")

    def test_query_statistics_cover_the_last_week(self):
        for support in ("SUPPORTED", "SUPPORTED", "INSUFFICIENT_CONTEXT"):
            RagQueryLog.objects.create(workspace=self.workspace, knowledge_base=self.knowledge_base,
                                       kind=QueryKind.CHAT, support=support, total_ms=100)
        queries = self.overview()["queries"]
        self.assertEqual((queries["total"], queries["supported"], queries["insufficient_context"]), (3, 2, 1))
        self.assertEqual(queries["average_ms"], 100)
