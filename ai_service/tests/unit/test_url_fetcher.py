"""SSRF protection for URL ingestion.

Every way a URL can be made to point inside the network is attempted here,
and each must be refused before a request is made to it. DNS and HTTP are
doubles, so the tests prove what the fetcher does with an answer — including
answers a hostile resolver or server would give.
"""

from __future__ import annotations

from collections.abc import AsyncIterator, Callable

import httpx
import pytest

from app.core.config import UrlFetchSettings
from app.core.exceptions import UrlRejectedError
from app.modules.ingestion.url_fetcher import SafeUrlFetcher, is_public_address

PUBLIC = "93.184.216.34"


def fetcher(handler: Callable[[httpx.Request], httpx.Response],
            *, resolve: Callable[[str], list[str]] | None = None,
            **settings: object) -> SafeUrlFetcher:
    async def resolver(host: str, port: int) -> list[str]:
        return resolve(host) if resolve else [PUBLIC]

    return SafeUrlFetcher(
        UrlFetchSettings(**settings),  # type: ignore[arg-type]
        resolver=resolver,
        transport=httpx.MockTransport(handler),
    )


def page(body: str = "<p>Hello</p>", status: int = 200,
         **headers: str) -> httpx.Response:
    return httpx.Response(
        status, content=body.encode(),
        headers={"content-type": "text/html; charset=utf-8", **headers},
    )


# -- address classification ------------------------------------------------

@pytest.mark.parametrize(
    ("address", "public"),
    [
        ("8.8.8.8", True),
        ("2606:4700:4700::1111", True),
        ("::ffff:8.8.8.8", True),
        ("127.0.0.1", False),
        ("10.1.2.3", False),
        ("172.16.0.1", False),
        ("192.168.1.10", False),
        ("169.254.169.254", False),   # cloud metadata
        ("100.64.0.1", False),        # carrier-grade NAT
        ("0.0.0.0", False),  # noqa: S104 — an address under test, not a bind
        ("224.0.0.1", False),
        ("::1", False),
        ("fd00:ec2::254", False),     # AWS metadata over IPv6
        ("fe80::1", False),
        ("::ffff:127.0.0.1", False),  # IPv4-mapped loopback
        ("64:ff9b::7f00:1", False),   # NAT64 of loopback
        ("2002:7f00:1::", False),     # 6to4 of loopback
        ("not-an-address", False),
    ],
)
def test_addresses_are_classified(address, public):
    assert is_public_address(address) is public


# -- validation, before any I/O ----------------------------------------------

@pytest.mark.parametrize(
    ("url", "code"),
    [
        ("ftp://example.com/file", "URL_INVALID"),
        ("file:///etc/passwd", "URL_INVALID"),
        ("https://user:pass@example.com/", "URL_INVALID"),
        ("not a url", "URL_INVALID"),
        ("https://example.com:6333/collections", "URL_BLOCKED"),
        ("http://localhost/", "URL_BLOCKED"),
        ("http://intranet.internal/", "URL_BLOCKED"),
        ("http://metadata.google.internal/computeMetadata/v1/", "URL_BLOCKED"),
        ("http://169.254.169.254/latest/meta-data/", "URL_BLOCKED"),
        ("http://[::1]/", "URL_BLOCKED"),
        ("http://10.0.0.5/", "URL_BLOCKED"),
    ],
)
def test_urls_are_refused_before_any_request(url, code):
    with pytest.raises(UrlRejectedError) as caught:
        SafeUrlFetcher(UrlFetchSettings()).validate(url)

    assert caught.value.code == code


# -- fetching ---------------------------------------------------------------

async def test_the_request_goes_to_the_vetted_address_under_the_real_name():
    seen: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["address"] = request.url.host
        seen["host_header"] = request.headers["host"]
        seen["sni"] = request.extensions.get("sni_hostname")
        return page()

    resource = await fetcher(handler).fetch("https://docs.example.com/guide")

    assert seen == {"address": PUBLIC, "host_header": "docs.example.com",
                    "sni": "docs.example.com"}
    assert resource.url == "https://docs.example.com/guide"
    assert resource.content_type == "text/html"
    assert resource.charset == "utf-8"


async def test_a_name_resolving_to_a_private_address_is_refused_unrequested():
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return page()

    with pytest.raises(UrlRejectedError) as caught:
        await fetcher(handler, resolve=lambda _: ["10.0.0.7"]).fetch(
            "https://intranet.example.com/"
        )

    assert caught.value.code == "URL_BLOCKED"
    assert requests == []


