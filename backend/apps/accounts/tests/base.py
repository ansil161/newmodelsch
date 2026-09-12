from unittest import mock

from django.conf import settings
from django.core.cache import cache
from django.urls import reverse
from rest_framework.test import APIClient, APITestCase

from apps.accounts.captcha import CaptchaResult
from apps.accounts.models import User

PASSWORD = "Correct-Horse-Battery-9"
_DEFAULT = object()


class AuthAPITestCase(APITestCase):
    """
    One active user, CAPTCHA verification stubbed to pass (it has its own
    tests in test_captcha.py), and a clean cache so rate limits and lockouts
    never leak between tests.
    """

    def setUp(self):
        super().setUp()
        cache.clear()
        self.csrf_url = reverse("accounts:csrf")
        self.login_url = reverse("accounts:login")
        self.refresh_url = reverse("accounts:refresh")
        self.logout_url = reverse("accounts:logout")
        self.me_url = reverse("accounts:me")

        self.user = User.objects.create_user(email="teacher@example.com", password=PASSWORD, full_name="Asha Rao")

        patcher = mock.patch("apps.accounts.views.verify_captcha", return_value=CaptchaResult(True))
        self.verify_captcha = patcher.start()
        self.addCleanup(patcher.stop)

    @property
    def access_cookie(self):
        return settings.AUTH_COOKIES["ACCESS_NAME"]

    @property
    def refresh_cookie(self):
        return settings.AUTH_COOKIES["REFRESH_NAME"]

    def login(self, email=_DEFAULT, password=PASSWORD, *, client=None, **extra):
        client = client or self.client
        payload = {
            "email": self.user.email if email is _DEFAULT else email,
            "password": password,
            "captcha_token": "captcha-token",
        }
        return client.post(self.login_url, payload, format="json", **extra)

    def csrf_client(self):
        """A client that enforces CSRF as a browser deployment does, and a token for it."""
        client = APIClient(enforce_csrf_checks=True)
        return client, self.fetch_csrf_token(client)

    def fetch_csrf_token(self, client):
        return client.get(self.csrf_url).json()["data"]["csrf_token"]

    def assertCookieCleared(self, response, name, path):
        morsel = response.cookies[name]
        self.assertEqual(morsel.value, "")
        self.assertEqual(morsel["max-age"], 0)
        self.assertEqual(morsel["path"], path)
        self.assertTrue(morsel["httponly"])
