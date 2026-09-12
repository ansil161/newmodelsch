"""The parser contract.

One method: bytes in, blocks in reading order out. Parsers are synchronous —
every one of them is CPU-bound — and the ingestion service runs them in a
worker thread behind a semaphore, so no parser needs to know about the event
loop.

A parser raises `DocumentRejectedError` for input it refuses on purpose: a
password, too many pages, no text layer. Anything else it raises is treated
by the service as a damaged file, logged with its traceback, and reported to
the caller as DOCUMENT_CORRUPT — never with the parser's own message, which
can quote the file.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from ..models import ParsedDocument


class DocumentParser(ABC):
    format: str = ""
    name: str = ""

    @abstractmethod
    def parse(self, data: bytes, *, filename: str,
              charset: str | None = None) -> ParsedDocument:
        """Blocks in reading order, plus whatever metadata the format carries."""
