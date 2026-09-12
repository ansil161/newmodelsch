from django.conf import settings
from django.core.checks import Tags, Warning, register


@register(Tags.security)
def captcha_enabled(app_configs, **kwargs):
    """Make a disabled CAPTCHA loud. production.py refuses to start with it off."""
    if settings.CAPTCHA["ENABLED"]:
        return []
    return [
        Warning(
            "CAPTCHA verification on login is disabled.",
            hint="Set CAPTCHA_ENABLED=True. Production settings refuse to start without it.",
            id="accounts.W001",
        )
    ]
