from datetime import timedelta

from django.test import override_settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken

from apps.accounts.constants import Messages

from .base import AuthAPITestCase


class RefreshTests(AuthAPITestCase):
    def setUp(self):
        super().setUp()
        self.assertEqual(self.login().status_code, 200)

    def refresh(self, client=None):
        return (client or self.client).post(self.refresh_url, format="json")

    def client_with_refresh_cookie(self, value):
        client = APIClient()
        client.cookies[self.refresh_cookie] = value
        return client

    def assertSessionExpired(self, response, *, cleared=True):
        self.assertEqual(response.status_code, 401)
        self.assertEqual(
            response.json(),
            {"success": False, "message": Messages.SESSION_EXPIRED, "code": "session_expired", "errors": {}},
        )
        self.assertIn("WWW-Authenticate", response)
        if cleared:
            self.assertCookieCleared(response, self.access_cookie, "/api/")
            self.assertCookieCleared(response, self.refresh_cookie, "/api/v1/auth/")
        else:
            self.assertNotIn(self.access_cookie, response.cookies)
            self.assertNotIn(self.refresh_cookie, response.cookies)

    def test_valid_refresh_rotates_both_cookies(self):
        old_refresh = self.client.cookies[self.refresh_cookie].value
        old_access = self.client.cookies[self.access_cookie].value

        response = self.refresh()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"success": True, "message": Messages.REFRESH_SUCCESS, "data": {}})
        new_refresh = response.cookies[self.refresh_cookie].value
        new_access = response.cookies[self.access_cookie].value
        self.assertNotEqual(new_refresh, old_refresh)
        self.assertNotEqual(new_access, old_access)
        self.assertTrue(BlacklistedToken.objects.filter(token__token=old_refresh).exists())
        self.assertTrue(OutstandingToken.objects.filter(token=new_refresh, blacklistedtoken__isnull=True).exists())

    def test_the_new_access_token_authenticates(self):
        self.refresh()
        self.assertEqual(self.client.get(self.me_url).status_code, 200)

    def test_refresh_cookie_missing(self):
        self.assertSessionExpired(self.refresh(APIClient()))

    def test_invalid_refresh_cookie(self):
        self.assertSessionExpired(self.refresh(self.client_with_refresh_cookie("not-a-jwt")))

    def test_expired_refresh_token(self):
        token = RefreshToken.for_user(self.user)
        token.set_exp(lifetime=timedelta(seconds=-1))
        self.assertSessionExpired(self.refresh(self.client_with_refresh_cookie(str(token))))

    @override_settings(AUTH_REFRESH_REUSE_GRACE_SECONDS=0)
    def test_blacklisted_refresh_token(self):
        token = self.client.cookies[self.refresh_cookie].value
        self.client.post(self.logout_url)
        self.assertSessionExpired(self.refresh(self.client_with_refresh_cookie(token)))

    def test_refresh_racing_a_logout_is_refused_quietly(self):
        # A refresh already in flight when the user signs out arrives with the
        # token logout has just blacklisted. Refused, but not treated as theft.
        other_device = APIClient()
        self.login(client=other_device)
        token = self.client.cookies[self.refresh_cookie].value
        self.client.post(self.logout_url)

        self.assertSessionExpired(self.refresh(self.client_with_refresh_cookie(token)), cleared=False)
        self.assertEqual(self.refresh(other_device).status_code, 200)

    def test_an_access_token_is_not_a_refresh_token(self):
        access = self.client.cookies[self.access_cookie].value
        self.assertSessionExpired(self.refresh(self.client_with_refresh_cookie(access)))

    def test_deactivated_user_cannot_refresh(self):
        self.user.is_active = False
        self.user.save()
        self.assertSessionExpired(self.refresh())

    def test_password_change_ends_the_session(self):
        self.user.set_password("A-Brand-New-Password-1")
        self.user.save()
        self.assertEqual(self.client.get(self.me_url).status_code, 401)
        self.assertSessionExpired(self.refresh())

    @override_settings(AUTH_REFRESH_REUSE_GRACE_SECONDS=0)
    def test_reusing_a_rotated_token_revokes_every_session(self):
        stolen = self.client.cookies[self.refresh_cookie].value
        self.assertEqual(self.refresh().status_code, 200)  # the real user rotates

        self.assertSessionExpired(self.refresh(self.client_with_refresh_cookie(stolen)))  # the copy is replayed

        self.assertFalse(OutstandingToken.objects.filter(user=self.user, blacklistedtoken__isnull=True).exists())
        # The real user's freshly rotated token is revoked along with the rest.
        self.assertSessionExpired(self.refresh())

    def test_concurrent_rotation_within_the_grace_period_leaves_the_winner_alone(self):
        stale = self.client.cookies[self.refresh_cookie].value
        self.assertEqual(self.refresh().status_code, 200)  # the tab that won the race

        # The tab that lost: refused, but its response must not clear the
        # cookies the winner has just set.
        self.assertSessionExpired(self.refresh(self.client_with_refresh_cookie(stale)), cleared=False)
        self.assertEqual(self.refresh().status_code, 200)

    def test_refresh_is_rate_limited(self):
        rates = {"login_ip_burst": "10/min", "login_ip_sustained": "100/hour", "auth_refresh": "2/min"}
        with override_settings(AUTH_THROTTLE_RATES=rates):
            self.refresh()
            self.refresh()
            response = self.refresh()
        self.assertEqual(response.status_code, 429)
