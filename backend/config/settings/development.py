"""
Local development: `manage.py runserver` on http://localhost:8000, reached
through the Vite dev server's /api proxy (or cross-origin, via CORS).

Only the defaults change here. Anything set in backend/.env still wins.
"""

from .base import *  # noqa: F403
from .base import KNOWLEDGE_BASE, LOGGING, env, env_list

DEBUG = env.bool("DEBUG", default=True)
ALLOWED_HOSTS = env_list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])

# Human-readable lines in a terminal; LOG_FORMAT=json to see what production emits.
LOGGING["handlers"]["stdout"]["formatter"] = env("LOG_FORMAT", default="console")

# Knowledge-base jobs run in a background thread of `runserver`, so an upload
# is processed without starting a separate worker. KB_TASK_DISPATCH=worker and
# `manage.py process_documents` reproduce production instead.
KNOWLEDGE_BASE = {**KNOWLEDGE_BASE, "DISPATCH": env("KB_TASK_DISPATCH", default="thread")}
