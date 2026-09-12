"""Health endpoints.

Three, because orchestrators need three different answers:

  /health/live   Is the process running? Nothing else. A liveness probe that
                 checks dependencies will restart a healthy service because
                 Qdrant blinked — turning one outage into a restart loop.

  /health/ready  Should traffic be routed here? This one does check
                 dependencies, because a pod that cannot reach the vector
                 store cannot answer and should be taken out of rotation
                 until it can.

  /health        A human-readable summary of what is configured and what is
                 reachable. Unauthenticated on purpose but says nothing
                 sensitive: provider *names* and model *names*, never a key,
                 a URL with credentials, or a host.
"""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, Response, status

from app.api.dependencies import ResourcesDep
from app.core.config import LLMProviderName
from app.core.logging import get_logger

logger = get_logger(__name__)

# Every provider the service can be configured with. Typed, so adding one to
# the Literal without adding it here is a type error rather than a silently
# incomplete health report.
_PROVIDER_NAMES: tuple[LLMProviderName, ...] = ("gemini", "groq", "xai")

router = APIRouter(prefix="/health", tags=["health"])

_READINESS_TIMEOUT_SECONDS = 5.0


@router.get("/live")
async def live() -> dict[str, str]:
    return {"status": "alive"}


@router.get("/ready")
async def ready(resources: ResourcesDep, response: Response) -> dict[str, Any]:
    checks = await _run_checks(resources)
    healthy = all(checks.values())

    if not healthy:
        # 503, so a load balancer stops sending traffic here. The body still
        # says which check failed, for whoever is looking.
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return {"status": "ready" if healthy else "not_ready", "checks": checks}


@router.get("")
async def health(resources: ResourcesDep) -> dict[str, Any]:
    settings = resources.settings
    return {
        "status": "ok",
        "service": settings.service_name,
        "environment": settings.environment,
        "embedding": {
            "provider": resources.embeddings.provider_name,
            "model": resources.embeddings.model,
            "dimensions": resources.embeddings.dimensions,
        },
        "reranker": {"provider": resources.reranker.name},
        "vector_store": {
            "provider": resources.vector_store.name,
            "collection": settings.qdrant.collection,
        },
        "llm": {
            "primary": settings.llm.primary,
            "fallback": settings.llm.fallback,
            # Model names, not keys and not endpoints.
            "models": {
                name: settings.provider_settings(name).model
                for name in _PROVIDER_NAMES
            },
        },
        "retrieval": {
            "dense_top_k": settings.retrieval.dense_top_k,
            "sparse_top_k": settings.retrieval.sparse_top_k,
            "fusion_k": settings.retrieval.fusion_k,
            "rerank_top_k": settings.retrieval.rerank_top_k,
            "final_context_chunks": settings.retrieval.final_context_chunks,
        },
        "cache": resources.embeddings.stats(),
    }


async def _run_checks(resources: ResourcesDep) -> dict[str, bool]:
    async def guarded(name: str, coro: Any) -> tuple[str, bool]:
        try:
            return name, bool(
                await asyncio.wait_for(coro, timeout=_READINESS_TIMEOUT_SECONDS)
            )
        except Exception as exc:
            logger.warning(
                "Readiness check failed",
                extra={"check": name, "error_type": type(exc).__name__},
            )
            return name, False

    results = await asyncio.gather(
        guarded("vector_store", resources.vector_store.health()),
        guarded("llm", resources.llm.health()),
    )
    return dict(results)
