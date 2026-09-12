"""
Settings shared by every environment.

Every value that differs between a laptop and a server comes from the process
environment, or from backend/.env during local development. The defaults
written here are the *safe* ones - secure cookies, CAPTCHA on, no CORS - so a
variable that is forgotten in production fails closed rather than open.
development.py and production.py adjust only what genuinely differs.
"""

from datetime import timedelta
from pathlib import Path

import environ
from django.core.exceptions import ImproperlyConfigured
from django.utils.csp import CSP

BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env()
# Fills gaps only: a variable already set in the real environment wins.
environ.Env.read_env(BASE_DIR / ".env")


def env_list(name, default=()):
    """A comma-separated variable as a list, ignoring empty items (`FOO=`)."""
    return [item for item in env.list(name, default=list(default)) if item]


# ---------------------------------------------------------------------------
# Core
# ---------------------------------------------------------------------------

SECRET_KEY = env("SECRET_KEY")
DEBUG = env.bool("DEBUG", default=False)
ALLOWED_HOSTS = env_list("ALLOWED_HOSTS")

INSTALLED_APPS = [
    # django.contrib.admin, with its login rate-limited like the API's.
    "apps.accounts.admin_apps.ThrottledAdminConfig",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.postgres",
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "apps.accounts",
    "apps.knowledge_base",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.csp.ContentSecurityPolicyMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    # Before CommonMiddleware, so preflight responses carry CORS headers.
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ADMIN_URL = env("ADMIN_URL", default="admin/")

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]


# ---------------------------------------------------------------------------
# Database - PostgreSQL only
# ---------------------------------------------------------------------------

DATABASES = {"default": env.db("DATABASE_URL")}
DATABASES["default"]["CONN_MAX_AGE"] = env.int("DB_CONN_MAX_AGE", default=60)
DATABASES["default"]["CONN_HEALTH_CHECKS"] = True

if DATABASES["default"]["ENGINE"] != "django.db.backends.postgresql":
    raise ImproperlyConfigured("DATABASE_URL must point at PostgreSQL (postgres://...).")

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# ---------------------------------------------------------------------------
# Users and passwords
# ---------------------------------------------------------------------------

AUTH_USER_MODEL = "accounts.User"

# ModelBackend keyed on email, plus the per-account failure limit. It is the
# only backend, so the API login and the admin login share one lockout.
AUTHENTICATION_BACKENDS = ["apps.accounts.backends.EmailBackend"]

# Applied wherever a password is *set* - the admin and createsuperuser. There
# is no public registration, so these never reach the login form.
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
        "OPTIONS": {"min_length": 12},
    },
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]


# ---------------------------------------------------------------------------
# Internationalisation, static files, email
# ---------------------------------------------------------------------------

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MAILERS = {
    "default": {
        "BACKEND": "django.core.mail.backends.console.EmailBackend",
    },
}


# ---------------------------------------------------------------------------
# Cache - holds the rate-limit and login-failure counters
# ---------------------------------------------------------------------------
# Counters must be shared by every worker process, or each worker grants its
# own allowance. Redis when REDIS_URL is set; production.py falls back to the
# database cache otherwise. Local memory is only acceptable for one process.

REDIS_URL = env("REDIS_URL", default="")

if REDIS_URL:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": REDIS_URL,
            "KEY_PREFIX": "nmhs",
        }
    }
else:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "nmhs-default",
        }
    }


# ---------------------------------------------------------------------------
# Auth cookies
# ---------------------------------------------------------------------------

COOKIE_SECURE = env.bool("COOKIE_SECURE", default=True)
COOKIE_SAMESITE = env("COOKIE_SAMESITE", default="Lax")
COOKIE_DOMAIN = env("COOKIE_DOMAIN", default="") or None

if COOKIE_SAMESITE not in {"Lax", "Strict", "None"}:
    raise ImproperlyConfigured("COOKIE_SAMESITE must be Lax, Strict or None.")
