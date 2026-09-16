from django.urls import include, path

urlpatterns = [
    path("api/v1/auth/", include("apps.accounts.urls")),
    path("api/v1/", include("apps.knowledge_base.urls")),
    # Server to server: the AI service's re-index worker. Token-authenticated
    # and never linked from the console; see apps/knowledge_base/internal.py.
    path("api/internal/", include("apps.knowledge_base.internal_urls")),
]

# JSON rather than Django's HTML pages; only used when DEBUG is off.
handler404 = "apps.core.views.not_found"
handler500 = "apps.core.views.server_error"
