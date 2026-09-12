from unittest import mock

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.accounts.models import User
from apps.knowledge_base.constants import JobStatus, Role
from apps.knowledge_base.jobs.runner import run_next_job
from apps.knowledge_base.models import Document, IngestionJob, KnowledgeBase, Workspace, WorkspaceMembership

from .fakes import FakeAIClient

PASSWORD = "Correct-Horse-Battery-9"

# Every module that asks for the AI client. Patched where it is looked up,
# which is where `from .ai_client import get_client` put a reference.
_CLIENT_LOOKUPS = (
    "apps.knowledge_base.jobs.runner.get_client",
    "apps.knowledge_base.views.get_client",
    "apps.knowledge_base.chat.get_client",
    "apps.knowledge_base.overview.get_client",
)


class KnowledgeBaseTestCase(APITestCase):
    """
    Two workspaces, a member of each role in the first, an administrator of
    the second as the outsider, one knowledge base, and the AI service faked.
    Signed in as the editor unless a test says otherwise.
    """

    def setUp(self):
        super().setUp()
        cache.clear()
        self.ai = FakeAIClient()
        for target in _CLIENT_LOOKUPS:
            patcher = mock.patch(target, return_value=self.ai)
            patcher.start()
            self.addCleanup(patcher.stop)

        self.workspace = Workspace.objects.create(name="School", slug="school")
        self.other_workspace = Workspace.objects.create(name="Elsewhere", slug="elsewhere")
        self.admin = self.member("admin@example.com", Role.ADMIN)
        self.editor = self.member("editor@example.com", Role.EDITOR)
        self.viewer = self.member("viewer@example.com", Role.VIEWER)
        self.outsider = self.member("outsider@example.com", Role.ADMIN, workspace=self.other_workspace)
        self.knowledge_base = KnowledgeBase.objects.create(workspace=self.workspace, name="Handbook")
        self.login(self.editor)

    def member(self, email, role, *, workspace=None):
        user = User.objects.create_user(email=email, password=PASSWORD, full_name=email.split("@")[0].title())
        WorkspaceMembership.objects.create(workspace=workspace or self.workspace, user=user, role=role)
        return user

    def login(self, user):
        self.client.force_authenticate(user=user)

    def data(self, response):
        return response.json()["data"]

    # -- documents ---------------------------------------------------------

    def upload(self, name="guide.md", content=b"# Fees\n\nTuition is paid termly.", *,
               knowledge_base=None, content_type="text/markdown", **fields):
        knowledge_base = knowledge_base or self.knowledge_base
        return self.client.post(
            reverse("knowledge_base:documents", args=[knowledge_base.pk]),
            {"file": SimpleUploadedFile(name, content, content_type=content_type), **fields},
            format="multipart",
        )

    def uploaded(self, *args, **kwargs):
        response = self.upload(*args, **kwargs)
        self.assertEqual(response.status_code, 201, response.content)
        return Document.objects.get(pk=self.data(response)["document"]["id"])

    def ready(self, *args, **kwargs):
        document = self.uploaded(*args, **kwargs)
        self.run_jobs()
        document.refresh_from_db()
        return document

    # -- jobs --------------------------------------------------------------

    def run_jobs(self, *, limit=25):
        ran = 0
        while ran < limit and run_next_job("test-worker"):
            ran += 1
        return ran

    def make_ready(self):
        """Bring scheduled retries forward to now."""
        IngestionJob.objects.filter(status=JobStatus.QUEUED).update(run_after=timezone.now())
