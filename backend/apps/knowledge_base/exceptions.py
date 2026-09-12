"""
API errors for the knowledge base. Every one is a PublicMessage: its text was
written for an administrator and is safe to show verbatim.

`code` varies per instance for the rejection errors — an unsupported type and
an oversized file are both "the upload was refused", but a client branches on
which — so it is set on the instance, where the core exception handler reads it.
"""

from rest_framework import exceptions, status

from apps.core.exceptions import PublicMessage

from .constants import Messages


class KnowledgeBaseAPIError(PublicMessage, exceptions.APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_code = "invalid"
    default_detail = "The request could not be processed."

    def __init__(self, detail=None, *, code=None, status_code=None):
        super().__init__(detail or self.default_detail)
        if code:
            self.default_code = code
        if status_code:
            self.status_code = status_code


class UploadRejected(KnowledgeBaseAPIError):
    default_code = "upload_rejected"


class DuplicateDocument(KnowledgeBaseAPIError):
    status_code = status.HTTP_409_CONFLICT
    default_code = "duplicate_document"

    def __init__(self, existing):
        super().__init__(f'This file is already in the knowledge base as "{existing.title}".')
        self.existing = existing


class InvalidState(KnowledgeBaseAPIError):
    """The action makes no sense for the object's current state."""

    status_code = status.HTTP_409_CONFLICT
    default_code = "invalid_state"


class RoleForbidden(PublicMessage, exceptions.PermissionDenied):
    default_detail = Messages.ROLE_FORBIDDEN
    default_code = "role_forbidden"


class ServiceUnavailable(KnowledgeBaseAPIError):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_code = "service_unavailable"
    default_detail = Messages.AI_UNAVAILABLE


class UpstreamRejected(KnowledgeBaseAPIError):
    """The AI service refused a request for a reason it described safely."""

    default_code = "upstream_rejected"
