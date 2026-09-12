# New Model High School — API

Django 6.1 + Django REST framework. **Sign-in only**: there is no registration,
signup or password-reset endpoint. Accounts are created by administrators in the
Django admin or with `createsuperuser`.

```
backend/
  manage.py
  config/
    settings/   base.py · development.py · production.py · test.py
    urls.py     /admin/, /api/v1/auth/, /api/v1/ (knowledge base), /api/internal/
  apps/
    core/       response envelope, exception handler, client IP, JSON logging
    accounts/   user model, cookie-JWT auth, CAPTCHA, throttles, admin, tests
    knowledge_base/  workspaces, knowledge bases, documents, versions, chunks,
                the ingestion job queue, the AI-service client, audit log, tests
  requirements/ base.txt · development.txt · production.txt
```

## Local setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate                 # macOS/Linux: source venv/bin/activate
pip install -r requirements/development.txt
cp .env.example .env                  # fill in SECRET_KEY, DATABASE_URL, ...
python manage.py migrate
python manage.py createsuperuser      # the only way to create the first account
python manage.py runserver 127.0.0.1:8000
```

The frontend's dev server proxies `/api` to `127.0.0.1:8000`, so run both and
open `http://127.0.0.1:5173/login`.

For local CAPTCHA, Cloudflare's published Turnstile test keys work end to end
(`CAPTCHA_SITE_KEY=1x00000000000000000000AA`,
`CAPTCHA_SECRET_KEY=1x0000000000000000000000000000000AA`): the widget always
passes and the server still makes a real siteverify call. The secret
`2x0000000000000000000000000000000AA` always fails, for testing rejection.

## Tests

```bash
python manage.py test --settings=config.settings.test
```

Runs against a throwaway PostgreSQL database that Django creates and drops.

## Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/v1/auth/csrf/` | – | CSRF token + public CAPTCHA config |
| POST | `/api/v1/auth/login/` | CSRF | `{email, password, captcha_token}` → sets cookies, returns user |
| POST | `/api/v1/auth/refresh/` | CSRF + refresh cookie | rotates both cookies |
| POST | `/api/v1/auth/logout/` | CSRF | blacklists refresh token, clears cookies; idempotent |
| GET | `/api/v1/auth/me/` | access cookie | the signed-in user |

Every response is `{"success", "message", "data"}` or
`{"success": false, "message", "code", "errors"}`. Tokens never appear in a body.

## How sign-in is protected

- **Tokens** — SimpleJWT access (10 min) and refresh (7 days) tokens, only ever
  in `HttpOnly` cookies. The refresh cookie's path is `/api/v1/auth/`, so it is
  not sent with ordinary API calls. Refresh tokens rotate on every use; the old
  one is blacklisted. Presenting a blacklisted token after the 30 s race window
  revokes every session the user has. Changing a password ends every session.
- **CSRF** — every unsafe request needs `X-CSRFToken`; the token comes from
  `GET /csrf/`, and is rotated at sign-in and sign-out.
- **CAPTCHA** — Turnstile, hCaptcha or reCAPTCHA v2, verified server-side with
  the secret key. Fails closed if the provider is unreachable.
- **Brute force** — per-IP limits (IPv6 bucketed by /64) and a per-account lock
  after 5 failed passwords in 15 minutes. The lock is temporary, applies equally
  to unknown emails, and is shared with the Django admin login.
- **Responses** — one message for unknown email, wrong password and disabled
  account; no stack traces or internals; `Cache-Control: no-store`.
- **Logs** — JSON lines with `event`, `ip`, `user_id`; emails appear only as a
  keyed hash (`email_fp`). Passwords, tokens and secrets are never logged.

## Knowledge base

The admin console's knowledge base and the chatbot behind it. This app is the
control plane — who may do what, the documents and their state, the files,
the job queue. `ai_service` is the execution plane — parsing, chunking,
embeddings, Qdrant, retrieval, generation. The browser only ever talks to
Django; the AI service's token never leaves the server. See
[`docs/knowledge-base.md`](../docs/knowledge-base.md) for the whole design.

**Setup**

```bash
python manage.py migrate                        # also creates a "Default workspace"
python manage.py grant_workspace_access you@school.org --role admin
python manage.py runserver 127.0.0.1:8000
python manage.py process_documents              # the worker; see KB_TASK_DISPATCH
```

