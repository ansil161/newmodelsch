"""Retrieval and generation metrics.

Pure functions over ranked lists. Kept separate from the harness so the
arithmetic can itself be unit-tested — a metric that is quietly wrong is
worse than no metric, because it produces confident numbers nobody
double-checks.

WHICH METRIC ANSWERS WHICH QUESTION
  hit rate   Did the right document appear at all? The floor. If this is
             low, nothing downstream can save the answer.
  recall@k   What fraction of the relevant documents were found?
  precision  How much of what was retrieved was relevant? Low precision
             wastes the context budget and dilutes the prompt.
  MRR        How high did the first relevant result rank? This is the one
             that tracks reranking quality most directly.
  nDCG       Rank-weighted, and the fairest single number when several
             documents are relevant.
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass


def hit_rate(retrieved: Sequence[str], relevant: set[str]) -> float:
    if not relevant:
        return 1.0
    return 1.0 if any(item in relevant for item in retrieved) else 0.0


def recall_at_k(retrieved: Sequence[str], relevant: set[str], k: int) -> float:
    if not relevant:
        return 1.0
    found = {item for item in retrieved[:k] if item in relevant}
    return len(found) / len(relevant)


def precision_at_k(retrieved: Sequence[str], relevant: set[str], k: int) -> float:
    window = retrieved[:k]
    if not window:
        return 0.0
    return sum(1 for item in window if item in relevant) / len(window)


def reciprocal_rank(retrieved: Sequence[str], relevant: set[str]) -> float:
    for position, item in enumerate(retrieved, start=1):
        if item in relevant:
            return 1.0 / position
    return 0.0


def ndcg_at_k(retrieved: Sequence[str], relevant: set[str], k: int) -> float:
    """Binary-gain nDCG.

    Discounted by log2 of rank, so a relevant document at position 1 is worth
    more than one at position 5, and normalised by the best achievable
    ordering so the number is comparable across questions with different
    numbers of relevant documents.
    """
    if not relevant:
        return 1.0

    gain = sum(
        1.0 / math.log2(position + 1)
        for position, item in enumerate(retrieved[:k], start=1)
        if item in relevant
    )
    ideal = sum(
        1.0 / math.log2(position + 1)
        for position in range(1, min(len(relevant), k) + 1)
    )
    return gain / ideal if ideal else 0.0


def groundedness(answer: str, expected_facts: Sequence[str]) -> float:
    """Fraction of the expected facts present in the answer.

    A blunt instrument on purpose. Judging faithfulness with another model
    costs a call per case and introduces a second thing that can be wrong;
    substring matching on short factual anchors — a figure, a part number —
    is deterministic, free, and catches the failure that matters most, which
    is the model rounding "thirty-six months" to "three years" or inventing a
    different number entirely.
    """
    if not expected_facts:
        return 1.0
    lowered = answer.lower()
    # Any-match rather than all: the dataset lists alternative spellings of
    # the same fact ("thirty-six" / "36").
    return 1.0 if any(fact.lower() in lowered for fact in expected_facts) else 0.0


def citation_correctness(cited_documents: Sequence[str], relevant: set[str]) -> float:
    """Fraction of cited documents that are genuinely relevant.

    Catches the answer that is right for the wrong reason — correct text,
    citation pointing at the distractor.
    """
    if not cited_documents:
        return 0.0
    return sum(1 for doc in cited_documents if doc in relevant) / len(cited_documents)


def refusal(answer: str) -> bool:
    """Whether the answer declines rather than inventing something.

    Phrase matching, which is imperfect. It is checked against the
    `unanswerable` cases, where the correct behaviour is unambiguous.
    """
    lowered = answer.lower()
    return any(
        phrase in lowered
        for phrase in (
            "not have enough information", "does not contain", "no information",
            "could not find", "cannot find", "not mentioned", "not covered",
            "don't have", "do not have", "unable to find", "nothing in the",
            "not specified", "not available in",
        )
    )


@dataclass
class RetrievalScores:
    hit_rate: float = 0.0
    recall: float = 0.0
    precision: float = 0.0
    mrr: float = 0.0
    ndcg: float = 0.0
    cases: int = 0

    def add(self, retrieved: Sequence[str], relevant: set[str], k: int) -> None:
        self.hit_rate += hit_rate(retrieved, relevant)
        self.recall += recall_at_k(retrieved, relevant, k)
        self.precision += precision_at_k(retrieved, relevant, k)
        self.mrr += reciprocal_rank(retrieved, relevant)
        self.ndcg += ndcg_at_k(retrieved, relevant, k)
        self.cases += 1

    def averaged(self) -> dict[str, float]:
        if not self.cases:
            return {}
        return {
            "hit_rate": round(self.hit_rate / self.cases, 3),
            "recall": round(self.recall / self.cases, 3),
            "precision": round(self.precision / self.cases, 3),
            "mrr": round(self.mrr / self.cases, 3),
            "ndcg": round(self.ndcg / self.cases, 3),
            "cases": self.cases,
        }
