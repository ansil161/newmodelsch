"""IngestionService — bytes or a URL in, chunks out.

    detect format → parse → clean → chunk

Parsing and chunking are CPU-bound, so they run in a worker thread; running
them on the event loop would stall every chat request in flight for as long
as a 300-page PDF takes to read. A semaphore caps how many run at once, for
the same reason the indexing service caps concurrent embeddings.

Every failure the caller sees is a `DocumentRejectedError` or a
`UrlRejectedError` with a code and a message written for an administrator.
A parser that crashes on a malformed file is logged here with its traceback
and reported as DOCUMENT_CORRUPT — its own exception text, which can quote
the file, never leaves the service.
"""

from __future__ import annotations

import asyncio
from pathlib import PurePosixPath
from urllib.parse import unquote, urlsplit

from app.core.config import IngestionSettings
from app.core.exceptions import AIServiceError, DocumentRejectedError, ErrorCode
from app.core.logging import Stopwatch, get_logger

from .chunking import Chunker
from .cleaning import clean_document
from .detection import detect_format, format_from_filename
from .models import ExtractionResult
from .parsers import parser_for
from .url_fetcher import SafeUrlFetcher

logger = get_logger(__name__)


def file_too_large(limit: int) -> DocumentRejectedError:
    return DocumentRejectedError(
        f"The file is larger than the {limit // (1024 * 1024)} MB limit.",
        code=ErrorCode.FILE_TOO_LARGE, status_code=413,
    )


class IngestionService:
    def __init__(self, settings: IngestionSettings, fetcher: SafeUrlFetcher) -> None:
        self._settings = settings
        self._fetcher = fetcher
        self._chunker = Chunker.from_settings(settings)
        self._gate = asyncio.Semaphore(max(1, settings.max_concurrent_extractions))

    async def extract_file(self, data: bytes, *, filename: str,
                           content_type: str | None) -> ExtractionResult:
        if len(data) > self._settings.max_file_bytes:
            raise file_too_large(self._settings.max_file_bytes)
        async with self._gate:
            return await asyncio.to_thread(
                self._extract, data, filename, content_type, None, False
            )

    async def extract_url(self, url: str) -> ExtractionResult:
        resource = await self._fetcher.fetch(url)
        async with self._gate:
            result = await asyncio.to_thread(
                self._extract, resource.data, _filename_for(resource.url),
                resource.content_type, resource.charset, True,
            )
        result.source_url = resource.url
        result.content_type = resource.content_type
        result.fetch_ms = resource.fetch_ms
        if not result.title:
            result.title = _title_from_url(resource.url)
        return result

    async def aclose(self) -> None:
        await self._fetcher.aclose()

    # -- the pipeline, in a worker thread ---------------------------------

    def _extract(self, data: bytes, filename: str, content_type: str | None,
                 charset: str | None, from_url: bool) -> ExtractionResult:
        format_name = detect_format(data, filename=filename, content_type=content_type)
        parser = parser_for(format_name, self._settings)

        with Stopwatch() as extraction:
            try:
                parsed = parser.parse(data, filename=filename, charset=charset)
            except AIServiceError:
                raise
            except Exception as exc:
                logger.exception(
                    "Parser failed",
                    extra={"format": format_name, "parser": parser.name},
                )
                raise DocumentRejectedError(
                    "The file appears to be damaged and could not be read.",
                    code=ErrorCode.DOCUMENT_CORRUPT,
                ) from exc
            parsed = clean_document(parsed)

        characters = parsed.character_count
        if characters > self._settings.max_extracted_characters:
            raise DocumentRejectedError(
                f"The document contains more than "
                f"{self._settings.max_extracted_characters:,} characters of text. "
                f"Split it into smaller documents.",
                code=ErrorCode.DOCUMENT_TOO_LARGE,
            )

        with Stopwatch() as chunking:
            chunks = self._chunker.chunk(parsed) if characters else []
        if not chunks:
            message = (_NO_TEXT_FROM_PAGE if from_url
                       else "No readable text was found in the file.")
            raise DocumentRejectedError(message, code=ErrorCode.NO_EXTRACTABLE_TEXT)

        logger.info(
            "Document extracted",
            extra={"format": format_name, "parser": parser.name,
                   "pages": parsed.page_count, "characters": characters,
                   "chunks": len(chunks), "warnings": len(parsed.warnings),
                   "extraction_ms": extraction.milliseconds,
                   "chunking_ms": chunking.milliseconds},
        )
        return ExtractionResult(
            format=format_name,
            parser=parser.name,
            chunks=chunks,
            title=parsed.title,
            page_count=parsed.page_count,
            character_count=characters,
            warnings=parsed.warnings,
            metadata=parsed.metadata,
            extraction_ms=extraction.milliseconds,
            chunking_ms=chunking.milliseconds,
        )


_NO_TEXT_FROM_PAGE = (
    "No readable text was found on the page. Pages that build their content "
    "with JavaScript cannot be read — link to a static version of the page, "
    "or upload the content as a file."
)


def _filename_for(url: str) -> str:
    """The URL's last path segment, when it names a format we recognise.

    Otherwise empty, so format detection falls back to the Content-Type —
    "/docs/getting-started" says nothing, "/handbook.pdf" says a lot.
    """
    segment = PurePosixPath(unquote(urlsplit(url).path)).name
    return segment if format_from_filename(segment) else ""


def _title_from_url(url: str) -> str:
    parts = urlsplit(url)
    path = unquote(parts.path).rstrip("/")
    return f"{parts.hostname}{path}"[:300] if parts.hostname else url[:300]
