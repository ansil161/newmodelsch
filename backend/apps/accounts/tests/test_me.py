from datetime import timedelta

from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from apps.accounts.constants import Messages

from .base import AuthAPITestCase


class MeTests(AuthAPITestCase):
    def client_with_access_cookie(self, value):
        client = APIClient()
        client.cookies[self.access_cookie] = value
        return client

    def assertUnauthenticated(self, response):
        self.assertEqual(response.status_code, 401)
        body = response.json()
        self.assertFalse(body["success"])
        self.assertEqual(body["code"], "not_authenticated")
        self.assertIn("WWW-Authenticate", response)

    def test_authenticated_request_returns_the_safe_user_fields(self):
        self.login()
        response = self.client.get(self.me_url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "success": True,
                "message": Messages.CURRENT_USER,
                "data": {
                    "user": {"id": self.user.pk, "email": "teacher@example.com", "full_name": "Asha Rao", "is_staff": False}
                },
            },
        )

    def test_unauthenticated_request(self):
        self.assertUnauthenticated(APIClient().get(self.me_url))

    def test_expired_access_token(self):
        token = AccessToken.for_user(self.user)
        token.set_exp(lifetime=timedelta(seconds=-1))
        self.assertUnauthenticated(self.client_with_access_cookie(str(token)).get(self.me_url))

    def test_tampered_access_token(self):
        token = str(AccessToken.for_user(self.user))
        header, payload, signature = token.split(".")
        forged = f"{header}.{payload}.{signature[::-1]}"
        self.assertUnauthenticated(self.client_with_access_cookie(forged).get(self.me_url))

    def test_a_refresh_token_is_not_an_access_token(self):
        refresh = str(RefreshToken.for_user(self.user))
        self.assertUnauthenticated(self.client_with_access_cookie(refresh).get(self.me_url))

    def test_bearer_header_is_not_accepted(self):
        token = str(AccessToken.for_user(self.user))
        self.assertUnauthenticated(APIClient().get(self.me_url, HTTP_AUTHORIZATION=f"Bearer {token}"))

    def test_deactivation_takes_effect_on_the_next_request(self):
        self.login()
        self.user.is_active = False
        self.user.save()
        self.assertUnauthenticated(self.client.get(self.me_url))

    def test_a_stale_access_cookie_does_not_block_login(self):
        client = self.client_with_access_cookie("stale.and.invalid")
        self.assertEqual(self.login(client=client).status_code, 200)
