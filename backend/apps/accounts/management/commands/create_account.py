"""
manage.py create_account <email> [--full-name "Asha Rao"] [--staff] [--superuser]

Creates a sign-in account, prompting twice for the password. With the Django
admin gone this and `createsuperuser` are the only ways an account comes into
being - there is no signup. Follow it with `grant_workspace_access` to give a
non-superuser access to a knowledge-base workspace.
"""

import getpass

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError

from apps.accounts.validators import normalize_email


class Command(BaseCommand):
    help = "Create a sign-in account."

    def add_arguments(self, parser):
        parser.add_argument("email")
        parser.add_argument("--full-name", default="")
        parser.add_argument("--staff", action="store_true", help="Mark the account as staff.")
        parser.add_argument("--superuser", action="store_true", help="Administrator of every workspace.")

    def handle(self, email, full_name, staff, superuser, **options):
        User = get_user_model()
        email = normalize_email(email)
        if not email:
            raise CommandError("An email address is required.")
        if User.objects.filter(email=email).exists():
            raise CommandError(f"An account with the email {email} already exists.")

        password = getpass.getpass("Password: ")
        if password != getpass.getpass("Password (again): "):
            raise CommandError("The passwords do not match.")
        try:
            validate_password(password, User(email=email, full_name=full_name))
        except ValidationError as exc:
            raise CommandError(" ".join(exc.messages)) from exc

        if superuser:
            user = User.objects.create_superuser(email=email, password=password, full_name=full_name)
        else:
            user = User.objects.create_user(email=email, password=password, full_name=full_name, is_staff=staff)
        self.stdout.write(self.style.SUCCESS(f"Created {user.email}."))
