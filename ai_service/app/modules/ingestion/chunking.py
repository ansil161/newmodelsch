"""Structure-aware chunking.

Splitting every N characters is the default in most RAG tutorials, and it is
the single most common reason a RAG system answers badly with good retrieval
numbers. A fixed window cuts a sentence in half, glues the end of one section
to the start of an unrelated one, and produces chunks an embedding model
cannot place because they are about two things at once.

So chunks follow the document:

    document
      └─ sections        a heading and everything under it, up to the next
           │             heading of the same or a higher level
           └─ pieces     paragraphs, list items and table rows — never split
                │        unless one alone is too big, and then at sentence
                │        boundaries, and only then at words
                └─ chunks  pieces packed up to a target size, never across a
                           section boundary, with a sentence or two of
                           overlap so a fact on a boundary is retrievable
                           from either side

Every chunk carries the page(s) it came from and its heading path, and — when
`include_section_path` is on — starts with that path as a line of text. That
last part matters more than it looks: "The deadline is 31 March" embeds as a
sentence about some deadline; "Admissions › Fees\\n\\nThe deadline is 31 March"
embeds as the fee deadline, which is the question someone will actually ask.
"""

from __future__ import annotations

import hashlib
import math
import re
from collections.abc import Sequence
from dataclasses import dataclass, field

from app.core.config import IngestionSettings
from app.core.exceptions import DocumentRejectedError, ErrorCode

from .models import Block, BlockKind, ChunkDraft, ParsedDocument
from .tokens import estimate_tokens

SECTION_SEPARATOR = " › "

# A heading longer than this is almost certainly a misdetected paragraph; kept
# in the path it would eat the chunk's budget on every chunk of its section.
_MAX_HEADING_CHARACTERS = 120

# A sentence ends at . ! ? or … optionally followed by a closing quote or
# bracket, then whitespace, then something that can start a sentence. Two
# fixed-width lookbehinds because `re` does not allow a variable-width one.
_SENTENCE_BOUNDARY = re.compile(
    r"(?:(?<=[.!?…])|(?<=[.!?…][\"'”’)\]]))\s+(?=[\"'“‘(\[]?[A-Z0-9])"
)


@dataclass
class _Piece:
    text: str
    tokens: int
    page: int | None
    kind: BlockKind
    # Carried over from the previous chunk. Excluded when a small tail is
    # folded back into the chunk it would have overlapped, or it would appear
    # twice.
    overlap: bool = False


@dataclass
class _Section:
    path: tuple[str, ...]
    pieces: list[_Piece] = field(default_factory=list)


