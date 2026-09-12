"""Markdown.

The format that states its own structure, so this parser's job is mostly to
read it faithfully: ATX and setext headings become heading blocks with their
level, fenced code stays verbatim, list items and table rows stay separate,
and YAML front matter is removed (its `title:` kept).

Inline syntax is reduced to the text a reader sees — `[text](url)` becomes
"text", `**bold**` becomes "bold". The URL of a link is not content; indexed,
it is a long string of tokens that matches nothing anyone asks.

Line-based rather than a CommonMark implementation. CommonMark's edge cases
(lazy continuation, nested block quotes inside list items) matter to a
renderer and not to text extraction; a dependency for them would not change
a single chunk of a real knowledge-base document.
"""

from __future__ import annotations

import re

from app.core.config import IngestionSettings

from ..detection import decode_text
from ..models import Block, BlockKind, ParsedDocument
from .base import DocumentParser

_ATX = re.compile(r"^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$")
_FENCE = re.compile(r"^(`{3,}|~{3,})")
_LIST_ITEM = re.compile(r"^\s*(?:[-*+]|\d{1,9}[.)])\s+(.*)$")
_TABLE_ROW = re.compile(r"^\s*\|.*\|\s*$")
_TABLE_RULE = re.compile(r"^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)*\|?\s*$")
_SETEXT_1 = re.compile(r"^=+\s*$")
_SETEXT_2 = re.compile(r"^-+\s*$")
_THEMATIC_BREAK = re.compile(r"^\s*([-*_])(?:\s*\1){2,}\s*$")

_IMAGE = re.compile(r"!\[([^\]]*)\]\([^)]*\)")
_LINK = re.compile(r"\[([^\]]+)\]\([^)]*\)")
_REFERENCE_LINK = re.compile(r"\[([^\]]+)\]\[[^\]]*\]")
_AUTOLINK = re.compile(r"<((?:https?|mailto):[^>\s]+)>")
_CODE_SPAN = re.compile(r"`([^`]+)`")
_STRONG = re.compile(r"(\*\*|__)(.+?)\1")
_EMPHASIS = re.compile(r"(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])")
_HTML_TAG = re.compile(r"</?[A-Za-z][^>]*>")
_ESCAPE = re.compile(r"\\([\\`*_{}\[\]()#+\-.!|>])")
_FRONT_MATTER_TITLE = re.compile(r"^title\s*:\s*[\"']?(.+?)[\"']?\s*$", re.IGNORECASE)


class MarkdownParser(DocumentParser):
    format = "md"
    name = "markdown"

    def __init__(self, settings: IngestionSettings | None = None) -> None:
        del settings

    def parse(self, data: bytes, *, filename: str,
              charset: str | None = None) -> ParsedDocument:
        text, warning = decode_text(data, charset)
        lines = text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
        lines, front_title = _strip_front_matter(lines)

        blocks: list[Block] = []
        paragraph: list[str] = []

        def flush() -> None:
            if paragraph:
                blocks.append(Block(BlockKind.PARAGRAPH, inline(" ".join(paragraph))))
                paragraph.clear()

        index = 0
        total = len(lines)
        while index < total:
            line = lines[index]
            stripped = line.strip()

            fence = _FENCE.match(stripped)
            if fence:
                flush()
                marker = fence.group(1)
                code: list[str] = []
                index += 1
                while index < total and not lines[index].strip().startswith(marker):
                    code.append(lines[index].rstrip())
                    index += 1
                index += 1  # the closing fence
                if any(code_line.strip() for code_line in code):
                    blocks.append(Block(BlockKind.CODE, "\n".join(code)))
                continue

            if not stripped:
                flush()
                index += 1
                continue

            heading = _ATX.match(stripped)
            if heading:
                flush()
                blocks.append(Block(BlockKind.HEADING, inline(heading.group(2)),
                                    level=len(heading.group(1))))
                index += 1
                continue

            # A setext underline turns the paragraph above it into a heading.
            # Checked before the thematic break: "---" under text is a
            # heading, "---" on its own is a rule.
            if paragraph and (_SETEXT_1.match(stripped) or _SETEXT_2.match(stripped)):
                level = 1 if stripped.startswith("=") else 2
                blocks.append(Block(BlockKind.HEADING, inline(" ".join(paragraph)),
                                    level=level))
                paragraph.clear()
                index += 1
                continue

            if _THEMATIC_BREAK.match(stripped):
                flush()
                index += 1
                continue

            if _TABLE_ROW.match(stripped):
                flush()
                rows: list[str] = []
                while index < total and _TABLE_ROW.match(lines[index].strip()):
                    row = lines[index].strip()
                    if not _TABLE_RULE.match(row):
                        cells = [inline(cell.strip())
                                 for cell in row.strip("|").split("|")]
                        cells = [cell for cell in cells if cell]
                        if cells:
                            rows.append(" | ".join(cells))
                    index += 1
                if rows:
                    blocks.append(Block(BlockKind.TABLE, "\n".join(rows)))
                continue

            item = _LIST_ITEM.match(line)
            if item:
                flush()
                parts = [item.group(1).strip()]
                index += 1
                # Indented continuation lines belong to the item.
                while index < total:
                    following = lines[index]
                    if (not following.strip() or _LIST_ITEM.match(following)
                            or not following.startswith((" ", "\t"))):
                        break
                    parts.append(following.strip())
                    index += 1
                blocks.append(Block(BlockKind.LIST_ITEM, inline(" ".join(parts))))
                continue

            paragraph.append(stripped.lstrip(">").strip() if stripped.startswith(">")
                             else stripped)
            index += 1

        flush()

        title = front_title or next(
            (block.text for block in blocks
             if block.kind is BlockKind.HEADING and block.level == 1),
            None,
        )
        return ParsedDocument(
            format=self.format,
            parser=self.name,
            blocks=[block for block in blocks if block.text],
            title=title,
            warnings=[warning] if warning else [],
        )


def inline(text: str) -> str:
    """Markdown inline syntax reduced to the text a reader sees."""
    text = _IMAGE.sub(r"\1", text)
    text = _LINK.sub(r"\1", text)
    text = _REFERENCE_LINK.sub(r"\1", text)
    text = _AUTOLINK.sub(r"\1", text)
    text = _CODE_SPAN.sub(r"\1", text)
    text = _STRONG.sub(r"\2", text)
    text = _EMPHASIS.sub(r"\1", text)
    text = _HTML_TAG.sub("", text)
    text = _ESCAPE.sub(r"\1", text)
    return " ".join(text.split())


def _strip_front_matter(lines: list[str]) -> tuple[list[str], str | None]:
    if not lines or lines[0].strip() != "---":
        return lines, None
    for end in range(1, min(len(lines), 200)):
        if lines[end].strip() in ("---", "..."):
            title = None
            for line in lines[1:end]:
                match = _FRONT_MATTER_TITLE.match(line.strip())
                if match:
                    title = match.group(1).strip() or None
                    break
            return lines[end + 1:], title
    return lines, None
