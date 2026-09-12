from django.urls import reverse

from apps.knowledge_base.ai_client import AIServiceError, AIServiceUnavailable
from apps.knowledge_base.constants import Messages
from apps.knowledge_base.models import KnowledgeBase, RagQueryLog

from .base import KnowledgeBaseTestCase


class RagTestTests(KnowledgeBaseTestCase):
    url = reverse("knowledge_base:rag-test")

    def ask(self, **payload):
        return self.client.post(
            self.url, {"knowledge_base": str(self.knowledge_base.pk), "question": "When are fees due?", **payload},
            format="json",
        )

    def test_the_tenant_and_knowledge_base_come_from_the_database_not_the_request(self):
        self.login(self.viewer)
        response = self.ask(
            filters={"tags": ["Fees"]},
            options={"generate": False, "final_k": 3},
            knowledgeBaseId="someone-elses", tenant_id="another-tenant",
        )

        self.assertEqual(response.status_code, 200, response.content)
        (_, identity, details), = self.ai.calls_to("rag_test")
        payload = details["payload"]
        self.assertEqual(identity.tenant_id, str(self.workspace.pk))
        self.assertTrue(identity.is_admin)
        self.assertEqual(payload["knowledgeBaseId"], str(self.knowledge_base.pk))
        self.assertEqual(payload["filters"]["tags"], ["fees"])
        self.assertEqual((payload["options"]["finalK"], payload["options"]["generate"]), (3, False))

    def test_the_answer_comes_back_in_this_apis_convention_and_is_logged(self):
        body = self.data(self.ask())
        self.assertEqual(body["trace"]["filters"]["tenant_id"], str(self.workspace.pk))
        self.assertIn("total_ms", body["timings"])

        log = RagQueryLog.objects.get()
        self.assertEqual((log.kind, log.support, log.total_ms), ("test", "SUPPORTED", 33))

    def test_an_outsider_cannot_test_another_workspaces_knowledge_base(self):
        self.login(self.outsider)
        self.assertEqual(self.ask().status_code, 404)
        self.assertEqual(self.ai.calls_to("rag_test"), [])

    def test_an_ai_outage_is_reported_without_its_details(self):
        self.ai.fail("rag_test", AIServiceUnavailable())
        response = self.ask()
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["message"], Messages.AI_UNAVAILABLE)
        self.assertEqual(RagQueryLog.objects.get().error_code, "AI_SERVICE_UNAVAILABLE")

    def test_a_refused_question_carries_the_services_reason(self):
        self.ai.fail("rag_test", AIServiceError("Enter a question.", code="INVALID_REQUEST", status=400))
        response = self.ask()
        self.assertEqual(response.status_code, 400)
        self.assertEqual((response.json()["code"], response.json()["message"]), ("invalid_request", "Enter a question."))


class ChatTests(KnowledgeBaseTestCase):
    url = reverse("knowledge_base:chat")
    stream_url = reverse("knowledge_base:chat-stream")

    def test_a_workspace_chat_searches_only_the_chat_enabled_knowledge_bases(self):
        enabled = KnowledgeBase.objects.create(workspace=self.workspace, name="Public FAQ", chat_enabled=True)
        response = self.client.post(self.url, {"workspace": str(self.workspace.pk), "message": "Fees?"}, format="json")

        self.assertEqual(response.status_code, 200, response.content)
        (_, identity, details), = self.ai.calls_to("chat")
        self.assertEqual(details["payload"]["filters"]["knowledgeBaseIds"], [str(enabled.pk)])
        self.assertFalse(identity.is_admin)
        body = self.data(response)
        self.assertEqual(body["metadata"]["support"], "SUPPORTED")
        self.assertEqual(body["sources"][0]["document_name"], "Guide")

    def test_a_workspace_with_nothing_enabled_says_so_without_asking_a_model(self):
        response = self.client.post(self.url, {"workspace": str(self.workspace.pk), "message": "Fees?"}, format="json")
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["code"], "no_chat_knowledge")
        self.assertEqual(self.ai.calls_to("chat"), [])

    def test_a_named_knowledge_base_can_be_tried_before_it_is_enabled(self):
        self.client.post(self.url, {"knowledge_base": str(self.knowledge_base.pk), "message": "Fees?"}, format="json")
        (_, _, details), = self.ai.calls_to("chat")
        self.assertEqual(details["payload"]["filters"]["knowledgeBaseIds"], [str(self.knowledge_base.pk)])

    def test_chat_is_refused_outside_the_callers_workspaces(self):
        self.login(self.outsider)
        response = self.client.post(self.url, {"workspace": str(self.workspace.pk), "message": "Hi"}, format="json")
        self.assertEqual(response.status_code, 404)

    def test_the_stream_is_relayed_frame_by_frame_in_this_apis_convention(self):
        response = self.client.post(
            self.stream_url, {"knowledge_base": str(self.knowledge_base.pk), "message": "Fees?"}, format="json"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/event-stream")
        self.assertEqual(response["X-Accel-Buffering"], "no")
        body = b"".join(response.streaming_content).decode()
        self.assertIn("event: token", body)
        self.assertIn('"conversation_id":null', body)
        self.assertIn('"document_name":"Guide"', body)
        self.assertIn(": keepalive", body)
        self.assertEqual(RagQueryLog.objects.get().support, "SUPPORTED")

    def test_a_stream_that_cannot_start_is_an_ordinary_error(self):
        self.ai.fail("stream_chat", AIServiceUnavailable())
        response = self.client.post(
            self.stream_url, {"knowledge_base": str(self.knowledge_base.pk), "message": "Fees?"}, format="json"
        )
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["code"], "service_unavailable")

    def test_a_browser_asking_for_an_event_stream_gets_one(self):
        # What the console sends. DRF's negotiation used to answer 406 to it.
        response = self.client.post(
            self.stream_url, {"knowledge_base": str(self.knowledge_base.pk), "message": "Fees?"},
            format="json", HTTP_ACCEPT="text/event-stream",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/event-stream")
        self.assertIn("event: token", b"".join(response.streaming_content).decode())

    def test_an_error_before_the_stream_is_json_even_when_a_stream_was_asked_for(self):
        self.ai.fail("stream_chat", AIServiceUnavailable())
        response = self.client.post(
            self.stream_url, {"knowledge_base": str(self.knowledge_base.pk), "message": "Fees?"},
            format="json", HTTP_ACCEPT="text/event-stream",
        )
        self.assertEqual(response.status_code, 503)
        self.assertIn("application/json", response["Content-Type"])
        self.assertEqual(response.json()["code"], "service_unavailable")
