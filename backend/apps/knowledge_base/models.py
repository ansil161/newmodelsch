"""
The knowledge base's system of record.

    Workspace (the tenant)
      └─ KnowledgeBase
           ├─ KnowledgeSource        a file, a web page, pasted text, …
           │    └─ Document          what an administrator manages
           │         └─ DocumentVersion   one upload or fetch of it
           │              └─ DocumentChunk     what was extracted, as indexed
           └─ IngestionJob           the durable work queue

The AI service stores nothing; this is where a document's file, status,
versions and chunks live, beside the accounts that own them. Vectors are the
one derived copy, held in Qdrant under the workspace id as their tenant id —
which is why nothing that holds vectors may be deleted here before the AI
service has deleted them (see the PROTECT relations and jobs/runner.py).

Chunks are stored here, not only in Qdrant, for two reasons: a re-embed after
a model change must not re-parse every file, and an administrator asking
"what did it extract from my PDF?" deserves the actual answer.
"""

import uuid

from django.conf import settings
from django.contrib.postgres.fields import ArrayField
from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower
from django.utils import timezone

from .constants import (
    ACTIVE_JOB_STATUSES,
    WRITING_KINDS,
    DocumentStatus,
    JobKind,
    JobStatus,
    KnowledgeBaseStatus,
    QueryKind,
    Role,
    SourceType,
    Stage,
)
from .storage import get_storage, version_upload_path


