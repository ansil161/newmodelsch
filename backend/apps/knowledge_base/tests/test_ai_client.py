import json

import httpx
from django.test import SimpleTestCase

from apps.knowledge_base.ai_client import AIServiceClient, AIServiceError, AIServiceUnavailable, Identity

IDENTITY = Identity(tenant_id="workspace-1", user_id="user:7")


class AIServiceClientTests(SimpleTestCase):
    """The client against a fake transport: what it sends, and what it makes of the answers."""

    def client_for(self, handler):
        return AIServiceClient("http://ai.test", "secret-token", transport=httpx.MockTransport(handler))

    def test_every_call_carries_the_service_token_and_the_identity(self):
        seen = {}

        def handler(request):
            seen.update(request.headers)
            return httpx.Response(200, json={"points": 4})

        self.assertEqual(self.client_for(handler).index_stats(IDENTITY, knowledge_base_id="kb-1"), 4)
        self.assertEqual(seen["authorization"], "Bearer secret-token")
        self.assertEqual(seen["x-jaaz-tenant-id"], "workspace-1")
        self.assertEqual(seen["x-jaaz-user-id"], "user:7")
        self.assertEqual(seen["x-jaaz-is-admin"], "false")
        self.assertTrue(seen["x-request-id"])

    def test_a_described_refusal_keeps_its_code_and_message(self):
        def handler(request):
            return httpx.Response(422, json={"error": {"code": "DOCUMENT_ENCRYPTED", "message": "Remove the password."}})

        with self.assertRaises(AIServiceError) as caught:
            self.client_for(handler).extract_url(IDENTITY, "https://example.org")
        self.assertEqual((caught.exception.code, caught.exception.message), ("DOCUMENT_ENCRYPTED", "Remove the password."))
        self.assertFalse(caught.exception.retryable)

    def test_a_server_error_becomes_unavailable_and_loses_its_body(self):
        def handler(request):
            return httpx.Response(500, json={"error": {"code": "INTERNAL_ERROR", "message": "Traceback: secret"}})

        with self.assertRaises(AIServiceUnavailable) as caught:
            self.client_for(handler).rag_test(IDENTITY, {})
        self.assertTrue(caught.exception.retryable)
        self.assertNotIn("secret", caught.exception.message)

    def test_a_rate_limit_is_retryable(self):
        def handler(request):
            return httpx.Response(429, json={"error": {"code": "TOO_MANY_REQUESTS", "message": "Slow down."}})

        with self.assertRaises(AIServiceError) as caught:
            self.client_for(handler).chat(IDENTITY, {})
        self.assertTrue(caught.exception.retryable)

    def test_an_unreachable_service_is_unavailable(self):
        def handler(request):
            raise httpx.ConnectError("refused", request=request)

        with self.assertRaises(AIServiceUnavailable):
            self.client_for(handler).delete_document(IDENTITY, "d1")

    def test_a_file_goes_as_multipart(self):
        seen = {}

        def handler(request):
            seen["type"] = request.headers["content-type"]
            seen["body"] = request.read()
            return httpx.Response(200, json={"chunks": []})

        self.client_for(handler).extract_file(IDENTITY, filename="a.md", content_type="text/markdown", data=b"# Hi")
        self.assertTrue(seen["type"].startswith("multipart/form-data"))
        self.assertIn(b"# Hi", seen["body"])

    def test_the_stream_is_read_line_by_line(self):
        frames = "event: token\ndata: " + json.dumps({"delta": "Hi"}) + "\n\n"

        def handler(request):
            return httpx.Response(200, content=frames.encode(), headers={"content-type": "text/event-stream"})

        with self.client_for(handler).stream_chat(IDENTITY, {}) as lines:
            received = list(lines)
        self.assertEqual(received[:2], ["event: token", 'data: {"delta": "Hi"}'])

    def test_a_stream_refused_before_it_opens_raises(self):
        def handler(request):
            return httpx.Response(503, json={"error": {"code": "LLM_UNAVAILABLE", "message": "Busy."}})

        with self.assertRaises(AIServiceError), self.client_for(handler).stream_chat(IDENTITY, {}):
            pass
