"""Reciprocal Rank Fusion.

The problem: dense and sparse retrieval return scores that are not
comparable. Cosine similarity lives in [-1, 1] and clusters tightly around
0.6-0.9 for anything plausible; Qdrant's IDF-weighted sparse score is
unbounded and depends on how rare the query's terms happen to be in the
collection. Normalising them onto a common scale requires knowing each
distribution, which changes with every query and every document added.

RRF sidesteps that by throwing the scores away and using only the *ranks*:

    score(d) = Σ_r  weight_r / (k + rank_r(d))

A document at rank 1 in either list scores 1/(k+1); one at rank 20 scores
1/(k+20). A document both retrievers found scores the sum, which is the
behaviour worth having — agreement between two independent methods is the
strongest signal available at this stage.

`k` (default 60, from the original paper) controls how sharply top ranks
dominate. Small k makes rank 1 overwhelmingly important; large k flattens the
list toward the raw union. Weights let one retriever be trusted more than the
other — useful when a collection is mostly prose (favour dense) or mostly
identifiers and part numbers (favour sparse).

This module is pure: lists in, list out, no I/O, no configuration lookups.
That is what makes the ranking behaviour testable without a vector database.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from dataclasses import dataclass

from app.shared.types import RetrievalMethod, RetrievedChunk


@dataclass(frozen=True)
class RankedList:
    """One retriever's output, best first, with how much to trust it."""

    chunks: Sequence[RetrievedChunk]
    weight: float = 1.0


def reciprocal_rank_fusion(
    ranked_lists: Iterable[RankedList], *, k: int = 60, limit: int | None = None,
) -> list[RetrievedChunk]:
    """Fuse ranked lists into one ordering.

    Chunks appearing in more than one list are merged into a single result
    that keeps every score it arrived with — the dense score, the sparse
    score, and which retrievers found it. Nothing is discarded, because the
    reranker and the citation builder both want that provenance, and because
    a debugging session that cannot see why a chunk ranked where it did is a
    long one.
    """
    if k < 1:
        raise ValueError("RRF k must be at least 1")

    merged: dict[str, RetrievedChunk] = {}
    scores: dict[str, float] = {}

    for ranked in ranked_lists:
        for position, chunk in enumerate(ranked.chunks):
            # Rank is 1-based: the first result should score 1/(k+1), not
            # 1/k, or a single top hit would dominate every fused list.
            rank = position + 1
            contribution = ranked.weight / (k + rank)

            existing = merged.get(chunk.chunk_id)
            if existing is None:
                merged[chunk.chunk_id] = chunk.model_copy(deep=True)
                scores[chunk.chunk_id] = contribution
            else:
                _absorb(existing, chunk)
                scores[chunk.chunk_id] += contribution

    for chunk_id, chunk in merged.items():
        chunk.fusion_score = scores[chunk_id]
        if len(chunk.methods) > 1:
            # Found by both. Recorded so the reranker's input and the logs
            # can tell a consensus hit from a single-retriever one.
            chunk.methods = [RetrievalMethod.HYBRID, *chunk.methods]

    ordered = sorted(
        merged.values(),
        # chunk_id as the tiebreaker: float sums are order-dependent, and a
        # ranking that shuffles between identical runs is untestable.
        key=lambda chunk: (-(chunk.fusion_score or 0.0), chunk.chunk_id),
    )
    return ordered[:limit] if limit is not None else ordered


def _absorb(target: RetrievedChunk, other: RetrievedChunk) -> None:
    """Fold a duplicate hit's scores and methods into the kept copy."""
    if other.dense_score is not None:
        target.dense_score = (
            other.dense_score if target.dense_score is None
            else max(target.dense_score, other.dense_score)
        )
    if other.sparse_score is not None:
        target.sparse_score = (
            other.sparse_score if target.sparse_score is None
            else max(target.sparse_score, other.sparse_score)
        )
    for method in other.methods:
        if method not in target.methods:
            target.methods.append(method)
