"""
The knowledge base in the Django admin: memberships to manage, the rest to read.

Workspaces and who belongs to them are managed here — there is no console
screen for them yet. Everything that holds vectors (knowledge bases, sources,
documents) is read-only: deleting one here would delete its rows without
asking the AI service to delete its vectors, which is exactly the orphan the
console's deletion job exists to prevent.
"""

from django.contrib import admin

from .models import (
    AuditLog,
    Document,
    IngestionJob,
    KnowledgeBase,
    RagQueryLog,
    Workspace,
    WorkspaceMembership,
)


class ReadOnlyAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class MembershipInline(admin.TabularInline):
    model = WorkspaceMembership
    extra = 1
    autocomplete_fields = ("user",)


@admin.register(Workspace)
class WorkspaceAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "created_at")
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}
    inlines = (MembershipInline,)

    def has_delete_permission(self, request, obj=None):
        # A workspace with knowledge bases is protected at the database level
        # too; this keeps the button from offering what will be refused.
        return obj is None or not obj.knowledge_bases.exists()


@admin.register(WorkspaceMembership)
class WorkspaceMembershipAdmin(admin.ModelAdmin):
    list_display = ("user", "workspace", "role", "created_at")
    list_filter = ("role", "workspace")
    search_fields = ("user__email", "workspace__name")
    autocomplete_fields = ("user",)


@admin.register(KnowledgeBase)
class KnowledgeBaseAdmin(ReadOnlyAdmin):
    list_display = ("name", "workspace", "status", "chat_enabled", "updated_at")
    list_filter = ("status", "chat_enabled", "workspace")
    search_fields = ("name",)


@admin.register(Document)
class DocumentAdmin(ReadOnlyAdmin):
    list_display = ("title", "knowledge_base", "status", "file_type", "chunk_count", "updated_at")
    list_filter = ("status", "file_type")
    search_fields = ("title",)
    exclude = ("active_version", "latest_version")


@admin.register(IngestionJob)
class IngestionJobAdmin(ReadOnlyAdmin):
    list_display = ("id", "kind", "status", "stage", "attempts", "created_at", "duration_ms")
    list_filter = ("kind", "status")


@admin.register(AuditLog)
class AuditLogAdmin(ReadOnlyAdmin):
    list_display = ("created_at", "action", "target_type", "target_label", "actor")
    list_filter = ("action",)
    search_fields = ("target_label", "target_id")


@admin.register(RagQueryLog)
class RagQueryLogAdmin(ReadOnlyAdmin):
    list_display = ("created_at", "kind", "knowledge_base", "support", "total_ms", "error_code")
    list_filter = ("kind", "support")
