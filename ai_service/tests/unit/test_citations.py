"""Citations.

The rule under test: sources are built from retrieval, never from the model.
A model that invents "[7]" when four excerpts were supplied must not produce
a footnote, and must never produce a document name.
"""

from __future__ import annotations

from app.modules.rag import citations
from tests.conftest import chunk


def excerpts():
    return [
        chunk("c1", document="d1", name="Product Guide",
              content="Warranty is 36 months.", page=12),
        chunk("c2", document="d2", name="Company FAQ",
              content="Returns within 14 days.", page=4),
        chunk("c3", document="d1", name="Product Guide",
              content="Calibration at 3 months.", page=13),
    ]


def test_only_cited_excerpts_become_sources():
    result = citations.build("The warranty is 36 months [1].", excerpts())

    assert [s.document_name for s in result.sources] == ["Product Guide"]
    assert result.sources[0].citation_number == 1
    assert result.sources[0].chunk_id == "c1"


def test_several_markers_resolve_in_order():
    result = citations.build("Both apply [2] and also [1].", excerpts())
    assert [s.citation_number for s in result.sources] == [1, 2]


def test_a_grouped_marker_is_parsed():
    result = citations.build("Two sources agree [1, 3].", excerpts())
    assert [s.citation_number for s in result.sources] == [1, 3]


def test_adjacent_markers_are_parsed():
    result = citations.build("Stated in both [1][2].", excerpts())
    assert [s.citation_number for s in result.sources] == [1, 2]


def test_a_repeated_marker_yields_one_source():
    result = citations.build("First [1]. Again [1].", excerpts())
    assert len(result.sources) == 1


def test_page_numbers_come_from_the_chunk_not_the_model():
    result = citations.build("Answer [1].", excerpts())
    assert result.sources[0].page == 12


def test_an_invented_marker_is_reported_and_stripped():
    """The hallucination case.

    Rendering [7] would show the reader a footnote pointing at nothing.
    """
    result = citations.build("Claim one [1]. Claim two [7].", excerpts())

    assert result.invalid_markers == [7]
    assert "[7]" not in result.answer
    assert "[1]" in result.answer
    assert [s.citation_number for s in result.sources] == [1]


def test_a_group_keeps_its_valid_members_when_one_is_invalid():
    result = citations.build("Sources [2, 9].", excerpts())
    assert "[2]" in result.answer
    assert "9" not in result.answer
    assert [s.citation_number for s in result.sources] == [2]


def test_stripping_a_marker_does_not_leave_a_space_before_punctuation():
    result = citations.build("A claim [9].", excerpts())
    assert result.answer == "A claim."


def test_an_answer_with_no_markers_still_reports_what_it_was_built_from():
    # Better than showing no provenance for an answer that clearly came from
    # somewhere — but numbered 0, because no mapping was asserted.
    result = citations.build("A general answer with no markers.", excerpts())

    assert len(result.sources) == 3
    assert all(source.citation_number == 0 for source in result.sources)


def test_no_excerpts_means_no_sources():
    result = citations.build("I could not find anything about that.", [])
    assert result.sources == []
    assert result.invalid_markers == []


def test_the_model_cannot_supply_a_document_name():
    """Even if the answer text names a document, the source does not.

    Every field on a Source is copied off a retrieved chunk.
    """
    result = citations.build(
        "According to the Nonexistent Handbook, yes [1].", excerpts()
    )
    assert result.sources[0].document_name == "Product Guide"
    assert result.sources[0].document_id == "d1"


def test_an_excerpt_is_a_verbatim_window_of_the_chunk():
    long_chunk = chunk("c1", content="word " * 200)
    result = citations.build("Answer [1].", [long_chunk])

    excerpt = result.sources[0].excerpt
    assert excerpt.endswith("…")
    assert len(excerpt) <= 245
    assert long_chunk.content.startswith(excerpt.rstrip("…").rstrip())


def test_provisional_sources_are_numbered_by_prompt_position():
    # These are sent before the answer exists, so the number must be the
    # marker the model was told to use.
    sources = citations.provisional_sources(excerpts())
    assert [s.citation_number for s in sources] == [1, 2, 3]
