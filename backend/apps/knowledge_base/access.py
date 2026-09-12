"""
Who may do what — decided here, on the server, for every request.

The console hides buttons a role cannot use; that is convenience. This is
the control. Every view resolves its object through one of these functions,
which check the caller's role in the object's workspace:

    not a member         404, exactly as if the object did not exist — a
                         workspace's knowledge bases are not something
                         another workspace may even confirm
    member, role too low 403, with a message saying so
    enough               the object

Superusers are administrators of every workspace: they already are, through
the Django admin, and pretending otherwise here would only move the
workaround somewhere less audited.
"""

import uuid

from rest_framework.exceptions import NotFound

from .constants import ROLE_RANK, Messages, Role
from .exceptions import InvalidState, RoleForbidden
from .models import Document, KnowledgeBase, KnowledgeSource, Workspace, WorkspaceMembership


def parse_uuid(value):
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError):
        return None


def role_for(user, workspace):
    """The user's role in a workspace, or None when they have none."""
    if not (user and user.is_authenticated and user.is_active):
        return None
    if user.is_superuser:
        return Role.ADMIN
    return (
        WorkspaceMembership.objects.filter(user=user, workspace_id=workspace.pk)
        .values_list("role", flat=True)
        .first()
    )


def accessible_workspaces(user):
    if user.is_superuser:
        return Workspace.objects.all()
    return Workspace.objects.filter(memberships__user=user).distinct()


def require_role(user, workspace, minimum):
    role = role_for(user, workspace)
    if role is None:
        raise NotFound()
    if ROLE_RANK[Role(role)] < ROLE_RANK[Role(minimum)]:
        raise RoleForbidden()
    return role


def workspace_for(user, pk, minimum=Role.VIEWER):
    identifier = parse_uuid(pk)
    workspace = Workspace.objects.filter(pk=identifier).first() if identifier else None
    if workspace is None:
        raise NotFound()
    require_role(user, workspace, minimum)
    return workspace


def knowledge_base_for(user, pk, minimum=Role.VIEWER, *, allow_deleting=False):
    knowledge_base = KnowledgeBase.objects.select_related("workspace").filter(pk=pk).first()
    if knowledge_base is None:
        raise NotFound()
    require_role(user, knowledge_base.workspace, minimum)
    if knowledge_base.is_deleting and not allow_deleting:
        raise InvalidState(Messages.KB_DELETING_BLOCKED)
    return knowledge_base


def document_for(user, pk, minimum=Role.VIEWER):
    document = (
        Document.objects.select_related(
            "knowledge_base__workspace", "source", "active_version", "latest_version", "created_by"
        )
        .filter(pk=pk)
        .first()
    )
    if document is None:
        raise NotFound()
    require_role(user, document.knowledge_base.workspace, minimum)
    if document.knowledge_base.is_deleting:
        raise InvalidState(Messages.KB_DELETING_BLOCKED)
    return document


def source_for(user, pk, minimum=Role.VIEWER):
    source = KnowledgeSource.objects.select_related("knowledge_base__workspace").filter(pk=pk).first()
    if source is None:
        raise NotFound()
    require_role(user, source.knowledge_base.workspace, minimum)
    if source.knowledge_base.is_deleting:
        raise InvalidState(Messages.KB_DELETING_BLOCKED)
    return source
