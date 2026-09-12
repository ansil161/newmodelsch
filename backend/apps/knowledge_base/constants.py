"""
The knowledge base's vocabulary: roles, statuses, stages, and every message
the API says to a client.

Messages live here, not at raise sites, for the same reason as in accounts:
they are the whole of what an administrator reads when something goes wrong,
so they are written once, deliberately, and never assembled from an
exception's own text.
"""

from django.db import models


class Role(models.TextChoices):
    """A user's role in one workspace. Superusers act as ADMIN everywhere."""

    ADMIN = "admin", "Administrator"
    EDITOR = "editor", "Editor"
    VIEWER = "viewer", "Viewer"


# Higher includes lower: an editor may do everything a viewer may.
ROLE_RANK = {Role.VIEWER: 1, Role.EDITOR: 2, Role.ADMIN: 3}


class KnowledgeBaseStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    DELETING = "deleting", "Deleting"


class SourceType(models.TextChoices):
    """
    Where a document's content comes from.

    Planned: website (a crawl), notion, google_drive, confluence, database,
    api. Each is a choice here, an ingestion branch in jobs/runner.py and a
    form in the console. Documents, versions and chunks are already
    source-agnostic, so none of them changes shape.
    """

    FILE = "file", "File upload"
    URL = "url", "Web page"
    TEXT = "text", "Text"


class DocumentStatus(models.TextChoices):
    UPLOADED = "uploaded", "Uploaded"
    QUEUED = "queued", "Queued"
    PROCESSING = "processing", "Processing"
    INDEXING = "indexing", "Indexing"
    READY = "ready", "Ready"
    FAILED = "failed", "Failed"
    DELETING = "deleting", "Deleting"


IN_PROGRESS = (
    DocumentStatus.UPLOADED,
    DocumentStatus.QUEUED,
    DocumentStatus.PROCESSING,
    DocumentStatus.INDEXING,
)


class JobKind(models.TextChoices):
    INGEST = "ingest", "Ingest"
    REINDEX = "reindex", "Re-index"
    DELETE_DOCUMENT = "delete_document", "Delete document"
    DELETE_KNOWLEDGE_BASE = "delete_knowledge_base", "Delete knowledge base"


# Kinds that write a document's vectors. At most one of these may be active
# for a document at a time — enforced by a database constraint.
WRITING_KINDS = (JobKind.INGEST, JobKind.REINDEX)


class JobStatus(models.TextChoices):
    QUEUED = "queued", "Queued"
    RUNNING = "running", "Running"
    SUCCEEDED = "succeeded", "Succeeded"
    FAILED = "failed", "Failed"
    CANCELLED = "cancelled", "Cancelled"


ACTIVE_JOB_STATUSES = (JobStatus.QUEUED, JobStatus.RUNNING)


class Stage(models.TextChoices):
    """What a job is doing now, in words an administrator would use."""

    QUEUED = "queued", "Queued"
    RETRYING = "retrying", "Waiting to retry"
    FETCHING = "fetching", "Fetching the page"
    EXTRACTING = "extracting", "Extracting text"
    STORING = "storing", "Saving chunks"
    INDEXING = "indexing", "Embedding and indexing"
    DELETING = "deleting", "Removing from the index"
    DONE = "done", "Done"


# Progress by stage. Honest about what it is: which step of a fixed sequence
# the job has reached, not a measurement of how much of a step is done.
STAGE_PROGRESS = {
    Stage.QUEUED: 5,
    Stage.RETRYING: 5,
    Stage.FETCHING: 15,
    Stage.EXTRACTING: 30,
    Stage.STORING: 50,
    Stage.INDEXING: 70,
    Stage.DELETING: 50,
    Stage.DONE: 100,
}


class QueryKind(models.TextChoices):
    TEST = "test", "Test RAG"
    CHAT = "chat", "Chat"


class Messages:
    LISTED = "OK."
    KB_CREATED = "Knowledge base created."
    KB_UPDATED = "Knowledge base updated."
    KB_DELETING = "The knowledge base is being deleted."
    DOCUMENT_UPLOADED = "Document uploaded. Processing has started."
    DOCUMENT_UPDATED = "Document updated."
    DOCUMENT_DELETING = "The document is being deleted."
    VERSION_UPLOADED = "New version uploaded. Processing has started."
    VERSION_ACTIVATING = "That version is being restored."
    SOURCE_ADDED = "Source added. Processing has started."
    SOURCE_DELETING = "The source and its documents are being deleted."
    SOURCE_SYNCING = "The source is being refreshed."
    REPROCESSING = "The document is being processed again."
    RETRYING = "Processing is being retried."
    CANCELLED = "Processing was cancelled."
    CANCEL_REQUESTED = "Cancellation requested. The current step will finish first."
    ANSWER = "Answer."

    ROLE_FORBIDDEN = "Your role in this workspace does not allow this."
    KB_DELETING_BLOCKED = "This knowledge base is being deleted."
    ALREADY_PROCESSING = "This document is already being processed."
    ALREADY_DELETING = "This document is already being deleted."
    NOT_FAILED = "Only a document whose latest version failed can be retried."
    NOTHING_TO_CANCEL = "This document is not being processed."
    NOTHING_TO_REPROCESS = "This document has no version to process."
    VERSION_ALREADY_ACTIVE = "That version is already the live one."
    VERSION_NOT_RESTORABLE = "Only file and text versions can be restored."
    VERSIONS_FILE_ONLY = "New versions can only be uploaded for file documents."
    SYNC_URL_ONLY = "Only web-page sources can be refreshed."
    NO_CHAT_KNOWLEDGE = "No knowledge base is available to the assistant yet."
    DUPLICATE_NAME = "A knowledge base with that name already exists in this workspace."
    CONTENT_TOO_LARGE = "The upload is larger than the size limit."
    AI_UNAVAILABLE = "The AI service is unavailable. Please try again shortly."
    SCANNER_UNAVAILABLE = "The file could not be checked for malware. Please try again shortly."
    MALWARE_DETECTED = "The file was flagged by the malware scanner and was not uploaded."


# Shown on a failed document when processing could not run at all, rather
# than failing on the document itself.
FAILURE_MESSAGES = {
    "AI_SERVICE_UNAVAILABLE": (
        "The AI service could not be reached. It will be retried automatically; "
        "if this persists, check that the AI service is running."
    ),
    "INTERNAL_ERROR": "Processing failed unexpectedly. Try again, or contact support.",
    "CANCELLED": "Processing was cancelled.",
    "SOURCE_FILE_MISSING": "The uploaded file could not be found in storage. Upload it again.",
    "INDEX_VERIFICATION_FAILED": (
        "The search index did not store every part of this document. It will be retried "
        "automatically; if this persists, check the vector database."
    ),
}
