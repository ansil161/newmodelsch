"""HTML to blocks, with the page's furniture left behind.

A web page is mostly not its content. Navigation, cookie banners, footers,
share buttons, "related articles": on a typical documentation page they are
more text than the article, and indexed as knowledge they surface as
citations for every question that happens to share a word with a menu item.

So extraction runs in two passes over a small tree built with the standard
library's HTMLParser:

  1. Choose the content root: the page's <main> if it has one, else its
     largest <article> when that holds a real share of the text, else <body>.
  2. Walk it, dropping furniture — navigation landmarks, forms, scripts,
     anything hidden, and containers whose class or id says they are a menu,
     a footer or a banner — and emitting headings, paragraphs, list items,
     tables and code as blocks.

A short list item or paragraph that is mostly link text is dropped too: that
is what a menu looks like once its markup has been taken away.

Pages that build their content in the browser with JavaScript arrive here as
an empty shell. That is reported as "no readable text", not worked around —
running a headless browser against an arbitrary URL is a much larger attack
surface than this service should carry.
"""

from __future__ import annotations

import re
from html.parser import HTMLParser

from app.core.config import IngestionSettings
from app.core.exceptions import DocumentRejectedError, ErrorCode

from ..detection import decode_text
from ..models import Block, BlockKind, ParsedDocument
from .base import DocumentParser

_VOID = frozenset({
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta",
    "param", "source", "track", "wbr",
})
# Never content, wherever they appear.
_DROP = frozenset({
    "head", "script", "style", "noscript", "template", "svg", "math", "canvas",
    "iframe", "object", "embed", "video", "audio", "picture", "form", "button",
    "select", "option", "input", "textarea", "label", "nav", "aside", "dialog",
    "menu",
})
_HEADINGS = {"h1": 1, "h2": 2, "h3": 3, "h4": 4, "h5": 5, "h6": 6}
_PARAGRAPHS = frozenset({
    "p", "blockquote", "dd", "dt", "figcaption", "address", "caption", "summary",
})
_LISTS = frozenset({"ul", "ol", "dl"})
# Wrappers: their loose text becomes a paragraph, their block children are
# walked in turn.
_WRAPPERS = frozenset({
    "div", "section", "article", "main", "body", "html", "details", "center",
    "header", "footer", "figure", "fieldset", "hgroup", "ul", "ol", "dl",
    "table", "thead", "tbody", "tfoot", "tr", "td", "th", "#root",
})
# Start tags that implicitly close an open <p>.
_CLOSES_P = frozenset({
    "p", "div", "section", "article", "ul", "ol", "dl", "table", "pre",
    "blockquote", "header", "footer", "main", "nav", "aside", "form", "hr",
    "figure", "h1", "h2", "h3", "h4", "h5", "h6",
})
_FURNITURE_ROLES = frozenset({
    "navigation", "banner", "contentinfo", "complementary", "search", "menu",
    "menubar", "dialog", "alertdialog", "toolbar",
})
_FURNITURE_HINT = re.compile(
    r"(?:^|[\s_-])(?:nav|navbar|navigation|menu|breadcrumbs?|footer|site-header|"
    r"sidebar|cookies?|consent|banner|share|sharing|social|advert|ads|promo|"
    r"newsletter|subscribe|related|comments?|popup|modal|skip-link)(?:$|[\s_-])",
    re.IGNORECASE,
)
_META_KEYS = frozenset({"og:title", "twitter:title", "description", "og:description",
                        "og:site_name", "author"})
_META_CHARSET = re.compile(
    rb"""<meta[^>]+charset\s*=\s*["']?\s*([A-Za-z0-9_.:-]+)""", re.IGNORECASE
)
# Deep enough for any real page; shallow enough that the recursive walk below
# cannot be driven into Python's recursion limit by a hostile one.
_MAX_DEPTH = 200
_LINK_DENSITY = 0.7
_SHORT_TEXT = 200


class _Node:
    __slots__ = ("attrs", "children", "depth", "parent", "tag")

    def __init__(self, tag: str, attrs: dict[str, str], parent: _Node | None) -> None:
        self.tag = tag
        self.attrs = attrs
        self.parent = parent
        self.children: list[_Node | str] = []
        self.depth: int = parent.depth + 1 if parent is not None else 0


