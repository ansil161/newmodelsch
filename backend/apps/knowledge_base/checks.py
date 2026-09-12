from django.conf import settings
from django.core.checks import Error, Tags, Warning, register


@register()
def job_settings(app_configs, **kwargs):
    config = settings.KNOWLEDGE_BASE
    problems = []
    if config["DISPATCH"] not in ("worker", "thread"):
        problems.append(Error("KB_TASK_DISPATCH must be 'worker' or 'thread'.", id="knowledge_base.E002"))
    if config["JOB_STALE_SECONDS"] <= config["INGEST_TIMEOUT"]:
        problems.append(
            Error(
                "KB_JOB_STALE_SECONDS must be longer than KB_INGEST_TIMEOUT_SECONDS.",
                hint="A job cannot heartbeat from inside an AI service call; a shorter stale "
                "threshold would let a second worker reclaim a job that is still running.",
                id="knowledge_base.E003",
            )
        )
    if config["DISPATCH"] == "thread" and not settings.DEBUG:
        problems.append(
            Warning(
                "Knowledge-base jobs run in a thread of the web process.",
                hint="Set KB_TASK_DISPATCH=worker and run `manage.py process_documents`. Thread "
                "dispatch dies with the web process and is meant for local development.",
                id="knowledge_base.W001",
            )
        )
    return problems


@register(Tags.security, deploy=True)
def ai_service_security(app_configs, **kwargs):
    config = settings.KNOWLEDGE_BASE
    problems = []
    if not config["AI_SERVICE_TOKEN"]:
        problems.append(
            Error(
                "AI_SERVICE_TOKEN is not set.",
                hint="The AI service refuses unauthenticated requests in production; set it to the "
                "AI service's SECURITY__SERVICE_TOKEN.",
                id="knowledge_base.E001",
            )
        )
    if config["MALWARE_SCANNER"] == "none":
        problems.append(
            Warning(
                "Uploaded files are not scanned for malware.",
                hint="Set KB_MALWARE_SCANNER=clamav and point CLAMAV_HOST at a clamd daemon.",
                id="knowledge_base.W002",
            )
        )
    return problems