if COOKIE_SAMESITE == "None" and not COOKIE_SECURE:
    raise ImproperlyConfigured("COOKIE_SAMESITE=None requires COOKIE_SECURE=True.")
# Listed so that a deployment which sets it gets an answer rather than being
# silently ignored: the JWT cookies are HttpOnly, always.
if not env.bool("COOKIE_HTTPONLY", default=True):
    raise ImproperlyConfigured("COOKIE_HTTPONLY cannot be disabled: JWTs must never be readable by JavaScript.")

AUTH_COOKIES = {
    "ACCESS_NAME": env("ACCESS_COOKIE_NAME", default="access_token"),
    "REFRESH_NAME": env("REFRESH_COOKIE_NAME", default="refresh_token"),
    # The access token goes to every API call; the refresh token only to the
    # auth endpoints, so it is never on the wire for an ordinary request.
    "ACCESS_PATH": "/api/",
    "REFRESH_PATH": "/api/v1/auth/",
    "DOMAIN": COOKIE_DOMAIN,
    "SECURE": COOKIE_SECURE,
    "SAMESITE": COOKIE_SAMESITE,
}

# Sessions exist only for the Django admin.
SESSION_COOKIE_SECURE = COOKIE_SECURE
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"


# ---------------------------------------------------------------------------
# CSRF and CORS
# ---------------------------------------------------------------------------
# Cookie authentication is exactly what CSRF attacks exploit, so every unsafe
# request must carry the X-CSRFToken header. The client reads the token from
# GET /api/v1/auth/csrf/ rather than from document.cookie, which lets the
# cookie itself be HttpOnly and keeps working when the API is on another host.

CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SECURE = COOKIE_SECURE
CSRF_COOKIE_SAMESITE = COOKIE_SAMESITE
CSRF_TRUSTED_ORIGINS = env_list("CSRF_TRUSTED_ORIGINS")

# An explicit allow-list with credentials. There is deliberately no switch for
# CORS_ALLOW_ALL_ORIGINS: with credentials it would hand every site the API.
CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS")
CORS_ALLOW_CREDENTIALS = True
CORS_URLS_REGEX = r"^/api/.*$"


# ---------------------------------------------------------------------------
# Security headers
# ---------------------------------------------------------------------------

SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
SECURE_CROSS_ORIGIN_OPENER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"

# The backend serves JSON and the admin, both from its own origin. The admin
# ships no inline script or style, so this needs no exceptions.
SECURE_CSP = {
    "default-src": [CSP.SELF],
    "base-uri": [CSP.NONE],
    "object-src": [CSP.NONE],
    "frame-ancestors": [CSP.NONE],
    "form-action": [CSP.SELF],
}


# ---------------------------------------------------------------------------
# Django REST framework
# ---------------------------------------------------------------------------

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["apps.accounts.authentication.CookieJWTAuthentication"],
    # Deny by default; an endpoint that is public says so.
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
    "EXCEPTION_HANDLER": "apps.core.exceptions.api_exception_handler",
    # How many reverse proxies sit in front of Django and append to
    # X-Forwarded-For. 0 trusts only REMOTE_ADDR. Left at DRF's default (None)
    # the whole header - which the client writes - would be the rate-limit key.
    "NUM_PROXIES": env.int("TRUSTED_PROXY_COUNT", default=0),
    "TEST_REQUEST_DEFAULT_FORMAT": "json",
}


# ---------------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------------

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=env.int("JWT_ACCESS_TOKEN_LIFETIME_MINUTES", default=10)),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=env.int("JWT_REFRESH_TOKEN_LIFETIME_DAYS", default=7)),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    # last_login is updated through the user_logged_in signal in LoginView.
    "UPDATE_LAST_LOGIN": False,
    "ALGORITHM": "HS256",
    "SIGNING_KEY": env("JWT_SIGNING_KEY", default="") or SECRET_KEY,
    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
    "CHECK_USER_IS_ACTIVE": True,
    # Every token carries a fingerprint of the password hash, so changing a
    # password ends every session that was signed in with the old one.
    "CHECK_REVOKE_TOKEN": True,
    "REVOKE_TOKEN_CLAIM": "hash_password",
}


