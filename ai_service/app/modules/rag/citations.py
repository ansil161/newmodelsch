"""Citations, built from retrieval — never from the model.

THE RULE THIS FILE ENFORCES. The model is given numbered excerpts and asked
to cite them. It is never asked for a document name, a page number or an id,
and it is never believed about one. Every `Source` returned to the client is
constructed from a chunk this service actually retrieved and actually put in
the prompt. A model cannot fabricate a citation here because it is not the
thing producing them.

What the model *can* do is emit a marker that does not exist — "[7]" when
four excerpts were supplied — or cite nothing at all. Both are handled:

  * markers outside the valid range are stripped from the answer text, and
    logged, because they are a hallucination and rendering them would show
    the user a footnote pointing nowhere;
  * markers the model did use determine which sources are returned, so an
    answer that drew on two of six excerpts cites two, not six.

The fallback when the model cites nothing is deliberate. Rather than
returning no sources for an answer that clearly came from somewhere, the
excerpts that were in the prompt are returned unnumbered — the user still
gets "here is what this was based on", without a false claim about which
sentence came from which document.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.core.logging import get_logger
from app.shared.types import RetrievedChunk, Source

logger = get_logger(__name__)

# [1], [2][3], [1, 2]
_CITATION = re.compile(r"\[(\d+(?:\s*,\s*\d+)*)\]")

_EXCERPT_CHARACTERS = 240


@dataclass(frozen=True)
class CitationResult:
    answer: str
    sources: list[Source]
    # Markers the model invented. Surfaced for logging and evaluation, not to
    # the user.
    invalid_markers: list[int]
    # Valid markers the answer actually used, ascending. Empty when the model
    # cited nothing — which grounding.py treats very differently from citing.
    cited: list[int] = field(default_factory=list)


def build(answer: str, chunks: list[RetrievedChunk]) -> CitationResult:
    """Resolve the markers in an answer against the excerpts it was given."""
    if not chunks:
        return CitationResult(answer=answer, sources=[], invalid_markers=[])

    valid = range(1, len(chunks) + 1)
    cited: list[int] = []
    invalid: list[int] = []

    for match in _CITATION.finditer(answer):
        for raw in match.group(1).split(","):
            number = int(raw.strip())
            if number in valid:
                if number not in cited:
                    cited.append(number)
            elif number not in invalid:
                invalid.append(number)

    cleaned = _strip_invalid(answer, invalid) if invalid else answer

    if invalid:
        logger.warning(
            "The model cited excerpts that were not supplied",
            extra={"invalid_markers": invalid, "excerpts": len(chunks)},
        )

    if cited:
        sources = [
            _to_source(chunks[number - 1], number) for number in sorted(cited)
        ]
    else:
        # Nothing cited. Return what the answer was built from, without
        # claiming a mapping that was never asserted.
        sources = [_to_source(chunk, 0) for chunk in chunks]

    return CitationResult(answer=cleaned, sources=sources, invalid_markers=invalid,
                          cited=sorted(cited))


def provisional_sources(chunks: list[RetrievedChunk]) -> list[Source]:
    """Sources in prompt order, before the answer exists.

    Sent to the client the moment retrieval finishes so source cards render
    while the answer is still streaming. Their `citation_number` is the
    marker the model was told to use, which is why it is safe to show them
    early: the numbering comes from this service, not from the model.
    """
    return [_to_source(chunk, number)
            for number, chunk in enumerate(chunks, start=1)]


def _strip_invalid(answer: str, invalid: list[int]) -> str:
    """Remove markers pointing at excerpts that do not exist.

    Only the invalid numbers are removed; a group like "[2][7]" keeps [2].
    """
    invalid_set = set(invalid)

    def replace(match: re.Match[str]) -> str:
        numbers = [int(part.strip()) for part in match.group(1).split(",")]
        kept = [number for number in numbers if number not in invalid_set]
        if not kept:
            return ""
        return "[" + ", ".join(str(number) for number in kept) + "]"

    # Collapse the space a removed marker leaves before punctuation.
    cleaned = _CITATION.sub(replace, answer)
    return re.sub(r"\s+([.,;:!?])", r"\1", cleaned).strip()


def _to_source(chunk: RetrievedChunk, number: int) -> Source:
    pages = list(chunk.metadata.pages)
    if not pages and chunk.metadata.page is not None:
        pages = [chunk.metadata.page]

    return Source(
        document_id=chunk.document_id,
        document_name=chunk.document_name,
        chunk_id=chunk.chunk_id,
        chunk_index=chunk.chunk_index,
        page=pages[0] if pages else None,
        pages=pages,
        heading=chunk.metadata.heading,
        section=chunk.metadata.section,
        source_url=chunk.source_url,
        document_version=chunk.document_version,
        citation_number=number,
        score=round(chunk.final_score, 6),
        excerpt=_excerpt(chunk.content),
    )


def _excerpt(content: str) -> str:
    """A short verbatim window, so a reader can check the citation.

    Cut on a word boundary — a snippet ending mid-word reads like a bug.
    """
    text = content.strip()
    if len(text) <= _EXCERPT_CHARACTERS:
        return text
    window = text[:_EXCERPT_CHARACTERS]
    space = window.rfind(" ")
    if space > _EXCERPT_CHARACTERS // 2:
        window = window[:space]
    return f"{window.rstrip()}…"
