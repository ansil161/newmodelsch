"""
Where uploaded files live: a private directory, never a public media URL.

The storage has no base URL, so a stored file cannot be linked to — it is
read only by the ingestion worker and by the authenticated download view,
which checks the caller's role first. Stored names are random: a user's
filename never becomes a path, so there is nothing to traverse and nothing
to collide.
"""

import uuid
from pathlib import PurePosixPath

from django.conf import settings
from django.core.files.storage import FileSystemStorage


def get_storage():
    return FileSystemStorage(
        location=settings.KNOWLEDGE_BASE["STORAGE_ROOT"],
        base_url=None,
        directory_permissions_mode=0o700,
        file_permissions_mode=0o600,
    )


def version_upload_path(instance, filename):
    """<workspace>/<knowledge base>/<random>.<ext> — the extension kept, nothing else."""
    knowledge_base = instance.document.knowledge_base
    suffix = PurePosixPath(filename).suffix.lower()[:10]
    return f"{knowledge_base.workspace_id}/{knowledge_base.id}/{uuid.uuid4().hex}{suffix}"
