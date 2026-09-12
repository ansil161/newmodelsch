"""Support levels, decided from evidence rather than from the model's say-so."""

from __future__ import annotations

from app.modules.rag.grounding import SupportLevel, assess
from app.modules.rag.prompts import INSUFFICIENT_CONTEXT_SENTENCE


def test_no_retrieved_context_is_insufficient_whatever_the_answer_says():
    assert assess("It is thirty six months [1].", grounded=False, cited=[1]) \
        is SupportLevel.INSUFFICIENT_CONTEXT


def test_an_answer_that_cites_its_claims_is_supported():
    answer = ("The warranty lasts thirty six months [1]. "
              "Claims are raised with the project lead [2].")

    assert assess(answer, grounded=True, cited=[1, 2]) is SupportLevel.SUPPORTED


def test_a_marker_placed_after_the_full_stop_still_counts():
    answer = ("The warranty lasts thirty six months. [1] "
              "Claims are raised with the project lead. [2]")

    assert assess(answer, grounded=True, cited=[1, 2]) is SupportLevel.SUPPORTED


def test_the_instructed_refusal_is_insufficient():
    answer = f"{INSUFFICIENT_CONTEXT_SENTENCE} The excerpts cover fees, not transport."

    assert assess(answer, grounded=True, cited=[]) is SupportLevel.INSUFFICIENT_CONTEXT


def test_an_answer_naming_a_gap_is_partial():
    answer = ("Fees are paid termly [1]. The knowledge base does not contain enough "
              "information about transport.")

    assert assess(answer, grounded=True, cited=[1]) is SupportLevel.PARTIALLY_SUPPORTED


def test_uncited_claims_make_an_answer_partial():
    answer = ("Fees are paid termly and in advance [1]. Buses leave every morning "
              "at seven. Lunch is served at noon every day.")

    assert assess(answer, grounded=True, cited=[1]) is SupportLevel.PARTIALLY_SUPPORTED


def test_an_answer_citing_nothing_is_not_supported():
    assert assess("Fees are paid termly and always in advance.", grounded=True,
                  cited=[]) is SupportLevel.PARTIALLY_SUPPORTED


def test_admitted_general_knowledge_is_partial():
    answer = ("Fees are paid termly [1]. From general knowledge, most schools "
              "also charge an annual fee.")

    assert assess(answer, grounded=True, cited=[1]) is SupportLevel.PARTIALLY_SUPPORTED
