"""/api/internal/ — server-to-server only. See internal.py."""

from django.urls import path

from . import internal

app_name = "knowledge_base_internal"

urlpatterns = [
    path("knowledge-base/documents/", internal.InternalDocumentListView.as_view(), name="documents"),
    path("knowledge-base/documents/<uuid:pk>/chunks/", internal.InternalDocumentChunksView.as_view(),
         name="document-chunks"),
]
