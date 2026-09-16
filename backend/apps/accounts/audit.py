"""
Security event logging for authentication.

Every line carries an `event` name (see constants.Events), the client IP, and
where known the user id. Email addresses are never written: failures carry
`email_fp`, a keyed hash that lets repeated attempts against one account be
correlated without the log holding the address. Passwords, tokens
and headers are never passed here at all.
"""

import logging

from django.utils.crypto import salted_hmac

from apps.core.http import get_client_ip

from .validators import normalize_email

logger = logging.getLogger("apps.accounts.audit")


def fingerprint_email(email):
    return salted_hmac("apps.accounts.audit.email", normalize_email(email)).hexdigest()[:16]


def log_auth_event(event, request=None, *, level=logging.INFO, user=None, user_id=None, email=None, **fields):
    extra = {"event": event, **fields}
    if request is not None:
        extra["ip"] = get_client_ip(request)
    if user is not None:
        user_id = user.pk
    if user_id is not None:
        extra["user_id"] = user_id
    if email:
        extra["email_fp"] = fingerprint_email(email)
    logger.log(level, event, extra=extra)
