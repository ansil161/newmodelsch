import time
from unittest import mock

from django.conf import settings
from django.test import override_settings
from rest_framework_simplejwt.settings import api_settings as jwt_settings

from apps.accounts.captcha import CaptchaResult
from apps.accounts.constants import Messages
from apps.accounts.models import User

from .base import PASSWORD, AuthAPITestCase

LOW_IP_RATES = {"login_ip_burst": "3/min", "login_ip_sustained": "100/hour", "auth_refresh": "30/min"}


class LoginTests(AuthAPITestCase):
    def test_valid_credentials_return_the_user_and_set_cookies(self):
        response = self.login()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "success": True,
                "message": Messages.LOGIN_SUCCESS,
                "data": {
                    "user": {"id": self.user.pk, "email": "teacher@example.com", "full_name": "Asha Rao", "is_staff": False}
                },
            },
        )

        access = response.cookies[self.access_cookie]
        refresh = response.cookies[self.refresh_cookie]
        self.assertTrue(access.value)
        self.assertTrue(refresh.value)
        for morsel in (access, refresh):
            self.assertTrue(morsel["httponly"])
            self.assertEqual(morsel["samesite"], "Lax")
        self.assertEqual(access["path"], "/api/")
        self.assertEqual(refresh["path"], "/api/v1/auth/")
        self.assertEqual(access["max-age"], int(jwt_settings.ACCESS_TOKEN_LIFETIME.total_seconds()))
        self.assertEqual(refresh["max-age"], int(jwt_settings.REFRESH_TOKEN_LIFETIME.total_seconds()))

    def test_login_updates_last_login(self):
        self.assertIsNone(self.user.last_login)
        self.login()
        self.user.refresh_from_db()
        self.assertIsNotNone(self.user.last_login)

    def test_email_is_trimmed_and_case_insensitive(self):
        self.assertEqual(self.login(email="  Teacher@EXAMPLE.com ").status_code, 200)

    def assertInvalidCredentials(self, response):
        self.assertEqual(response.status_code, 401)
        self.assertEqual(
            response.json(),
            {"success": False, "message": "Invalid email or password.", "code": "invalid_credentials", "errors": {}},
        )
        self.assertNotIn(self.access_cookie, response.cookies)
        self.assertNotIn(self.refresh_cookie, response.cookies)

    def test_unknown_email_gets_the_generic_error(self):
        self.assertInvalidCredentials(self.login(email="nobody@example.com"))

    def test_wrong_password_gets_the_same_generic_error(self):
        self.assertInvalidCredentials(self.login(password="not-the-password"))

    def test_inactive_user_gets_the_same_generic_error(self):
        self.user.is_active = False
        self.user.save()
        self.assertInvalidCredentials(self.login())

    def test_user_without_a_usable_password_cannot_sign_in(self):
        self.user.set_unusable_password()
        self.user.save()
        self.assertInvalidCredentials(self.login())

    def assertFieldError(self, response, field):
        self.assertEqual(response.status_code, 400)
        body = response.json()
        self.assertFalse(body["success"])
        self.assertEqual(body["code"], "invalid")
        self.assertIn(field, body["errors"])

    def test_missing_email(self):
        response = self.client.post(self.login_url, {"password": PASSWORD, "captcha_token": "t"}, format="json")
        self.assertFieldError(response, "email")

    def test_missing_password(self):
        response = self.client.post(self.login_url, {"email": self.user.email, "captcha_token": "t"}, format="json")
        self.assertFieldError(response, "password")

    def test_blank_password(self):
        self.assertFieldError(self.login(password=""), "password")

    def test_malformed_email(self):
        self.assertFieldError(self.login(email="not-an-email"), "email")

    def test_malformed_json(self):
        response = self.client.post(self.login_url, data="{", content_type="application/json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.json()["success"])

    def test_get_is_not_allowed(self):
        self.assertEqual(self.client.get(self.login_url).status_code, 405)


class LoginCaptchaTests(AuthAPITestCase):
    def test_captcha_token_and_client_ip_are_sent_for_verification(self):
        self.login(REMOTE_ADDR="203.0.113.7")
        self.verify_captcha.assert_called_once_with("captcha-token", "203.0.113.7")

    def test_captcha_success_allows_sign_in(self):
        self.verify_captcha.return_value = CaptchaResult(True)
        self.assertEqual(self.login().status_code, 200)

    def test_captcha_failure_is_rejected_before_the_password_is_checked(self):
        self.verify_captcha.return_value = CaptchaResult(False, ("invalid-input-response",))
        with mock.patch("apps.accounts.views.authenticate") as authenticate:
            response = self.login()

        authenticate.assert_not_called()
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {"success": False, "message": Messages.CAPTCHA_FAILED, "code": "captcha_failed", "errors": {}},
        )
        self.assertNotIn(self.access_cookie, response.cookies)

    def test_captcha_failures_do_not_count_toward_the_account_lock(self):
        self.verify_captcha.return_value = CaptchaResult(False, ("invalid-input-response",))
        for _ in range(settings.AUTH_LOGIN_FAILURE_LIMIT + 2):
            self.login(password="wrong")

        self.verify_captcha.return_value = CaptchaResult(True)
        self.assertEqual(self.login().status_code, 200)


