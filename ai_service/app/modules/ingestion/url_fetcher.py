"""Fetching a user-supplied URL without becoming a proxy into the network.

SSRF — server-side request forgery — is what happens when a service fetches
a URL someone else chose. The request leaves from *inside*, with this
service's network position: "http://169.254.169.254/latest/meta-data/"
returns the cloud credentials of the machine this runs on, and
"http://qdrant:6333/collections" returns the knowledge base. Blocking those
strings is not enough, because each can be spelled another way:

    a hostname that resolves to a private address         DNS
    one that resolves publicly when checked, privately     DNS rebinding
      when fetched
    a public URL that redirects to a private one           redirects
    2130706433, 0x7f.1, [::ffff:127.0.0.1]                 address encodings
    an HTTP proxy from the environment the check never     proxies
      sees

So the defence is structural, not a list of bad strings:

  1. VALIDATE the URL: http(s) only, web ports only, no embedded credentials,
     no hostnames that only mean something inside a network.
  2. RESOLVE the hostname here, and require EVERY address it resolves to to
     be public. One private answer in the set fails the name — otherwise a
     resolver returning [public, private] would be a coin toss.
  3. CONNECT TO THE ADDRESS THAT WAS CHECKED, not to the name. The request
     goes to the IP literal with Host and TLS SNI set to the hostname, so
     the certificate is still verified against the real name and no second
     DNS lookup happens between the check and the connection.
  4. FOLLOW REDIRECTS BY HAND, running every hop through 1–3.
  5. BOUND EVERYTHING: total time, response size — counted after
     decompression, so a gzip bomb stops at the limit — and the content
     types that can be documents at all.

Keep-alive is off. The pool is keyed on the connected address, so a TLS
connection opened for one hostname could otherwise be reused for a different
hostname on the same IP, carrying the first one's certificate. The proxy
environment is ignored for the same reason step 3 exists.
"""

from __future__ import annotations

import asyncio
import ipaddress
import socket
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any
from urllib.parse import urljoin, urlsplit, urlunsplit

import httpx

from app.core.config import UrlFetchSettings
from app.core.exceptions import ErrorCode, UrlRejectedError
from app.core.logging import Stopwatch, get_logger

logger = get_logger(__name__)

Resolver = Callable[[str, int], Awaitable[list[str]]]

# What a document can arrive as. Everything else — images, video, archives,
# executables — is refused before its body is read.
ALLOWED_CONTENT_TYPES = frozenset({
    "text/html",
    "application/xhtml+xml",
    "text/plain",
    "text/markdown",
    "text/x-markdown",
    "text/csv",
    "application/json",
    "application/pdf",
})

_REDIRECT_STATUSES = frozenset({301, 302, 303, 307, 308})
_DEFAULT_PORTS = {"http": 80, "https": 443}
_MAX_URL_LENGTH = 2_048

# Names that only mean something inside a network. Resolution would catch
# most of them anyway; refusing them by name makes the refusal explicit and
# does not depend on how the local resolver is configured.
_BLOCKED_HOSTNAMES = frozenset({
    "localhost", "localhost.localdomain", "ip6-localhost", "ip6-loopback",
    "metadata", "metadata.google.internal", "instance-data",
    "kubernetes", "kubernetes.default",
})
_BLOCKED_SUFFIXES = (
    ".localhost", ".local", ".localdomain", ".internal", ".intranet", ".lan",
    ".home.arpa", ".corp", ".svc", ".cluster.local",
)
_NAT64 = ipaddress.ip_network("64:ff9b::/96")


@dataclass(frozen=True)
class FetchedResource:
    url: str
    content_type: str | None
    charset: str | None
    data: bytes
    redirects: int
    fetch_ms: int


@dataclass(frozen=True)
class _Target:
    url: str
    scheme: str
    hostname: str
    port: int
    path: str
    query: str

    @property
    def host_header(self) -> str:
        host = f"[{self.hostname}]" if ":" in self.hostname else self.hostname
        if self.port == _DEFAULT_PORTS[self.scheme]:
            return host
        return f"{host}:{self.port}"


def is_public_address(address: str) -> bool:
    """Whether an IP address is on the public internet.

    `is_global` does most of the work: it is False for private, loopback,
    link-local (which includes the 169.254.169.254 metadata endpoint), shared
    (100.64/10), reserved and documentation ranges. IPv6 forms that embed an
    IPv4 address are unwrapped and the embedded address tested, because
    ::ffff:127.0.0.1 *is* 127.0.0.1 to the kernel.
    """
    try:
        ip = ipaddress.ip_address(address.split("%", 1)[0])
    except ValueError:
        return False

    if isinstance(ip, ipaddress.IPv6Address):
        if ip.ipv4_mapped is not None:
            return is_public_address(str(ip.ipv4_mapped))
        if ip.sixtofour is not None:
            return is_public_address(str(ip.sixtofour))
        if ip.teredo is not None:
            # A tunnel endpoint. Nothing a document is served from.
            return False
        if ip in _NAT64:
            return is_public_address(str(ipaddress.IPv4Address(int(ip) & 0xFFFFFFFF)))

    return bool(ip.is_global) and not ip.is_multicast and not ip.is_unspecified


