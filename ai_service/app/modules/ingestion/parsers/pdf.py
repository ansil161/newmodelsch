"""PDF text extraction, with pages and sections kept.

pypdf: pure Python, no system libraries, no subprocess. It reads the text
layer — which is the text the author typed, in the order the file stores it —
and that is what a knowledge base wants.

Two things are kept that a plain "extract all text" call would lose:

  PAGES. Every block carries its page number, so a citation can say "page 12"
  and mean it. A reader checking the answer opens the PDF at that page; a
  citation without one asks them to search a 200-page manual.

  SECTIONS. When the PDF has an outline (bookmarks), each entry is placed at
  the start of the page it points to, as a heading at its outline depth —
  which is exact. Without an outline, headings are recognised from the text:
  numbered headings ("3.2 Resetting a password"), "Chapter 4 …", and short
  lines in capitals. That is a heuristic and is kept conservative: a
  single-number line like "1. Open Settings" is a numbered step far more
  often than a heading, so it is not treated as one.

Scanned PDFs have no text layer. OCR is deliberately not attempted here — it
is a large dependency with its own accuracy problems — and a scan is rejected
with a message that says what to do, rather than "processed" into an empty
document that silently never answers anything.
"""

from __future__ import annotations

import io
import re
from collections import defaultdict
from typing import Any

from pypdf import PdfReader

from app.core.config import IngestionSettings
from app.core.exceptions import DocumentRejectedError, ErrorCode

from ..cleaning import strip_page_furniture
from ..models import Block, BlockKind, ParsedDocument
from .base import DocumentParser

_DOTTED_HEADING = re.compile(r"^(\d{1,2}(?:\.\d{1,2}){1,3})\.?\s+(\S.{0,90})$")
_NAMED_HEADING = re.compile(
    r"^(?:chapter|section|part|appendix|unit)\s+(?:\d{1,3}|[IVXLC]{1,6}|[A-Z])\b",
    re.IGNORECASE,
)
_MAX_OUTLINE_ENTRIES = 2_000
# Below this many characters across the whole file, there is no text layer.
_MIN_TEXT_CHARACTERS = 20


class PdfParser(DocumentParser):
    format = "pdf"
    name = "pypdf"

    def __init__(self, settings: IngestionSettings) -> None:
        self._max_pages = settings.max_pages

    def parse(self, data: bytes, *, filename: str,
              charset: str | None = None) -> ParsedDocument:
        try:
            reader = PdfReader(io.BytesIO(data), strict=False)
        except Exception as exc:
            raise DocumentRejectedError(
                "The PDF could not be opened. It may be damaged or incomplete.",
                code=ErrorCode.DOCUMENT_CORRUPT,
            ) from exc

        if reader.is_encrypted:
            # Many "protected" PDFs only restrict printing or copying and open
            # with an empty password. Those are readable; the rest are not.
            try:
                unlocked = bool(reader.decrypt(""))
            except Exception:
                unlocked = False
            if not unlocked:
                raise DocumentRejectedError(
                    "This PDF is password-protected. Remove the password and "
                    "upload it again.",
                    code=ErrorCode.DOCUMENT_ENCRYPTED,
                )

        try:
            page_count = len(reader.pages)
        except Exception as exc:
            raise DocumentRejectedError(
                "The PDF's page structure could not be read. It may be damaged.",
                code=ErrorCode.DOCUMENT_CORRUPT,
            ) from exc
        if page_count > self._max_pages:
            raise DocumentRejectedError(
                f"This PDF has {page_count:,} pages; the limit is "
                f"{self._max_pages:,}. Split it into smaller files.",
                code=ErrorCode.DOCUMENT_TOO_LARGE,
            )

        warnings: list[str] = []
        texts: list[str] = []
        unreadable = 0
        for page in reader.pages:
            try:
                texts.append(page.extract_text() or "")
            except Exception:
                unreadable += 1
                texts.append("")
        if unreadable:
            warnings.append(f"{unreadable} page(s) could not be read and were skipped.")

        texts = strip_page_furniture(texts)
        if sum(len(text.strip()) for text in texts) < _MIN_TEXT_CHARACTERS:
            raise DocumentRejectedError(
                "No selectable text was found in this PDF — it is probably a "
                "scan. Run it through OCR (most PDF tools can) and upload the "
                "result.",
                code=ErrorCode.NO_EXTRACTABLE_TEXT,
            )

        blank = sum(1 for text in texts if not text.strip()) - unreadable
        if blank > 0:
            warnings.append(
                f"{blank} page(s) had no selectable text (possibly scanned "
                f"images) and contributed nothing."
            )

        outline = _outline_starts(reader)
        blocks: list[Block] = []
        for index, text in enumerate(texts):
            number = index + 1
            for level, heading in outline.get(index, ()):
                blocks.append(
                    Block(BlockKind.HEADING, heading, page=number, level=level)
                )
            blocks.extend(_page_blocks(text, number, detect_headings=not outline))

        title, author = _metadata(reader)
        return ParsedDocument(
            format=self.format,
            parser=self.name,
            blocks=blocks,
            title=title,
            page_count=page_count,
            metadata={"author": author} if author else {},
            warnings=warnings,
        )