class Chunker:
    def __init__(
        self,
        *,
        target_tokens: int,
        max_tokens: int,
        overlap_tokens: int,
        min_tokens: int,
        max_chunks: int,
        include_section_path: bool = True,
    ) -> None:
        self._target = target_tokens
        self._max = max_tokens
        self._overlap_tokens = overlap_tokens
        self._min = min_tokens
        self._max_chunks = max_chunks
        self._include_path = include_section_path

    @classmethod
    def from_settings(cls, settings: IngestionSettings) -> Chunker:
        return cls(
            target_tokens=settings.chunk_target_tokens,
            max_tokens=settings.chunk_max_tokens,
            overlap_tokens=settings.chunk_overlap_tokens,
            min_tokens=settings.chunk_min_tokens,
            max_chunks=settings.max_chunks,
            include_section_path=settings.include_section_path,
        )

    def chunk(self, document: ParsedDocument) -> list[ChunkDraft]:
        drafts: list[ChunkDraft] = []
        for section in self._sections(document.blocks):
            for group in self._pack(section):
                if len(drafts) >= self._max_chunks:
                    raise DocumentRejectedError(
                        f"The document is too large: it would produce more "
                        f"than {self._max_chunks} chunks. Split it into smaller "
                        f"documents and upload them separately.",
                        code=ErrorCode.DOCUMENT_TOO_LARGE,
                    )
                drafts.append(self._draft(len(drafts), section.path, group))
        return drafts

    # -- sections --------------------------------------------------------

    def _sections(self, blocks: Sequence[Block]) -> list[_Section]:
        sections = [_Section(path=())]
        # (level, title) for every heading still open above the current one.
        stack: list[tuple[int, str]] = []

        for block in blocks:
            if block.kind is BlockKind.HEADING:
                level = block.level if block.level > 0 else 1
                title = _shorten(block.text, _MAX_HEADING_CHARACTERS)
                stack = [entry for entry in stack if entry[0] < level]
                stack.append((level, title))
                sections.append(_Section(path=tuple(text for _, text in stack)))
                continue

            section = sections[-1]
            header_tokens = self._header_tokens(section.path)
            # Kept whole up to the ceiling. Split, when it must be, to the
            # target — which leaves room for the overlap the next chunk opens
            # with; pieces cut to the ceiling would never have any.
            section.pieces.extend(self._pieces(
                block,
                keep_whole=max(self._max - header_tokens, self._min),
                split_to=max(self._target - header_tokens, self._min),
            ))

        # A heading with nothing under it before the next heading contributes
        # its title to the path of what follows and is not a chunk itself.
        return [section for section in sections if section.pieces]

    def _pieces(self, block: Block, *, keep_whole: int, split_to: int) -> list[_Piece]:
        tokens = estimate_tokens(block.text)
        if tokens <= keep_whole:
            return [_Piece(block.text, tokens, block.page, block.kind)]

        # Too big to be one piece. Tables and code split between lines;
        # prose between sentences.
        if block.kind in (BlockKind.TABLE, BlockKind.CODE):
            units, joiner = block.text.split("\n"), "\n"
        else:
            units, joiner = split_sentences(block.text), " "

        return [
            _Piece(text, estimate_tokens(text), block.page, block.kind)
            for text in _group(units, split_to, joiner)
        ]

    # -- packing ---------------------------------------------------------

    def _pack(self, section: _Section) -> list[list[_Piece]]:
        header_tokens = self._header_tokens(section.path)
        target = max(self._min, self._target - header_tokens)
        ceiling = max(self._min, self._max - header_tokens)

        groups: list[list[_Piece]] = []
        current: list[_Piece] = []
        size = 0

        for piece in section.pieces:
            has_body = any(not existing.overlap for existing in current)
            if has_body and size + _cost(piece) > target:
                groups.append(current)
                carried = self._overlap(current)
                fits = carried is not None and _cost(carried) + _cost(piece) <= ceiling
                current = [carried] if carried is not None and fits else []
                size = sum(_cost(existing) for existing in current)
            current.append(piece)
            size += _cost(piece)

        if current:
            body = [piece for piece in current if not piece.overlap]
            body_size = sum(_cost(piece) for piece in body)
            previous_size = sum(_cost(piece) for piece in groups[-1]) if groups else 0
            fits = previous_size + body_size <= ceiling
            # A small tail reads better as the end of the chunk before it
            # than as a chunk of its own — provided it fits.
            if groups and body_size < self._min and fits:
                groups[-1].extend(body)
            else:
                groups.append(current)
        return groups

    def _overlap(self, group: list[_Piece]) -> _Piece | None:
        """The last sentence or two of a chunk, to open the next one."""
        if self._overlap_tokens <= 0:
            return None
        body = [piece for piece in group if not piece.overlap]
        if not body:
            return None

        sentences = split_sentences(body[-1].text)
        taken: list[str] = []
        size = 0
        for sentence in reversed(sentences):
            tokens = estimate_tokens(sentence)
            if size + tokens > self._overlap_tokens:
                break
            taken.insert(0, sentence)
            size += tokens

        # Nothing small enough, or the "overlap" would be the entire previous
        # chunk repeated.
        if not taken or (len(body) == 1 and len(taken) == len(sentences)):
            return None
        # Same kind as what it repeats, so repeated table rows stay rows.
        kind = body[-1].kind
        joiner = "\n" if kind in (BlockKind.TABLE, BlockKind.CODE) else " "
        return _Piece(joiner.join(taken), size, body[-1].page, kind, overlap=True)

    # -- output ----------------------------------------------------------

    def _draft(self, index: int, path: tuple[str, ...],
               group: list[_Piece]) -> ChunkDraft:
        body = _join(group)
        header = self._header(path)
        content = f"{header}\n\n{body}" if header else body
        pages = tuple(sorted({piece.page for piece in group if piece.page is not None}))
        return ChunkDraft(
            index=index,
            content=content,
            token_count=estimate_tokens(content),
            content_hash=hashlib.sha256(content.encode("utf-8")).hexdigest(),
            page=pages[0] if pages else None,
            pages=pages,
            heading=path[-1] if path else None,
            section=SECTION_SEPARATOR.join(path) if path else None,
        )

    def _header(self, path: tuple[str, ...]) -> str:
        if not (self._include_path and path):
            return ""
        full = SECTION_SEPARATOR.join(path)
        # A deep path would take a real share of every chunk's budget. Past
        # a quarter of it, the nearest heading alone carries most of the
        # meaning anyway.
        if estimate_tokens(full) > self._max // 4:
            return path[-1]
        return full

    def _header_tokens(self, path: tuple[str, ...]) -> int:
        header = self._header(path)
        # +2 for the blank line between the header and the body.
        return estimate_tokens(header) + 2 if header else 0


