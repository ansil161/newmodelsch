"""
Brute-force and credential-stuffing protection.

Two independent limits, because they stop different attacks:

    per IP        many emails from one source (credential stuffing).
                  DRF throttles, counted on every attempt.
    per account   one email from many sources (distributed brute force).
                  LoginFailureTracker, counted on *failed password checks*
                  only, so a legitimate user is never locked by their own
                  successful sign-ins.

Neither is permanent. Both live in the cache, which must be shared by every
worker process in production (see CACHES in settings).
"""

import logging
import time

from django.conf import settings
from django.core.cache import cache
from django.utils.crypto import salted_hmac
from rest_framework.throttling import SimpleRateThrottle

from apps.core.http import get_client_ip, rate_limit_key

from .audit import log_auth_event
from .constants import Events
from .validators import normalize_email


class _AuthRateThrottle(SimpleRateThrottle):
    """
    A per-client-IP limit. The rate is read from settings.AUTH_THROTTLE_RATES
    on each request, because DRF binds DEFAULT_THROTTLE_RATES once at import,
    which makes a rate impossible to change without a restart.
    """

    cache_format = "auth-throttle:%(scope)s:%(ident)s"

    def get_rate(self):
        return settings.AUTH_THROTTLE_RATES[self.scope]

    def get_ident(self, request):
        return rate_limit_key(get_client_ip(request))

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}

    def allow_request(self, request, view):
        self._request = request
        return super().allow_request(request, view)

    def throttle_failure(self):
        log_auth_event(Events.RATE_LIMIT_TRIGGERED, self._request, level=logging.WARNING, scope=self.scope)
        return False


class LoginIPBurstThrottle(_AuthRateThrottle):
    scope = "login_ip_burst"


class LoginIPSustainedThrottle(_AuthRateThrottle):
    scope = "login_ip_sustained"


class RefreshThrottle(_AuthRateThrottle):
    scope = "auth_refresh"


class LoginFailureTracker:
    """
    Counts failed password checks against one email, from any IP.

    Once AUTH_LOGIN_FAILURE_LIMIT failures land inside the window, further
    attempts on that email are refused until the window - which opens at the
    first failure - runs out. A successful sign-in clears the count.

    Applied identically whether or not the email belongs to an account, so a
    lock reveals nothing about which addresses are registered. Keyed on an
    HMAC of the address, so the cache never holds one.
    """

    def __init__(self, email):
        digest = salted_hmac("apps.accounts.login-failures", normalize_email(email)).hexdigest()
        self._count_key = f"auth:login-failures:{digest}"
        self._until_key = f"auth:login-failures-until:{digest}"

    @property
    def limit(self):
        return settings.AUTH_LOGIN_FAILURE_LIMIT

    @property
    def window(self):
        return settings.AUTH_LOGIN_FAILURE_WINDOW

    def retry_after(self):
        """Seconds until this email may be tried again; 0 when it is not locked."""
        if (cache.get(self._count_key) or 0) < self.limit:
            return 0
        until = cache.get(self._until_key)
        return max(1, int(until - time.time())) if until else self.window

    def is_locked(self):
        return self.retry_after() > 0

    def record_failure(self):
        # add() writes only when the key is absent, so the window opens on the
        # first failure and later failures do not extend it.
        if cache.add(self._count_key, 0, timeout=self.window):
            cache.set(self._until_key, time.time() + self.window, timeout=self.window)
        try:
            cache.incr(self._count_key)
        except ValueError:
            # The window expired between add() and incr(): this is the first
            # failure of a new one.
            cache.set(self._count_key, 1, timeout=self.window)
            cache.set(self._until_key, time.time() + self.window, timeout=self.window)

    def reset(self):
        cache.delete_many([self._count_key, self._until_key])
