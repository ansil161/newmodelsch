"""/api/v1/ — the knowledge base, its documents and sources, Test RAG, chat, and the website's public chat."""

from django.urls import path

from . import chat, views

app_name = "knowledge_base"

urlpatterns = [
    path("workspaces/", views.WorkspaceListView.as_view(), name="workspaces"),
    path("knowledge-bases/", views.KnowledgeBaseListView.as_view(), name="knowledge-bases"),
    path("knowledge-bases/<uuid:pk>/", views.KnowledgeBaseDetailView.as_view(), name="knowledge-base"),
    path("knowledge-bases/<uuid:pk>/overview/", views.KnowledgeBaseOverviewView.as_view(), name="overview"),
    path("knowledge-bases/<uuid:pk>/documents/", views.DocumentCollectionView.as_view(), name="documents"),
    path("knowledge-bases/<uuid:pk>/sources/", views.SourceCollectionView.as_view(), name="sources"),
    path("knowledge-bases/<uuid:pk>/jobs/", views.JobListView.as_view(), name="jobs"),
    path("documents/<uuid:pk>/", views.DocumentDetailView.as_view(), name="document"),
    path("documents/<uuid:pk>/reprocess/", views.DocumentActionView.as_view(operation="reprocess"),
         name="document-reprocess"),
    path("documents/<uuid:pk>/retry/", views.DocumentActionView.as_view(operation="retry"),
         name="document-retry"),
    path("documents/<uuid:pk>/cancel/", views.DocumentActionView.as_view(operation="cancel"),
         name="document-cancel"),
    path("documents/<uuid:pk>/versions/", views.DocumentVersionCollectionView.as_view(),
         name="document-versions"),
    path("documents/<uuid:pk>/versions/<uuid:version_pk>/activate/",
         views.DocumentVersionActivateView.as_view(), name="document-version-activate"),
    path("documents/<uuid:pk>/chunks/", views.DocumentChunkListView.as_view(), name="document-chunks"),
    path("documents/<uuid:pk>/download/", views.DocumentDownloadView.as_view(), name="document-download"),
    path("sources/<uuid:pk>/", views.SourceDetailView.as_view(), name="source"),
    path("sources/<uuid:pk>/sync/", views.SourceSyncView.as_view(), name="source-sync"),
    path("rag/test/", views.RagTestView.as_view(), name="rag-test"),
    path("chat/", chat.ChatView.as_view(), name="chat"),
    path("chat/stream/", chat.ChatStreamView.as_view(), name="chat-stream"),
    path("public/chat/stream/", chat.PublicChatStreamView.as_view(), name="public-chat-stream"),
]