async def system_resolver(hostname: str, port: int) -> list[str]:
    loop = asyncio.get_running_loop()
    infos = await loop.getaddrinfo(hostname, port, type=socket.SOCK_STREAM)
    return list(dict.fromkeys(str(info[4][0]) for info in infos))


class SafeUrlFetcher:
    def __init__(
        self,
        settings: UrlFetchSettings,
        *,
        resolver: Resolver | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._settings = settings
        # Injectable so tests can answer DNS and HTTP without a network.
        self._resolver = resolver or system_resolver
        self._client = httpx.AsyncClient(
            transport=transport,
            follow_redirects=False,
            trust_env=False,
            timeout=httpx.Timeout(settings.timeout_seconds,
                                  connect=settings.connect_timeout_seconds),
            limits=httpx.Limits(max_connections=10, max_keepalive_connections=0),
            headers={
                "User-Agent": settings.user_agent,
                "Accept": ("text/html,application/xhtml+xml,application/pdf;q=0.9,"
                           "text/plain;q=0.8,*/*;q=0.1"),
            },
        )

    async def fetch(self, url: str) -> FetchedResource:
        with Stopwatch() as timer:
            try:
                async with asyncio.timeout(self._settings.timeout_seconds):
                    data, target, content_type, charset, redirects = (
                        await self._follow(url)
                    )
            except (TimeoutError, httpx.TimeoutException) as exc:
                raise UrlRejectedError(
                    "The page took too long to respond.",
                    code=ErrorCode.URL_TIMEOUT, status_code=504, retryable=True,
                ) from exc

        logger.info(
            "Fetched URL",
            extra={"host": target.hostname, "bytes": len(data),
                   "content_type": content_type, "redirects": redirects,
                   "fetch_ms": timer.milliseconds},
        )
        return FetchedResource(
            url=target.url, content_type=content_type, charset=charset,
            data=data, redirects=redirects, fetch_ms=timer.milliseconds,
        )

    def validate(self, url: str) -> _Target:
        """Parse and check a URL. Raises UrlRejectedError; performs no I/O."""
        raw = (url or "").strip()
        if not raw or len(raw) > _MAX_URL_LENGTH:
            raise _invalid("Enter a valid web address.")
        try:
            parts = urlsplit(raw)
            explicit_port = parts.port
        except ValueError as exc:
            raise _invalid("Enter a valid web address.") from exc

        scheme = parts.scheme.lower()
        allowed = {value.lower() for value in self._settings.allowed_schemes}
        if scheme not in allowed or scheme not in _DEFAULT_PORTS:
            raise _invalid("Only http:// and https:// links can be added.")
        if parts.username is not None or parts.password is not None:
            raise _invalid("Links that contain a username or password cannot be added.")

        hostname = (parts.hostname or "").rstrip(".")
        if not hostname:
            raise _invalid("Enter a valid web address.")
        try:
            hostname = hostname.encode("idna").decode("ascii").lower()
        except UnicodeError as exc:
            raise _invalid("The link's host name is not valid.") from exc

        port = explicit_port or _DEFAULT_PORTS[scheme]
        if port not in self._settings.allowed_ports:
            raise _blocked(
                f"Links to port {port} cannot be added. Only standard web "
                f"ports are allowed."
            )

        if not self._settings.allow_private_networks:
            if hostname in _BLOCKED_HOSTNAMES or hostname.endswith(_BLOCKED_SUFFIXES):
                raise _blocked()
            if _is_ip_literal(hostname) and not is_public_address(hostname):
                raise _blocked()

        path = parts.path or "/"
        netloc = f"[{hostname}]" if ":" in hostname else hostname
        if port != _DEFAULT_PORTS[scheme]:
            netloc = f"{netloc}:{port}"
        return _Target(
            url=urlunsplit((scheme, netloc, path, parts.query, "")),
            scheme=scheme, hostname=hostname, port=port,
            path=path, query=parts.query,
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    # -- internals -------------------------------------------------------

    async def _follow(
        self, url: str
    ) -> tuple[bytes, _Target, str | None, str | None, int]:
        current = url
        for redirects in range(self._settings.max_redirects + 1):
            target = self.validate(current)
            address = await self._resolve(target)
            response = await self._send(target, address)
            try:
                if response.status_code in _REDIRECT_STATUSES:
                    location = response.headers.get("location", "").strip()
                    if not location:
                        raise _failed("The page redirected without saying where to.")
                    # The next hop is validated and resolved from scratch.
                    current = urljoin(target.url, location)
                    continue
                data, content_type, charset = await self._read(response)
                return data, target, content_type, charset, redirects
            finally:
                await response.aclose()
        raise _failed("The page redirected too many times.")

    async def _resolve(self, target: _Target) -> str:
        if _is_ip_literal(target.hostname):
            return target.hostname
        try:
            addresses = await self._resolver(target.hostname, target.port)
        except (OSError, UnicodeError) as exc:
            raise UrlRejectedError(
                "The site's address could not be found. Check the link.",
                code=ErrorCode.URL_UNREACHABLE, status_code=502,
            ) from exc
        if not addresses:
            raise UrlRejectedError(
                "The site's address could not be found. Check the link.",
                code=ErrorCode.URL_UNREACHABLE, status_code=502,
            )

        if not self._settings.allow_private_networks:
            refused = [
                address for address in addresses if not is_public_address(address)
            ]
            if refused:
                logger.warning(
                    "Refused a URL whose host resolves to a non-public address",
                    extra={"host": target.hostname, "addresses": ",".join(refused[:4])},
                )
                raise _blocked()

        # IPv4 first: a host with both, on a network without IPv6 routing,
        # would otherwise fail to connect for no reason the user can fix.
        return sorted(addresses, key=lambda address: ":" in address)[0]

    async def _send(self, target: _Target, address: str) -> httpx.Response:
        host = f"[{address}]" if ":" in address else address
        pinned = urlunsplit(
            (target.scheme, f"{host}:{target.port}", target.path, target.query, "")
        )
        extensions: dict[str, Any] = (
            {"sni_hostname": target.hostname} if target.scheme == "https" else {}
        )
        request = self._client.build_request(
            "GET", pinned, headers={"Host": target.host_header}, extensions=extensions
        )
        try:
            return await self._client.send(request, stream=True)
        except httpx.TimeoutException:
            raise
        except httpx.HTTPError as exc:
            logger.warning(
                "URL fetch could not connect",
                extra={"host": target.hostname, "error_type": type(exc).__name__},
            )
            raise UrlRejectedError(
                "The site could not be reached. Check the link, or try again later.",
                code=ErrorCode.URL_UNREACHABLE, status_code=502, retryable=True,
            ) from exc

    async def _read(self, response: httpx.Response
                    ) -> tuple[bytes, str | None, str | None]:
        status = response.status_code
        if status != 200:
            raise UrlRejectedError(
                f"The page responded with HTTP {status}.",
                code=ErrorCode.URL_FETCH_FAILED, status_code=502,
                retryable=status == 429 or status >= 500,
            )

        media_type, charset = parse_content_type(response.headers.get("content-type"))
        if media_type is not None and media_type not in ALLOWED_CONTENT_TYPES:
            raise UrlRejectedError(
                "That link points to something other than a web page or a "
                "supported document.",
                code=ErrorCode.URL_CONTENT_UNSUPPORTED,
            )

        limit = self._settings.max_bytes
        declared = response.headers.get("content-length", "")
        if declared.isdigit() and int(declared) > limit:
            raise _too_large(limit)

        body = bytearray()
        try:
            async for part in response.aiter_bytes():
                body.extend(part)
                if len(body) > limit:
                    raise _too_large(limit)
        except httpx.TimeoutException:
            raise
        except httpx.HTTPError as exc:
            raise _failed("The page could not be downloaded completely.") from exc
        return bytes(body), media_type, charset


def parse_content_type(header: str | None) -> tuple[str | None, str | None]:
    if not header:
        return None, None
    media_type, _, parameters = header.partition(";")
    charset = None
    for parameter in parameters.split(";"):
        key, _, value = parameter.strip().partition("=")
        if key.lower() == "charset":
            charset = value.strip().strip('"') or None
    return (media_type.strip().lower() or None), charset


def _is_ip_literal(hostname: str) -> bool:
    try:
        ipaddress.ip_address(hostname)
    except ValueError:
        return False
    return True


def _invalid(message: str) -> UrlRejectedError:
    return UrlRejectedError(message, code=ErrorCode.URL_INVALID)


def _blocked(message: str = "That address cannot be added: it points to a "
                            "private or internal network.") -> UrlRejectedError:
    return UrlRejectedError(message, code=ErrorCode.URL_BLOCKED)


def _failed(message: str) -> UrlRejectedError:
    return UrlRejectedError(message, code=ErrorCode.URL_FETCH_FAILED, status_code=502)


def _too_large(limit: int) -> UrlRejectedError:
    return UrlRejectedError(
        f"The page is larger than the {limit // (1024 * 1024)} MB limit.",
        code=ErrorCode.URL_TOO_LARGE,
    )
