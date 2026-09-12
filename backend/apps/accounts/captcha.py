"""
Server-side CAPTCHA verification.

The browser only ever holds the provider's *response token*. Whether that
token is genuine is decided here, by sending it with the secret key to the
provider's siteverify endpoint - never by anything the browser reports.

Turnstile, hCaptcha and reCAPTCHA v2 share one siteverify protocol (form POST
of secret/response/remoteip, JSON reply with `success`, `error-codes` and
`hostname`), so the provider is a URL rather than a code path.
"""

import json
import logging
from dataclasses import dataclass
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings

logger = logging.getLogger(__name__)

VERIFY_URLS = {
    "turnstile": "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    "hcaptcha": "https://api.hcaptcha.com/siteverify",
    "recaptcha": "https://www.google.com/recaptcha/api/siteverify",
}

# Turnstile documents 2048 characters; the others are shorter. Anything past
# this is not a token, and is not worth a round trip to find out.
MAX_TOKEN_LENGTH = 4096
_MAX_RESPONSE_BYTES = 64 * 1024


@dataclass(frozen=True)
class CaptchaResult:
    success: bool
    error_codes: tuple = ()


def public_config():
    """What the login form needs to render the widget. Never the secret."""
    config = settings.CAPTCHA
    if not config["ENABLED"]:
        return {"enabled": False, "provider": None, "site_key": ""}
    return {"enabled": True, "provider": config["PROVIDER"], "site_key": config["SITE_KEY"]}


def verify_captcha(token, remote_ip=None):
    config = settings.CAPTCHA
    if not config["ENABLED"]:
        return CaptchaResult(True)

    token = (token or "").strip()
    if not token:
        return CaptchaResult(False, ("missing-input-response",))
    if len(token) > MAX_TOKEN_LENGTH:
        return CaptchaResult(False, ("invalid-input-response",))

    fields = {"secret": config["SECRET_KEY"], "response": token}
    if remote_ip:
        fields["remoteip"] = remote_ip

    try:
        payload = _post_verification(VERIFY_URLS[config["PROVIDER"]], fields, timeout=config["TIMEOUT"])
    except (URLError, TimeoutError, OSError, ValueError) as exc:
        # Fail closed. A provider outage must not become a way around the check.
        logger.error(
            "captcha_unavailable",
            extra={"event": "captcha_unavailable", "provider": config["PROVIDER"], "error": type(exc).__name__},
        )
        return CaptchaResult(False, ("verification-unavailable",))

    if payload.get("success") is not True:
        codes = tuple(str(code) for code in payload.get("error-codes") or ())
        return CaptchaResult(False, codes or ("verification-failed",))

    expected = config["EXPECTED_HOSTNAMES"]
    if expected and payload.get("hostname") not in expected:
        return CaptchaResult(False, ("hostname-mismatch",))

    return CaptchaResult(True)


def _post_verification(url, fields, timeout):
    request = Request(
        url,
        data=urlencode(fields).encode(),
        headers={"Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json"},
        method="POST",
    )
    # A fixed https:// URL from VERIFY_URLS, never user input.
    with urlopen(request, timeout=timeout) as response:  # noqa: S310
        body = response.read(_MAX_RESPONSE_BYTES)
    payload = json.loads(body)
    if not isinstance(payload, dict):
        raise ValueError("Unexpected verification payload.")
    return payload
