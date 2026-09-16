"""
Settings for `manage.py test --settings=config.settings.test`.

Deterministic whatever backend/.env says about cookies, rate limits
or logging. Only DATABASE_URL and SECRET_KEY are taken from the environment;
Django creates and destroys its own test database.
"""

import tempfile

from .development import *  # noqa: F403
from .development import AUTH_COOKIES, KNOWLEDGE_BASE

DEBUG = False

# The AI service is faked in the tests (see apps/knowledge_base/tests/fakes.py);
# jobs run only when a test runs them, and files go to a throwaway directory.
KNOWLEDGE_BASE = {
    **KNOWLEDGE_BASE,
    "AI_SERVICE_URL": "http://ai-service.test",
    "AI_SERVICE_TOKEN": "test-service-token",
    "INTERNAL_API_TOKEN": "test-internal-token",
    "STORAGE_ROOT": tempfile.mkdtemp(prefix="kb-tests-"),
    "DISPATCH": "worker",
    "MALWARE_SCANNER": "none",
    "MAX_UPLOAD_BYTES": 1024 * 1024,
    "JOB_MAX_ATTEMPTS": 3,
    "THROTTLE_RATES": {
        "upload": "1000/min", "source": "1000/min", "rag_test": "1000/min", "chat": "1000/min",
        "public_chat_burst": "1000/min", "public_chat_sustained": "1000/hour",
    },
}

# Speed only. MD5 must never be used outside the test suite.
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "accounts-tests",
    }
}

AUTH_COOKIES = {**AUTH_COOKIES, "SECURE": False, "SAMESITE": "Lax", "DOMAIN": None}

# The API has no sessions, but the test client's logout() (which DRF's
# force_authenticate(user=None) calls) still opens one. Signed cookies need
# no django.contrib.sessions table.
SESSION_ENGINE = "django.contrib.sessions.backends.signed_cookies"

CORS_ALLOWED_ORIGINS = ["http://localhost:5173"]
CSRF_TRUSTED_ORIGINS = ["http://localhost:5173"]

# High enough that only the tests about rate limiting ever reach them; those
# tests lower them explicitly.
AUTH_THROTTLE_RATES = {
    "login_ip_burst": "1000/min",
    "login_ip_sustained": "1000/hour",
    "auth_refresh": "1000/min",
}
AUTH_LOGIN_FAILURE_LIMIT = 5
AUTH_LOGIN_FAILURE_WINDOW = 900
AUTH_REFRESH_REUSE_GRACE_SECONDS = 30

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"null": {"class": "logging.NullHandler"}},
    "root": {"handlers": ["null"], "level": "INFO"},
}
