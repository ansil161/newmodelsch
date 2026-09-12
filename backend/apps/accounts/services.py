"""
Token lifecycle: issue, rotate, revoke, and the cookies that carry them.

Tokens exist in exactly two places - the database's outstanding-token list
and the browser's HttpOnly cookies. They are never put in a response body
and never logged.
"""

from dataclasses import dataclass
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.settings import api_settings as jwt_settings
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.utils import get_md5_hash_password


@dataclass(frozen=True)
class TokenPair:
    access: str
    refresh: str


class RefreshRejected(Exception):
    """
    A refresh cookie that cannot be exchanged for new tokens. `reason` is for
    the log only; the client is told its session expired, whatever it was.
    """

    def __init__(self, reason, *, user_id=None, clear_cookies=True):
        super().__init__(reason)
        self.reason = reason
        self.user_id = user_id
        self.clear_cookies = clear_cookies


class _UncheckedRefreshToken(RefreshToken):
    """
    A refresh token whose blacklist membership is *not* checked when it is
    decoded. The signature, expiry and token type still are.

    SimpleJWT raises the same TokenError for a forged token and for a
    replayed one. Rotation has to tell them apart - a replay is a theft
    signal - so it checks the blacklist itself, under a row lock.
    """

    def check_blacklist(self):
        return None


def issue_tokens(user):
    refresh = RefreshToken.for_user(user)  # also records it as outstanding
    return TokenPair(access=str(refresh.access_token), refresh=str(refresh))


def rotate_refresh_token(raw_token):
    """
    Exchange a refresh token for a new access/refresh pair, blacklisting it.

    Returns (user, TokenPair). Raises RefreshRejected when the token is
    invalid, expired, already used, or belongs to a user who can no longer
    sign in.

    Presenting an already-blacklisted token is treated as theft - an attacker
    and the real user each holding a copy - and every session the user has is
    revoked, unless it happens within AUTH_REFRESH_REUSE_GRACE_SECONDS of the
    blacklisting. That is a request racing another: two tabs refreshing with
    one cookie, or a refresh still in flight when the user signed out. The
    token is refused either way; only the revocation is withheld.
    """
    try:
        token = _UncheckedRefreshToken(raw_token)
    except TokenError as exc:
        raise RefreshRejected("invalid_or_expired") from exc

    # The outcome is returned out of the transaction rather than raised inside
    # it: raising would roll back the revocation it is reporting.
    with transaction.atomic():
        outcome = _rotate_locked(token)
    if isinstance(outcome, RefreshRejected):
        raise outcome
    return outcome


def _rotate_locked(token):
    user_id = token.get(jwt_settings.USER_ID_CLAIM)
    try:
        # get(), not first(): OutstandingToken orders by `user`, which first()
        # would turn into an outer join - and PostgreSQL cannot lock rows on
        # the nullable side of one. get() drops the ordering.
        outstanding = OutstandingToken.objects.select_for_update().get(jti=token[jwt_settings.JTI_CLAIM])
    except OutstandingToken.DoesNotExist:
        # Every refresh token this API issues is recorded. A validly signed
        # one that is not was never issued here.
        return RefreshRejected("unknown_token", user_id=user_id)

    blacklisted = BlacklistedToken.objects.filter(token=outstanding).first()
    if blacklisted is not None:
        grace = timedelta(seconds=settings.AUTH_REFRESH_REUSE_GRACE_SECONDS)
        if timezone.now() - blacklisted.blacklisted_at <= grace:
            # A race with a rotation or a sign-out, not a replay. If it was a
            # rotation, the winning response carries the new cookies, and
            # clearing them here - in the loser's response - would sign the
            # user out.
            return RefreshRejected("concurrent_request", user_id=user_id, clear_cookies=False)
        revoke_all_refresh_tokens(outstanding.user_id)
        return RefreshRejected("reuse_detected", user_id=user_id)

    user = get_user_model().objects.filter(pk=user_id).first()
    if user is None or not user.is_active:
        BlacklistedToken.objects.get_or_create(token=outstanding)
        return RefreshRejected("inactive_user", user_id=user_id)

    if jwt_settings.CHECK_REVOKE_TOKEN and token.get(jwt_settings.REVOKE_TOKEN_CLAIM) != get_md5_hash_password(
        user.password
    ):
        revoke_all_refresh_tokens(user.pk)
        return RefreshRejected("password_changed", user_id=user_id)

    BlacklistedToken.objects.create(token=outstanding)
    token.set_jti()
    token.set_exp()
    token.set_iat()
    token.outstand()
    return user, TokenPair(access=str(token.access_token), refresh=str(token))


def blacklist_refresh_token(raw_token):
    """Blacklist one refresh token (logout). Returns its user id, or None if it was not a valid token."""
    try:
        token = _UncheckedRefreshToken(raw_token)
    except TokenError:
        return None
    token.blacklist()  # get_or_create: logging out twice is a no-op
    return token.get(jwt_settings.USER_ID_CLAIM)


def revoke_all_refresh_tokens(user_id):
    """
    Sign a user out everywhere by blacklisting every live refresh token they
    hold. Access tokens already issued lapse by themselves within
    ACCESS_TOKEN_LIFETIME, which is why that lifetime is kept short.
    """
    if user_id is None:
        return 0
    live = OutstandingToken.objects.filter(
        user_id=user_id, expires_at__gt=timezone.now(), blacklistedtoken__isnull=True
    )
    created = BlacklistedToken.objects.bulk_create(
        [BlacklistedToken(token=token) for token in live], ignore_conflicts=True
    )
    return len(created)


# ---------------------------------------------------------------------------
# Cookies
# ---------------------------------------------------------------------------


def _cookie_attributes(path):
    config = settings.AUTH_COOKIES
    return {
        "path": path,
        "domain": config["DOMAIN"],
        "secure": config["SECURE"],
        "httponly": True,
        "samesite": config["SAMESITE"],
    }


def set_auth_cookies(response, tokens):
    config = settings.AUTH_COOKIES
    response.set_cookie(
        config["ACCESS_NAME"],
        tokens.access,
        max_age=int(jwt_settings.ACCESS_TOKEN_LIFETIME.total_seconds()),
        **_cookie_attributes(config["ACCESS_PATH"]),
    )
    response.set_cookie(
        config["REFRESH_NAME"],
        tokens.refresh,
        max_age=int(jwt_settings.REFRESH_TOKEN_LIFETIME.total_seconds()),
        **_cookie_attributes(config["REFRESH_PATH"]),
    )


def clear_auth_cookies(response):
    """
    Expire both cookies. Deletion repeats the exact path, domain and flags
    they were set with: a browser matches cookies by name, domain and path,
    and a mismatched deletion leaves the original in place.
    """
    config = settings.AUTH_COOKIES
    for name, path in ((config["ACCESS_NAME"], config["ACCESS_PATH"]), (config["REFRESH_NAME"], config["REFRESH_PATH"])):
        response.set_cookie(
            name,
            "",
            max_age=0,
            expires="Thu, 01 Jan 1970 00:00:00 GMT",
            **_cookie_attributes(path),
        )
