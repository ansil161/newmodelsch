"""
Everything the auth API says to a client, and the names of what it logs.

These messages are the only text about authentication a client ever sees.
They are deliberately uninformative where information would help an
attacker: one message for an unknown email, a wrong password and a disabled
account alike.
"""


class Messages:
    LOGIN_SUCCESS = "Login successful."
    LOGOUT_SUCCESS = "Logged out."
    REFRESH_SUCCESS = "Session refreshed."
    CURRENT_USER = "Current user."
    CSRF_ISSUED = "Security token issued."

    INVALID_CREDENTIALS = "Invalid email or password."
    TOO_MANY_ATTEMPTS = "Too many attempts. Please try again later."
    SESSION_EXPIRED = "Your session has expired. Please sign in again."
    CSRF_FAILED = "Your security token has expired. Please try again."


class Codes:
    """Stable values of the `code` field, for client code to branch on."""

    INVALID_CREDENTIALS = "invalid_credentials"
    SESSION_EXPIRED = "session_expired"
    CSRF_FAILED = "csrf_failed"


class Events:
    """Structured log event names (the `event` field of every auth log line)."""

    LOGIN_SUCCESS = "login_success"
    LOGIN_FAILURE = "login_failure"
    LOGOUT = "logout"
    REFRESH_SUCCESS = "refresh_success"
    REFRESH_FAILURE = "refresh_failure"
    REFRESH_REUSE_DETECTED = "refresh_reuse_detected"
    RATE_LIMIT_TRIGGERED = "rate_limit_triggered"
    CSRF_FAILURE = "csrf_failure"


# Sent with every 401. The credentials are an HttpOnly cookie, not a header.
AUTHENTICATE_HEADER = 'Cookie realm="api"'
