import json
import logging
from unittest import mock

from django.conf import settings
from django.db import IntegrityError, transaction
from django.test import RequestFactory, SimpleTestCase, TestCase, override_settings
from rest_framework.request import Request
from rest_framework.test import APIClient, APIRequestFactory
from rest_framework_simplejwt.tokens import AccessToken

from apps.accounts.authentication import CookieJWTAuthentication
from apps.accounts.exceptions import CSRFFailed
from apps.accounts.models import User
from apps.core.http import get_client_ip, rate_limit_key
from apps.core.logging import JsonFormatter, RedactSensitiveFilter

from .base import PASSWORD, AuthAPITestCase


class ResponseHygieneTests(AuthAPITestCase):
    def test_no_credential_ever_appears_in_a_response_body(self):
        login = self.login()
        first_tokens = [login.cookies[self.access_cookie].value, login.cookies[self.refresh_cookie].value]
        me = self.client.get(self.me_url)
        refresh = self.client.post(self.refresh_url)
        second_tokens = [refresh.cookies[self.access_cookie].value, refresh.cookies[self.refresh_cookie].value]
        logout = self.client.post(self.logout_url)

        secrets = [PASSWORD, self.user.password, *first_tokens, *second_tokens]
        for response in (login, me, refresh, logout):
            body = response.content.decode()
            for secret in secrets:
                self.assertNotIn(secret, body)
            for key in ('"password"', '"access"', '"refresh"', '"token"', '"access_token"', '"refresh_token"'):
                self.assertNotIn(key, body)

    def test_unexpected_errors_are_logged_but_never_described_to_the_client(self):
        self.login()
        failure = RuntimeError("database password is hunter2")
        with mock.patch("apps.accounts.views.UserSerializer", side_effect=failure):
            with self.assertLogs("apps.core", level="ERROR") as logs:
                response = self.client.get(self.me_url)

        self.assertEqual(response.status_code, 500)
        self.assertEqual(
            response.json(),
            {"success": False, "message": "Something went wrong. Please try again.", "code": "server_error", "errors": {}},
        )
        self.assertNotIn("hunter2", response.content.decode())
        self.assertNotIn("Traceback", response.content.decode())
        self.assertIn("hunter2", logs.output[0])  # the operator still gets the detail

    def test_internal_token_errors_are_not_described_to_the_client(self):
        client = APIClient()
        client.cookies[self.access_cookie] = "not-a-jwt"
        body = client.get(self.me_url).content.decode()
        self.assertNotIn("AccessToken", body)
        self.assertNotIn("token_class", body)

    def test_auth_responses_are_never_cached(self):
        responses = [self.client.get(self.csrf_url), self.login(), self.client.get(self.me_url)]
        for response in responses:
            self.assertIn("no-store", response["Cache-Control"])

    def test_csrf_bootstrap_returns_only_the_token(self):
        data = self.client.get(self.csrf_url).json()["data"]
        self.assertEqual(list(data), ["csrf_token"])
        self.assertTrue(data["csrf_token"])

    def test_security_headers(self):
        response = self.client.get(self.csrf_url)
        self.assertEqual(response["X-Content-Type-Options"], "nosniff")
        self.assertEqual(response["X-Frame-Options"], "DENY")
        self.assertEqual(response["Referrer-Policy"], "same-origin")
        self.assertIn("frame-ancestors 'none'", response["Content-Security-Policy"])

    def test_there_is_no_registration_endpoint(self):
        for path in ("/api/v1/auth/register/", "/api/v1/auth/signup/", "/api/v1/auth/users/"):
            response = self.client.post(path, {"email": "new@example.com", "password": PASSWORD}, format="json")
            self.assertEqual(response.status_code, 404)
        self.assertFalse(User.objects.filter(email="new@example.com").exists())

    def test_there_is_no_django_admin(self):
        for path in ("/admin/", "/admin/login/"):
            self.assertEqual(self.client.get(path).status_code, 404)


