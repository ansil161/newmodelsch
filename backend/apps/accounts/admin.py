from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.auth.forms import AdminUserCreationForm, UserChangeForm
from django.utils import timezone

from .models import User
from .services import revoke_all_refresh_tokens
from .validators import normalize_email


class UserCreationAdminForm(AdminUserCreationForm):
    class Meta(AdminUserCreationForm.Meta):
        model = User
        fields = ("email", "full_name")
        field_classes = {}

    def clean_email(self):
        return normalize_email(self.cleaned_data["email"])


class UserChangeAdminForm(UserChangeForm):
    class Meta(UserChangeForm.Meta):
        model = User
        fields = "__all__"
        field_classes = {}

    def clean_email(self):
        return normalize_email(self.cleaned_data["email"])


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    """
    The only way accounts come into being. Deactivate rather than delete: a
    deactivated user is refused at sign-in, on refresh and on every request
    carrying an access token, and keeps their history.
    """

    form = UserChangeAdminForm
    add_form = UserCreationAdminForm

    ordering = ("email",)
    list_display = ("email", "full_name", "is_active", "is_staff", "is_superuser", "last_login", "date_joined")
    list_filter = ("is_active", "is_staff", "is_superuser", "groups")
    search_fields = ("email", "full_name")
    readonly_fields = ("last_login", "date_joined", "created_at", "updated_at")
    filter_horizontal = ("groups", "user_permissions")

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Profile", {"fields": ("full_name",)}),
        ("Access", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Dates", {"fields": ("last_login", "date_joined", "created_at", "updated_at")}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "full_name", "usable_password", "password1", "password2", "is_active", "is_staff"),
            },
        ),
    )

    actions = ("activate_users", "deactivate_users")

    @admin.action(description="Activate selected users", permissions=["change"])
    def activate_users(self, request, queryset):
        count = queryset.filter(is_active=False).update(is_active=True, updated_at=timezone.now())
        self.message_user(request, f"Activated {count} user(s).", messages.SUCCESS)

    @admin.action(description="Deactivate selected users and sign them out", permissions=["change"])
    def deactivate_users(self, request, queryset):
        # An administrator cannot lock themselves out from here.
        ids = list(queryset.filter(is_active=True).exclude(pk=request.user.pk).values_list("pk", flat=True))
        User.objects.filter(pk__in=ids).update(is_active=False, updated_at=timezone.now())
        for user_id in ids:
            revoke_all_refresh_tokens(user_id)
        self.message_user(request, f"Deactivated {len(ids)} user(s).", messages.SUCCESS)

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        if change and "is_active" in form.changed_data and not obj.is_active:
            revoke_all_refresh_tokens(obj.pk)
