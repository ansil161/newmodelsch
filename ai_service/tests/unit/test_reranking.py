"""Parsing what the hosted cross-encoder returns.

WHY THIS IS TESTED SEPARATELY. `rerank` deliberately degrades to the fused
ordering when anything goes wrong, which is the right behaviour — a knowledge
base that ranks slightly worse beats one that answers "try again". But it
also means a broken request or a misparsed response is invisible: the service
keeps answering, a little worse, and says nothing.

That is exactly what happened. The hosted reranker was being sent a
sentence-similarity payload while the model is served as a text-classification
pipeline, so every call returned 400, every call was swallowed, and reranking
silently never ran.
"""

from __future__ import annotations

import pytest

from app.modules.retrieval.reranking import _parse_classification_scores


def test_scores_wrapped_in_an_outer_list() -> None:
    """The shape the hosted API returns today."""
    body = [[
        {"label": "LABEL_0", "score": 0.91},
        {"label": "LABEL_0", "score": 0.00004},
        {"label": "LABEL_0", "score": 0.0006},
    ]]

    assert _parse_classification_scores(body, 3) == [0.91, 0.00004, 0.0006]


def test_scores_returned_bare() -> None:
    body = [{"label": "LABEL_0", "score": 0.7}, {"label": "LABEL_0", "score": 0.2}]

    assert _parse_classification_scores(body, 2) == [0.7, 0.2]


def test_a_full_label_distribution_per_input() -> None:
    """Some deployments return every label; the first is the ranked one."""
    body = [
        [{"label": "LABEL_0", "score": 0.8}, {"label": "LABEL_1", "score": 0.2}],
        [{"label": "LABEL_0", "score": 0.1}, {"label": "LABEL_1", "score": 0.9}],
    ]

    assert _parse_classification_scores(body, 2) == [0.8, 0.1]


def test_a_single_passage() -> None:
    assert _parse_classification_scores([[{"score": 0.5}]], 1) == [0.5]


def test_order_is_preserved() -> None:
    """Scores line up with the passages by position, not by score.

    `_apply_scores` zips them against the chunks, so a reordering here would
    attach every score to the wrong passage and reorder the evidence behind
    an answer without any error being raised.
    """
    body = [[{"score": 0.1}, {"score": 0.9}, {"score": 0.5}]]

    assert _parse_classification_scores(body, 3) == [0.1, 0.9, 0.5]


@pytest.mark.parametrize("body", [
    {"error": "model is loading"},
    [],
    [[{"score": 0.1}]],
    "not json at all",
])
def test_anything_unexpected_raises_rather_than_guessing(body: object) -> None:
    """A wrong count must fail, not be padded or truncated.

    Coercing here would hand `_apply_scores` a mismatched list and mis-rank
    the evidence. Raising lets the caller fall back to the fused order, which
    is at least a correct ordering.
    """
    with pytest.raises(ValueError):
        _parse_classification_scores(body, 3)
