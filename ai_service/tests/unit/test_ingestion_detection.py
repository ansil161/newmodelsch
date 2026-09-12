"""Format detection: what a file claims, checked against what it is."""

from __future__ import annotations

import pytest

from app.core.exceptions import DocumentRejectedError
from app.modules.ingestion.detection import decode_text, detect_format, sniff

PNG = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"


def test_a_pdf_is_recognised():
    data = b"%PDF-1.7\n1 0 obj"
    assert detect_format(data, filename="a.pdf", content_type=None) == "pdf"


def test_the_extension_wins_over_a_generic_media_type():
    assert detect_format(b"# Title", filename="notes.md",
                         content_type="text/plain") == "md"


def test_the_media_type_is_used_when_the_name_says_nothing():
    assert detect_format(
        b"<html></html>", filename="page", content_type="text/html; charset=utf-8"
    ) == "html"


def test_an_unnamed_pdf_is_still_recognised_by_its_bytes():
    assert detect_format(b"%PDF-1.4\n", filename="", content_type=None) == "pdf"


@pytest.mark.parametrize(
    ("data", "filename", "code"),
    [
        (b"just some text", "fake.pdf", "FILE_TYPE_MISMATCH"),
        (b"%PDF-1.4 binary", "report.docx", "FILE_TYPE_MISMATCH"),
        (PNG, "image.txt", "FILE_TYPE_MISMATCH"),
        (b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1rest", "old.doc", "UNSUPPORTED_FILE_TYPE"),
        (PNG, "photo.png", "UNSUPPORTED_FILE_TYPE"),
        (b"", "empty.txt", "NO_EXTRACTABLE_TEXT"),
    ],
)
def test_files_that_are_not_what_they_claim_are_refused(data, filename, code):
    with pytest.raises(DocumentRejectedError) as caught:
        detect_format(data, filename=filename, content_type=None)

    assert caught.value.code == code
    assert caught.value.retryable is False


def test_legacy_office_files_get_advice_not_just_a_refusal():
    with pytest.raises(DocumentRejectedError) as caught:
        detect_format(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1", filename="x.doc",
                      content_type=None)

    assert ".docx" in caught.value.message


def test_sniffing_separates_text_from_binary():
    assert sniff(b"plain words\nand more\n") == "text"
    assert sniff(bytes(range(32)) * 4) == "binary"
    assert sniff(PNG) == "binary"


def test_windows_1252_is_decoded_with_a_warning():
    text, warning = decode_text("café".encode("cp1252"))

    assert text == "café"
    assert warning


def test_a_byte_order_mark_decides_the_encoding():
    assert decode_text("héllo".encode("utf-16")) == ("héllo", None)


def test_a_declared_charset_is_honoured():
    assert decode_text("naïve".encode("latin-1"), "latin-1") == ("naïve", None)
