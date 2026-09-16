"""
Production. wsgi.py and asgi.py default to this module.

It refuses to import - so the process refuses to start - when a setting that
protects users is missing or unsafe. A server that boots with insecure
cookies is worse than one that does not boot.
"""

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F403
from .base import (
    ALLOWED_HOSTS,
    AUTH_COOKIES,
    CORS_ALLOWED_ORIGINS,
    CSRF_TRUSTED_ORIGINS,
    REDIS_URL,
    SECRET_KEY,
    env,
)

# Never read from the environment here.
DEBUG = False


def _require(condition, message):
    if not condition:
        raise ImproperlyConfigured(message)


_require(
    len(SECRET_KEY) >= 50 and not SECRET_KEY.startswith("django-insecure"),
    "SECRET_KEY must be a unique, random value of at least 50 characters.",
)
_require(
    bool(ALLOWED_HOSTS) and "*" not in ALLOWED_HOSTS,
    "ALLOWED_HOSTS must list the API's hostnames explicitly.",
)
_require(AUTH_COOKIES["SECURE"], "COOKIE_SECURE must be True in production.")
_require(
    all(origin.startswith("https://") for origin in [*CORS_ALLOWED_ORIGINS, *CSRF_TRUSTED_ORIGINS]),
    "CORS_ALLOWED_ORIGINS and CSRF_TRUSTED_ORIGINS must be https:// origins.",
)

CSRF_COOKIE_SECURE = True

SECURE_SSL_REDIRECT = env.bool("SECURE_SSL_REDIRECT", default=True)
# Only behind a proxy that overwrites X-Forwarded-Proto. Trusting a header the
# client can set would let any request claim it arrived over HTTPS.
if env.bool("USE_X_FORWARDED_PROTO", default=False):
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

SECURE_HSTS_SECONDS = env.int("SECURE_HSTS_SECONDS", default=31_536_000)
SECURE_HSTS_INCLUDE_SUBDOMAINS = env.bool("SECURE_HSTS_INCLUDE_SUBDOMAINS", default=True)
SECURE_HSTS_PRELOAD = env.bool("SECURE_HSTS_PRELOAD", default=True)

# SMTP. The auth API sends no email today, but Django's error reporting and
# any future feature will, and the console backend would silently drop it.
MAILERS = {
    "default": {
        "BACKEND": "django.core.mail.backends.smtp.EmailBackend",
        "OPTIONS": {
            "host": env("EMAIL_HOST", default="localhost"),
            "port": env.int("EMAIL_PORT", default=587),
            "username": env("EMAIL_HOST_USER", default=""),
            "password": env("EMAIL_HOST_PASSWORD", default=""),
            "use_tls": env.bool("EMAIL_USE_TLS", default=True),
            "timeout": 10,
        },
    },
}

# Rate-limit counters must be shared by every worker. Without Redis, use the
# database (run `manage.py createcachetable` once per deployment).
if not REDIS_URL:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.db.DatabaseCache",
            "LOCATION": "django_cache",
        }
    }
