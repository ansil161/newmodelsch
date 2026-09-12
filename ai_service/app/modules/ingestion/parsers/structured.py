"""CSV and JSON: records rather than prose.

Both become one line per record — "Header: value; Header: value" — rather
than the raw file. A CSV row "Grade 6,Science,Mrs Rao" retrieved on its own
says nothing; "Class: Grade 6; Subject: Science; Teacher: Mrs Rao" answers
"who teaches Grade 6 science" by itself, which is the point of retrieving
it. The lines are table-kind blocks, so the chunker packs many records per
chunk and splits between records, never inside one.

Row counts are bounded. A 50,000-row export is a database, not a document,
and indexing it as text answers questions about it badly — reported to the
administrator as a size limit rather than accepted and made useless.
"""

from __future__ import annotations

import csv
import io
import json
import re
from itertools import zip_longest
from pathlib import PurePosixPath
from typing import Any

from app.core.config import IngestionSettings
from app.core.exceptions import DocumentRejectedError, ErrorCode

from ..detection import decode_text
from ..models import Block, BlockKind, ParsedDocument
from .base import DocumentParser

_MAX_JSON_DEPTH = 32
# A list of scalars at most this long is written on one line.
_INLINE_LIST_ITEMS = 20
_NUMBER = re.compile(r"[-+]?[\d.,]+%?")


class CsvParser(DocumentParser):
    format = "csv"
    name = "csv"

    def __init__(self, settings: IngestionSettings) -> None:
        self._max_rows = settings.max_table_rows

    def parse(self, data: bytes, *, filename: str,
              charset: str | None = None) -> ParsedDocument:
        text, warning = decode_text(data, charset)
        sample = text[:16_384]

        # The Sniffer is good at delimiters and poor at headers — its header
        # test votes on column-length consistency and calls "Class,Subject,
        # Teacher" data about as often as not. Headers are decided below.
        try:
            dialect: type[csv.Dialect] | csv.Dialect = csv.Sniffer().sniff(
                sample, delimiters=",;\t|"
            )
        except csv.Error:
            dialect = csv.excel

        rows: list[list[str]] = []
        try:
            for row in csv.reader(io.StringIO(text), dialect):
                cells = [cell.strip() for cell in row]
                if any(cells):
                    rows.append(cells)
                    if len(rows) > self._max_rows + 1:
                        raise _too_many_rows(self._max_rows)
        except csv.Error as exc:
            raise DocumentRejectedError(
                "The CSV file could not be read. Check that it is a valid, "
                "comma- or semicolon-separated file.",
                code=ErrorCode.DOCUMENT_CORRUPT,
            ) from exc

        if not rows:
            return ParsedDocument(self.format, self.name, [], warnings=_listed(warning))

        width = max(len(row) for row in rows)
        if looks_like_header(rows[0]):
            header, body = rows[0], rows[1:]
        else:
            header, body = [], rows
        labels = [
            (header[column] if column < len(header) and header[column]
             else f"Column {column + 1}")
            for column in range(width)
        ]

        blocks = []
        for row in body:
            pairs = [
                f"{label}: {value}"
                for label, value in zip_longest(labels, row, fillvalue="")
                if value
            ]
            if pairs:
                blocks.append(Block(BlockKind.TABLE, "; ".join(pairs)))

        return ParsedDocument(
            format=self.format,
            parser=self.name,
            blocks=blocks,
            title=_stem(filename),
            metadata={"rows": str(len(body)), "columns": str(width)},
            warnings=_listed(warning),
        )


class JsonParser(DocumentParser):
    format = "json"
    name = "json"

    def __init__(self, settings: IngestionSettings) -> None:
        self._max_lines = settings.max_table_rows

    def parse(self, data: bytes, *, filename: str,
              charset: str | None = None) -> ParsedDocument:
        text, warning = decode_text(data, charset)
        try:
            value = json.loads(text)
        except (json.JSONDecodeError, RecursionError) as exc:
            raise DocumentRejectedError(
                "The file is not valid JSON.", code=ErrorCode.DOCUMENT_CORRUPT
            ) from exc

        blocks: list[Block] = []
        self._lines = 0

        if isinstance(value, list):
            # A list of records: one block per record.
            for item in value:
                lines = self._flatten(item, "")
                if lines:
                    blocks.append(Block(BlockKind.TABLE, "\n".join(lines)))
        elif isinstance(value, dict):
            scalars = [key for key, item in value.items() if _is_scalar(item)]
            if scalars:
                lines = [
                    line for key in scalars
                    for line in self._flatten(value[key], str(key))
                ]
                if lines:
                    blocks.append(Block(BlockKind.TABLE, "\n".join(lines)))
            # A nested top-level key is a section of its own, headed by its name.
            for key, item in value.items():
                if _is_scalar(item):
                    continue
                lines = self._flatten(item, "")
                if lines:
                    blocks.append(Block(BlockKind.HEADING, str(key), level=1))
                    blocks.append(Block(BlockKind.TABLE, "\n".join(lines)))
        elif value is not None:
            blocks.append(Block(BlockKind.PARAGRAPH, _format(value)))

        return ParsedDocument(
            format=self.format,
            parser=self.name,
            blocks=blocks,
            title=_stem(filename),
            warnings=_listed(warning),
        )

    def _flatten(self, value: Any, prefix: str, depth: int = 0) -> list[str]:
        """Dotted paths to scalar values: `address.city: Hyderabad`."""
        if depth > _MAX_JSON_DEPTH:
            return []
        lines: list[str] = []
        if isinstance(value, dict):
            for key, item in value.items():
                path = f"{prefix}.{key}" if prefix else str(key)
                lines.extend(self._flatten(item, path, depth + 1))
        elif isinstance(value, list):
            short = len(value) <= _INLINE_LIST_ITEMS
            if short and all(_is_scalar(item) for item in value):
                rendered = ", ".join(
                    _format(item) for item in value if item not in (None, "")
                )
                if rendered:
                    lines.append(f"{prefix}: {rendered}" if prefix else rendered)
            else:
                for position, item in enumerate(value):
                    lines.extend(
                        self._flatten(item, f"{prefix}[{position}]", depth + 1)
                    )
        elif value not in (None, ""):
            lines.append(f"{prefix}: {_format(value)}" if prefix else _format(value))

        self._lines += len(lines) if depth == 0 else 0
        if self._lines > self._max_lines:
            raise _too_many_rows(self._max_lines)
        return lines


def looks_like_header(row: list[str]) -> bool:
    """A first row of distinct, non-numeric labels is a header.

    Nearly every CSV a school or company exports has one, so the test is
    for the rare file that does not: a first row containing a number or a
    repeated value is data.
    """
    cells = [cell for cell in row if cell]
    return (bool(cells) and len(set(cells)) == len(cells)
            and not any(_NUMBER.fullmatch(cell) for cell in cells))


def _is_scalar(value: Any) -> bool:
    return not isinstance(value, dict | list)


def _format(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def _stem(filename: str) -> str | None:
    stem = PurePosixPath(filename.replace("\\", "/")).stem
    return stem or None


def _listed(warning: str | None) -> list[str]:
    return [warning] if warning else []


def _too_many_rows(limit: int) -> DocumentRejectedError:
    return DocumentRejectedError(
        f"The file has more than {limit:,} records, which is more than a "
        f"knowledge-base document should hold. Split it, or keep only the "
        f"records people will ask about.",
        code=ErrorCode.DOCUMENT_TOO_LARGE,
    )
