"""The ingestion endpoints, through the real routing and dependency graph."""

from __future__ import annotations

import httpx
import pytest
from pydantic import SecretStr

from app.modules.ingestion.url_fetcher import SafeUrlFetcher
from tests.documents import make_docx, make_pdf
from tests.integration.support import build_resources, headers, make_client

EXTRACT = "/api/v1/ingestion/extract"
EXTRACT_URL = "/api/v1/ingestion/extract-url"


@pytest.fixture
def client(settings):
    return make_client(settings, build_resources(settings))


def upload(client, name: str, data: bytes,
           content_type: str = "application/octet-stream", **extra_headers: str):
    return client.post(
        EXTRACT,
        headers={**headers(), **extra_headers},
        files={"file": (name, data, content_type)},
    )


def test_a_markdown_file_comes_back_as_sectioned_chunks(client):
    response = upload(
        client, "guide.md",
        b"# Fees\n\nTuition is paid termly.\n\n# Transport\n\nBuses leave at 7.",
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["format"] == "md"
    assert body["chunkCount"] == 2
    sections = [chunk["metadata"]["section"] for chunk in body["chunks"]]
    assert sections == ["Fees", "Transport"]
    assert [chunk["chunkIndex"] for chunk in body["chunks"]] == [0, 1]
    assert all(len(chunk["contentHash"]) == 64 for chunk in body["chunks"])
    assert body["timings"]["extractionMs"] >= 0


def test_a_pdf_keeps_its_page_numbers(client):
    pdf = make_pdf([["Admissions open in January."], ["Fees are paid termly."]])

    body = upload(client, "guide.pdf", pdf, "application/pdf").json()

    assert body["format"] == "pdf"
    assert body["pageCount"] == 2
    assert body["chunks"][0]["metadata"]["pages"] == [1, 2]


def test_a_word_document_keeps_its_headings(client):
    body = upload(client, "handbook.docx", make_docx()).json()

    assert body["format"] == "docx"
    assert body["title"] == "Staff Handbook"
    headings = {chunk["metadata"]["heading"] for chunk in body["chunks"]}
    assert "Leave policy" in headings


@pytest.mark.parametrize(
    ("name", "data", "code"),
    [
        ("photo.png", b"\x89PNG\r\n\x1a\n\x00\x00", "UNSUPPORTED_FILE_TYPE"),
        ("report.pdf", b"not a pdf at all", "FILE_TYPE_MISMATCH"),
        ("empty.txt", b"", "NO_EXTRACTABLE_TEXT"),
    ],
)
def test_a_refused_file_says_why(client, name, data, code):
    response = upload(client, name, data)

    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == code
    assert error["message"]


def test_an_oversized_file_is_refused(settings):
    settings.ingestion.max_file_bytes = 100
    client = make_client(settings, build_resources(settings))

    response = upload(client, "big.txt", b"a" * 1_000)

    assert response.status_code == 413
    assert response.json()["error"]["code"] == "FILE_TOO_LARGE"


def test_extraction_requires_the_callers_identity(client):
    response = client.post(EXTRACT, files={"file": ("a.txt", b"text", "text/plain")})
    assert response.status_code == 400


def test_extraction_requires_the_service_token_when_one_is_configured(settings):
    settings.security.service_token = SecretStr("the-real-token")
    client = make_client(settings, build_resources(settings))

    assert upload(client, "a.txt", b"text").status_code == 401
    assert upload(client, "a.txt", b"text",
                  Authorization="Bearer the-real-token").status_code == 200


def test_a_url_is_fetched_through_the_safe_fetcher_and_chunked(settings):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, headers={"content-type": "text/html"}, content=(
            b"<html><head><title>Fees</title></head><body><nav>Menu</nav>"
            b"<main><h1>Fees</h1><p>Tuition is paid termly.</p></main></body></html>"
        ))

    async def resolver(host: str, port: int) -> list[str]:
        return ["93.184.216.34"]

    fetcher = SafeUrlFetcher(settings.url_fetch, resolver=resolver,
                             transport=httpx.MockTransport(handler))
    client = make_client(settings, build_resources(settings, fetcher=fetcher))

    response = client.post(EXTRACT_URL, headers=headers(),
                           json={"url": "https://school.example/fees"})

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["sourceUrl"] == "https://school.example/fees"
    assert body["title"] == "Fees"
    assert body["format"] == "html"
    assert "Menu" not in body["chunks"][0]["content"]


def test_a_url_into_the_internal_network_is_refused(client):
    response = client.post(EXTRACT_URL, headers=headers(),
                           json={"url": "http://169.254.169.254/latest/meta-data/"})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "URL_BLOCKED"