def split_sentences(text: str) -> list[str]:
    """Sentences, with line breaks treated as boundaries too."""
    sentences: list[str] = []
    for line in text.split("\n"):
        stripped = line.strip()
        if stripped:
            sentences.extend(
                part.strip() for part in _SENTENCE_BOUNDARY.split(stripped)
                if part.strip()
            )
    return sentences


def _group(units: list[str], limit: int, joiner: str) -> list[str]:
    """Pack units into groups under `limit` tokens, splitting any unit over it."""
    groups: list[str] = []
    current: list[str] = []
    size = 0
    for unit in units:
        tokens = estimate_tokens(unit)
        if tokens > limit:
            if current:
                groups.append(joiner.join(current))
                current, size = [], 0
            groups.extend(_split_words(unit, limit))
            continue
        if current and size + tokens > limit:
            groups.append(joiner.join(current))
            current, size = [], 0
        current.append(unit)
        size += tokens
    if current:
        groups.append(joiner.join(current))
    return groups


def _split_words(text: str, limit: int) -> list[str]:
    """The last resort: a single sentence longer than a whole chunk."""
    parts: list[str] = []
    words: list[str] = []
    characters = 0
    for word in text.split():
        if estimate_tokens(word) > limit:
            # Not a word: a URL, a hash, an unbroken run of data.
            if words:
                parts.append(" ".join(words))
                words, characters = [], 0
            step = limit * 4
            parts.extend(
                word[start:start + step] for start in range(0, len(word), step)
            )
            continue
        projected = max(
            math.ceil((characters + len(word) + 1) / 4),
            math.ceil((len(words) + 1) * 1.33),
        )
        if words and projected > limit:
            parts.append(" ".join(words))
            words, characters = [], 0
        words.append(word)
        characters += len(word) + 1
    if words:
        parts.append(" ".join(words))
    return parts


def _cost(piece: _Piece) -> int:
    """A piece's tokens plus one for the separator joining it to the next.

    Counting the separator is what makes the size limits real: the estimate
    of a joined chunk can exceed the sum of its pieces' estimates by about
    that much per join, and a limit that is only approximately enforced is a
    chunk that is sometimes truncated by the embedding model.
    """
    return piece.tokens + 1


def _join(pieces: Sequence[_Piece]) -> str:
    """List items, table rows and code lines stay tight; paragraphs get a blank line."""
    parts: list[str] = []
    previous: _Piece | None = None
    tight = (BlockKind.LIST_ITEM, BlockKind.TABLE, BlockKind.CODE)
    for piece in pieces:
        if parts:
            same_kind = previous is not None and previous.kind == piece.kind
            parts.append("\n" if same_kind and piece.kind in tight else "\n\n")
        parts.append(piece.text)
        previous = piece
    return "".join(parts)


def _shorten(text: str, limit: int) -> str:
    text = " ".join(text.split())
    if len(text) <= limit:
        return text
    cut = text[:limit].rsplit(" ", 1)[0]
    return f"{cut}…"
