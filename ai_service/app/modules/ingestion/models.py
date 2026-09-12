"""The shapes a document passes through on its way to becoming chunks.

    bytes ──parse──► ParsedDocument (blocks) ──clean──► ParsedDocument
          ──chunk──► list[ChunkDraft] ──► ExtractionResult

Blocks, not a flat string, all the way to the chunker. A heading, a list item
and a table row are different things and the chunker treats them
differently — a heading starts a section, list items stay on their own
lines, a table is split between rows rather than mid-row. Flattening to text
at parse time would throw that away and leave the chunker guessing at it.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum


class BlockKind(StrEnum):
    HEADING = "heading"
    PARAGRAPH = "paragraph"
    LIST_ITEM = "list_item"
    TABLE = "table"
    CODE = "code"


@dataclass(frozen=True)
class Block:
    """One structural unit of a document, in reading order.

    `page` is 1-based, and None for formats that have no pages. `level` is
    meaningful for headings only: 1 is the outermost.
    """

    kind: BlockKind
    text: str
    page: int | None = None
    level: int = 0


@dataclass
class ParsedDocument:
    format: str
    parser: str
    blocks: list[Block]
    title: str | None = None
    page_count: int | None = None
    # Strings only — author, language, source description. Passed through to
    # the caller, which decides what to keep.
    metadata: dict[str, str] = field(default_factory=dict)
    # Things an administrator should know about a document that was still
    # processed: skipped pages, a guessed encoding, an unreadable table.
    warnings: list[str] = field(default_factory=list)

    @property
    def character_count(self) -> int:
        return sum(len(block.text) for block in self.blocks)


@dataclass(frozen=True)
class ChunkDraft:
    """A chunk as ingestion produces it, before anything has an id for it.

    Ids are assigned by the caller, which owns the document record — it is
    the one that knows which version of which document this came from.
    """

    index: int
    content: str
    token_count: int
    content_hash: str
    page: int | None = None
    pages: tuple[int, ...] = ()
    heading: str | None = None
    section: str | None = None


@dataclass
class ExtractionResult:
    format: str
    parser: str
    chunks: list[ChunkDraft]
    title: str | None
    page_count: int | None
    character_count: int
    warnings: list[str]
    metadata: dict[str, str]
    extraction_ms: int = 0
    chunking_ms: int = 0
    fetch_ms: int = 0
    # Set for URL ingestion: where the content actually came from after
    # redirects, and what the server said it was.
    source_url: str | None = None
    content_type: str | None = None

    @property
    def token_count(self) -> int:
        return sum(chunk.token_count for chunk in self.chunks)
