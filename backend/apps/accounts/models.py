from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower
from django.utils import timezone

from .validators import normalize_email


class UserManager(BaseUserManager):
    """
    Accounts are created by administrators - with `create_account` or
    `createsuperuser` - never through the API. There is no signup.
    """

    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("An email address is required.")
        user = self.model(email=normalize_email(email), **extra_fields)
        # None leaves an unusable password: the account exists but cannot sign in.
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        if extra_fields["is_staff"] is not True:
            raise ValueError("A superuser must have is_staff=True.")
        if extra_fields["is_superuser"] is not True:
            raise ValueError("A superuser must have is_superuser=True.")
        return self._create_user(email, password, **extra_fields)

    def get_by_natural_key(self, email):
        return self.get(email=normalize_email(email))


class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(
        "email address",
        max_length=254,
        unique=True,
        error_messages={"unique": "A user with that email address already exists."},
    )
    full_name = models.CharField("full name", max_length=150, blank=True)
    is_active = models.BooleanField(
        "active",
        default=True,
        help_text="Unticking this blocks sign-in and ends the user's sessions on their next request. "
        "Prefer it to deleting an account.",
    )
    is_staff = models.BooleanField(
        "staff status",
        default=False,
        help_text="Designates whether the user can sign in to this admin site.",
    )
    date_joined = models.DateTimeField("date joined", default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    EMAIL_FIELD = "email"
    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    class Meta:
        verbose_name = "user"
        verbose_name_plural = "users"
        ordering = ("email",)
        constraints = [
            # Emails are normalised before every save. This makes the database
            # enforce it too, so `unique=True` is case-insensitive in effect
            # even for rows written by a bulk update or raw SQL.
            models.CheckConstraint(
                condition=Q(email=Lower("email")),
                name="accounts_user_email_lowercase",
                violation_error_message="Email addresses are stored in lower case.",
            ),
        ]

    def __str__(self):
        return self.email

    def clean(self):
        super().clean()
        self.email = normalize_email(self.email)

    def save(self, *args, **kwargs):
        self.email = normalize_email(self.email)
        super().save(*args, **kwargs)

    def get_full_name(self):
        return self.full_name or self.email

    def get_short_name(self):
        return self.full_name.split(" ")[0] if self.full_name else self.email
