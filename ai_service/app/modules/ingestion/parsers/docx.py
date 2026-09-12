"""Word documents (.docx).

The document body is read in order — paragraphs and tables interleaved as
they appear — through `iter_inner_content()`, not `document.paragraphs`,
which lists every paragraph and silently drops every table.

Headings come from paragraph styles: "Heading 1" … "Heading 6", and "Title".
They are matched by style id as well as display name, because a document
written in a non-English Word names its styles in that language
("Überschrift 1") while the id stays "Heading1".

A DOCX has no pages until something lays it out, so its chunks carry section
headings and no page numbers. An approximate page — "page 12, as Word last
rendered it" — would be a citation that is sometimes wrong, which is worse
than one that says a little less.

A .docx is a zip, and a zip can be a bomb: a few kilobytes that expand to
gigabytes. The archive's declared sizes are checked before python-docx
touches it (zipfile will not decompress a member past its declared size, so
the declaration is binding), and python-docx's XML parser does not resolve
entities, which closes the XML equivalent.
"""

from __future__ import annotations

import io
import zipfile

from docx import Document as open_document
from docx.table import Table
from docx.text.paragraph import Paragraph

from app.core.config import IngestionSettings
from app.core.exceptions import DocumentRejectedError, ErrorCode

from ..models import Block, BlockKind, ParsedDocument
from .base import DocumentParser

# Members smaller than this are not worth a ratio check: tiny XML parts
# compress extremely well and legitimately so.
_RATIO_CHECK_BYTES = 1_000_000


class DocxParser(DocumentParser):
    format = "docx"
    name = "python-docx"

    def __init__(self, settings: IngestionSettings) -> None:
        self._max_uncompressed = settings.max_uncompressed_bytes
        self._max_ratio = settings.max_compression_ratio
        self._max_rows = settings.max_table_rows

    def parse(self, data: bytes, *, filename: str,
              charset: str | None = None) -> ParsedDocument:
        self._check_archive(data)
        try:
            document = open_document(io.BytesIO(data))
        except Exception as exc:
            raise DocumentRejectedError(
                "The file could not be opened as a Word document. It may be damaged.",
                code=ErrorCode.DOCUMENT_CORRUPT,
            ) from exc

        blocks: list[Block] = []
        warnings: list[str] = []
        rows = 0
        skipped_tables = 0

        for item in document.iter_inner_content():
            if isinstance(item, Paragraph):
                block = _paragraph_block(item)
                if block is not None:
                    blocks.append(block)
            elif isinstance(item, Table):
                try:
                    table_rows = _table_rows(item)
                except Exception:
                    # Malformed merged cells. One table, not the document.
                    skipped_tables += 1
                    continue
                rows += len(table_rows)
                if rows > self._max_rows:
                    raise DocumentRejectedError(
                        f"The document's tables hold more than "
                        f"{self._max_rows:,} rows. Split it into smaller documents.",
                        code=ErrorCode.DOCUMENT_TOO_LARGE,
                    )
                if table_rows:
                    blocks.append(Block(BlockKind.TABLE, "\n".join(table_rows)))

        if skipped_tables:
            warnings.append(
                f"{skipped_tables} table(s) could not be read and were skipped."
            )

        properties = document.core_properties
        title = " ".join((properties.title or "").split()) or next(
            (block.text for block in blocks
             if block.kind is BlockKind.HEADING and block.level == 1),
            None,
        )
        author = " ".join((properties.author or "").split())

        return ParsedDocument(
            format=self.format,
            parser=self.name,
            blocks=blocks,
            title=title[:300] if title else None,
            metadata={"author": author[:200]} if author else {},
            warnings=warnings,
        )

    def _check_archive(self, data: bytes) -> None:
        try:
            archive = zipfile.ZipFile(io.BytesIO(data))
        except zipfile.BadZipFile as exc:
            raise DocumentRejectedError(
                "The file could not be opened as a Word document. It may be damaged.",
                code=ErrorCode.DOCUMENT_CORRUPT,
            ) from exc

        with archive:
            names = set(archive.namelist())
            if "word/document.xml" not in names:
                if "xl/workbook.xml" in names:
                    kind = "an Excel workbook"
                elif "ppt/presentation.xml" in names:
                    kind = "a PowerPoint presentation"
                else:
                    kind = "a ZIP archive"
                raise DocumentRejectedError(
                    f"This file is {kind}, not a Word document. Only .docx "
                    f"Word files are supported here.",
                    code=ErrorCode.FILE_TYPE_MISMATCH,
                )

            total = 0
            for info in archive.infolist():
                total += info.file_size
                if total > self._max_uncompressed:
                    raise DocumentRejectedError(
                        "The document expands to more than "
                        f"{self._max_uncompressed // (1024 * 1024)} MB when "
                        "decompressed and was refused.",
                        code=ErrorCode.DOCUMENT_TOO_LARGE,
                    )
                if (info.file_size > _RATIO_CHECK_BYTES and info.compress_size > 0
                        and info.file_size / info.compress_size > self._max_ratio):
                    raise DocumentRejectedError(
                        "The document is compressed far more heavily than a "
                        "real Word file and was refused.",
                        code=ErrorCode.DOCUMENT_REJECTED,
                    )


def _paragraph_block(paragraph: Paragraph) -> Block | None:
    text = paragraph.text.strip()
    if not text:
        return None

    style = paragraph.style
    name = style.name if style is not None else None
    style_id = style.style_id if style is not None else None

    level = heading_level(name, style_id)
    if level:
        return Block(BlockKind.HEADING, text, level=level)
    if _is_list_item(paragraph, name):
        return Block(BlockKind.LIST_ITEM, text)
    return Block(BlockKind.PARAGRAPH, text)


def heading_level(name: str | None, style_id: str | None) -> int:
    for candidate in (style_id, name):
        if not candidate:
            continue
        compact = candidate.replace(" ", "").lower()
        if compact == "title":
            return 1
        if compact.startswith("heading") and compact[7:].isdigit():
            return max(1, min(6, int(compact[7:])))
    return 0


def _is_list_item(paragraph: Paragraph, style_name: str | None) -> bool:
    # Numbering lives on the paragraph's properties, which python-docx does
    # not expose publicly; the underlying element is stable across versions.
    properties = paragraph._p.pPr
    if properties is not None and properties.numPr is not None:
        return True
    return style_name is not None and style_name.lower().startswith("list")


def _table_rows(table: Table) -> list[str]:
    rows: list[str] = []
    for row in table.rows:
        cells: list[str] = []
        for cell in row.cells:
            text = " ".join(cell.text.split())
            # A merged cell is returned once per grid column it spans.
            if text and (not cells or cells[-1] != text):
                cells.append(text)
        if cells:
            rows.append(" | ".join(cells))
    return rows
