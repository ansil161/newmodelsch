"""Every parser, against real files of its format."""

from __future__ import annotations

import io
import zipfile

import pytest

from app.core.config import IngestionSettings
from app.core.exceptions import DocumentRejectedError
from app.modules.ingestion.models import BlockKind, ParsedDocument
from app.modules.ingestion.parsers import parser_for
from tests.documents import make_docx, make_pdf, rewrite_pdf

SETTINGS = IngestionSettings()


def parse(format_name: str, data: bytes, filename: str = "file",
          settings: IngestionSettings = SETTINGS) -> ParsedDocument:
    return parser_for(format_name, settings).parse(data, filename=filename)


def summary(document: ParsedDocument) -> list[tuple[BlockKind, str]]:
    return [(block.kind, block.text) for block in document.blocks]


# -- Markdown ---------------------------------------------------------------

MARKDOWN = b"""---
title: Parent Handbook
---
# Admissions

Applications open in **January**. See [the form](https://example.com/form).

## Fees

| Term | Amount |
|------|--------|
| First | 12,000 |

- Pay online
- Or at the office

```
code block stays
```
Setext Heading
--------------
Body under setext.
"""


def test_markdown_structure_is_read_faithfully():
    document = parse("md", MARKDOWN, "handbook.md")
    blocks = summary(document)

    assert document.title == "Parent Handbook"
    assert (BlockKind.HEADING, "Admissions") in blocks
    assert any(block.text == "Fees" and block.level == 2 for block in document.blocks)
    assert (BlockKind.PARAGRAPH,
            "Applications open in January. See the form.") in blocks
    assert (BlockKind.TABLE, "Term | Amount\nFirst | 12,000") in blocks
    assert (BlockKind.LIST_ITEM, "Pay online") in blocks
    assert (BlockKind.CODE, "code block stays") in blocks
    assert any(block.text == "Setext Heading" and block.level == 2
               for block in document.blocks)


# -- Plain text --------------------------------------------------------------

def test_plain_text_headings_are_recognised():
    document = parse(
        "txt",
        b"SCHOOL TIMINGS\n\nClasses start at 8.\n\n"
        b"Transport\n=========\nBuses leave at 7.",
        "notes.txt",
    )

    assert summary(document)[:2] == [
        (BlockKind.HEADING, "SCHOOL TIMINGS"),
        (BlockKind.PARAGRAPH, "Classes start at 8."),
    ]
    assert (BlockKind.HEADING, "Transport") in summary(document)
    assert document.blocks[-1].text == "Buses leave at 7."


# -- CSV and JSON -------------------------------------------------------------

def test_csv_rows_become_self_describing_records():
    document = parse(
        "csv",
        b"Class,Subject,Teacher\nGrade 6,Science,Mrs Rao\nGrade 7,Maths,Mr Khan\n",
        "staff.csv",
    )

    assert summary(document) == [
        (BlockKind.TABLE, "Class: Grade 6; Subject: Science; Teacher: Mrs Rao"),
        (BlockKind.TABLE, "Class: Grade 7; Subject: Maths; Teacher: Mr Khan"),
    ]


def test_a_csv_without_a_header_gets_column_labels():
    document = parse("csv", b"1,Rao\n2,Khan\n", "numbers.csv")

    assert document.blocks[0].text == "Column 1: 1; Column 2: Rao"


def test_csv_row_limit_is_enforced():
    rows = "Name\n" + "\n".join(f"Person {index}" for index in range(10))

    with pytest.raises(DocumentRejectedError) as caught:
        parse("csv", rows.encode(), "big.csv", IngestionSettings(max_table_rows=3))

    assert caught.value.code == "DOCUMENT_TOO_LARGE"


def test_json_records_are_flattened_to_readable_paths():
    document = parse(
        "json",
        b'[{"name": "Bus 4", "route": {"start": "Charminar", "stops": ["A", "B"]}}]',
        "routes.json",
    )

    assert document.blocks[0].text == (
        "name: Bus 4\nroute.start: Charminar\nroute.stops: A, B"
    )


def test_json_top_level_objects_become_sections():
    document = parse("json", b'{"school": "NMHS", "fees": {"term1": 12000}}', "x.json")

    assert summary(document) == [
        (BlockKind.TABLE, "school: NMHS"),
        (BlockKind.HEADING, "fees"),
        (BlockKind.TABLE, "term1: 12000"),
    ]


def test_invalid_json_is_refused():
    with pytest.raises(DocumentRejectedError) as caught:
        parse("json", b"{not json", "broken.json")

    assert caught.value.code == "DOCUMENT_CORRUPT"


# -- HTML ---------------------------------------------------------------------

PAGE = b"""<!doctype html><html lang="en-GB"><head>
<title>Fees | NMHS</title><meta property="og:title" content="School Fees">
<style>p { color: red }</style><script>var leak = "script text";</script></head>
<body>
<header class="site-header"><a href="/">Home</a> <a href="/about">About</a></header>
<nav><ul><li><a href="/a">Menu A</a></li><li><a href="/b">Menu B</a></li></ul></nav>
<main>
  <h1>School fees</h1>
  <p>Tuition is <strong>12,000</strong> per term.</p>
  <div class="cookie-banner">We use cookies.</div>
  <h2>Payment</h2>
  <ul><li>Online through the portal</li><li><a href="/x">Read more</a></li></ul>
  <table><tr><th>Term</th><th>Due</th></tr><tr><td>First</td><td>June</td></tr></table>
  <p hidden>Hidden text</p>
</main>
<footer>Copyright 2026</footer>
</body></html>"""


