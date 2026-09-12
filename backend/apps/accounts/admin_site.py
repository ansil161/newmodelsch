import math

from django.contrib import admin
from django.http import HttpResponse

from .constants import Messages
from .throttles import LoginIPBurstThrottle, LoginIPSustainedThrottle


class ThrottledAdminSite(admin.AdminSite):
    """
    The admin login is a second password prompt for the same accounts. It
    shares the API login's per-account lockout (through EmailBackend) and,
    here, its per-IP limits - so it is never the easier door to brute-force.
    """

    site_header = "New Model High School administration"
    site_title = "NMHS admin"
    index_title = "Administration"

    def login(self, request, extra_context=None):
        if request.method == "POST":
            for throttle in (LoginIPBurstThrottle(), LoginIPSustainedThrottle()):
                if not throttle.allow_request(request, None):
                    response = HttpResponse(
                        Messages.TOO_MANY_ATTEMPTS, status=429, content_type="text/plain; charset=utf-8"
                    )
                    wait = throttle.wait()
                    if wait:
                        response["Retry-After"] = str(math.ceil(wait))
                    return response
        return super().login(request, extra_context)