class _TreeBuilder(HTMLParser):
    """A forgiving tree: unclosed tags close when an ancestor does."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.root = _Node("#root", {}, None)
        self._open = self.root
        self._in_title = False
        self.title = ""
        self.meta: dict[str, str] = {}
        self.language: str | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        attributes = {name.lower(): (value or "") for name, value in attrs}

        if tag == "html" and attributes.get("lang"):
            self.language = attributes["lang"]
        elif tag == "meta":
            key = (attributes.get("property") or attributes.get("name") or "").lower()
            if key in _META_KEYS and attributes.get("content"):
                self.meta.setdefault(key, attributes["content"].strip())
        elif tag == "title":
            self._in_title = True

        if tag in _CLOSES_P and self._open.tag == "p":
            self._open = self._open.parent or self.root
        if tag == "li":
            self._implicitly_close("li", frozenset({"ul", "ol", "menu"}))
        elif tag in ("td", "th"):
            self._implicitly_close_any({"td", "th"}, frozenset({"tr", "table"}))
        elif tag == "tr":
            self._implicitly_close(
                "tr", frozenset({"table", "thead", "tbody", "tfoot"})
            )

        node = _Node(tag, attributes, self._open)
        self._open.children.append(node)
        if tag not in _VOID and node.depth < _MAX_DEPTH:
            self._open = node

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag == "title":
            self._in_title = False
        node: _Node | None = self._open
        while node is not None and node is not self.root and node.tag != tag:
            node = node.parent
        if node is not None and node is not self.root:
            self._open = node.parent or self.root

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title += data
        elif data:
            self._open.children.append(data)

    def _implicitly_close(self, tag: str, boundaries: frozenset[str]) -> None:
        self._implicitly_close_any({tag}, boundaries)

    def _implicitly_close_any(self, tags: set[str], boundaries: frozenset[str]) -> None:
        node: _Node | None = self._open
        while node is not None and node is not self.root and node.tag not in boundaries:
            if node.tag in tags:
                self._open = node.parent or self.root
                return
            node = node.parent


class _Extractor:
    def __init__(self, *, keep_header_footer: bool) -> None:
        self.blocks: list[Block] = []
        self._text: list[str] = []
        self._link_characters = 0
        self._keep_header_footer = keep_header_footer

    def extract(self, root: _Node) -> list[Block]:
        self._walk(root, in_link=False)
        self._flush()
        return self.blocks

    def _walk(self, node: _Node, *, in_link: bool) -> None:
        for child in node.children:
            if isinstance(child, str):
                self._text.append(child)
                if in_link:
                    self._link_characters += len(child.strip())
                continue

            tag = child.tag
            if self._is_furniture(child):
                continue
            if tag in _HEADINGS:
                self._flush()
                text, _ = self._inline(child)
                if text:
                    self.blocks.append(Block(BlockKind.HEADING, text[:300],
                                             level=_HEADINGS[tag]))
            elif tag == "pre":
                self._flush()
                code = _raw_text(child).strip("\n")
                if code.strip():
                    self.blocks.append(Block(BlockKind.CODE, code))
            elif tag == "table":
                self._flush()
                self._table(child)
            elif tag == "li":
                self._flush()
                self._list_item(child)
            elif tag in _PARAGRAPHS:
                self._flush()
                self._emit(BlockKind.PARAGRAPH, *self._inline(child))
            elif tag == "br":
                self._text.append("\n")
            elif tag == "hr":
                self._flush()
            elif tag in _WRAPPERS:
                self._flush()
                self._walk(child, in_link=in_link)
                self._flush()
            else:
                # Inline: its text joins the paragraph being accumulated.
                self._walk(child, in_link=in_link or tag == "a")

    def _list_item(self, node: _Node) -> None:
        text, links = self._inline(node, skip=_LISTS)
        self._emit(BlockKind.LIST_ITEM, text, links)
        for child in node.children:
            if isinstance(child, _Node) and child.tag in _LISTS:
                self._walk(child, in_link=False)
                self._flush()

    def _table(self, node: _Node) -> None:
        rows: list[str] = []
        for row in _rows(node):
            cells = [
                self._inline(cell)[0] for cell in row.children
                if isinstance(cell, _Node) and cell.tag in ("td", "th")
                and not self._is_furniture(cell)
            ]
            cells = [cell for cell in cells if cell]
            if cells:
                rows.append(" | ".join(cells))
        if not rows:
            return
        # A table used for layout, where the cells are the page: walk it as
        # content instead of flattening a whole article into one "row".
        if len(rows) <= 2 and sum(len(row) for row in rows) / len(rows) > 400:
            self._walk(node, in_link=False)
            self._flush()
            return
        self.blocks.append(Block(BlockKind.TABLE, "\n".join(rows)))

    def _inline(self, node: _Node, *, skip: frozenset[str] = frozenset()
                ) -> tuple[str, int]:
        """The visible text under a node, and how much of it is link text."""
        parts: list[str] = []
        link_characters = 0
        stack: list[tuple[_Node | str, bool]] = [
            (child, False) for child in reversed(node.children)
        ]
        while stack:
            item, in_link = stack.pop()
            if isinstance(item, str):
                parts.append(item)
                if in_link:
                    link_characters += len(item.strip())
                continue
            if item.tag in skip or self._is_furniture(item):
                continue
            if item.tag == "br":
                parts.append(" ")
                continue
            if item.tag in _PARAGRAPHS or item.tag in _WRAPPERS:
                parts.append(" ")
            nested = in_link or item.tag == "a"
            stack.extend((child, nested) for child in reversed(item.children))
        return " ".join("".join(parts).split()), link_characters

    def _emit(self, kind: BlockKind, text: str, link_characters: int) -> None:
        if not text:
            return
        if len(text) < _SHORT_TEXT and link_characters / len(text) > _LINK_DENSITY:
            return
        self.blocks.append(Block(kind, text))

    def _flush(self) -> None:
        if self._text:
            text = "\n".join(
                " ".join(line.split()) for line in "".join(self._text).split("\n")
            ).strip()
            links = self._link_characters
            self._text = []
            self._link_characters = 0
            flat = " ".join(text.split())
            if flat and not (len(flat) < _SHORT_TEXT
                             and links / len(flat) > _LINK_DENSITY):
                self.blocks.append(Block(BlockKind.PARAGRAPH, text))

    def _is_furniture(self, node: _Node) -> bool:
        if node.tag in _DROP:
            return True
        if node.tag in ("header", "footer") and not self._keep_header_footer:
            return True
        return _hidden_or_marked(node)


class HtmlParser(DocumentParser):
    format = "html"
    name = "html"

    def __init__(self, settings: IngestionSettings | None = None) -> None:
        del settings

    def parse(self, data: bytes, *, filename: str,
              charset: str | None = None) -> ParsedDocument:
        if not charset:
            match = _META_CHARSET.search(data[:4096])
            charset = match.group(1).decode("ascii", "ignore") if match else None
        text, warning = decode_text(data, charset)

        builder = _TreeBuilder()
        try:
            builder.feed(text)
            builder.close()
        except Exception as exc:
            raise DocumentRejectedError(
                "The page's HTML could not be read.", code=ErrorCode.DOCUMENT_CORRUPT
            ) from exc

        root = _content_root(builder.root)
        blocks = _Extractor(
            keep_header_footer=root.tag in ("main", "article")
        ).extract(root)

        first_heading = next(
            (block.text for block in blocks if block.kind is BlockKind.HEADING), None
        )
        title = (
            builder.meta.get("og:title")
            or builder.meta.get("twitter:title")
            or " ".join(builder.title.split())
            or first_heading
        )

        metadata: dict[str, str] = {}
        if builder.language:
            metadata["language"] = builder.language.split("-")[0].strip().lower()[:8]
        for key, label in (("description", "description"),
                           ("og:description", "description"),
                           ("og:site_name", "site_name"),
                           ("author", "author")):
            if builder.meta.get(key) and label not in metadata:
                metadata[label] = builder.meta[key][:500]

        return ParsedDocument(
            format=self.format,
            parser=self.name,
            blocks=blocks,
            title=title[:300] if title else None,
            metadata=metadata,
            warnings=[warning] if warning else [],
        )


def _hidden_or_marked(node: _Node) -> bool:
    attrs = node.attrs
    if "hidden" in attrs or attrs.get("aria-hidden", "").lower() == "true":
        return True
    style = attrs.get("style", "").replace(" ", "").lower()
    if "display:none" in style or "visibility:hidden" in style:
        return True
    if attrs.get("role", "").lower() in _FURNITURE_ROLES:
        return True
    if node.tag in ("main", "article", "body", "html", "#root"):
        return False
    hint = f"{attrs.get('id', '')} {attrs.get('class', '')}"
    return bool(hint.strip()) and bool(_FURNITURE_HINT.search(hint))


def _content_root(root: _Node) -> _Node:
    mains = [node for node in _find_all(root, "main") if not _hidden_or_marked(node)]
    if mains:
        return max(mains, key=_text_length)

    body = next(iter(_find_all(root, "body")), root)
    articles = _find_all(body, "article")
    if articles:
        best = max(articles, key=_text_length)
        # A blog index is a page of short <article> teasers; none of them is
        # "the" content and the body is the better root.
        if _text_length(best) >= 0.25 * max(1, _text_length(body)):
            return best
    return body


def _find_all(node: _Node, tag: str) -> list[_Node]:
    found: list[_Node] = []
    stack = [node]
    while stack:
        current = stack.pop()
        for child in current.children:
            if isinstance(child, _Node):
                if child.tag == tag:
                    found.append(child)
                stack.append(child)
    return found


def _text_length(node: _Node) -> int:
    total = 0
    stack = [node]
    while stack:
        current = stack.pop()
        for child in current.children:
            if isinstance(child, str):
                total += len(child.strip())
            elif child.tag not in _DROP:
                stack.append(child)
    return total


def _rows(table: _Node) -> list[_Node]:
    """Rows of this table, not of any table nested inside it."""
    rows: list[_Node] = []
    stack = list(reversed(table.children))
    while stack:
        item = stack.pop()
        if not isinstance(item, _Node) or item.tag == "table":
            continue
        if item.tag == "tr":
            rows.append(item)
        else:
            stack.extend(reversed(item.children))
    return rows


def _raw_text(node: _Node) -> str:
    parts: list[str] = []
    stack: list[_Node | str] = [node]
    while stack:
        item = stack.pop()
        if isinstance(item, str):
            parts.append(item)
        elif item.tag == "br":
            parts.append("\n")
        else:
            stack.extend(reversed(item.children))
    return "".join(parts)
