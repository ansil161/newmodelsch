"""How well an answer is supported by what was retrieved.

Three levels, decided from evidence this service controls rather than from
the model's opinion of itself:

    SUPPORTED             the answer cites the excerpts it was given, for
                          most of what it says, and claims no gap
    PARTIALLY_SUPPORTED   it cites some excerpts, but also says the knowledge
                          base is silent on part of the question, mixes in
                          general knowledge, or makes claims it does not cite
    INSUFFICIENT_CONTEXT  nothing relevant was retrieved, or the model said
                          it could not answer from what was

WHY NOT ASK A MODEL. A second call to grade the first costs another round
trip and another bill on every answer, and a model's judgement of its own
grounding is exactly the thing in doubt. The signals used here are
mechanical: whether retrieval produced any context, which citation markers
survived resolution against that context (citations.py), and whether the
answer contains the sentence the prompt tells the model to use when the
excerpts fall short (prompts.INSUFFICIENT_CONTEXT_MARKER).

WHAT IT IS FOR. A label for the console and for evaluation, not a gate. The
answer text is never altered because of it: an answer the model qualified
honestly is already the right answer, and one it did not is better caught by
an administrator reading the label than hidden by a rewrite.
"""

from __future__ import annotations

import re
from collections.abc import Sequence
from enum import StrEnum

from .prompts import INSUFFICIENT_CONTEXT_MARKER


class SupportLevel(StrEnum):
    SUPPORTED = "SUPPORTED"
    PARTIALLY_SUPPORTED = "PARTIALLY_SUPPORTED"
    INSUFFICIENT_CONTEXT = "INSUFFICIENT_CONTEXT"


# The instructed sentence first; then the ways models phrase the same
# admission when they paraphrase it anyway.
_GAP_PHRASES = (
    INSUFFICIENT_CONTEXT_MARKER.lower(),
    "does not contain enough information",
    "do not contain enough information",
    "not have enough information",
    "could not find",
    "couldn't find",
    "no information about",
    "not mentioned in the",
    "not covered in the",
    "the excerpts do not",
    "the provided excerpts do not",
)
_GENERAL_KNOWLEDGE_PHRASES = (
    "not from the knowledge base",
    "general knowledge",
)

_MARKER = re.compile(r"\[\d+(?:\s*,\s*\d+)*\]")
# "…months. [1]" → "…months [1]." so the marker stays with the sentence it
# supports when the answer is split.
_MARKER_AFTER_STOP = re.compile(r"([.!?])\s*((?:\[\d+(?:\s*,\s*\d+)*\])+)")
_SENTENCE_BREAK = re.compile(r"(?<=[.!?])\s+|\n+")

# Share of an answer's substantive sentences that must carry a citation for
# it to count as SUPPORTED. Below it, the answer says more than it attributes.
CITED_SHARE = 0.5
# Shorter than this is a connective ("In short:"), not a claim.
_MIN_CLAIM_WORDS = 5


def assess(answer: str, *, grounded: bool, cited: Sequence[int]) -> SupportLevel:
    if not grounded:
        return SupportLevel.INSUFFICIENT_CONTEXT

    lowered = answer.lower()
    admits_gap = any(phrase in lowered for phrase in _GAP_PHRASES)

    if not cited:
        # Context existed and the model cited none of it: either it declined,
        # or it answered without attributing anything to the documents.
        return (SupportLevel.INSUFFICIENT_CONTEXT if admits_gap
                else SupportLevel.PARTIALLY_SUPPORTED)

    if admits_gap or any(phrase in lowered for phrase in _GENERAL_KNOWLEDGE_PHRASES):
        return SupportLevel.PARTIALLY_SUPPORTED

    normalised = _MARKER_AFTER_STOP.sub(r" \2\1", answer)
    claims = [
        sentence for sentence in _SENTENCE_BREAK.split(normalised)
        if len(_MARKER.sub("", sentence).split()) >= _MIN_CLAIM_WORDS
    ]
    if not claims:
        return SupportLevel.SUPPORTED
    attributed = sum(1 for sentence in claims if _MARKER.search(sentence))
    return (SupportLevel.SUPPORTED if attributed / len(claims) >= CITED_SHARE
            else SupportLevel.PARTIALLY_SUPPORTED)
