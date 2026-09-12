"""
A first workspace, so a fresh install has somewhere to put a knowledge base.

Superusers administer it immediately. Anyone else is added with
`manage.py grant_workspace_access <email> --role admin`.
"""

from django.db import migrations


def create_default_workspace(apps, schema_editor):
    Workspace = apps.get_model("knowledge_base", "Workspace")
    if not Workspace.objects.exists():
        Workspace.objects.create(name="Default workspace", slug="default")


class Migration(migrations.Migration):
    dependencies = [("knowledge_base", "0001_initial")]

    operations = [migrations.RunPython(create_default_workspace, migrations.RunPython.noop)]
