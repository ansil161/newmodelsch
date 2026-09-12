"""Cleaning extracted text before it is chunked.

Extraction produces text that is correct but dirty, and the dirt is not
harmless. Every one of these costs retrieval quality somewhere:

  * ligatures and zero-width characters   "ﬁle" and "file" are different
                                          tokens to the sparse retriever, so
                                          an exact-term search misses
  * running headers, footers, page numbers "ACME Handbook — Confidential"
                                          on every page becomes the most
                                          common phrase in the document and
                                          matches every query that shares a
                                          word with it
  * lines broken for layout               a PDF breaks every line; left alone
                                          each sentence arrives in pieces and
                                          the chunker's sentence boundaries
                                          are wrong
  * words hyphenated across a line break  "authen-\\ntication" is not a word

Deliberately NOT done: NFKC normalisation. It would fix ligatures too, but it
also folds superscripts and fractions into plain digits — "10⁶" becomes
"106" — which silently changes a number in a knowledge base whose whole job
is to state numbers correctly. Ligatures are replaced explicitly instead.
"""

from __future__ import annotations

import re
import unicodedata
from collections import Counter
from dataclasses import replace

from .models import Block, BlockKind, ParsedDocument

_LIGATURES = str.maketrans({
    "ﬀ": "ff", "ﬁ": "fi", "ﬂ": "fl", "ﬃ": "ffi",
    "ﬄ": "ffl", "ﬅ": "st", "ﬆ": "st",
})
# Zero-width space/joiners, word joiner, BOM, and the soft hyphen — which
# PDFs emit at every hyphenation point whether or not the word was broken.
_INVISIBLE = re.compile("[​‌‍⁠﻿­]")
_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]")
_HORIZONTAL_SPACE = re.compile(r"[^\S\n]+")
_BLANK_RUNS = re.compile(r"\n{3,}")
# "authen-\ntication" → "authentication". Only when a lower-case letter
# continues the word: "Hyderabad-\nBased" and "2025-\n26" are real hyphens.
_HYPHENATED_BREAK = re.compile(r"(?<=[A-Za-z])-\n(?=[a-z])")
_BULLET = re.compile(
    r"^(?:[•‣⁃∙▪●◦·►✓*\-–—]"
    r"|\(?\d{1,3}[.)]|\(?[a-zA-Z][.)])\s+"
)
_PAGE_NUMBER = re.compile(
    r"^(?:page\s+)?\d{1,4}(?:\s*(?:of|/)\s*\d{1,4})?$", re.IGNORECASE
)
_DIGITS = re.compile(r"\d+")


def normalize(text: str) -> str:
    """Encoding-level cleanup that is safe for every format."""
    text = unicodedata.normalize("NFC", text).translate(_LIGATURES)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = _INVISIBLE.sub("", text)
    text = _CONTROL.sub(" ", text)
    text = _HORIZONTAL_SPACE.sub(" ", text)
    text = "\n".join(line.strip() for line in text.split("\n"))
    return _BLANK_RUNS.sub("\n\n", text).strip()


def reflow(text: str, *, dehyphenate: bool = False) -> list[tuple[BlockKind, str]]:
    """Rejoin lines broken for layout, keeping the breaks that mean something.

    A blank line ends a paragraph. A line that starts with a bullet or a
    list number starts a list item. Every other line break is layout, and
    the line is joined to the one before it.
    """
    if dehyphenate:
        text = _HYPHENATED_BREAK.sub("", text)

    segments: list[tuple[BlockKind, str]] = []
    for paragraph in re.split(r"\n\s*\n", text):
        kind: BlockKind | None = None
        lines: list[str] = []
        for raw_line in paragraph.split("\n"):
            line = raw_line.strip()
            if not line:
                continue
            if _BULLET.match(line):
                if lines and kind is not None:
                    segments.append((kind, " ".join(lines)))
                kind, lines = BlockKind.LIST_ITEM, [line]
            else:
                if kind is None:
                    kind = BlockKind.PARAGRAPH
                lines.append(line)
        if lines and kind is not None:
            segments.append((kind, " ".join(lines)))
    return segments


def strip_page_furniture(pages: list[str]) -> list[str]:
    """Remove running headers, running footers and page numbers.

    A line is furniture when it sits at a page's edge — the first or last two
    lines, or one on a page too short to have a separate header — and, digits
    aside, so "Page 3" and "Page 4" count as one line, the same line sits
    there on at least half the pages, and at least three. Bare page numbers
    at a page's edge go regardless.

    Applied to page text before blocks are formed, because only there is it
    still known which lines were at the top and bottom of a page.
    """
    split_pages = [[line.strip() for line in page.split("\n")] for page in pages]

    furniture: set[str] = set()
    if len(pages) >= 3:
        edge_lines: Counter[str] = Counter()
        for lines in split_pages:
            edges = _edge_indexes(lines)
            edge_lines.update({_signature(lines[index]) for index in edges})
        threshold = max(3, len(pages) // 2)
        furniture = {
            signature for signature, count in edge_lines.items()
            if signature and count >= threshold
        }

    cleaned: list[str] = []
    for lines in split_pages:
        edges = _edge_indexes(lines)
        kept = [
            line for index, line in enumerate(lines)
            if not (
                index in edges
                and (_signature(line) in furniture or _PAGE_NUMBER.match(line))
            )
        ]
        cleaned.append("\n".join(kept))
    return cleaned


def clean_document(document: ParsedDocument) -> ParsedDocument:
    """Normalise every block, reflow prose, and drop what is left empty."""
    dehyphenate = document.format == "pdf"
    blocks: list[Block] = []

    for block in document.blocks:
        text = normalize(block.text)
        if not text:
            continue
        if block.kind is BlockKind.PARAGRAPH:
            blocks.extend(
                Block(kind, segment, block.page)
                for kind, segment in reflow(text, dehyphenate=dehyphenate)
            )
        elif block.kind in (BlockKind.TABLE, BlockKind.CODE):
            # Line structure is the content: rows, or code.
            blocks.append(replace(block, text=text))
        else:
            # Headings and list items are one line each.
            blocks.append(replace(block, text=" ".join(text.split())))

    # Consecutive identical blocks: a heading repeated by an outline and by
    # the page text, a paragraph a converter emitted twice.
    deduplicated: list[Block] = []
    for block in blocks:
        if (deduplicated and deduplicated[-1].kind == block.kind
                and deduplicated[-1].text == block.text):
            continue
        deduplicated.append(block)

    title = normalize(document.title) if document.title else None
    return replace(document, blocks=deduplicated, title=title or None)


def _edge_indexes(lines: list[str]) -> set[int]:
    non_empty = [index for index, line in enumerate(lines) if line]
    # Two lines at each edge of a full page — a running header can be a title
    # and a date. One on a short page, where the second line in is already
    # body text, and body text that follows a pattern ("Step 3 of 5") would
    # otherwise be mistaken for furniture.
    window = 2 if len(non_empty) >= 6 else 1
    return set(non_empty[:window] + non_empty[-window:])


def _signature(line: str) -> str:
    return _DIGITS.sub("#", line.lower()).strip()
