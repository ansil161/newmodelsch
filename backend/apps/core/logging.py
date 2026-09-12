"""
Structured logging.

Code logs an event name as the message and the details as `extra` fields:

    logger.info("login_success", extra={"event": "login_success", "user_id": 7})

JsonFormatter writes one JSON object per line for a log pipeline;
ConsoleFormatter writes the same fields as key=value for a terminal. Only
primitive values are emitted, so an object passed in `extra` - Django attaches
the whole request to its own records - is never serialised by accident.
"""

import json
import logging
from datetime import UTC, datetime

_RESERVED = set(vars(logging.LogRecord("", logging.INFO, "", 0, "", (), None))) | {"message", "asctime"}
_SENSITIVE_WORDS = ("password", "passwd", "secret", "token", "authorization", "cookie", "session")


def _extra_fields(record):
    fields = {}
    for key, value in vars(record).items():
        if key in _RESERVED or key.startswith("_"):
            continue
        if value is None or isinstance(value, (str, int, float, bool)):
            fields[key] = value
    return fields


class JsonFormatter(logging.Formatter):
    def format(self, record):
        payload = {
            "ts": datetime.fromtimestamp(record.created, tz=UTC).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            **_extra_fields(record),
        }
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


class ConsoleFormatter(logging.Formatter):
    def format(self, record):
        line = f"{self.formatTime(record, '%H:%M:%S')} {record.levelname:<7} {record.name}: {record.getMessage()}"
        fields = " ".join(f"{key}={value}" for key, value in _extra_fields(record).items() if key != "event")
        if fields:
            line = f"{line}  {fields}"
        if record.exc_info:
            line = f"{line}\n{self.formatException(record.exc_info)}"
        return line


class RedactSensitiveFilter(logging.Filter):
    """
    Last line of defence. Code in this project never passes a credential to a
    logger; if a future change does, under any field name that looks like
    one, the value is blanked here rather than written out.
    """

    def filter(self, record):
        for key in list(vars(record)):
            if key in _RESERVED:
                continue
            if any(word in key.lower() for word in _SENSITIVE_WORDS):
                setattr(record, key, "[redacted]")
        return True
