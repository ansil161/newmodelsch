from rest_framework.test import APIClient
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken

from apps.accounts.constants import Messages

from .base import AuthAPITestCase


class LogoutTests(AuthAPITestCase):
    def setUp(self):
        super().setUp()
        self.assertEqual(self.login().status_code, 200)

    def test_logout_blacklists_the_refresh_token_and_clears_both_cookies(self):
        refresh = self.client.cookies[self.refresh_cookie].value

        response = self.client.post(self.logout_url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"success": True, "message": Messages.LOGOUT_SUCCESS, "data": {}})
        self.assertTrue(BlacklistedToken.objects.filter(token__token=refresh).exists())
        self.assertCookieCleared(response, self.access_cookie, "/api/")
        self.assertCookieCleared(response, self.refresh_cookie, "/api/v1/auth/")

    def test_a_logged_out_session_is_dead(self):
        refresh = self.client.cookies[self.refresh_cookie].value
        self.client.post(self.logout_url)

        self.assertEqual(self.client.get(self.me_url).status_code, 401)
        replay = APIClient()
        replay.cookies[self.refresh_cookie] = refresh
        self.assertEqual(replay.post(self.refresh_url).status_code, 401)

    def test_logout_is_idempotent(self):
        for _ in range(3):
            self.assertEqual(self.client.post(self.logout_url).status_code, 200)

    def test_logout_without_any_session_succeeds(self):
        response = APIClient().post(self.logout_url)
        self.assertEqual(response.status_code, 200)
        self.assertCookieCleared(response, self.access_cookie, "/api/")

    def test_logout_with_a_garbage_refresh_cookie_succeeds(self):
        client = APIClient()
        client.cookies[self.refresh_cookie] = "garbage"
        self.assertEqual(client.post(self.logout_url).status_code, 200)

    def test_logout_requires_a_csrf_token(self):
        client, token = self.csrf_client()
        self.assertEqual(self.login(client=client, HTTP_X_CSRFTOKEN=token).status_code, 200)

        response = client.post(self.logout_url)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["code"], "csrf_failed")

        fresh = self.fetch_csrf_token(client)
        self.assertEqual(client.post(self.logout_url, HTTP_X_CSRFTOKEN=fresh).status_code, 200)