def test_html_keeps_the_content_and_leaves_the_furniture():
    document = parse("html", PAGE, "page.html")
    texts = [block.text for block in document.blocks]

    assert document.title == "School Fees"
    assert document.metadata["language"] == "en"
    assert (BlockKind.HEADING, "School fees") in summary(document)
    assert "Tuition is 12,000 per term." in texts
    assert "Online through the portal" in texts
    assert "Term | Due\nFirst | June" in texts
    for furniture in ("Menu A", "Home", "We use cookies.", "Copyright 2026",
                      "Hidden text", "script text", "Read more"):
        assert not any(furniture in text for text in texts), furniture


def test_a_page_without_main_falls_back_to_the_body_without_its_navigation():
    page = (b"<html><body><nav><a href='/'>Home</a></nav><div class='content'>"
            b"<h2>Visiting hours</h2><p>The office is open from nine to four.</p>"
            b"</div><footer>Footer text</footer></body></html>")

    texts = [block.text for block in parse("html", page, "p.html").blocks]

    assert texts == ["Visiting hours", "The office is open from nine to four."]


# -- DOCX ---------------------------------------------------------------------

def test_docx_headings_lists_and_tables_arrive_in_document_order():
    document = parse("docx", make_docx(), "handbook.docx")

    assert document.title == "Staff Handbook"
    assert [(block.kind, block.text, block.level) for block in document.blocks] == [
        (BlockKind.HEADING, "Leave policy", 1),
        (BlockKind.PARAGRAPH,
         "Teachers may take twelve days of casual leave a year.", 0),
        (BlockKind.HEADING, "Applying", 2),
        (BlockKind.LIST_ITEM, "Submit the form to the office", 0),
        (BlockKind.TABLE, "Type | Days\nCasual | 12", 0),
    ]


def test_an_excel_workbook_renamed_docx_is_refused_by_name():
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("xl/workbook.xml", "<workbook/>")

    with pytest.raises(DocumentRejectedError) as caught:
        parse("docx", buffer.getvalue(), "sheet.docx")

    assert caught.value.code == "FILE_TYPE_MISMATCH"
    assert "Excel" in caught.value.message


def test_a_zip_bomb_is_refused_before_it_is_opened():
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("word/document.xml", "<w:document/>")
        archive.writestr("word/padding.xml", b"0" * 5_000_000)

    with pytest.raises(DocumentRejectedError) as caught:
        parse("docx", buffer.getvalue(), "bomb.docx")

    assert caught.value.code == "DOCUMENT_REJECTED"


# -- PDF ----------------------------------------------------------------------

def test_pdf_text_keeps_its_page_numbers():
    data = make_pdf([["Admissions guide", "Applications open in January."],
                     ["Fees are paid termly."]])

    document = parse("pdf", data, "guide.pdf")

    assert document.page_count == 2
    assert {block.page for block in document.blocks} == {1, 2}
    assert "Fees are paid termly." in " ".join(
        block.text for block in document.blocks if block.page == 2
    )


def test_pdf_outline_entries_become_sections_on_their_pages():
    data = rewrite_pdf(
        make_pdf([["Welcome to the school."], ["Tuition is paid termly."]]),
        outline=[("Introduction", 0), ("Fees", 1)],
    )

    document = parse("pdf", data, "guide.pdf")

    assert any(block.kind is BlockKind.HEADING and block.text == "Fees"
               and block.page == 2 for block in document.blocks)


def test_numbered_headings_are_detected_but_numbered_steps_are_not():
    data = make_pdf([["2.1 Resetting a password",
                      "Open Settings and choose Security.",
                      "1. Open the app"]])

    headings = [block.text for block in parse("pdf", data, "manual.pdf").blocks
                if block.kind is BlockKind.HEADING]

    assert headings == ["2.1 Resetting a password"]


def test_a_password_protected_pdf_is_refused_with_advice():
    data = rewrite_pdf(make_pdf([["Secret"]]), user_password="letmein")

    with pytest.raises(DocumentRejectedError) as caught:
        parse("pdf", data, "locked.pdf")

    assert caught.value.code == "DOCUMENT_ENCRYPTED"
    assert "password" in caught.value.message.lower()


def test_a_pdf_restricted_only_by_an_owner_password_is_read():
    data = rewrite_pdf(make_pdf([["Readable despite restrictions."]]),
                       user_password="")

    texts = " ".join(block.text for block in parse("pdf", data, "r.pdf").blocks)

    assert "Readable despite restrictions." in texts


def test_a_pdf_with_no_text_layer_is_refused_with_advice():
    with pytest.raises(DocumentRejectedError) as caught:
        parse("pdf", make_pdf([[]]), "scan.pdf")

    assert caught.value.code == "NO_EXTRACTABLE_TEXT"
    assert "OCR" in caught.value.message


def test_the_page_limit_is_enforced():
    with pytest.raises(DocumentRejectedError) as caught:
        parse("pdf", make_pdf([["one"], ["two"]]), "long.pdf",
              IngestionSettings(max_pages=1))

    assert caught.value.code == "DOCUMENT_TOO_LARGE"


def test_a_damaged_pdf_is_refused_rather_than_crashing():
    with pytest.raises(DocumentRejectedError):
        parse("pdf", b"%PDF-1.4\nthis is not really a pdf", "broken.pdf")
