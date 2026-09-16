from rest_framework import exceptions

from apps.core.exceptions import PublicMessage

from .constants import Codes, Messages


class InvalidCredentials(PublicMessage, exceptions.AuthenticationFailed):
    """The one answer to an unknown email, a wrong password and a disabled account."""

    default_detail = Messages.INVALID_CREDENTIALS
    default_code = Codes.INVALID_CREDENTIALS


class CSRFFailed(PublicMessage, exceptions.PermissionDenied):
    default_detail = Messages.CSRF_FAILED
    default_code = Codes.CSRF_FAILED


class TooManyAttempts(exceptions.Throttled):
    """
    The per-account lock. Deliberately not a PublicMessage: it answers with
    the same 429 text as the per-IP limits, so the two are indistinguishable.
    """
