from django.apps import AppConfig


class KnowledgeBaseConfig(AppConfig):
    name = "apps.knowledge_base"
    label = "knowledge_base"
    verbose_name = "Knowledge base"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self):
        from . import checks  # noqa: F401  (registers the system checks)
