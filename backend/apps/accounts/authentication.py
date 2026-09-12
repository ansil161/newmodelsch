import logging

from django.conf import settings
from rest_framework.authentication import CSRFCheck
from rest_framework_simplejwt.authentication import JWTAuthentication

from .audit import log_auth_event
from .constants import AUTHENTICATE_HEADER, Events
from .exceptions import CSRFFailed


def enforce_csrf(request):
    """
    Run Django's CSRF check on a DRF request.

    DRF exempts every APIView from CsrfViewMiddleware, on the assumption
    that APIs authenticate with a header an attacker's page cannot set. This
    API authenticates with cookies, which a browser attaches to a forged
    cross-site request exactly as it does to a real one - so it opts back in.
    Safe methods pass; unsafe ones need a valid X-CSRFToken header.
    """
    check = CSRFCheck(lambda _request: None)
    check.process_request(request)  # loads the CSRF cookie into request.META
    reason = check.process_view(request, None, (), {})
    if reason:
        log_auth_event(Events.CSRF_FAILURE, request, level=logging.WARNING, reason=reason, path=request.path)
        raise CSRFFailed()


class CookieJWTAuthentication(JWTAuthentication):
    """
    Authenticates with the access JWT in its HttpOnly cookie - never from an
    Authorization header - and enforces CSRF on every unsafe request it
    authenticates. SimpleJWT still does all token validation: signature,
    expiry, token type, user active, and the password-change revocation claim.
    """

    def authenticate(self, request):
        raw_token = request.COOKIES.get(settings.AUTH_COOKIES["ACCESS_NAME"])
        if not raw_token:
            return None
        validated_token = self.get_validated_token(raw_token)
        user = self.get_user(validated_token)
        enforce_csrf(request)
        return user, validated_token

    def authenticate_header(self, request):
        return AUTHENTICATE_HEADER
