import unicodedata


def normalize_email(value):
    """
    The canonical form of a login email: NFKC, trimmed, lower-cased whole.

    RFC 5321 technically lets the local part be case-sensitive; no provider a
    school's staff use treats it that way, and a sign-in that fails over a
    capital letter is a support call. Applied on write (model, manager)
    and on every lookup, so stored and typed addresses always compare equal.
    """
    return unicodedata.normalize("NFKC", value or "").strip().lower()