def _page_blocks(text: str, page: int, *, detect_headings: bool) -> list[Block]:
    blocks: list[Block] = []
    paragraph: list[str] = []

    def flush() -> None:
        if paragraph:
            blocks.append(Block(BlockKind.PARAGRAPH, "\n".join(paragraph), page=page))
            paragraph.clear()

    for line in text.split("\n"):
        stripped = line.strip()
        if not stripped:
            flush()
            continue
        level = heading_level(stripped) if detect_headings else 0
        if level:
            flush()
            blocks.append(Block(BlockKind.HEADING, stripped, page=page, level=level))
        else:
            paragraph.append(stripped)
    flush()
    return blocks


def heading_level(line: str) -> int:
    """A heading level for a line that looks like one, else 0."""
    if not 3 <= len(line) <= 100 or line[-1] in ".,;:":
        return 0

    dotted = _DOTTED_HEADING.match(line)
    if dotted and dotted.group(2)[0].isupper():
        return min(3, dotted.group(1).count(".") + 1)

    if _NAMED_HEADING.match(line) and len(line) <= 60:
        return 1

    letters = [character for character in line if character.isalpha()]
    if (len(letters) >= 4 and all(character.isupper() for character in letters)
            and len(line.split()) <= 10 and not line[0].isdigit()):
        return 1
    return 0


def _outline_starts(reader: PdfReader) -> dict[int, list[tuple[int, str]]]:
    """Page index → the outline entries that start on it, with their depth."""
    starts: dict[int, list[tuple[int, str]]] = defaultdict(list)
    seen = 0

    def walk(items: Any, level: int) -> None:
        nonlocal seen
        for item in items:
            if seen >= _MAX_OUTLINE_ENTRIES:
                return
            if isinstance(item, list):
                # pypdf nests an entry's children in a list right after it.
                walk(item, level + 1)
                continue
            title = " ".join(str(getattr(item, "title", "") or "").split())
            if not title:
                continue
            try:
                page = reader.get_destination_page_number(item)
            except Exception:  # noqa: S112 — a dangling entry costs one section name
                continue
            if page is None or page < 0:
                continue
            starts[page].append((min(level, 6), title[:200]))
            seen += 1

    try:
        walk(reader.outline, 1)
    except Exception:
        # A malformed outline costs the section names, not the document.
        return {}
    return dict(starts)


def _metadata(reader: PdfReader) -> tuple[str | None, str | None]:
    try:
        info = reader.metadata
        if not info:
            return None, None
        title = " ".join(str(info.title or "").split()) or None
        author = " ".join(str(info.author or "").split()) or None
    except Exception:
        return None, None
    # Word-processor defaults that are worse than no title at all.
    if title and title.lower() in {"untitled", "microsoft word", "document"}:
        title = None
    return (title[:300] if title else None), (author[:200] if author else None)
