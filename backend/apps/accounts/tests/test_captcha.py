from unittest import mock
from urllib.error import URLError

from django.test import SimpleTestCase, override_settings

from apps.accounts import captcha

ENABLED = {
    "ENABLED": True,
    "PROVIDER": "turnstile",
    "SITE_KEY": "public-site-key",
    "SECRET_KEY": "private-secret-key",
    "EXPECTED_HOSTNAMES": [],
    "TIMEOUT": 2.0,
}


@override_settings(CAPTCHA=ENABLED)
class VerifyCaptchaTests(SimpleTestCase):
    def provider(self, **kwargs):
        return mock.patch.object(captcha, "_post_verification", **kwargs)

    def test_success_is_verified_server_side_with_the_secret(self):
        with self.provider(return_value={"success": True, "hostname": "school.example"}) as post:
            result = captcha.verify_captcha("response-token", "203.0.113.9")

        self.assertTrue(result.success)
        url, fields = post.call_args.args
        self.assertEqual(url, "https://challenges.cloudflare.com/turnstile/v0/siteverify")
        self.assertEqual(
            fields, {"secret": "private-secret-key", "response": "response-token", "remoteip": "203.0.113.9"}
        )

    def test_provider_rejection(self):
        with self.provider(return_value={"success": False, "error-codes": ["timeout-or-duplicate"]}):
            result = captcha.verify_captcha("response-token")
        self.assertFalse(result.success)
        self.assertEqual(result.error_codes, ("timeout-or-duplicate",))

    def test_success_must_be_the_literal_true(self):
        with self.provider(return_value={"success": "true"}):
            self.assertFalse(captcha.verify_captcha("response-token").success)

    def test_provider_outage_fails_closed(self):
        with self.provider(side_effect=URLError("unreachable")):
            result = captcha.verify_captcha("response-token")
        self.assertFalse(result.success)
        self.assertEqual(result.error_codes, ("verification-unavailable",))

    def test_malformed_provider_response_fails_closed(self):
        with self.provider(side_effect=ValueError("not json")):
            self.assertFalse(captcha.verify_captcha("response-token").success)

    def test_missing_token_is_rejected_without_calling_the_provider(self):
        with self.provider() as post:
            self.assertFalse(captcha.verify_captcha("   ").success)
        post.assert_not_called()

    def test_oversized_token_is_rejected_without_calling_the_provider(self):
        with self.provider() as post:
            self.assertFalse(captcha.verify_captcha("x" * (captcha.MAX_TOKEN_LENGTH + 1)).success)
        post.assert_not_called()

    @override_settings(CAPTCHA={**ENABLED, "EXPECTED_HOSTNAMES": ["school.example"]})
    def test_token_solved_on_another_hostname_is_rejected(self):
        with self.provider(return_value={"success": True, "hostname": "attacker.example"}):
            result = captcha.verify_captcha("response-token")
        self.assertFalse(result.success)
        self.assertEqual(result.error_codes, ("hostname-mismatch",))

    @override_settings(CAPTCHA={**ENABLED, "PROVIDER": "hcaptcha"})
    def test_provider_is_configurable(self):
        with self.provider(return_value={"success": True}) as post:
            captcha.verify_captcha("response-token")
        self.assertEqual(post.call_args.args[0], "https://api.hcaptcha.com/siteverify")

    @override_settings(CAPTCHA={**ENABLED, "ENABLED": False})
    def test_disabled_captcha_passes_without_calling_the_provider(self):
        with self.provider() as post:
            self.assertTrue(captcha.verify_captcha("").success)
        post.assert_not_called()

    def test_public_config_never_contains_the_secret(self):
        config = captcha.public_config()
        self.assertEqual(config, {"enabled": True, "provider": "turnstile", "site_key": "public-site-key"})
        self.assertNotIn("private-secret-key", str(config))
