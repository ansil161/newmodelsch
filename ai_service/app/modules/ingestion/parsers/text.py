"""Plain text.

The format with the least structure, so the parser looks for the two kinds of
heading plain text actually uses — a line underlined with === or ---, and a
short line in capitals — and otherwise splits on blank lines. Line wrapping
inside a paragraph is undone by the cleaner.
"""

from __future__ import annotations

import re

from app.core.config import IngestionSettings

from ..detection import decode_text
from ..models import Block, BlockKind, ParsedDocument
from .base import DocumentParser

_UNDERLINE = re.compile(r"^(=+|-+)$")
_PARAGRAPH_BREAK = re.compile(r"\n\s*\n")


class PlainTextParser(DocumentParser):
    format = "txt"
    name = "plain-text"

    def __init__(self, settings: IngestionSettings | None = None) -> None:
        del settings

    def parse(self, data: bytes, *, filename: str,
              charset: str | None = None) -> ParsedDocument:
        text, warning = decode_text(data, charset)
        text = text.replace("\r\n", "\n").replace("\r", "\n")

        blocks: list[Block] = []
        for paragraph in _PARAGRAPH_BREAK.split(text):
            lines = [line.rstrip() for line in paragraph.split("\n") if line.strip()]
            if not lines:
                continue

            if len(lines) >= 2 and _UNDERLINE.match(lines[1].strip()) \
                    and len(lines[0]) <= 120:
                level = 1 if lines[1].strip().startswith("=") else 2
                blocks.append(Block(BlockKind.HEADING, lines[0].strip(), level=level))
                lines = lines[2:]
                if not lines:
                    continue

            if len(lines) == 1 and looks_like_heading(lines[0]):
                blocks.append(Block(BlockKind.HEADING, lines[0].strip(), level=1))
                continue

            blocks.append(Block(BlockKind.PARAGRAPH, "\n".join(lines)))

        return ParsedDocument(
            format=self.format,
            parser=self.name,
            blocks=blocks,
            warnings=[warning] if warning else [],
        )


def looks_like_heading(line: str) -> bool:
    """A short line in capitals with no sentence punctuation at the end."""
    stripped = line.strip()
    if not 3 <= len(stripped) <= 80 or stripped[-1] in ".,;:!?":
        return False
    letters = [character for character in stripped if character.isalpha()]
    return len(letters) >= 3 and all(character.isupper() for character in letters)