class AccountLockTests(AuthAPITestCase):
    def fail(self, email=None, times=None):
        for _ in range(times or settings.AUTH_LOGIN_FAILURE_LIMIT):
            response = self.login(email=email or self.user.email, password="wrong")
            self.assertEqual(response.status_code, 401)

    def test_account_is_locked_after_repeated_failures_even_for_the_right_password(self):
        self.fail()
        response = self.login()

        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.json()["message"], "Too many attempts. Please try again later.")
        self.assertEqual(response.json()["code"], "throttled")
        self.assertIn("Retry-After", response)
        self.assertNotIn(self.access_cookie, response.cookies)

    def test_lock_is_per_account(self):
        other = User.objects.create_user(email="head@example.com", password=PASSWORD)
        self.fail()
        self.assertEqual(self.login(email=other.email).status_code, 200)

    def test_unknown_email_locks_exactly_like_a_real_one(self):
        self.fail(email="ghost@example.com")
        self.assertEqual(self.login(email="ghost@example.com", password="wrong").status_code, 429)

    def test_success_resets_the_failure_count(self):
        limit = settings.AUTH_LOGIN_FAILURE_LIMIT
        self.fail(times=limit - 1)
        self.assertEqual(self.login().status_code, 200)
        self.fail(times=limit - 1)
        self.assertEqual(self.login().status_code, 200)

    def test_lock_is_never_permanent(self):
        self.fail()
        self.assertEqual(self.login().status_code, 429)

        later = time.time() + settings.AUTH_LOGIN_FAILURE_WINDOW + 1
        with mock.patch("time.time", return_value=later):
            self.assertEqual(self.login().status_code, 200)


@override_settings(AUTH_THROTTLE_RATES=LOW_IP_RATES)
class IPRateLimitTests(AuthAPITestCase):
    def test_login_is_rate_limited_per_ip(self):
        for n in range(3):
            self.login(email=f"user{n}@example.com", password="wrong")
        response = self.login()

        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.json()["message"], "Too many attempts. Please try again later.")
        self.assertIn("Retry-After", response)

    def test_x_forwarded_for_cannot_be_used_to_dodge_the_limit(self):
        for n in range(3):
            self.login(email=f"user{n}@example.com", password="wrong", HTTP_X_FORWARDED_FOR=f"198.51.100.{n}")
        response = self.login(HTTP_X_FORWARDED_FOR="198.51.100.99")
        self.assertEqual(response.status_code, 429)

    def test_other_clients_are_unaffected(self):
        for n in range(3):
            self.login(email=f"user{n}@example.com", password="wrong", REMOTE_ADDR="203.0.113.1")
        self.assertEqual(self.login(REMOTE_ADDR="203.0.113.2").status_code, 200)
