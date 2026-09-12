"""
Checks an upload or a link must pass before anything is stored or queued.

These are the cheap checks, run in the request so the administrator hears
about a wrong file type immediately rather than a minute later from the
worker. The AI service validates again, more deeply — a parser is the only
thing that can tell a damaged PDF from a good one, and its SSRF-safe fetcher
is the only thing that can tell where a hostname really resolves. Neither
layer trusts the other to have done its job.
"""

import hashlib
import ipaddress
import re
from pathlib import PurePosixPath
from urllib.parse import urlsplit

from django.conf import settings
from django.utils.text import get_valid_filename

from .exceptions import UploadRejected

LABELS = {"pdf": "PDF", "docx": "DOCX", "txt": "TXT", "md": "Markdown", "csv": "CSV", "json": "JSON", "html": "HTML"}
_ALIASES = {"markdown": "md", "htm": "html", "text": "txt"}
_ZIP = b"PK\x03\x04"
_OLE = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
_UTF16_BOMS = (b"\xff\xfe", b"\xfe\xff")

_LANGUAGE = re.compile(r"^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$")
_BLOCKED_HOSTS = {"localhost", "metadata", "metadata.google.internal"}
_BLOCKED_SUFFIXES = (".localhost", ".local", ".internal", ".lan", ".home.arpa")


def upload_format(filename):
    suffix = PurePosixPath(filename or "").suffix.lower().lstrip(".")
    return _ALIASES.get(suffix, suffix)


def display_filename(filename):
    """A filename safe to show and to store as a label. Never used as a path."""
    name = PurePosixPath((filename or "").replace("\\", "/")).name
    return (get_valid_filename(name) if name else "document")[:200]


def validate_upload(uploaded):
    """The upload's format, or UploadRejected saying what is wrong with it."""
    config = settings.KNOWLEDGE_BASE
    allowed = [upload_format(f"x.{extension}") for extension in config["ALLOWED_EXTENSIONS"]]
    file_format = upload_format(uploaded.name)

    if file_format not in allowed:
        supported = ", ".join(LABELS.get(item, item.upper()) for item in allowed)
        raise UploadRejected(f"This file type is not supported. Supported types: {supported}.",
                             code="unsupported_file_type")
    if uploaded.size == 0:
        raise UploadRejected("The file is empty.", code="empty_file")
    if uploaded.size > config["MAX_UPLOAD_BYTES"]:
        raise UploadRejected(
            f"The file is larger than the {config['MAX_UPLOAD_BYTES'] // (1024 * 1024)} MB limit.",
            code="file_too_large",
        )

    uploaded.seek(0)
    head = uploaded.read(8192)
    uploaded.seek(0)
    if head.startswith(_OLE):
        raise UploadRejected(
            "Legacy Office files (.doc, .xls, .ppt) are not supported. Save the document as "
            ".docx or PDF and upload it again.",
            code="unsupported_file_type",
        )
    if not _content_matches(file_format, head):
        raise UploadRejected(
            f"The file's contents do not match its {LABELS.get(file_format, file_format)} type. "
            "It may be damaged, or renamed from another format.",
            code="file_type_mismatch",
        )
    return file_format


def _content_matches(file_format, head):
    if file_format == "pdf":
        return b"%PDF-" in head[:1024]
    if file_format == "docx":
        return head.startswith(_ZIP)
    # Text formats: no NUL byte, unless the file declares UTF-16.
    return head.startswith(_UTF16_BOMS) or b"\x00" not in head


def checksum(uploaded):
    digest = hashlib.sha256()
    uploaded.seek(0)
    for chunk in uploaded.chunks():
        digest.update(chunk)
    uploaded.seek(0)
    return digest.hexdigest()


def validate_language(value):
    value = (value or "").strip()
    if value and not _LANGUAGE.match(value):
        raise UploadRejected("Use a language code such as en, hi or te.", code="invalid_language")
    return value.lower() if value else ""


def clean_tags(value):
    """Tags from a list or a comma-separated string: trimmed, lower-cased, de-duplicated."""
    if isinstance(value, str):
        value = value.split(",")
    tags = []
    for tag in value or ():
        tag = " ".join(str(tag).split()).lower()[:50]
        if tag and tag not in tags:
            tags.append(tag)
    if len(tags) > 20:
        raise UploadRejected("A document can have at most 20 tags.", code="too_many_tags")
    return tags


def validate_source_url(url):
    """
    The first gate for a link: scheme, credentials, obviously internal hosts.

    Deliberately shallow — it does not resolve DNS. Resolution here would be
    a check at one moment by one resolver, and the fetch happens later from
    another process. The AI service resolves, pins and re-checks at fetch
    time, which is the only place that check means anything.
    """
    url = (url or "").strip()
    if not url or len(url) > 2048:
        raise UploadRejected("Enter a valid web address.", code="invalid_url")
    parts = urlsplit(url)
    if parts.scheme.lower() not in ("http", "https"):
        raise UploadRejected("Only http:// and https:// links can be added.", code="invalid_url")
    if parts.username or parts.password:
        raise UploadRejected("Links that contain a username or password cannot be added.", code="invalid_url")
    host = (parts.hostname or "").rstrip(".").lower()
    if not host:
        raise UploadRejected("Enter a valid web address.", code="invalid_url")
    if host in _BLOCKED_HOSTS or host.endswith(_BLOCKED_SUFFIXES) or _is_private_literal(host):
        raise UploadRejected(
            "That address cannot be added: it points to a private or internal network.", code="blocked_url"
        )
    return url


def _is_private_literal(host):
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        return False
    if address.version == 6 and address.ipv4_mapped:
        address = address.ipv4_mapped
    return not address.is_global
