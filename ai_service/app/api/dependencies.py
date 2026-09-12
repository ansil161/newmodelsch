"""FastAPI dependencies: authentication, identity, rate limiting, resources.

`require_caller` is the one that matters. It verifies the shared service
token and turns the headers Django sends into a `CallerIdentity`, which is
the only thing allowed to produce a retrieval filter. Nothing downstream ever
reads a tenant or a user id out of a request body — that is the difference
between "the caller says it is tenant A" and "Django, which holds the
session, says it is tenant A".
"""

from __future__ import annotations

import time
from collections import defaultdict, deque
from typing import Annotated

from fastapi import Depends, Header, Request

from app.core.config import Settings
from app.core.exceptions import InvalidRequestError, RateLimitedError
from app.core.lifecycle import AppResources
from app.core.security import CallerIdentity, verify_service_token

# Headers Django uses to vouch for the end user. Prefixed so they cannot be
# confused with anything a browser might send, and only believed because the
# request carried the service token.
USER_ID_HEADER = "x-jaaz-user-id"
TENANT_ID_HEADER = "x-jaaz-tenant-id"
ADMIN_HEADER = "x-jaaz-is-admin"

DEFAULT_TENANT = "default"


def get_resources(request: Request) -> AppResources:
    resources: AppResources | None = getattr(request.app.state, "resources", None)
    if resources is None:  # pragma: no cover — only during a failed startup
        raise RuntimeError("Application resources are not initialised.")
    return resources


def get_app_settings(
    resources: Annotated[AppResources, Depends(get_resources)],
) -> Settings:
    return resources.settings


async def require_caller(
    settings: Annotated[Settings, Depends(get_app_settings)],
    authorization: Annotated[str | None, Header()] = None,
    x_jaaz_user_id: Annotated[str | None, Header()] = None,
    x_jaaz_tenant_id: Annotated[str | None, Header()] = None,
    x_jaaz_is_admin: Annotated[str | None, Header()] = None,
) -> CallerIdentity:
    verify_service_token(authorization, settings)

    if not x_jaaz_user_id:
        # The token proves the *service* is trusted. It says nothing about
        # which user, and every retrieval needs one for the audit trail.
        raise InvalidRequestError(
            f"The {USER_ID_HEADER} header is required."
        )

    return CallerIdentity(
        user_id=x_jaaz_user_id,
        # A single tenant today. The plumbing is here so that adding a second
        # is a data change, not an audit of every query in the codebase.
        tenant_id=x_jaaz_tenant_id or DEFAULT_TENANT,
        is_admin=(x_jaaz_is_admin or "").lower() in ("1", "true", "yes"),
    )


class SlidingWindowRateLimiter:
    """Per-key request ceilings, in memory.

    Honest about what it is: correct for one instance, an approximation for
    two, and useless across a restart. It exists because an unlimited chat
    endpoint is an unlimited bill, and something imperfect in front of that is
    much better than nothing. A shared Redis counter is the production
    upgrade; this class is the seam for it.

    A deque of timestamps rather than a fixed bucket, so a burst at 11:59:59
    cannot be followed by an identical burst at 12:00:00.
    """

    def __init__(self) -> None:
        self._events: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str, *, limit: int, window_seconds: int) -> None:
        if limit <= 0:
            return

        now = time.monotonic()
        cutoff = now - window_seconds
        events = self._events[key]

        while events and events[0] < cutoff:
            events.popleft()

        if len(events) >= limit:
            retry_after = int(events[0] + window_seconds - now) + 1
            raise RateLimitedError(retry_after_seconds=max(1, retry_after))

        events.append(now)

    def prune(self, older_than_seconds: int = 3600) -> None:
        """Drop keys with no recent activity, so the dict cannot grow forever."""
        cutoff = time.monotonic() - older_than_seconds
        for key in list(self._events):
            events = self._events[key]
            while events and events[0] < cutoff:
                events.popleft()
            if not events:
                del self._events[key]


_limiter = SlidingWindowRateLimiter()


def get_rate_limiter() -> SlidingWindowRateLimiter:
    return _limiter


async def enforce_chat_rate_limit(
    caller: Annotated[CallerIdentity, Depends(require_caller)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    limiter: Annotated[SlidingWindowRateLimiter, Depends(get_rate_limiter)],
) -> CallerIdentity:
    """Two windows: a burst limit and an hourly one.

    The minute window stops a runaway client; the hour window stops a patient
    one. Either alone is easy to work around.
    """
    if not settings.rate_limit.enabled:
        return caller

    key = f"chat:{caller.tenant_id}:{caller.user_id}"
    limiter.check(
        key, limit=settings.rate_limit.chat_requests_per_minute, window_seconds=60
    )
    limiter.check(
        f"{key}:hour",
        limit=settings.rate_limit.chat_requests_per_hour,
        window_seconds=3600,
    )
    return caller


async def enforce_index_rate_limit(
    caller: Annotated[CallerIdentity, Depends(require_caller)],
    settings: Annotated[Settings, Depends(get_app_settings)],
    limiter: Annotated[SlidingWindowRateLimiter, Depends(get_rate_limiter)],
) -> CallerIdentity:
    if not settings.rate_limit.enabled:
        return caller
    limiter.check(
        f"index:{caller.tenant_id}",
        limit=settings.rate_limit.index_requests_per_minute,
        window_seconds=60,
    )
    return caller


CallerDep = Annotated[CallerIdentity, Depends(require_caller)]
ChatCallerDep = Annotated[CallerIdentity, Depends(enforce_chat_rate_limit)]
IndexCallerDep = Annotated[CallerIdentity, Depends(enforce_index_rate_limit)]
ResourcesDep = Annotated[AppResources, Depends(get_resources)]
SettingsDep = Annotated[Settings, Depends(get_app_settings)]

__all__ = [
    "CallerDep",
    "ChatCallerDep",
    "IndexCallerDep",
    "ResourcesDep",
    "SettingsDep",
    "SlidingWindowRateLimiter",
    "get_resources",
]
