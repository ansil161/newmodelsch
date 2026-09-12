"""
manage.py grant_workspace_access <email> --role admin [--workspace default]

Gives an account a role in a workspace — the first step after creating a
staff account, since the knowledge base shows nothing to someone who belongs
to no workspace. Superusers need no membership: they administer every
workspace already.
"""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.utils.text import slugify

from apps.accounts.validators import normalize_email
from apps.knowledge_base.constants import Role
from apps.knowledge_base.models import Workspace, WorkspaceMembership


class Command(BaseCommand):
    help = "Give a user a role in a knowledge-base workspace."

    def add_arguments(self, parser):
        parser.add_argument("email")
        parser.add_argument("--role", choices=Role.values, default=Role.ADMIN)
        parser.add_argument("--workspace", default="default", help="Workspace slug (default: default).")
        parser.add_argument("--create", action="store_true", help="Create the workspace if it does not exist.")

    def handle(self, email, role, workspace, create, **options):
        user = get_user_model().objects.filter(email=normalize_email(email)).first()
        if user is None:
            raise CommandError(f"No account with the email {email}.")

        slug = slugify(workspace)
        target = Workspace.objects.filter(slug=slug).first()
        if target is None:
            if not create:
                raise CommandError(f"No workspace '{slug}'. Pass --create to create it.")
            target = Workspace.objects.create(slug=slug, name=workspace.replace("-", " ").title())

        membership, created = WorkspaceMembership.objects.update_or_create(
            workspace=target, user=user, defaults={"role": role}
        )
        verb = "Added" if created else "Updated"
        self.stdout.write(self.style.SUCCESS(f"{verb}: {user.email} is {membership.role} of {target.name}."))