| Variable | What it is |
| --- | --- |
| `AI_SERVICE_URL`, `AI_SERVICE_TOKEN` | Where `ai_service` is, and its `SECURITY__SERVICE_TOKEN` — the same secret on both sides |
| `KB_INTERNAL_API_TOKEN` | What `ai_service`'s reindex job presents to `/api/internal/` (its `MAIN_BACKEND_TOKEN`) |
| `KB_STORAGE_ROOT` | Where uploaded files are kept, outside any served directory (default `var/knowledge_base`) |
| `KB_TASK_DISPATCH` | `worker` (default): a separate `process_documents` process; `thread`: in the web process, for development |
| `KB_MALWARE_SCANNER` | `none` or `clamav` (`CLAMAV_HOST`/`CLAMAV_PORT`); with ClamAV, an unreachable scanner refuses uploads |
| `KB_MAX_UPLOAD_BYTES`, `KB_ALLOWED_EXTENSIONS` | Upload limits, checked again against the file's own bytes |
| `KB_*_THROTTLE` | Per-user rates for uploads, sources, Test RAG and chat |

**Roles** are per workspace: *viewer* reads and tests, *editor* also adds,
edits, reprocesses and deletes documents, *admin* also creates, configures
and deletes knowledge bases. Superusers are admins everywhere. Someone outside
a workspace gets 404 for everything in it — its existence is not disclosed —
and every request is authorised against the workspace of the object it
names, never against anything the client sends.

**Processing.** An upload is stored, then queued. The worker claims jobs with
`SELECT … FOR UPDATE SKIP LOCKED`, heartbeats while working, reclaims jobs
from a worker that died, and retries temporary failures with backoff (three
attempts). A document is `uploaded → queued → processing → indexing → ready`,
or `failed` with a reason and a retry. Each re-index writes a new index
generation before removing the old one, so a document never drops out of
answers while it is being reprocessed.

| Method | Path | Role |
| --- | --- | --- |
| GET | `/api/v1/workspaces/` | member |
| GET, POST | `/api/v1/knowledge-bases/` (`?workspace=`) | member / admin |
| GET, PATCH, DELETE | `/api/v1/knowledge-bases/<id>/` | member / admin |
| GET | `/api/v1/knowledge-bases/<id>/overview/` | member |
| GET, POST | `/api/v1/knowledge-bases/<id>/documents/` (search, filters, sort, pages; multipart upload) | member / editor |
| GET, POST | `/api/v1/knowledge-bases/<id>/sources/` (`type`: `url` or `text`) | member / editor |
| GET | `/api/v1/knowledge-bases/<id>/jobs/` | member |
| GET, PATCH, DELETE | `/api/v1/documents/<id>/` | member / editor |
| POST | `/api/v1/documents/<id>/reprocess/`, `retry/`, `cancel/` | editor |
| POST | `/api/v1/documents/<id>/versions/`, `versions/<id>/activate/` | editor |
| GET | `/api/v1/documents/<id>/chunks/`, `download/` | member |
| DELETE, POST | `/api/v1/sources/<id>/`, `sources/<id>/sync/` | editor |
| POST | `/api/v1/rag/test/` | member |
| POST | `/api/v1/chat/`, `/api/v1/chat/stream/` | member |

## Production

```bash
pip install -r requirements/production.txt
export DJANGO_SETTINGS_MODULE=config.settings.production   # wsgi/asgi default to it
python manage.py check --deploy
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py createcachetable      # only if REDIS_URL is not set
gunicorn config.wsgi --workers 3 --threads 8 --bind 0.0.0.0:8000
python manage.py process_documents     # at least one, as its own process
```

A streaming chat answer holds a worker thread for as long as it streams, hence
`--threads`. Run as many `process_documents` processes as you want documents
processed in parallel; they never claim the same job.

`production.py` refuses to start without a strong `SECRET_KEY`, explicit
`ALLOWED_HOSTS`, `COOKIE_SECURE=True`, CAPTCHA enabled, and `https://` CORS and
CSRF origins. Set `TRUSTED_PROXY_COUNT` to the number of reverse proxies in front
of Django (and `USE_X_FORWARDED_PROTO=True` only behind a proxy that sets it), or
rate limits and logs will see the proxy's address instead of the client's.

Schedule `python manage.py flushexpiredtokens` daily to prune the token
blacklist.

**Deployment shape.** Serve the frontend and API from the same site — ideally
the same origin with `/api` routed to Django, or `www.` and `api.` subdomains of
one domain. Cookies stay `SameSite=Lax`. A frontend on an unrelated domain would
need `COOKIE_SAMESITE=None`, which works but gives up Lax's protection.
