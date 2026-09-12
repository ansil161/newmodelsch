"""
The knowledge base's audit trail: a row per change, and a log line.

Same rules as accounts/audit.py: identifiers and names of what changed, never
file contents, chunk text, questions or answers.
"""

import logging

from apps.core.http import get_client_ip

from .models import AuditLog, KnowledgeBase

logger = logging.getLogger("apps.knowledge_base.audit")


def record(action, *, request=None, actor=None, target=None, knowledge_base=None, **metadata):
    if actor is None and request is not None and request.user.is_authenticated:
        actor = request.user
    if knowledge_base is None:
        knowledge_base = target if isinstance(target, KnowledgeBase) else getattr(target, "knowledge_base", None)
    workspace = knowledge_base.workspace if knowledge_base is not None else None

    entry = AuditLog.objects.create(
        workspace=workspace,
        actor=actor,
        action=action,
        target_type=target.__class__.__name__.lower() if target is not None else "",
        target_id=str(target.pk) if target is not None else "",
        target_label=_label(target),
        knowledge_base_id_ref=knowledge_base.pk if knowledge_base is not None else None,
        metadata=metadata,
        ip=(get_client_ip(request) or None) if request is not None else None,
    )
    logger.info(
        action,
        extra={
            "event": "kb_audit",
            "action": action,
            "target_type": entry.target_type,
            "target_id": entry.target_id,
            "workspace_id": str(workspace.pk) if workspace is not None else None,
            "user_id": actor.pk if actor is not None else None,
        },
    )
    return entry


def _label(target):
    if target is None:
        return ""
    for attribute in ("title", "name"):
        value = getattr(target, attribute, None)
        if value:
            return str(value)[:300]
    return str(target)[:300]
