"""Structure-aware chunking.

The properties that decide answer quality long before retrieval runs: a chunk
never spans two sections, never exceeds what the embedding model can see,
carries its page and heading, and overlaps its neighbour just enough that a
fact on a boundary is retrievable from either side.
"""

from __future__ import annotations

from itertools import pairwise

import pytest

from app.core.config import IngestionSettings
from app.core.exceptions import DocumentRejectedError
from app.modules.ingestion.chunking import SECTION_SEPARATOR, Chunker, split_sentences
from app.modules.ingestion.models import Block, BlockKind, ParsedDocument

SENTENCE = "The admissions office reviews every application within ten working days."


def chunker(**overrides: object) -> Chunker:
    values: dict[str, object] = {
        "target_tokens": 60, "max_tokens": 90, "overlap_tokens": 12,
        "min_tokens": 8, "max_chunks": 500, "include_section_path": True,
    }
    values.update(overrides)
    return Chunker(**values)  # type: ignore[arg-type]


def document(*blocks: Block) -> ParsedDocument:
    return ParsedDocument(format="md", parser="test", blocks=list(blocks))


def heading(text: str, level: int = 1) -> Block:
    return Block(BlockKind.HEADING, text, level=level)


def para(text: str, page: int | None = None) -> Block:
    return Block(BlockKind.PARAGRAPH, text, page=page)


def test_a_heading_starts_a_section_and_no_chunk_crosses_it():
    chunks = chunker().chunk(document(
        heading("Fees"), para("Tuition is paid termly."),
        heading("Transport"), para("Buses leave at half past seven."),
    ))

    assert [chunk.section for chunk in chunks] == ["Fees", "Transport"]
    assert "Buses" not in chunks[0].content
    assert "Tuition" not in chunks[1].content


def test_nested_headings_build_a_path_and_a_sibling_replaces_its_predecessor():
    chunks = chunker().chunk(document(
        heading("Admissions", 1), heading("Fees", 2), para("Tuition is paid termly."),
        heading("Deadlines", 2), para("Apply by March."),
        heading("Transport", 1), para("Buses leave early."),
    ))

    assert [chunk.section for chunk in chunks] == [
        f"Admissions{SECTION_SEPARATOR}Fees",
        f"Admissions{SECTION_SEPARATOR}Deadlines",
        "Transport",
    ]
    assert chunks[1].heading == "Deadlines"


def test_the_section_path_opens_the_chunk_so_it_is_embedded_with_its_context():
    blocks = (heading("Fees"), para("Tuition is paid termly."))

    assert chunker().chunk(document(*blocks))[0].content == (
        "Fees\n\nTuition is paid termly."
    )
    assert chunker(include_section_path=False).chunk(document(*blocks))[0].content == (
        "Tuition is paid termly."
    )


def test_no_chunk_exceeds_the_maximum_even_for_one_enormous_paragraph():
    long_paragraph = para(" ".join([SENTENCE] * 40))
    chunks = chunker().chunk(document(heading("Policy"), long_paragraph))

    assert len(chunks) > 1
    assert all(chunk.token_count <= 90 for chunk in chunks)


def test_the_default_settings_keep_every_chunk_inside_the_embedding_window():
    settings = IngestionSettings()
    long_document = document(*(
        block
        for section in range(5)
        for block in (heading(f"Section {section}"), para(" ".join([SENTENCE] * 60)))
    ))

    chunks = Chunker.from_settings(settings).chunk(long_document)

    assert all(chunk.token_count <= settings.chunk_max_tokens for chunk in chunks)


def test_consecutive_chunks_overlap_by_a_sentence():
    sentences = [f"Fact number {index} is stated here plainly." for index in range(40)]
    chunks = chunker(include_section_path=False, overlap_tokens=16).chunk(
        document(para(" ".join(sentences)))
    )

    assert len(chunks) > 2
    for earlier, later in pairwise(chunks):
        assert later.content.startswith(split_sentences(earlier.content)[-1])


def test_pages_travel_with_the_chunk():
    chunks = chunker(include_section_path=False).chunk(document(
        para("Page one text.", page=1), para("Page two text.", page=2),
    ))

    assert chunks[0].pages == (1, 2)
    assert chunks[0].page == 1


def test_a_long_table_is_split_between_rows_never_inside_one():
    rows = "\n".join(
        f"Class: {index}; Teacher: Teacher {index}; Room: {100 + index}"
        for index in range(60)
    )
    chunks = chunker(include_section_path=False).chunk(
        document(Block(BlockKind.TABLE, rows))
    )

    assert len(chunks) > 1
    for chunk in chunks:
        for line in chunk.content.splitlines():
            if line.strip():
                assert line.startswith("Class: ")


def test_a_small_tail_is_folded_into_the_chunk_before_it():
    chunks = chunker(include_section_path=False).chunk(document(
        para(" ".join([SENTENCE] * 3)),
        para(" ".join([SENTENCE] * 4)),
        para("Short end."),
    ))

    assert len(chunks) == 2
    assert chunks[-1].content.endswith("Short end.")


def test_a_single_unbroken_string_is_split_without_losing_characters():
    chunks = chunker(include_section_path=False).chunk(document(para("x" * 2_000)))

    assert all(chunk.token_count <= 90 for chunk in chunks)
    assert "".join(chunk.content for chunk in chunks) == "x" * 2_000


def test_a_document_producing_too_many_chunks_is_refused():
    with pytest.raises(DocumentRejectedError) as caught:
        chunker(max_chunks=2).chunk(document(
            *(para(" ".join([SENTENCE] * 4)) for _ in range(5))
        ))

    assert caught.value.code == "DOCUMENT_TOO_LARGE"


def test_identical_content_hashes_identically():
    blocks = (heading("Fees"), para("Tuition is paid termly."))

    first = chunker().chunk(document(*blocks))[0]
    second = chunker().chunk(document(*blocks))[0]

    assert first.content_hash == second.content_hash
    assert len(first.content_hash) == 64


def test_sentence_splitting_keeps_closing_quotes_with_their_sentence():
    assert split_sentences('He said "Stop." Then he left.') == [
        'He said "Stop."', "Then he left.",
    ]