async def test_one_private_answer_among_public_ones_fails_the_name():
    with pytest.raises(UrlRejectedError) as caught:
        await fetcher(lambda _: page(), resolve=lambda _: [PUBLIC, "127.0.0.1"]).fetch(
            "https://mixed.example.com/"
        )

    assert caught.value.code == "URL_BLOCKED"


async def test_a_redirect_to_a_private_address_is_refused():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(302, headers={"location": "http://127.0.0.1/admin"})

    with pytest.raises(UrlRejectedError) as caught:
        await fetcher(handler).fetch("https://example.com/start")

    assert caught.value.code == "URL_BLOCKED"


async def test_a_redirect_to_a_name_that_resolves_privately_is_refused():
    def resolve(host: str) -> list[str]:
        return ["10.0.0.9"] if host == "internal.example.com" else [PUBLIC]

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(302, headers={"location": "https://internal.example.com/"})

    with pytest.raises(UrlRejectedError) as caught:
        await fetcher(handler, resolve=resolve).fetch("https://example.com/start")

    assert caught.value.code == "URL_BLOCKED"


async def test_safe_redirects_are_followed():
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/old":
            return httpx.Response(301, headers={"location": "/new"})
        return page()

    resource = await fetcher(handler).fetch("https://example.com/old")

    assert resource.url == "https://example.com/new"
    assert resource.redirects == 1


async def test_a_redirect_loop_stops():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(302, headers={"location": "/again"})

    with pytest.raises(UrlRejectedError) as caught:
        await fetcher(handler, max_redirects=3).fetch("https://example.com/again")

    assert caught.value.code == "URL_FETCH_FAILED"


async def test_content_that_cannot_be_a_document_is_refused_unread():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=b"\x89PNG",
                              headers={"content-type": "image/png"})

    with pytest.raises(UrlRejectedError) as caught:
        await fetcher(handler).fetch("https://example.com/photo")

    assert caught.value.code == "URL_CONTENT_UNSUPPORTED"


async def test_a_declared_oversized_body_is_refused():
    def handler(request: httpx.Request) -> httpx.Response:
        return page("x" * 5_000)

    with pytest.raises(UrlRejectedError) as caught:
        await fetcher(handler, max_bytes=1_000).fetch("https://example.com/big")

    assert caught.value.code == "URL_TOO_LARGE"


async def test_an_undeclared_oversized_body_is_cut_off_at_the_limit():
    async def body() -> AsyncIterator[bytes]:
        for _ in range(50):
            yield b"a" * 1_000

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=body(),
                              headers={"content-type": "text/plain"})

    with pytest.raises(UrlRejectedError) as caught:
        await fetcher(handler, max_bytes=2_000).fetch("https://example.com/stream")

    assert caught.value.code == "URL_TOO_LARGE"


@pytest.mark.parametrize(
    ("status", "retryable"), [(503, True), (429, True), (404, False)]
)
async def test_server_errors_are_retryable_and_client_errors_are_not(status, retryable):
    with pytest.raises(UrlRejectedError) as caught:
        await fetcher(lambda _: page(status=status)).fetch("https://example.com/")

    assert caught.value.code == "URL_FETCH_FAILED"
    assert caught.value.retryable is retryable


async def test_a_connection_failure_is_reported_as_unreachable():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("refused", request=request)

    with pytest.raises(UrlRejectedError) as caught:
        await fetcher(handler).fetch("https://example.com/")

    assert caught.value.code == "URL_UNREACHABLE"
    assert caught.value.retryable is True


async def test_a_slow_server_times_out():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("slow", request=request)

    with pytest.raises(UrlRejectedError) as caught:
        await fetcher(handler).fetch("https://example.com/")

    assert caught.value.code == "URL_TIMEOUT"


async def test_a_name_that_does_not_resolve_is_unreachable():
    def resolve(host: str) -> list[str]:
        raise OSError("Name or service not known")

    with pytest.raises(UrlRejectedError) as caught:
        await fetcher(lambda _: page(), resolve=resolve).fetch("https://nope.example/")

    assert caught.value.code == "URL_UNREACHABLE"


def test_private_networks_cannot_be_allowed_in_production():
    from app.core.config import Settings

    with pytest.raises(ValueError, match="ALLOW_PRIVATE_NETWORKS"):
        Settings(
            environment="production",
            security={"service_token": "token"},
            llm={"gemini": {"api_key": "key"}},
            url_fetch={"allow_private_networks": True},
        )
