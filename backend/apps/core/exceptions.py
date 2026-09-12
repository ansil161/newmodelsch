"""
The one place an API error becomes a response.

Every error leaves in the failure envelope. The message is chosen *here*, by
status code, unless the exception is marked PublicMessage - that is, its text
was written for the client. That rule is what keeps SimpleJWT's token-class
names, Django internals and anything a traceback might hold out of a browser.
"""

import logging

from rest_framework import exceptions
from rest_framework.response import Response

from .responses import GENERIC_ERROR, failure

logger = logging.getLogger("apps.core")

VALIDATION_MESSAGE = "Please correct the highlighted fields."

_STATUS_DEFAULTS = {
    400: ("bad_request", "The request could not be processed."),
    401: ("not_authenticated", "Authentication credentials were not provided or are no longer valid."),
    403: ("permission_denied", "You do not have permission to perform this action."),
    404: ("not_found", "Not found."),
    405: ("method_not_allowed", "Method not allowed."),
    406: ("not_acceptable", "Not acceptable."),
    415: ("unsupported_media_type", "Unsupported media type."),
    429: ("throttled", "Too many attempts. Please try again later."),
}


class PublicMessage:
    """Mixin for an APIException whose detail is safe to show the client verbatim."""

    public_message = True


def api_exception_handler(exc, context):
    # Imported here, not at module level: rest_framework.views imports the
    # authentication classes while it initialises, and they import PublicMessage
    # from this module - a top-level import would be circular.
    from rest_framework.views import exception_handler as drf_exception_handler
    from rest_framework.views import set_rollback

    # DRF's handler converts Http404 and Django's PermissionDenied, sets the
    # WWW-Authenticate and Retry-After headers, and marks the transaction for
    # rollback. Only the body is replaced below.
    response = drf_exception_handler(exc, context)

    if response is None:
        # Not an API exception, so a bug. The traceback goes to the log; the
        # client learns only that something failed.
        set_rollback()
        request = context.get("request")
        logger.error(
            "unhandled_api_exception",
            exc_info=exc,
            extra={"event": "unhandled_api_exception", "path": getattr(request, "path", "")},
        )
        return Response(failure(GENERIC_ERROR, code="server_error"), status=500)

    if isinstance(exc, exceptions.ValidationError):
        response.data = failure(VALIDATION_MESSAGE, code="invalid", errors=_field_errors(exc.detail))
    elif getattr(exc, "public_message", False):
        response.data = failure(str(exc.detail), code=exc.default_code)
    else:
        code, message = _STATUS_DEFAULTS.get(response.status_code, ("error", GENERIC_ERROR))
        response.data = failure(message, code=code)
    return response


def _field_errors(detail):
    if isinstance(detail, dict):
        return {field: _messages(value) for field, value in detail.items()}
    return {"non_field_errors": _messages(detail)}


def _messages(value):
    if isinstance(value, (list, tuple)):
        return [str(item) for item in value]
    return [str(value)]
