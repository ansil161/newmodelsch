"""Trust between the main backend and this service.

This service holds the Qdrant credentials, the LLM keys and the whole
knowledge base. It is meant to sit on an internal network, but network
placement is a deployment detail that can be got wrong, so it authenticates
every request itself.

The scheme is a shared bearer token issued to the Django backend. Not a JWT:
there is exactly one client, tokens are not delegated to anyone, and nothing
here needs to survive a key rotation independently. A constant-time compare
is used because `==` on secrets leaks their prefix through timing.

The *user* is not authenticated here — Django did that, and it is the only
thing holding the session cookie. What Django passes on is an identity
(`user_id`, `tenant_id`) that this service trusts and turns into Qdrant
filters. That trust is exactly as strong as the shared token, which is why
the token is mandatory in production.
"""

from __future__ import annotations

import hmac
from dataclasses import dataclass

from .config import Settings
from .exceptions import ForbiddenError, NotAuthenticatedError

BEARER_PREFIX = "Bearer "


@dataclass(frozen=True)
class CallerIdentity:
    """Who Django says is asking.

    `tenant_id` is the isolation boundary. Every retrieval this service
    performs is filtered by it — see vector_store/filters.py. There is one
    tenant today; the field exists so that adding a second is a data change
    rather than an audit of every query in the codebase.
    """

    user_id: str
    tenant_id: str
    is_admin: bool = False
    # Restricts retrieval to specific documents when the caller says so.
    # None means "everything this tenant may see", which is not the same as
    # "everything".
    allowed_document_ids: tuple[str, ...] | None = None


def verify_service_token(authorization: str | None, settings: Settings) -> None:
    """Reject anything not carrying the shared secret."""
    expected = settings.security.service_token

    if expected is None:
        if settings.is_production:
            # Unreachable: config validation refuses to build a production
            # Settings without a token. Kept as a second lock on the door.
            raise ForbiddenError("Service authentication is misconfigured.")
        # Development and tests run without a token so the service can be
        # curled and the suite does not need secrets.
        return

    if not authorization or not authorization.startswith(BEARER_PREFIX):
        raise NotAuthenticatedError("A service token is required.")

    supplied = authorization[len(BEARER_PREFIX):].strip()
    # compare_digest, not ==. String equality returns as soon as two bytes
    # differ, which tells an attacker how much of the prefix they have right.
    if not hmac.compare_digest(supplied, expected.get_secret_value()):
        raise NotAuthenticatedError("The service token is not valid.")


def redact(value: str | None, *, keep: int = 4) -> str:
    """Render a secret safe to log — used for diagnostics, never for output.

    Shows only enough to tell two keys apart when someone is working out
    which one is configured.
    """
    if not value:
        return "<unset>"
    if len(value) <= keep:
        return "*" * len(value)
    return f"{value[:keep]}{'*' * (len(value) - keep)}"
