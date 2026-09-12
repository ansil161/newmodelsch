from rest_framework.permissions import BasePermission

from .authentication import enforce_csrf


class CSRFProtected(BasePermission):
    """
    CSRF for endpoints that act on cookies without an authenticated user:
    login, refresh and logout. CookieJWTAuthentication covers every request
    it authenticates; these three would otherwise be the gap - a forged
    cross-site login is how an attacker signs a victim into the attacker's
    own account.

    Permissions run before throttles, so a forged request does not spend the
    real user's rate-limit allowance.
    """

    def has_permission(self, request, view):
        enforce_csrf(request)
        return True
