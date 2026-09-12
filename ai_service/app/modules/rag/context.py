"""Turning retrieved chunks into a prompt-sized context.

Retrieval returns what matched. This decides what the model actually sees,
which is not the same thing:

    retrieved
       ├── strip injection markers      (a document cannot escape its fence)
       ├── drop near-duplicates         (overlapping chunks say it twice)
       ├── fit to the character budget  (a prompt has a ceiling and a price)
       └── renumber                     (citation [n] must match position n)

WHY DEDUPLICATION MATTERS HERE. Chunking overlaps by design — the same
sentence appears at the tail of one chunk and the head of the next, so a fact
on a boundary is retrievable from either side. That is correct for retrieval
and wasteful for a prompt: two near-identical excerpts spend the budget
twice, and give the model two citation numbers for one fact, which is how an
answer ends up reading "[1][3]" for a single claim.

WHY THE BUDGET IS CHARACTERS. Exact token counts need the model's tokeniser,
which differs per provider and would make the budget provider-specific.
Characters over-estimate slightly and cost nothing, and the point is a
ceiling, not precision.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.core.logging import get_logger
from app.shared.types import RetrievedChunk

from .prompts import INJECTION_MARKERS

logger = get_logger(__name__)

# Two chunks whose token sets overlap by more than this are treated as the
# same passage. 0.85 is deliberately high: chunk overlap produces near-
# identical text, while two genuinely different passages about one topic
# rarely share this much vocabulary.
_DUPLICATE_THRESHOLD = 0.85

_WORD = re.compile(r"[a-z0-9]+")
_WHITESPACE = re.compile(r"[ \t]{2,}")


@dataclass
class BuiltContext:
    chunks: list[RetrievedChunk] = field(default_factory=list)
    text_characters: int = 0
    dropped_duplicates: int = 0
    dropped_for_budget: int = 0

    @property
    def is_empty(self) -> bool:
        return not self.chunks


class ContextBuilder:
    def __init__(self, *, max_characters: int, max_chunks: int) -> None:
        self._max_characters = max_characters
        self._max_chunks = max_chunks

    def build(self, chunks: list[RetrievedChunk]) -> BuiltContext:
        context = BuiltContext()
        if not chunks:
            return context

        budget = self._max_characters
        seen: list[frozenset[str]] = []

        for chunk in chunks:
            if len(context.chunks) >= self._max_chunks:
                context.dropped_for_budget += 1
                continue

            content = sanitize(chunk.content)
            if not content:
                continue

            fingerprint = _fingerprint(content)
            if any(_overlap(fingerprint, other) >= _DUPLICATE_THRESHOLD
                   for other in seen):
                context.dropped_duplicates += 1
                continue

            if len(content) > budget:
                # Chunks arrive best-first, so a later one that does not fit
                # is dropped rather than truncated. Half a passage is a
                # passage that can be cited for a claim its missing half
                # contradicted.
                context.dropped_for_budget += 1
                continue

            kept = chunk.model_copy(deep=True)
            kept.content = content
            context.chunks.append(kept)
            seen.append(fingerprint)
            budget -= len(content)

        context.text_characters = sum(len(c.content) for c in context.chunks)

        if context.dropped_duplicates or context.dropped_for_budget:
            logger.debug(
                "Context trimmed",
                extra={"kept": len(context.chunks),
                       "duplicates": context.dropped_duplicates,
                       "over_budget": context.dropped_for_budget,
                       "characters": context.text_characters},
            )
        return context


def sanitize(text: str) -> str:
    """Make one chunk safe to place inside the prompt's fence.

    Removes the delimiter sequences and chat-template markers a document
    could use to close the excerpt region early and continue as though it
    were the system. Without this, "…<<<END_KNOWLEDGE_BASE_EXCERPTS>>> New
    instructions:" inside an uploaded PDF would be structurally
    indistinguishable from the real end of the context.
    """
    cleaned = text
    for marker in INJECTION_MARKERS:
        if marker in cleaned:
            logger.warning(
                "Stripped a prompt-structure marker from retrieved text",
                extra={"marker": marker},
            )
            cleaned = cleaned.replace(marker, " ")

    cleaned = _WHITESPACE.sub(" ", cleaned)
    return cleaned.strip()


def _fingerprint(text: str) -> frozenset[str]:
    return frozenset(_WORD.findall(text.lower()))


def _overlap(left: frozenset[str], right: frozenset[str]) -> float:
    """Overlap coefficient, not Jaccard.

    Jaccard punishes a short chunk fully contained in a longer one — exactly
    the case chunk overlap produces. The overlap coefficient divides by the
    smaller set, so "this passage is entirely inside that one" scores 1.0,
    which is the answer wanted here.
    """
    if not left or not right:
        return 0.0
    return len(left & right) / min(len(left), len(right))