# ---------------------------------------------------------------------------
# Brute-force protection
# ---------------------------------------------------------------------------

# Per client IP (IPv6 bucketed by /64). DRF rate syntax: <count>/<sec|min|hour|day>.
AUTH_THROTTLE_RATES = {
    "login_ip_burst": env("LOGIN_THROTTLE_IP_BURST", default="10/min"),
    "login_ip_sustained": env("LOGIN_THROTTLE_IP_SUSTAINED", default="100/hour"),
    "auth_refresh": env("REFRESH_THROTTLE_IP", default="30/min"),
}

# Per account, whatever the IP: this many failed password checks within the
# window refuses further attempts on that email until the window ends. Never
# permanent, and applied identically to emails that do not exist.
AUTH_LOGIN_FAILURE_LIMIT = env.int("LOGIN_FAILURE_LIMIT", default=5)
AUTH_LOGIN_FAILURE_WINDOW = env.int("LOGIN_FAILURE_WINDOW_SECONDS", default=900)

# A refresh token presented again within this many seconds of being rotated
# or signed out is treated as racing requests (two tabs, or a refresh in
# flight during sign-out), not as theft. Past it, reuse signs the user out
# everywhere. Either way the stale token itself is refused.
AUTH_REFRESH_REUSE_GRACE_SECONDS = env.int("REFRESH_REUSE_GRACE_SECONDS", default=30)


# ---------------------------------------------------------------------------
# CAPTCHA
# ---------------------------------------------------------------------------

CAPTCHA = {
    "ENABLED": env.bool("CAPTCHA_ENABLED", default=True),
    # turnstile (Cloudflare) | hcaptcha | recaptcha (v2 checkbox)
    "PROVIDER": env("CAPTCHA_PROVIDER", default="turnstile"),
    # Public: sent to the browser by GET /api/v1/auth/csrf/.
    "SITE_KEY": env("CAPTCHA_SITE_KEY", default=""),
    # Private: used only for the server-to-provider verification call.
    "SECRET_KEY": env("CAPTCHA_SECRET_KEY", default=""),
    # When set, a solved challenge must come from one of these hostnames.
    "EXPECTED_HOSTNAMES": env_list("CAPTCHA_EXPECTED_HOSTNAMES"),
    "TIMEOUT": env.float("CAPTCHA_TIMEOUT_SECONDS", default=5.0),
}

if CAPTCHA["PROVIDER"] not in {"turnstile", "hcaptcha", "recaptcha"}:
    raise ImproperlyConfigured("CAPTCHA_PROVIDER must be turnstile, hcaptcha or recaptcha.")
if CAPTCHA["ENABLED"] and not (CAPTCHA["SITE_KEY"] and CAPTCHA["SECRET_KEY"]):
    raise ImproperlyConfigured("CAPTCHA_ENABLED requires CAPTCHA_SITE_KEY and CAPTCHA_SECRET_KEY.")


# ---------------------------------------------------------------------------
# Knowledge base
# ---------------------------------------------------------------------------
# This backend owns documents, their status and who may see them; the AI
# service parses, embeds, retrieves and generates. See apps/knowledge_base/
# and ai_service/README.md.

