"""Reciprocal Rank Fusion.

Pure ranking logic, so it is tested directly rather than through a vector
database. These are the assertions that would catch a regression in the
thing hybrid search exists for: that agreement between two retrievers
outranks a strong showing in one.
"""

from __future__ import annotations

import pytest

from app.modules.retrieval.fusion import RankedList, reciprocal_rank_fusion
from app.shared.types import RetrievalMethod
from tests.conftest import chunk


def test_a_single_list_keeps_its_order():
    fused = reciprocal_rank_fusion(
        [RankedList([chunk("a", dense=0.9), chunk("b", dense=0.8),
                     chunk("c", dense=0.7)])]
    )
    assert [c.chunk_id for c in fused] == ["a", "b", "c"]


def test_a_chunk_found_by_both_retrievers_outranks_one_found_by_either():
    """The central claim of hybrid retrieval.

    "b" is second in both lists and first in neither. It still wins, because
    two independent methods agreeing is stronger evidence than one method
    being confident.
    """
    dense = [chunk("a", dense=0.9), chunk("b", dense=0.8)]
    sparse = [chunk("c", sparse=9.0), chunk("b", sparse=8.0)]

    fused = reciprocal_rank_fusion([RankedList(dense), RankedList(sparse)], k=60)

    assert fused[0].chunk_id == "b"


def test_scores_from_both_retrievers_are_preserved_on_the_merged_chunk():
    # The reranker and the debugging path both want to know where a chunk
    # came from and how strongly.
    fused = reciprocal_rank_fusion([
        RankedList([chunk("a", dense=0.75)]),
        RankedList([chunk("a", sparse=4.5)]),
    ])

    merged = fused[0]
    assert merged.dense_score == 0.75
    assert merged.sparse_score == 4.5
    assert RetrievalMethod.HYBRID in merged.methods
    assert RetrievalMethod.DENSE in merged.methods
    assert RetrievalMethod.SPARSE in merged.methods


def test_a_chunk_from_one_retriever_is_not_marked_hybrid():
    fused = reciprocal_rank_fusion([RankedList([chunk("a", dense=0.9)])])
    assert RetrievalMethod.HYBRID not in fused[0].methods


def test_rank_drives_the_score_and_raw_scores_do_not():
    """RRF must ignore the incomparable raw scores.

    Sparse scores here are two orders of magnitude larger than the cosine
    scores. If any of that leaked into the fused score, the sparse list would
    dominate every result.
    """
    dense = [chunk("a", dense=0.99), chunk("b", dense=0.98)]
    sparse = [chunk("c", sparse=500.0), chunk("d", sparse=499.0)]

    fused = reciprocal_rank_fusion([RankedList(dense), RankedList(sparse)], k=60)

    # Rank 1 from each list ties; rank 2 from each ties below them.
    assert {fused[0].chunk_id, fused[1].chunk_id} == {"a", "c"}
    assert {fused[2].chunk_id, fused[3].chunk_id} == {"b", "d"}


def test_weights_shift_the_balance_between_retrievers():
    dense = [chunk("a", dense=0.9)]
    sparse = [chunk("c", sparse=9.0)]

    sparse_favoured = reciprocal_rank_fusion(
        [RankedList(dense, weight=1.0), RankedList(sparse, weight=3.0)]
    )
    dense_favoured = reciprocal_rank_fusion(
        [RankedList(dense, weight=3.0), RankedList(sparse, weight=1.0)]
    )

    assert sparse_favoured[0].chunk_id == "c"
    assert dense_favoured[0].chunk_id == "a"


def test_a_smaller_k_sharpens_the_advantage_of_rank_one():
    dense = [chunk("a", dense=0.9), chunk("b", dense=0.8)]

    sharp = reciprocal_rank_fusion([RankedList(dense)], k=1)
    flat = reciprocal_rank_fusion([RankedList(dense)], k=1000)

    sharp_ratio = sharp[0].fusion_score / sharp[1].fusion_score
    flat_ratio = flat[0].fusion_score / flat[1].fusion_score
    assert sharp_ratio > flat_ratio


def test_the_limit_truncates_after_ranking_not_before():
    dense = [chunk(str(i), dense=1.0 - i / 10) for i in range(10)]
    fused = reciprocal_rank_fusion([RankedList(dense)], limit=3)
    assert [c.chunk_id for c in fused] == ["0", "1", "2"]


def test_ordering_is_stable_for_equal_scores():
    # Float sums are order-dependent. Without the chunk_id tiebreaker the
    # ranking could differ between identical runs, which makes every
    # downstream test flaky.
    lists = [RankedList([chunk("b", dense=0.5)]), RankedList([chunk("a", sparse=1.0)])]
    first = [c.chunk_id for c in reciprocal_rank_fusion(lists)]
    second = [c.chunk_id for c in reciprocal_rank_fusion(lists)]
    assert first == second == ["a", "b"]


def test_empty_lists_fuse_to_nothing():
    assert reciprocal_rank_fusion([RankedList([]), RankedList([])]) == []


def test_one_empty_list_does_not_discard_the_other():
    # The degraded case: sparse search failed, dense still has answers.
    fused = reciprocal_rank_fusion(
        [RankedList([chunk("a", dense=0.9)]), RankedList([])]
    )
    assert [c.chunk_id for c in fused] == ["a"]


def test_k_below_one_is_rejected():
    with pytest.raises(ValueError):
        reciprocal_rank_fusion([RankedList([])], k=0)


def test_fusing_does_not_mutate_the_input_chunks():
    original = chunk("a", dense=0.9)
    reciprocal_rank_fusion([RankedList([original])])
    assert original.fusion_score is None
