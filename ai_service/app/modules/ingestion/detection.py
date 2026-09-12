"""What kind of file this is: what it claims to be, checked against what it is.

A filename is a claim the uploader makes, and so is a Content-Type header.
Neither is evidence. Each claimed format is checked against the file's leading
bytes before any parser sees it, so a renamed executable, an HTML error page
saved as .pdf, or a legacy .doc renamed to .docx fails here — with a message
that says what is wrong — rather than deep inside a parser with one that
does not.

Adding a format is an entry in the two tables below, a parser, and a line in
parsers/__init__.py. Nothing else in the pipeline knows which formats exist.
"""

from __future__ import annotations

import codecs
from pathlib import PurePosixPath

from app.core.exceptions import DocumentRejectedError, ErrorCode

SUPPORTED_FORMATS = ("pdf", "docx", "txt", "md", "csv", "json", "html")
TEXT_FORMATS = frozenset({"txt", "md", "csv", "json", "html"})

_EXTENSIONS: dict[str, str] = {
    ".pdf": "pdf",
    ".docx": "docx",
    ".txt": "txt",
    ".text": "txt",
    ".md": "md",
    ".markdown": "md",
    ".mdown": "md",
    ".csv": "csv",
    ".json": "json",
    ".html": "html",
    ".htm": "html",
    ".xhtml": "html",
}

_MEDIA_TYPES: dict[str, str] = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "text/plain": "txt",
    "text/markdown": "md",
    "text/x-markdown": "md",
    "text/csv": "csv",
    "application/csv": "csv",
    "application/json": "json",
    "text/json": "json",
    "text/html": "html",
    "application/xhtml+xml": "html",
}

# Compound File Binary: .doc, .xls, .ppt — Office before 2007.
_OLE_SIGNATURE = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
_ZIP_SIGNATURE = b"PK\x03\x04"
_SAMPLE_BYTES = 8_192


def format_from_filename(filename: str | None) -> str | None:
    if not filename:
        return None
    suffix = PurePosixPath(filename.replace("\\", "/")).suffix.lower()
    return _EXTENSIONS.get(suffix)


def format_from_media_type(content_type: str | None) -> str | None:
    if not content_type:
        return None
    return _MEDIA_TYPES.get(content_type.split(";", 1)[0].strip().lower())


def sniff(data: bytes) -> str:
    """"pdf", "zip", "ole", "text", "binary" or "empty" — from the bytes alone.

    Text is recognised negatively: no NUL byte, and almost no control
    characters. That accepts every encoding a real text file arrives in
    (UTF-8, Windows-1252, UTF-16 with a BOM) and rejects images, archives and
    executables, which all contain NULs within their first few kilobytes.
    """
    if not data:
        return "empty"
    if b"%PDF-" in data[:1024]:
        return "pdf"
    if data.startswith(_ZIP_SIGNATURE):
        return "zip"
    if data.startswith(_OLE_SIGNATURE):
        return "ole"
    if data.startswith((codecs.BOM_UTF8, codecs.BOM_UTF16_LE, codecs.BOM_UTF16_BE)):
        return "text"

    sample = data[:_SAMPLE_BYTES]
    if b"\x00" in sample:
        return "binary"
    controls = sum(1 for byte in sample if byte < 32 and byte not in (9, 10, 12, 13))
    return "binary" if controls > len(sample) * 0.02 else "text"


def detect_format(data: bytes, *, filename: str | None,
                  content_type: str | None) -> str:
    """The format to parse this file as, or a DocumentRejectedError saying why not.

    The extension is preferred over the media type when both are present:
    browsers and servers are routinely wrong about Content-Type (a Markdown
    file served as text/plain), rarely about a file's own name. Either way
    the claim is then checked against the bytes.
    """
    claimed = format_from_filename(filename) or format_from_media_type(content_type)
    sniffed = sniff(data)

    if sniffed == "empty":
        raise DocumentRejectedError(
            "The file is empty.", code=ErrorCode.NO_EXTRACTABLE_TEXT
        )
    if sniffed == "ole":
        raise DocumentRejectedError(
            "Legacy Office files (.doc, .xls, .ppt) are not supported. Save "
            "the document as .docx or PDF and upload it again.",
            code=ErrorCode.UNSUPPORTED_FILE_TYPE,
        )

    if claimed is None:
        # A URL with no useful extension and no useful Content-Type still
        # identifies itself if it is a PDF.
        if sniffed == "pdf":
            return "pdf"
        raise DocumentRejectedError(
            "This file type is not supported. Supported types: PDF, DOCX, TXT, "
            "Markdown, CSV, JSON and HTML.",
            code=ErrorCode.UNSUPPORTED_FILE_TYPE,
        )

    expected = {"pdf": "pdf", "docx": "zip"}.get(claimed, "text")
    if sniffed != expected:
        raise DocumentRejectedError(
            f"The file's contents do not match its {claimed.upper()} type. It "
            f"may be damaged, or renamed from another format.",
            code=ErrorCode.FILE_TYPE_MISMATCH,
        )
    return claimed


def decode_text(data: bytes, charset: str | None = None) -> tuple[str, str | None]:
    """Bytes to text, plus a warning when the encoding had to be guessed.

    A byte-order mark is authoritative; then a declared charset; then UTF-8.
    Windows-1252 is the last resort because it decodes almost any byte
    sequence — which is exactly why it comes last, and why falling back to it
    is reported rather than done silently.
    """
    for bom, encoding in (
        (codecs.BOM_UTF8, "utf-8-sig"),
        (codecs.BOM_UTF16_LE, "utf-16"),
        (codecs.BOM_UTF16_BE, "utf-16"),
    ):
        if data.startswith(bom):
            return data.decode(encoding, errors="replace"), None

    if charset:
        try:
            return data.decode(charset), None
        except (LookupError, UnicodeDecodeError):
            pass

    try:
        return data.decode("utf-8"), None
    except UnicodeDecodeError:
        return (
            data.decode("cp1252", errors="replace"),
            "The file is not valid UTF-8, so it was read as Windows-1252. "
            "Check accented characters in the extracted text.",
        )
