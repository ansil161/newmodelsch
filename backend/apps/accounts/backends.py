from django.contrib.auth.backends import ModelBackend
from django.core.exceptions import PermissionDenied
from django.views.decorators.debug import sensitive_variables

from .throttles import LoginFailureTracker


class EmailBackend(ModelBackend):
    """
    Django's ModelBackend - Django's password hashing, check_password with
    timing-attack mitigation, is_active enforcement - plus the per-account
    failure limit.

    It is the project's only backend, so every password check goes through
    it: the API login and the Django admin login share one lockout, and the
    limit cannot be sidestepped by choosing the other door.
    """

    @sensitive_variables("password")
    def authenticate(self, request, username=None, password=None, **kwargs):
        email = username if username is not None else kwargs.get("email")
        if email is None or password is None:
            return None

        tracker = LoginFailureTracker(email)
        if tracker.is_locked():
            # PermissionDenied stops authenticate() outright: no other backend
            # is consulted, and user_login_failed is still sent.
            raise PermissionDenied

        user = super().authenticate(request, username=email, password=password)
        if user is None:
            tracker.record_failure()
        else:
            tracker.reset()
        return user
