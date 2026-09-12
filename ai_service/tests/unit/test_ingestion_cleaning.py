"""Cleaning extracted text: the debris that costs retrieval quality."""

from __future__ import annotations

from app.modules.ingestion.cleaning import (
    clean_document,
    normalize,
    reflow,
    strip_page_furniture,
)
from app.modules.ingestion.models import Block, BlockKind, ParsedDocument


def test_ligatures_and_invisible_characters_are_removed():
    assert normalize("ﬁle​name­") == "filename"


def test_superscripts_are_kept_rather_than_folded_into_digits():
    # NFKC would turn this into "106 students" — a different number.
    assert normalize("10⁶ students") == "10⁶ students"


def test_whitespace_collapses_but_paragraph_breaks_survive():
    assert normalize("a  \t b\r\n\r\n\r\n\r\nc") == "a b\n\nc"


def test_reflow_joins_lines_broken_for_layout():
    assert reflow("The warranty\ncovers seating.") == [
        (BlockKind.PARAGRAPH, "The warranty covers seating."),
    ]


def test_reflow_keeps_bullets_as_separate_items():
    assert reflow("Bring:\n• a pen\n• a notebook") == [
        (BlockKind.PARAGRAPH, "Bring:"),
        (BlockKind.LIST_ITEM, "• a pen"),
        (BlockKind.LIST_ITEM, "• a notebook"),
    ]


def test_hyphenation_across_a_line_break_is_undone_only_when_asked():
    assert reflow("authen-\ntication", dehyphenate=True) == [
        (BlockKind.PARAGRAPH, "authentication"),
    ]
    assert reflow("authen-\ntication") == [(BlockKind.PARAGRAPH, "authen- tication")]


def test_a_real_hyphen_before_a_capital_is_not_joined():
    assert "Hyderabad-" in reflow("Hyderabad-\nBased", dehyphenate=True)[0][1]


def test_running_headers_footers_and_page_numbers_are_removed():
    pages = [
        f"ACME Handbook\nContent of page {n}.\nMore text {n}.\nPage {n} of 5"
        for n in range(1, 6)
    ]

    cleaned = strip_page_furniture(pages)

    assert all("ACME Handbook" not in page and "of 5" not in page for page in cleaned)
    assert "Content of page 3." in cleaned[2]


def test_a_line_repeated_in_the_body_of_every_page_is_kept():
    pages = [
        f"Title {n}\nIntro {n}\nContact the office.\nDetail {n}\nEnd {n}"
        for n in range(1, 6)
    ]

    assert all("Contact the office." in page for page in strip_page_furniture(pages))


def test_empty_blocks_and_consecutive_duplicates_are_dropped():
    document = ParsedDocument("md", "test", [
        Block(BlockKind.HEADING, "Fees", level=1),
        Block(BlockKind.HEADING, "Fees", level=1),
        Block(BlockKind.PARAGRAPH, "   "),
        Block(BlockKind.PARAGRAPH, "Paid termly."),
    ])

    assert [block.text for block in clean_document(document).blocks] == [
        "Fees", "Paid termly.",
    ]
