"""
Malware scanning for uploads.

Two implementations behind one function. "none" accepts everything and is
the default, because a scanner is infrastructure this project does not yet
run — `manage.py check --deploy` warns about it. "clamav" streams the file to
a clamd daemon with the INSTREAM command, which needs no shared filesystem
and no ClamAV library in this process.

Fail closed: with a scanner configured, a file that cannot be scanned is not
accepted. A scanner outage must not become a way around the scan.

Worth being clear about what a scan protects. Nothing in this system executes
an uploaded file — the AI service only extracts text from it — so the risk a
scan addresses is a stored file being downloaded by another administrator
and opened on their machine.
"""

import logging
import socket
from dataclasses import dataclass

from django.conf import settings

from .constants import Messages
from .exceptions import ServiceUnavailable, UploadRejected

logger = logging.getLogger(__name__)

_CHUNK_BYTES = 64 * 1024
_TIMEOUT_SECONDS = 30


@dataclass(frozen=True)
class ScanResult:
    clean: bool
    signature: str = ""


def scan_upload(uploaded):
    """Raise UploadRejected for an infected file, ServiceUnavailable if the scan cannot run."""
    scanner = settings.KNOWLEDGE_BASE["MALWARE_SCANNER"]
    if scanner == "none":
        return ScanResult(clean=True)
    if scanner != "clamav":
        raise ServiceUnavailable(Messages.SCANNER_UNAVAILABLE)

    try:
        result = _clamav_scan(uploaded)
    except (OSError, ValueError) as exc:
        logger.error("malware_scan_unavailable", extra={"event": "malware_scan_unavailable", "error": type(exc).__name__})
        raise ServiceUnavailable(Messages.SCANNER_UNAVAILABLE) from exc

    if not result.clean:
        logger.warning(
            "malware_detected", extra={"event": "malware_detected", "signature": result.signature[:120]}
        )
        raise UploadRejected(Messages.MALWARE_DETECTED, code="malware_detected")
    return result


def _clamav_scan(uploaded):
    config = settings.KNOWLEDGE_BASE
    uploaded.seek(0)
    with socket.create_connection((config["CLAMAV_HOST"], config["CLAMAV_PORT"]), timeout=_TIMEOUT_SECONDS) as sock:
        sock.sendall(b"zINSTREAM\0")
        for chunk in uploaded.chunks(_CHUNK_BYTES):
            sock.sendall(len(chunk).to_bytes(4, "big") + chunk)
        sock.sendall(b"\0\0\0\0")
        reply = b""
        while not reply.endswith(b"\0"):
            part = sock.recv(4096)
            if not part:
                break
            reply += part
    uploaded.seek(0)

    text = reply.rstrip(b"\0").decode("utf-8", "replace").strip()
    # "stream: OK" or "stream: Eicar-Signature FOUND" or "... ERROR"
    if text.endswith("OK"):
        return ScanResult(clean=True)
    if text.endswith("FOUND"):
        return ScanResult(clean=False, signature=text.removeprefix("stream:").removesuffix("FOUND").strip())
    raise ValueError("Unexpected scanner reply")
