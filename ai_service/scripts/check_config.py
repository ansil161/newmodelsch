"""Verify configuration and connectivity before starting the service.

    python scripts/check_config.py

Answers the question a deployment actually has: *is this box configured, and
can it reach what it needs?* It builds the real Settings, reports what is
configured, and then makes one small call to each dependency.

NOTHING HERE PRINTS A SECRET. Keys are reported as present or absent, and
where two might be confused (a Groq `gsk_…` key pasted into the xAI slot, say)
only the first few characters are shown. That is enough to tell two keys apart
and not enough to use one.

Exit code is 0 if everything needed to answer a question is reachable, 1
otherwise — so it can be a container pre-flight step or a deploy gate.
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

# Runnable as `python scripts/check_config.py` from the service root, which
# would otherwise not have the package on the path.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import Settings, get_settings
from app.core.lifecycle import AppResources
from app.core.security import redact

OK = "  ok  "
WARN = " warn "
FAIL = " fail "


def line(status: str, label: str, detail: str = "") -> None:
    print(f"[{status}] {label:<34}{detail}")


def rule(title: str) -> None:
    print(f"\n{title}\n{'-' * 74}")


def report_configuration(settings: Settings) -> list[str]:
    """What is set. Returns the list of problems that would stop an answer."""
    problems: list[str] = []

    rule("Configuration")
    line(OK, "environment", settings.environment)
    line(OK, "log format", settings.observability.log_format)

    token = settings.security.service_token
    if token is None:
        status = FAIL if settings.is_production else WARN
        detail = (
            "not set - this service would accept unauthenticated requests"
            if not settings.is_production
            else "not set - required in production"
        )
        line(status, "SECURITY__SERVICE_TOKEN", detail)
        if settings.is_production:
            problems.append("no service token")
    else:
        line(OK, "SECURITY__SERVICE_TOKEN", redact(token.get_secret_value()))

    rule("Embeddings and vectors")
    line(OK, "provider", settings.embedding.provider)
    line(OK, "model", settings.embedding.model)
    line(OK, "dimensions", str(settings.embedding.dimensions))
    line(OK, "collection", settings.qdrant.collection)
    line(OK, "distance", settings.qdrant.distance)

    hosted = settings.embedding.provider == "huggingface_api"
    if hosted and not settings.embedding.api_key:
        line(FAIL, "EMBEDDING__API_KEY", "not set - hosted inference needs a token")
        problems.append("no embedding API key")

    rule("Reranking")
    line(OK, "provider", settings.reranker.provider)
    if settings.reranker.provider == "none":
        line(WARN, "reranking", "disabled - the fused ranking is used as-is")
    else:
        line(OK, "model", settings.reranker.model)

    rule("Language models")
    for name in ("gemini", "groq", "xai"):
        provider = settings.provider_settings(name)  # type: ignore[arg-type]
        role = (
            "primary" if name == settings.llm.primary
            else "fallback" if name == settings.llm.fallback
            else "unused"
        )
        key = provider.api_key
        if key is None:
            status = FAIL if role == "primary" else WARN
            line(status, f"{name} ({role})", "no key")
            if role == "primary":
                problems.append(f"no API key for the primary provider {name}")
        else:
            line(
                OK, f"{name} ({role})",
                f"{provider.model}  {redact(key.get_secret_value())}",
            )

    if settings.llm.fallback is None:
        line(WARN, "fallback", "disabled - a provider outage is an outage")

    rule("Retrieval dials")
    retrieval = settings.retrieval
    line(
        OK, "dense / sparse top k",
        f"{retrieval.dense_top_k} / {retrieval.sparse_top_k}",
    )
    line(OK, "fusion k", str(retrieval.fusion_k))
    line(OK, "rerank top k", str(retrieval.rerank_top_k))
    line(OK, "final context chunks", str(retrieval.final_context_chunks))
    line(OK, "max context characters", str(retrieval.max_context_characters))

    return problems


async def report_connectivity(settings: Settings) -> list[str]:
    """One small call to each dependency."""
    problems: list[str] = []
    rule("Connectivity")

    resources = AppResources.build(settings)
    try:
        try:
            await resources.vector_store.ensure_collection()
            line(OK, "Qdrant", f"collection '{settings.qdrant.collection}' ready")
        except Exception as exc:
            line(FAIL, "Qdrant", f"{type(exc).__name__}: {exc}")
            problems.append("Qdrant unreachable")

        try:
            vector, sparse = await resources.embeddings.encode_query(
                "connectivity check"
            )
            if len(vector) != settings.embedding.dimensions:
                line(
                    FAIL, "Embeddings",
                    f"model returned {len(vector)} dimensions, "
                    f"configuration says {settings.embedding.dimensions}",
                )
                problems.append("embedding dimension mismatch")
            else:
                line(
                    OK, "Embeddings",
                    f"{len(vector)} dense dimensions, "
                    f"{len(sparse.indices)} sparse terms",
                )
        except Exception as exc:
            line(FAIL, "Embeddings", f"{type(exc).__name__}: {exc}")
            problems.append("embedding provider unreachable")

        try:
            healthy = await resources.llm.health()
            line(
                OK if healthy else FAIL,
                "LLM", "reachable" if healthy else "not reachable",
            )
            if not healthy:
                problems.append("no LLM provider reachable")
        except Exception as exc:
            line(FAIL, "LLM", f"{type(exc).__name__}: {exc}")
            problems.append("no LLM provider reachable")
    finally:
        await resources.aclose()

    return problems


async def main() -> int:
    try:
        settings = get_settings()
    except Exception as exc:
        # Settings validation is where a wrong number or a missing required
        # secret is caught, and its message already names the variable.
        print(f"[{FAIL}] Configuration is invalid:\n\n{exc}")
        return 1

    problems = report_configuration(settings)
    problems += await report_connectivity(settings)

    rule("Result")
    if problems:
        for problem in problems:
            line(FAIL, problem)
        print("\nThe service would not be able to answer a question.")
        return 1

    print("Ready. Everything needed to answer a question is configured and reachable.")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