class CookieTests(AuthAPITestCase):
    def test_cookies_are_secure_when_configured(self):
        with override_settings(AUTH_COOKIES={**settings.AUTH_COOKIES, "SECURE": True}):
            response = self.login()
        self.assertTrue(response.cookies[self.access_cookie]["secure"])
        self.assertTrue(response.cookies[self.refresh_cookie]["secure"])

    def test_csrf_cookie_is_httponly(self):
        response = self.client.get(self.csrf_url)
        self.assertTrue(response.cookies[settings.CSRF_COOKIE_NAME]["httponly"])


class CSRFTests(AuthAPITestCase):
    def test_login_without_a_csrf_token_is_refused(self):
        response = self.login(client=APIClient(enforce_csrf_checks=True))
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["code"], "csrf_failed")
        self.assertNotIn(self.access_cookie, response.cookies)

    def test_login_with_a_csrf_token(self):
        client, token = self.csrf_client()
        self.assertEqual(self.login(client=client, HTTP_X_CSRFTOKEN=token).status_code, 200)

    def test_csrf_failure_does_not_consume_the_rate_limit(self):
        rates = {"login_ip_burst": "2/min", "login_ip_sustained": "100/hour", "auth_refresh": "30/min"}
        with override_settings(AUTH_THROTTLE_RATES=rates):
            for _ in range(5):
                self.login(client=APIClient(enforce_csrf_checks=True))
            self.assertEqual(self.login().status_code, 200)

    def test_the_csrf_token_is_rotated_at_login(self):
        client, token = self.csrf_client()
        self.login(client=client, HTTP_X_CSRFTOKEN=token)
        self.assertEqual(client.post(self.refresh_url, HTTP_X_CSRFTOKEN=token).status_code, 403)
        fresh = self.fetch_csrf_token(client)
        self.assertEqual(client.post(self.refresh_url, HTTP_X_CSRFTOKEN=fresh).status_code, 200)

    def test_refresh_requires_a_csrf_token(self):
        client, token = self.csrf_client()
        self.login(client=client, HTTP_X_CSRFTOKEN=token)
        self.assertEqual(client.post(self.refresh_url).status_code, 403)

    def test_cookie_authenticated_unsafe_requests_require_csrf(self):
        factory = APIRequestFactory(enforce_csrf_checks=True)
        request = factory.post("/api/v1/anything/", {}, format="json")
        request.COOKIES[self.access_cookie] = str(AccessToken.for_user(self.user))
        with self.assertRaises(CSRFFailed):
            CookieJWTAuthentication().authenticate(Request(request))

    def test_cookie_authenticated_safe_requests_do_not(self):
        factory = APIRequestFactory(enforce_csrf_checks=True)
        request = factory.get("/api/v1/anything/")
        request.COOKIES[self.access_cookie] = str(AccessToken.for_user(self.user))
        user, _token = CookieJWTAuthentication().authenticate(Request(request))
        self.assertEqual(user, self.user)


@override_settings(CORS_ALLOWED_ORIGINS=["https://www.example.com"])
class CORSTests(AuthAPITestCase):
    def test_an_allowed_origin_may_send_credentials(self):
        response = self.client.get(self.csrf_url, HTTP_ORIGIN="https://www.example.com")
        self.assertEqual(response["Access-Control-Allow-Origin"], "https://www.example.com")
        self.assertEqual(response["Access-Control-Allow-Credentials"], "true")

    def test_any_other_origin_gets_no_cors_headers(self):
        response = self.client.get(self.csrf_url, HTTP_ORIGIN="https://attacker.example")
        self.assertNotIn("Access-Control-Allow-Origin", response)

    def test_wildcard_origins_are_never_enabled(self):
        self.assertFalse(getattr(settings, "CORS_ALLOW_ALL_ORIGINS", False))