class Workspace(models.Model):
    """
    The tenant. Its id is the tenant id the AI service filters every query
    and every write by, so two workspaces can never see each other's vectors.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("name",)

    def __str__(self):
        return self.name


class WorkspaceMembership(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="workspace_memberships"
    )
    role = models.CharField(max_length=16, choices=Role.choices, default=Role.VIEWER)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=("workspace", "user"), name="kb_one_membership_per_user"),
        ]

    def __str__(self):
        return f"{self.user} · {self.workspace} · {self.role}"


class KnowledgeBase(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # PROTECT: a workspace holding knowledge bases holds vectors, which only
    # the deletion job can remove.
    workspace = models.ForeignKey(Workspace, on_delete=models.PROTECT, related_name="knowledge_bases")
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True, max_length=2000)
    status = models.CharField(
        max_length=16, choices=KnowledgeBaseStatus.choices, default=KnowledgeBaseStatus.ACTIVE
    )
    # Whether the production chatbot answers from it. Administrators can test
    # a knowledge base that is not yet enabled.
    chat_enabled = models.BooleanField(default=False)
    default_language = models.CharField(max_length=16, default="en")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("name",)
        constraints = [
            models.UniqueConstraint(
                Lower("name"),
                "workspace",
                condition=Q(status=KnowledgeBaseStatus.ACTIVE),
                name="kb_unique_active_name_per_workspace",
            ),
        ]

    def __str__(self):
        return self.name

    @property
    def is_deleting(self):
        return self.status == KnowledgeBaseStatus.DELETING


class KnowledgeSource(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    knowledge_base = models.ForeignKey(KnowledgeBase, on_delete=models.CASCADE, related_name="sources")
    source_type = models.CharField(max_length=32, choices=SourceType.choices)
    name = models.CharField(max_length=300)
    url = models.URLField(max_length=2048, blank=True)
    # Type-specific settings: nothing yet for file, url or text; a crawl's
    # depth and scope, a Notion page id, later.
    config = models.JSONField(default=dict, blank=True)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return self.name


class Document(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    knowledge_base = models.ForeignKey(KnowledgeBase, on_delete=models.CASCADE, related_name="documents")
    # PROTECT: removing a source is done by deleting its documents through
    # the job queue, which removes their vectors first.
    source = models.ForeignKey(KnowledgeSource, on_delete=models.PROTECT, related_name="documents")

    title = models.CharField(max_length=300)
    description = models.TextField(blank=True, max_length=2000)
    category = models.CharField(max_length=100, blank=True)
    tags = ArrayField(models.CharField(max_length=50), default=list, blank=True)
    language = models.CharField(max_length=16, default="en")
    author = models.CharField(max_length=200, blank=True)
    source_url = models.URLField(max_length=2048, blank=True)

    # The state of the most recently processed version. Whether the document
    # is searchable is `active_version`, which a failed new version leaves in
    # place.
    status = models.CharField(max_length=16, choices=DocumentStatus.choices, default=DocumentStatus.UPLOADED)
    stage = models.CharField(max_length=16, choices=Stage.choices, blank=True)
    error_code = models.CharField(max_length=64, blank=True)
    error_message = models.TextField(blank=True)

    active_version = models.ForeignKey(
        "DocumentVersion", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    latest_version = models.ForeignKey(
        "DocumentVersion", on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    file_type = models.CharField(max_length=16, blank=True)
    file_size = models.BigIntegerField(default=0)
    chunk_count = models.PositiveIntegerField(default=0)
    page_count = models.PositiveIntegerField(null=True, blank=True)
    indexed_at = models.DateTimeField(null=True, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-updated_at",)
        indexes = [
            models.Index(fields=("knowledge_base", "status"), name="kb_document_status"),
            models.Index(fields=("knowledge_base", "-updated_at"), name="kb_document_recent"),
        ]

    def __str__(self):
        return self.title


class DocumentVersion(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="versions")
    number = models.PositiveIntegerField()
    status = models.CharField(max_length=16, choices=DocumentStatus.choices, default=DocumentStatus.UPLOADED)

    # File and text sources: the stored bytes. URL sources: the address.
    file = models.FileField(storage=get_storage, upload_to=version_upload_path, max_length=300, blank=True)
    original_filename = models.CharField(max_length=255, blank=True)
    mime_type = models.CharField(max_length=127, blank=True)
    file_size = models.BigIntegerField(default=0)
    # SHA-256 of the file, or of the extracted chunks for a web page. What
    # duplicate uploads and unchanged re-fetches are recognised by.
    checksum = models.CharField(max_length=64, blank=True, db_index=True)
    source_url = models.URLField(max_length=2048, blank=True)

    format = models.CharField(max_length=16, blank=True)
    parser = models.CharField(max_length=32, blank=True)
    extracted_title = models.CharField(max_length=300, blank=True)
    page_count = models.PositiveIntegerField(null=True, blank=True)
    character_count = models.PositiveIntegerField(default=0)
    chunk_count = models.PositiveIntegerField(default=0)
    token_count = models.PositiveIntegerField(default=0)
    warnings = models.JSONField(default=list, blank=True)

    # Recorded so a change of embedding model can find what needs re-embedding.
    embedding_model = models.CharField(max_length=128, blank=True)
    embedding_dimensions = models.PositiveIntegerField(null=True, blank=True)
    index_generation = models.BigIntegerField(null=True, blank=True)

    error_code = models.CharField(max_length=64, blank=True)
    error_message = models.TextField(blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    processing_started_at = models.DateTimeField(null=True, blank=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    indexed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-number",)
        constraints = [
            models.UniqueConstraint(fields=("document", "number"), name="kb_unique_version_number"),
        ]

    def __str__(self):
        return f"{self.document} v{self.number}"


class DocumentChunk(models.Model):
    # Deterministic: uuid5 of (version, index). Re-storing a version's chunks
    # after a retry produces the same ids, so the AI service's copy and this
    # one always agree on what a chunk is called.
    id = models.UUIDField(primary_key=True, editable=False)
    version = models.ForeignKey(DocumentVersion, on_delete=models.CASCADE, related_name="chunks")
    index = models.PositiveIntegerField()
    content = models.TextField()
    token_count = models.PositiveIntegerField(default=0)
    content_hash = models.CharField(max_length=64)
    page = models.PositiveIntegerField(null=True, blank=True)
    pages = ArrayField(models.PositiveIntegerField(), default=list, blank=True)
    heading = models.CharField(max_length=300, blank=True)
    section = models.CharField(max_length=1000, blank=True)

    class Meta:
        ordering = ("index",)
        constraints = [
            models.UniqueConstraint(fields=("version", "index"), name="kb_unique_chunk_index"),
        ]


class IngestionJob(models.Model):
    """
    The durable queue. Workers claim rows with SELECT … FOR UPDATE SKIP LOCKED,
    so any number of them can run without claiming the same job, and a job
    whose worker died is reclaimed when its heartbeat goes stale.

    The id doubles as the index generation: it is unique and monotonically
    increasing, and a retry of the same job reuses it, which is exactly what
    makes a retried index write overwrite its own vectors rather than add to
    them.
    """

    kind = models.CharField(max_length=32, choices=JobKind.choices)
    status = models.CharField(max_length=16, choices=JobStatus.choices, default=JobStatus.QUEUED)
    stage = models.CharField(max_length=16, choices=Stage.choices, default=Stage.QUEUED)
    progress = models.PositiveSmallIntegerField(default=0)

    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="jobs")
    # SET_NULL, not CASCADE: a deletion job deletes its own target, and must
    # still be there afterwards to be marked finished and read as history.
    knowledge_base = models.ForeignKey(
        KnowledgeBase, on_delete=models.SET_NULL, null=True, blank=True, related_name="jobs"
    )
    document = models.ForeignKey(Document, on_delete=models.SET_NULL, null=True, blank=True, related_name="jobs")
    version = models.ForeignKey(
        DocumentVersion, on_delete=models.SET_NULL, null=True, blank=True, related_name="jobs"
    )

    attempts = models.PositiveSmallIntegerField(default=0)
    max_attempts = models.PositiveSmallIntegerField(default=3)
    run_after = models.DateTimeField(default=timezone.now)
    locked_by = models.CharField(max_length=128, blank=True)
    locked_at = models.DateTimeField(null=True, blank=True)
    heartbeat_at = models.DateTimeField(null=True, blank=True)
    cancel_requested = models.BooleanField(default=False)

    error_code = models.CharField(max_length=64, blank=True)
    error_message = models.TextField(blank=True)
    # Names of what the job acts on, kept for display after the thing itself
    # has been deleted.
    payload = models.JSONField(default=dict, blank=True)
    result = models.JSONField(default=dict, blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    duration_ms = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=("status", "run_after"), name="kb_job_claim"),
            models.Index(fields=("knowledge_base", "-created_at"), name="kb_job_recent"),
        ]
        constraints = [
            # Two writers for one document's vectors would race each other's
            # prune. The database refuses the second rather than trusting
            # every code path to check first.
            models.UniqueConstraint(
                fields=("document",),
                condition=Q(status__in=ACTIVE_JOB_STATUSES, kind__in=WRITING_KINDS),
                name="kb_one_active_writer_per_document",
            ),
        ]

    def __str__(self):
        return f"{self.get_kind_display()} #{self.pk} ({self.status})"

    @property
    def is_active(self):
        return self.status in ACTIVE_JOB_STATUSES


class RagQueryLog(models.Model):
    """
    One row per Test RAG run or chat answer: shape and timing, never text.

    The question is deliberately not stored. The overview's statistics need
    counts, latencies and support levels; a table of everything every user
    has asked is a privacy liability nobody asked for.
    """

    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="+")
    knowledge_base = models.ForeignKey(
        KnowledgeBase, on_delete=models.SET_NULL, null=True, blank=True, related_name="query_logs"
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    kind = models.CharField(max_length=8, choices=QueryKind.choices)
    support = models.CharField(max_length=32, blank=True)
    grounded = models.BooleanField(default=False)
    retrieval_count = models.PositiveIntegerField(default=0)
    context_chunks = models.PositiveIntegerField(default=0)
    retrieval_ms = models.PositiveIntegerField(null=True, blank=True)
    rerank_ms = models.PositiveIntegerField(null=True, blank=True)
    generation_ms = models.PositiveIntegerField(null=True, blank=True)
    total_ms = models.PositiveIntegerField(null=True, blank=True)
    provider = models.CharField(max_length=64, blank=True)
    model = models.CharField(max_length=128, blank=True)
    error_code = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ("-created_at",)


class AuditLog(models.Model):
    """Who changed what in a knowledge base, and when. Written, never edited."""

    workspace = models.ForeignKey(Workspace, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    action = models.CharField(max_length=64)
    target_type = models.CharField(max_length=32)
    target_id = models.CharField(max_length=64)
    target_label = models.CharField(max_length=300, blank=True)
    # Ids of the parents, so a knowledge base's history can be read without
    # joining through rows that may since have been deleted.
    knowledge_base_id_ref = models.UUIDField(null=True, blank=True, db_index=True)
    metadata = models.JSONField(default=dict, blank=True)
    ip = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.action} {self.target_type}:{self.target_id}"
