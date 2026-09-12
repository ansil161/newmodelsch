from django.conf import settings
from django.urls import reverse
from rest_framework.test import APIClient

from apps.knowledge_base.ai_client import AIServiceUnavailable
from apps.knowledge_base.models import KnowledgeBase, RagQueryLog

from .base import KnowledgeBaseTestCase


class PublicChatTests(KnowledgeBaseTestCase):
    """The website's chatbot: anonymous, scoped by configuration, limited per IP."""

    url = reverse("knowledge_base:public-chat-stream")

    def setUp(self):
        super().setUp()
        self.client.force_authenticate(user=None)
        self.enabled = KnowledgeBase.objects.create(workspace=self.workspace, name="Public FAQ", chat_enabled=True)
        # Chat-enabled too, but in a workspace the website does not answer from.
        KnowledgeBase.objects.create(workspace=self.other_workspace, name="Elsewhere FAQ", chat_enabled=True)
        self.configure()

    def configure(self, *, rates=None, **overrides):
        config = {
            **settings.KNOWLEDGE_BASE,
            "PUBLIC_CHAT_WORKSPACE": "school",
            "THROTTLE_RATES": {**settings.KNOWLEDGE_BASE["THROTTLE_RATES"], **(rates or {})},
            **overrides,
        }
        override = self.settings(KNOWLEDGE_BASE=config)
        override.enable()
        self.addCleanup(override.disable)

    def ask(self, body=None, *, client=None, ip="198.51.100.20"):
        response = (client or self.client).post(
            self.url, body or {"message": "When are fees due?"}, format="json", REMOTE_ADDR=ip,
        )
        if response.streaming:
            # Reading the stream is what completes it, and what logs it.
            response.body_text = b"".join(response.streaming_content).decode()
        return response

    def test_an_anonymous_visitor_is_answered_from_the_chat_enabled_knowledge_bases_only(self):
        response = self.ask({
            "message": "When are fees due?",
            "history": [{"role": "user", "content": "Hi"}, {"role": "assistant", "content": "Hello!"}],
        })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/event-stream")
        self.assertIn("event: token", response.body_text)
        (_, identity, details), = self.ai.calls_to("stream_chat")
        self.assertEqual(identity.tenant_id, str(self.workspace.pk))
        self.assertTrue(identity.user_id.startswith("visitor:"))
        self.assertFalse(identity.is_admin)
        self.assertEqual(details["payload"]["filters"]["knowledgeBaseIds"], [str(self.enabled.pk)])
        self.assertEqual(details["payload"]["history"][1], {"role": "assistant", "content": "Hello!"})

    def test_the_request_cannot_choose_what_is_searched(self):
        self.ask({
            "message": "Fees?",
            "workspace": str(self.other_workspace.pk),
            "knowledge_base": str(self.knowledge_base.pk),
            "filters": {"knowledgeBaseIds": ["anything"]},
        })
        (_, identity, details), = self.ai.calls_to("stream_chat")
        self.assertEqual(identity.tenant_id, str(self.workspace.pk))
        self.assertEqual(details["payload"]["filters"]["knowledgeBaseIds"], [str(self.enabled.pk)])

    def test_a_visitor_is_identified_by_a_hash_of_their_address_never_the_address(self):
        self.ask(ip="203.0.113.7")
        self.ask(ip="203.0.113.7")
        self.ask(ip="203.0.113.8")
        first, again, other = (identity.user_id for _, identity, _ in self.ai.calls_to("stream_chat"))
        self.assertNotIn("203.0.113", first)
        self.assertEqual(first, again)
        self.assertNotEqual(first, other)

    def test_no_session_or_csrf_token_is_needed(self):
        response = self.ask(client=APIClient(enforce_csrf_checks=True))
        self.assertEqual(response.status_code, 200)

    def test_a_workspace_with_nothing_enabled_says_so_without_asking_a_model(self):
        KnowledgeBase.objects.filter(pk=self.enabled.pk).update(chat_enabled=False)
        response = self.ask()
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["code"], "no_chat_knowledge")
        self.assertEqual(self.ai.calls_to("stream_chat"), [])

    def test_a_switched_off_or_misconfigured_chatbot_is_not_found(self):
        self.configure(PUBLIC_CHAT_WORKSPACE="")
        self.assertEqual(self.ask().status_code, 404)
        self.configure(PUBLIC_CHAT_WORKSPACE="no-such-workspace")
        self.assertEqual(self.ask().status_code, 404)
        self.assertEqual(self.ai.calls_to("stream_chat"), [])

    def test_each_visitor_is_rate_limited_by_address(self):
        self.configure(rates={"public_chat_burst": "2/min"})
        self.assertEqual(self.ask().status_code, 200)
        self.assertEqual(self.ask().status_code, 200)
        self.assertEqual(self.ask().status_code, 429)
        self.assertEqual(self.ask(ip="198.51.100.21").status_code, 200)

    def test_the_answer_is_logged_without_a_user_or_the_question(self):
        self.ask()
        log = RagQueryLog.objects.get()
        self.assertIsNone(log.user)
        self.assertEqual((log.workspace, log.kind, log.support), (self.workspace, "chat", "SUPPORTED"))

    def test_a_stream_that_cannot_start_is_an_ordinary_error(self):
        self.ai.fail("stream_chat", AIServiceUnavailable())
        response = self.ask()
        self.assertEqual(response.status_code, 503)
        self.assertIn("application/json", response["Content-Type"])
        self.assertEqual(response.json()["code"], "service_unavailable")

    def test_an_empty_question_is_refused_before_the_ai_service(self):
        response = self.ask({"message": ""})
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.ai.calls_to("stream_chat"), [])
