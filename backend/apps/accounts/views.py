import logging

from django.conf import settings
from django.contrib.auth import authenticate, user_logged_in
from django.middleware.csrf import get_token, rotate_token
from django.utils.cache import add_never_cache_headers
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.http import get_client_ip
from apps.core.responses import failure, success

from . import services
from .audit import log_auth_event
from .captcha import public_config, verify_captcha
from .constants import AUTHENTICATE_HEADER, Codes, Events, Messages
from .exceptions import CaptchaFailed, InvalidCredentials, TooManyAttempts
from .permissions import CSRFProtected
from .serializers import LoginSerializer, UserSerializer
from .throttles import LoginFailureTracker, LoginIPBurstThrottle, LoginIPSustainedThrottle, RefreshThrottle


class AuthAPIView(APIView):
    """
    Behaviour every auth endpoint shares.

    Responses are never cached - each one sets or clears a credential.

    A 401 stays a 401. DRF quietly turns AuthenticationFailed into a 403 on
    views without authentication classes, and login, refresh and logout
    deliberately have none (a stale access cookie must never block them).
    The client relies on 401 meaning "sign in again".
    """

    def get_authenticate_header(self, request):
        return AUTHENTICATE_HEADER

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        add_never_cache_headers(response)
        return response


class CSRFTokenView(AuthAPIView):
    """
    GET /api/v1/auth/csrf/

    The login form's bootstrap: a CSRF token for the X-CSRFToken header and
    the public CAPTCHA configuration. Returning the token in the body lets
    the CSRF cookie stay HttpOnly and works when the API is cross-origin.
    """

    authentication_classes = ()
    permission_classes = (AllowAny,)

    def get(self, request):
        return success(
            Messages.CSRF_ISSUED,
            {"csrf_token": get_token(request._request), "captcha": public_config()},
        )


class LoginView(AuthAPIView):
    """
    POST /api/v1/auth/login/   {email, password, captcha_token}

    Order matters: CSRF and the per-IP limits run before the view (DRF
    permissions, then throttles); then input validation, CAPTCHA, the
    per-account lock, and only then the password check. A request that
    fails CAPTCHA never reaches the password hasher and never counts toward
    an account's lock - so locking someone out costs a solved CAPTCHA per try.
    """

    authentication_classes = ()
    permission_classes = (CSRFProtected,)
    throttle_classes = (LoginIPBurstThrottle, LoginIPSustainedThrottle)

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]

        captcha = verify_captcha(serializer.validated_data["captcha_token"], get_client_ip(request))
        if not captcha.success:
            log_auth_event(
                Events.CAPTCHA_FAILURE,
                request,
                level=logging.WARNING,
                email=email,
                codes=",".join(captcha.error_codes),
            )
            raise CaptchaFailed()

        retry_after = LoginFailureTracker(email).retry_after()
        if retry_after:
            log_auth_event(
                Events.RATE_LIMIT_TRIGGERED, request, level=logging.WARNING, email=email, scope="login_account"
            )
            raise TooManyAttempts(wait=retry_after)

        user = authenticate(request._request, email=email, password=serializer.validated_data["password"])
        if user is None:
            log_auth_event(Events.LOGIN_FAILURE, request, level=logging.WARNING, email=email)
            raise InvalidCredentials()

        tokens = services.issue_tokens(user)
        user_logged_in.send(sender=user.__class__, request=request._request, user=user)  # sets last_login
        rotate_token(request._request)  # a fresh CSRF secret for the new identity
        log_auth_event(Events.LOGIN_SUCCESS, request, user=user)

        response = success(Messages.LOGIN_SUCCESS, {"user": UserSerializer(user).data})
        services.set_auth_cookies(response, tokens)
        return response


class RefreshView(AuthAPIView):
    """
    POST /api/v1/auth/refresh/

    Reads the refresh token from its cookie - the client never touches it -
    rotates it, and sets both cookies again.
    """

    authentication_classes = ()
    permission_classes = (CSRFProtected,)
    throttle_classes = (RefreshThrottle,)

    def post(self, request):
        raw_token = request.COOKIES.get(settings.AUTH_COOKIES["REFRESH_NAME"])
        if not raw_token:
            log_auth_event(Events.REFRESH_FAILURE, request, reason="missing_cookie")
            return self._session_expired()

        try:
            user, tokens = services.rotate_refresh_token(raw_token)
        except services.RefreshRejected as rejection:
            reuse = rejection.reason == "reuse_detected"
            log_auth_event(
                Events.REFRESH_REUSE_DETECTED if reuse else Events.REFRESH_FAILURE,
                request,
                level=logging.WARNING if reuse else logging.INFO,
                user_id=rejection.user_id,
                reason=rejection.reason,
            )
            return self._session_expired(clear_cookies=rejection.clear_cookies)

        log_auth_event(Events.REFRESH_SUCCESS, request, user=user)
        response = success(Messages.REFRESH_SUCCESS)
        services.set_auth_cookies(response, tokens)
        return response

    def _session_expired(self, *, clear_cookies=True):
        response = Response(
            failure(Messages.SESSION_EXPIRED, code=Codes.SESSION_EXPIRED),
            status=status.HTTP_401_UNAUTHORIZED,
            headers={"WWW-Authenticate": AUTHENTICATE_HEADER},
        )
        if clear_cookies:
            services.clear_auth_cookies(response)
        return response


class LogoutView(AuthAPIView):
    """
    POST /api/v1/auth/logout/

    Blacklists the refresh token and expires both cookies. Idempotent, and
    succeeds with no session at all: signing out must never be able to fail.
    """

    authentication_classes = ()
    permission_classes = (CSRFProtected,)

    def post(self, request):
        raw_token = request.COOKIES.get(settings.AUTH_COOKIES["REFRESH_NAME"])
        user_id = services.blacklist_refresh_token(raw_token) if raw_token else None
        rotate_token(request._request)
        log_auth_event(Events.LOGOUT, request, user_id=user_id)

        response = success(Messages.LOGOUT_SUCCESS)
        services.clear_auth_cookies(response)
        return response


class MeView(AuthAPIView):
    """GET /api/v1/auth/me/ - the signed-in user, from the access cookie."""

    permission_classes = (IsAuthenticated,)

    def get(self, request):
        return success(Messages.CURRENT_USER, {"user": UserSerializer(request.user).data})
