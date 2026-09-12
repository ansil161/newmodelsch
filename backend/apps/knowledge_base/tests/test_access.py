from django.conf import settings
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from apps.accounts.models import User
from apps.knowledge_base.models import KnowledgeBase

from .base import PASSWORD, KnowledgeBaseTestCase


class AuthenticationTests(KnowledgeBaseTestCase):
    def test_an_anonymous_request_is_refused(self):
        self.client.force_authenticate(user=None)
        response = self.client.get(reverse("knowledge_base:knowledge-bases"), {"workspace": self.workspace.pk})
        self.assertEqual(response.status_code, 401)

    def test_an_upload_with_a_session_cookie_still_needs_the_csrf_token(self):
        client = APIClient(enforce_csrf_checks=True)
        client.cookies[settings.AUTH_COOKIES["ACCESS_NAME"]] = str(AccessToken.for_user(self.editor))

        response = client.post(
            reverse("knowledge_base:sources", args=[self.knowledge_base.pk]),
            {"type": "url", "url": "https://school.example/fees"}, format="json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["code"], "csrf_failed")


class WorkspaceIsolationTests(KnowledgeBaseTestCase):
    def test_workspaces_lists_only_the_callers_memberships_with_their_roles(self):
        self.login(self.viewer)
        workspaces = self.data(self.client.get(reverse("knowledge_base:workspaces")))["workspaces"]
        self.assertEqual([(item["slug"], item["role"]) for item in workspaces], [("school", "viewer")])

    def test_another_workspaces_knowledge_base_does_not_exist_for_an_outsider(self):
        self.login(self.outsider)
        for name in ("knowledge-base", "overview", "documents", "sources", "jobs"):
            with self.subTest(endpoint=name):
                response = self.client.get(reverse(f"knowledge_base:{name}", args=[self.knowledge_base.pk]))
                self.assertEqual(response.status_code, 404)

    def test_an_outsider_cannot_list_another_workspace(self):
        self.login(self.outsider)
        response = self.client.get(reverse("knowledge_base:knowledge-bases"), {"workspace": self.workspace.pk})
        self.assertEqual(response.status_code, 404)

    def test_an_outsider_can_neither_read_nor_change_a_document(self):
        document = self.uploaded()
        self.login(self.outsider)
        requests = {
            "detail": lambda: self.client.get(reverse("knowledge_base:document", args=[document.pk])),
            "delete": lambda: self.client.delete(reverse("knowledge_base:document", args=[document.pk])),
            "download": lambda: self.client.get(reverse("knowledge_base:document-download", args=[document.pk])),
            "chunks": lambda: self.client.get(reverse("knowledge_base:document-chunks", args=[document.pk])),
            "reprocess": lambda: self.client.post(reverse("knowledge_base:document-reprocess", args=[document.pk])),
        }
        for name, request in requests.items():
            with self.subTest(request=name):
                self.assertEqual(request().status_code, 404)
        document.refresh_from_db()
        self.assertEqual(document.status, "queued")

    def test_a_deactivated_member_loses_access(self):
        self.editor.is_active = False
        self.editor.save()
        response = self.client.get(reverse("knowledge_base:overview", args=[self.knowledge_base.pk]))
        self.assertEqual(response.status_code, 404)


class RoleTests(KnowledgeBaseTestCase):
    def test_a_viewer_can_read_but_not_change(self):
        document = self.uploaded()
        self.login(self.viewer)

        self.assertEqual(self.client.get(reverse("knowledge_base:documents", args=[self.knowledge_base.pk])).status_code, 200)
        response = self.upload(name="other.md", content=b"Other text.")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["code"], "role_forbidden")
        self.assertEqual(self.client.delete(reverse("knowledge_base:document", args=[document.pk])).status_code, 403)

    def test_only_an_administrator_creates_a_knowledge_base(self):
        url = reverse("knowledge_base:knowledge-bases")
        payload = {"workspace": str(self.workspace.pk), "name": "Policies"}

        self.assertEqual(self.client.post(url, payload, format="json").status_code, 403)
        self.login(self.admin)
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(self.data(response)["knowledge_base"]["role"], "admin")

    def test_only_an_administrator_deletes_a_knowledge_base(self):
        url = reverse("knowledge_base:knowledge-base", args=[self.knowledge_base.pk])
        self.assertEqual(self.client.delete(url).status_code, 403)
        self.login(self.admin)
        self.assertEqual(self.client.delete(url).status_code, 202)

    def test_a_superuser_administers_every_workspace(self):
        root = User.objects.create_superuser(email="root@example.com", password=PASSWORD)
        self.login(root)
        self.assertEqual(
            self.client.get(reverse("knowledge_base:overview", args=[self.knowledge_base.pk])).status_code, 200
        )

    def test_knowledge_base_names_are_unique_per_workspace_ignoring_case(self):
        self.login(self.admin)
        response = self.client.post(
            reverse("knowledge_base:knowledge-bases"),
            {"workspace": str(self.workspace.pk), "name": "HANDBOOK"}, format="json",
        )
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["code"], "duplicate_name")
        # The same name is fine in another workspace.
        self.assertTrue(KnowledgeBase.objects.create(workspace=self.other_workspace, name="Handbook"))
