"""Django-level error views, for errors raised outside a DRF view."""

from django.http import JsonResponse

from .responses import GENERIC_ERROR, failure


def not_found(request, exception=None):
    return JsonResponse(failure("Not found.", code="not_found"), status=404)


def server_error(request):
    return JsonResponse(failure(GENERIC_ERROR, code="server_error"), status=500)