KNOWLEDGE_BASE = {
    # The AI service and the token it expects (its SECURITY__SERVICE_TOKEN).
    # Server to server only: neither ever reaches a browser.
    "AI_SERVICE_URL": env("AI_SERVICE_URL", default="http://127.0.0.1:8001"),
    "AI_SERVICE_TOKEN": env("AI_SERVICE_TOKEN", default=""),
    "AI_SERVICE_TIMEOUT": env.float("AI_SERVICE_TIMEOUT_SECONDS", default=30.0),
    # Extracting or embedding one large document is a single call.
    "INGEST_TIMEOUT": env.float("KB_INGEST_TIMEOUT_SECONDS", default=600.0),
    "CHAT_TIMEOUT": env.float("KB_CHAT_TIMEOUT_SECONDS", default=120.0),
    # Presented by the AI service's re-index worker to /api/internal/ (its
    # MAIN_BACKEND_TOKEN). Empty disables those endpoints entirely.
    "INTERNAL_API_TOKEN": env("KB_INTERNAL_API_TOKEN", default=""),
    # Uploaded files: outside any web root, and nothing serves this directory.
    "STORAGE_ROOT": env("KB_STORAGE_ROOT", default=str(BASE_DIR / "var" / "knowledge_base")),
    # Keep at or below the AI service's INGESTION__MAX_FILE_BYTES.
    "MAX_UPLOAD_BYTES": env.int("KB_MAX_UPLOAD_BYTES", default=25 * 1024 * 1024),
    "ALLOWED_EXTENSIONS": env_list("KB_ALLOWED_EXTENSIONS", default=["pdf", "docx", "txt", "md", "csv", "json"]),
    "MAX_TEXT_CHARACTERS": env.int("KB_MAX_TEXT_CHARACTERS", default=200_000),
    # worker: `manage.py process_documents` runs jobs. thread: the web process
    # does, in a background thread — local development only.
    "DISPATCH": env("KB_TASK_DISPATCH", default="worker"),
    "WORKER_POLL_SECONDS": env.float("KB_WORKER_POLL_SECONDS", default=2.0),
    "JOB_MAX_ATTEMPTS": env.int("KB_JOB_MAX_ATTEMPTS", default=3),
    # Must exceed INGEST_TIMEOUT; a system check enforces it.
    "JOB_STALE_SECONDS": env.int("KB_JOB_STALE_SECONDS", default=900),
    # none | clamav
    "MALWARE_SCANNER": env("KB_MALWARE_SCANNER", default="none"),
    "CLAMAV_HOST": env("CLAMAV_HOST", default="127.0.0.1"),
    "CLAMAV_PORT": env.int("CLAMAV_PORT", default=3310),
    # The website's public chatbot answers from the chat-enabled knowledge
    # bases of the workspace with this slug, and nothing else - the scope is
    # fixed here, never by the request. Empty turns the public chatbot off.
    "PUBLIC_CHAT_WORKSPACE": env("KB_PUBLIC_CHAT_WORKSPACE", default="default"),
    # Per user, except public_chat_*, which are per client IP.
    "THROTTLE_RATES": {
        "upload": env("KB_UPLOAD_THROTTLE", default="120/hour"),
        "source": env("KB_SOURCE_THROTTLE", default="60/hour"),
        "rag_test": env("KB_RAG_TEST_THROTTLE", default="30/min"),
        "chat": env("KB_CHAT_THROTTLE", default="20/min"),
        "public_chat_burst": env("KB_PUBLIC_CHAT_THROTTLE_BURST", default="6/min"),
        "public_chat_sustained": env("KB_PUBLIC_CHAT_THROTTLE_SUSTAINED", default="60/hour"),
    },
}


# ---------------------------------------------------------------------------
# Logging - one JSON object per line on stdout
# ---------------------------------------------------------------------------

LOG_LEVEL = env("LOG_LEVEL", default="INFO")

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {
        "redact": {"()": "apps.core.logging.RedactSensitiveFilter"},
    },
    "formatters": {
        "json": {"()": "apps.core.logging.JsonFormatter"},
        "console": {"()": "apps.core.logging.ConsoleFormatter"},
    },
    "handlers": {
        "stdout": {
            "class": "logging.StreamHandler",
            "formatter": env("LOG_FORMAT", default="json"),
            "filters": ["redact"],
        },
    },
    "root": {"handlers": ["stdout"], "level": LOG_LEVEL},
    "loggers": {
        "django": {"handlers": ["stdout"], "level": LOG_LEVEL, "propagate": False},
    },
}
