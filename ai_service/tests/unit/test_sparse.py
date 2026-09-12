"""The sparse encoder.

Two properties carry the feature: identifiers survive tokenisation, and the
mapping from term to coordinate is stable across processes. The second is
not obvious and its failure is silent — stored vectors simply stop matching
after a restart.
"""

from __future__ import annotations

import math

from app.modules.embeddings import sparse


def test_identifiers_survive_as_single_tokens():
    """The whole reason sparse retrieval exists.

    A naive \\w+ split would shred "SKU-4471" into "sku" and "4471", and the
    one query that most needs an exact match would stop matching.
    """
    tokens = sparse.tokenize("Warranty for SKU-4471 on model X200 v1.5")
    assert "sku-4471" in tokens
    assert "x200" in tokens
    assert "v1.5" in tokens


def test_common_words_are_dropped():
    assert "the" not in sparse.tokenize("the warranty of the product")


def test_meaningful_short_words_are_kept():
    # Aggressive stopword removal hurts a support knowledge base.
    assert "not" in sparse.tokenize("does not include installation")


def test_the_same_term_always_maps_to_the_same_coordinate():
    """Python's hash() is salted per process; blake2b is not.

    A salted hash would invalidate every stored sparse vector on restart.
    """
    first = sparse.encode("warranty x200")
    second = sparse.encode("warranty x200")
    assert first.indices == second.indices
    assert first.values == second.values


def test_the_encoding_is_order_independent_in_its_coordinates():
    a = sparse.encode("warranty x200")
    b = sparse.encode("x200 warranty")
    assert set(a.indices) == set(b.indices)


def test_indices_are_sorted():
    # Qdrant expects ascending indices in a sparse vector.
    vector = sparse.encode("the quick brown fox jumped over a lazy dog today")
    assert vector.indices == sorted(vector.indices)


def test_term_frequency_is_sub_linear():
    """A word used forty times is not forty times more relevant."""
    once = sparse.encode("warranty")
    many = sparse.encode(" ".join(["warranty"] * 40))
    assert many.values[0] > once.values[0]
    assert many.values[0] < once.values[0] * 40
    assert math.isclose(many.values[0], 1.0 + math.log(40), rel_tol=1e-9)


def test_a_query_overlaps_the_document_that_contains_its_terms():
    document = sparse.encode(
        "The warranty on the X200 is thirty six months from handover."
    )
    query = sparse.encode("X200 warranty")
    assert set(query.indices) <= set(document.indices)


def test_an_unrelated_query_does_not_overlap():
    document = sparse.encode("Acoustic absorption and diffusion in a cinema.")
    query = sparse.encode("SKU-4471 invoice")
    assert not (set(query.indices) & set(document.indices))


def test_text_with_no_usable_terms_encodes_to_nothing():
    # An all-stopword query has nothing to match lexically. The store skips
    # the round trip rather than asking Qdrant to confirm it.
    assert sparse.encode("the and of a").is_empty
    assert sparse.encode("!!! ???").is_empty


def test_case_is_normalised():
    assert sparse.encode("WARRANTY").indices == sparse.encode("warranty").indices
