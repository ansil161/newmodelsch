from django.conf import settings
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from .base import KnowledgeBaseTestCase

TOKEN = "test-internal-token"


class InternalApiTests(KnowledgeBaseTestCase):
    """The endpoints the AI service's re-index worker reads chunks from."""

    def setUp(self):
        super().setUp()
        self.document = self.ready()
        self.service = APIClient()

    def get(self, url, *, token=TOKEN, tenant=None):
        headers = {"HTTP_X_JAAZ_TENANT_ID": str(tenant or self.workspace.pk)}
        if token is not None:
            headers["HTTP_AUTHORIZATION"] = f"Bearer {token}"
        return self.service.get(url, **headers)

    def test_nothing_is_returned_without_the_service_token(self):
        url = reverse("knowledge_base_internal:documents")
        self.assertEqual(self.get(url, token=None).status_code, 401)
        self.assertEqual(self.get(url, token="wrong-token").status_code, 401)

    def test_a_signed_in_users_cookie_is_not_a_service_token(self):
        self.service.cookies[settings.AUTH_COOKIES["ACCESS_NAME"]] = str(AccessToken.for_user(self.admin))
        self.assertEqual(self.get(reverse("knowledge_base_internal:documents"), token=None).status_code, 401)

    def test_the_tenant_header_scopes_the_documents(self):
        body = self.get(reverse("knowledge_base_internal:documents")).json()
        (document,) = body["results"]
        self.assertEqual(document["id"], str(self.document.pk))
        self.assertEqual(document["knowledgeBaseId"], str(self.knowledge_base.pk))
        self.assertEqual(body["meta"]["totalPages"], 1)

        other = self.get(reverse("knowledge_base_internal:documents"), tenant=self.other_workspace.pk).json()
        self.assertEqual(other["results"], [])

    def test_a_live_documents_chunks_are_returned_in_order(self):
        body = self.get(reverse("knowledge_base_internal:document-chunks", args=[self.document.pk])).json()
        self.assertEqual([chunk["chunkIndex"] for chunk in body["results"]], [0, 1])

    def test_another_tenants_document_does_not_exist(self):
        response = self.get(
            reverse("knowledge_base_internal:document-chunks", args=[self.document.pk]),
            tenant=self.other_workspace.pk,
        )
        self.assertEqual(response.status_code, 404)
