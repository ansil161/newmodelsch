"""The v1 API surface.

Health is mounted outside the version prefix as well as inside it: an
orchestrator's probe should not have to be updated when the API version
changes.
"""

from fastapi import APIRouter

from . import chat, health, ingestion, knowledge_base, rag, retrieval

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(chat.router)
api_router.include_router(ingestion.router)
api_router.include_router(knowledge_base.router)
api_router.include_router(retrieval.router)
api_router.include_router(rag.router)
api_router.include_router(health.router)

# Unversioned aliases for liveness and readiness probes.
probe_router = APIRouter()
probe_router.include_router(health.router)

__all__ = ["api_router", "probe_router"]
