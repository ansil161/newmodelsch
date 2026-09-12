"""The parser registry: the one place that maps a format to its parser.

A new format is a class implementing `DocumentParser`, an entry here, and its
extensions and media types in ingestion/detection.py. Nothing upstream of the
parsers or downstream of them changes.
"""

from __future__ import annotations

from collections.abc import Callable

from app.core.config import IngestionSettings
from app.core.exceptions import DocumentRejectedError, ErrorCode

from .base import DocumentParser
from .docx import DocxParser
from .html import HtmlParser
from .markdown import MarkdownParser
from .pdf import PdfParser
from .structured import CsvParser, JsonParser
from .text import PlainTextParser

_PARSERS: dict[str, Callable[[IngestionSettings], DocumentParser]] = {
    "pdf": PdfParser,
    "docx": DocxParser,
    "txt": PlainTextParser,
    "md": MarkdownParser,
    "csv": CsvParser,
    "json": JsonParser,
    "html": HtmlParser,
}


def parser_for(format_name: str, settings: IngestionSettings) -> DocumentParser:
    factory = _PARSERS.get(format_name)
    if factory is None:
        raise DocumentRejectedError(
            "This file type is not supported.", code=ErrorCode.UNSUPPORTED_FILE_TYPE
        )
    return factory(settings)


__all__ = ["DocumentParser", "parser_for"]
