"""Structured logging with per-request context.

Every log line from a request carries its `request_id`, and where known its
`conversation_id` and `user_id`, without any of the code doing the logging
having to pass them. That is what makes a slow or failed answer traceable
through six modules after the fact.

The context lives in `contextvars`, which is per-task in asyncio — two
concurrent chat requests do not see each other's identifiers.

WHAT IS NEVER LOGGED, anywhere in this service: API keys, the service token,
document contents, and full conversation history. Question text is logged
only at DEBUG and only when OBSERVABILITY__LOG_QUERY_TEXT is deliberately
turned on. Everything else is counts, durations and identifiers.
"""

from __future__ import annotations

import json
import logging
import sys
import time
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from contextvars import ContextVar
from typing import Any

# None rather than {} as the default. A ContextVar's default is one object
# shared by every context that has not set its own, so a mutable one is a
# single dict every unbound task would write into — one request's identifiers
# leaking into another's log lines. Reads go through `_context()`, which never
# returns the sentinel.
_request_context: ContextVar[dict[str, Any] | None] = ContextVar(
    "request_context", default=None
)


def _context() -> dict[str, Any]:
    return _request_context.get() or {}

# Attributes LogRecord always carries; anything else on a record was put
# there by a caller and is worth emitting.
_RESERVED = frozenset(
    vars(logging.LogRecord("", 0, "", 0, "", (), None)).keys()
) | {"message", "asctime", "taskName"}


def bind_context(**values: Any) -> None:
    """Add identifiers to every subsequent log line in this task."""
    current = dict(_context())
    current.update({key: value for key, value in values.items() if value is not None})
    _request_context.set(current)


@contextmanager
def request_context(**values: Any) -> Iterator[str]:
    """Scope a block of work to a request id, restoring the previous context."""
    token = _request_context.set(
        {**_context(), "request_id": values.pop("request_id", None)
         or uuid.uuid4().hex, **{k: v for k, v in values.items() if v is not None}}
    )
    try:
        yield _context()["request_id"]
    finally:
        _request_context.reset(token)


class _ContextFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        for key, value in _context().items():
            if not hasattr(record, key):
                setattr(record, key, value)
        return True


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for key, value in record.__dict__.items():
            if key not in _RESERVED and not key.startswith("_"):
                payload[key] = value
        if record.exc_info:
            # The traceback goes here and only here. It never reaches a
            # response body.
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


class ConsoleFormatter(logging.Formatter):
    """Readable locally, with the structured fields appended."""

    def format(self, record: logging.LogRecord) -> str:
        base = f"{self.formatTime(record, '%H:%M:%S')} {record.levelname:<7} " \
               f"{record.name}: {record.getMessage()}"
        extras = {
            key: value
            for key, value in record.__dict__.items()
            if key not in _RESERVED and not key.startswith("_")
        }
        if extras:
            base += "  " + " ".join(f"{k}={v}" for k, v in extras.items())
        if record.exc_info:
            base += "\n" + self.formatException(record.exc_info)
        return base


def configure_logging(level: str = "INFO", fmt: str = "console") -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter() if fmt == "json" else ConsoleFormatter())
    handler.addFilter(_ContextFilter())

    root = logging.getLogger()
    # Replace rather than append, so reloads under uvicorn do not stack
    # handlers and print every line four times.
    root.handlers = [handler]
    root.setLevel(level.upper())

    # These are chatty at INFO and say nothing this service's own logs do not.
    for noisy in ("httpx", "httpcore", "urllib3", "sentence_transformers"):
        logging.getLogger(noisy).setLevel("WARNING")


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)


class Stopwatch:
    """Measures a pipeline stage.

    Latency per stage is the first thing anyone asks about a slow answer, and
    it cannot be reconstructed afterwards from a single total.

        with Stopwatch() as timer:
            ...
        logger.info("retrieved", extra={"retrieval_ms": timer.milliseconds})
    """

    __slots__ = ("_elapsed", "_start")

    def __init__(self) -> None:
        self._start = 0.0
        self._elapsed = 0.0

    def __enter__(self) -> Stopwatch:
        self._start = time.perf_counter()
        return self

    def __exit__(self, *_: object) -> None:
        self._elapsed = time.perf_counter() - self._start

    @property
    def milliseconds(self) -> int:
        elapsed = self._elapsed or (time.perf_counter() - self._start)
        return int(elapsed * 1000)