class AuditLogTests(AuthAPITestCase):
    def test_auth_events_are_logged_without_credentials_or_email_addresses(self):
        with self.assertLogs("apps.accounts.audit", level="INFO") as captured:
            self.login(password="Wrong-Password-XYZ")
            login = self.login()
            refresh = self.client.post(self.refresh_url)
            self.client.post(self.logout_url)

        events = [record.event for record in captured.records]
        self.assertEqual(events, ["login_failure", "login_success", "refresh_success", "logout"])

        secrets = [
            "Wrong-Password-XYZ",
            PASSWORD,
            self.user.email,
            login.cookies[self.access_cookie].value,
            login.cookies[self.refresh_cookie].value,
            refresh.cookies[self.refresh_cookie].value,
        ]
        for record in captured.records:
            dump = " ".join(str(value) for value in vars(record).values())
            for secret in secrets:
                self.assertNotIn(secret, dump)

        self.assertEqual(captured.records[1].user_id, self.user.pk)
        self.assertTrue(captured.records[0].email_fp)

    def test_rate_limit_events_are_logged(self):
        rates = {"login_ip_burst": "1/min", "login_ip_sustained": "100/hour", "auth_refresh": "30/min"}
        with override_settings(AUTH_THROTTLE_RATES=rates), self.assertLogs("apps.accounts.audit", "WARNING") as captured:
            self.login()
            self.login()
        self.assertIn("rate_limit_triggered", [record.event for record in captured.records])


class LoggingPrimitivesTests(SimpleTestCase):
    def test_sensitive_fields_are_redacted_and_objects_are_not_serialised(self):
        record = logging.LogRecord("t", logging.INFO, __file__, 1, "login_success", (), None)
        record.event = "login_success"
        record.password = "hunter2"
        record.refresh_token = "eyJ..."
        record.request = object()

        RedactSensitiveFilter().filter(record)
        line = json.loads(JsonFormatter().format(record))

        self.assertEqual(line["event"], "login_success")
        self.assertEqual(line["password"], "[redacted]")
        self.assertEqual(line["refresh_token"], "[redacted]")
        self.assertNotIn("request", line)


class ClientIPTests(SimpleTestCase):
    def request(self):
        return RequestFactory().get("/", REMOTE_ADDR="10.0.0.1", HTTP_X_FORWARDED_FOR="198.51.100.1, 203.0.113.5")

    def test_forwarded_for_is_ignored_without_trusted_proxies(self):
        self.assertEqual(get_client_ip(self.request()), "10.0.0.1")

    def test_forwarded_for_is_read_one_hop_per_trusted_proxy(self):
        with override_settings(REST_FRAMEWORK={**settings.REST_FRAMEWORK, "NUM_PROXIES": 1}):
            self.assertEqual(get_client_ip(self.request()), "203.0.113.5")

    def test_ipv6_clients_are_rate_limited_per_64(self):
        self.assertEqual(rate_limit_key("2001:db8:1:2::1"), rate_limit_key("2001:db8:1:2:ffff::9"))
        self.assertNotEqual(rate_limit_key("2001:db8:1:2::1"), rate_limit_key("2001:db8:1:3::1"))
        self.assertEqual(rate_limit_key("203.0.113.5"), "203.0.113.5")


class UserModelTests(TestCase):
    def test_email_is_normalised_on_create(self):
        user = User.objects.create_user(email="  Mixed.Case@Example.COM ", password=PASSWORD)
        self.assertEqual(user.email, "mixed.case@example.com")

    def test_email_is_unique_regardless_of_case(self):
        User.objects.create_user(email="head@example.com", password=PASSWORD)
        with self.assertRaises(IntegrityError), transaction.atomic():
            User.objects.create_user(email="HEAD@example.com", password=PASSWORD)

    def test_database_refuses_an_unnormalised_email(self):
        user = User.objects.create_user(email="head@example.com", password=PASSWORD)
        with self.assertRaises(IntegrityError), transaction.atomic():
            User.objects.filter(pk=user.pk).update(email="Head@Example.com")

    def test_password_is_hashed_with_django(self):
        user = User.objects.create_user(email="head@example.com", password=PASSWORD)
        self.assertNotEqual(user.password, PASSWORD)
        self.assertTrue(user.check_password(PASSWORD))

    def test_user_created_without_a_password_cannot_sign_in(self):
        user = User.objects.create_user(email="head@example.com")
        self.assertFalse(user.has_usable_password())

    def test_create_superuser(self):
        user = User.objects.create_superuser(email="root@example.com", password=PASSWORD)
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)
