"""The FastAPI application.

Everything expensive is built in the lifespan and torn down on shutdown — see
core/lifecycle.py for why that matters more here than in an ordinary web
service.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import middleware
from app.api.v1.router import api_router, probe_router
from app.core.config import Settings, get_settings
from app.core.lifecycle import AppResources
from app.core.logging import configure_logging, get_logger

logger = get_logger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(
        settings.observability.log_level, settings.observability.log_format
    )

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        resources = AppResources.build(settings)
        app.state.resources = resources
        try:
            await resources.start()
        except Exception:
            # Startup failed. Release whatever was built before re-raising,
            # or a crash-looping container leaks a connection pool per
            # attempt.
            logger.exception("Startup failed")
            await resources.aclose()
            raise
        try:
            yield
        finally:
            await resources.aclose()
            logger.info("AI service stopped")

    app = FastAPI(
        title="JAAZ AI Service",
        version="1.0.0",
        summary="Retrieval-augmented generation over the JAAZ knowledge base.",
        lifespan=lifespan,
        # The interactive docs describe an internal service and enumerate its
        # surface. Useful locally, not something to publish.
        docs_url="/docs" if not settings.is_production else None,
        redoc_url=None,
        openapi_url="/openapi.json" if not settings.is_production else None,
    )

    # Empty by default. This service is called server-to-server by Django,
    # which is not a browser and sends no Origin. A populated list here means
    # someone has deliberately decided a browser may call it directly.
    if settings.security.cors_allow_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.security.cors_allow_origins,
            allow_credentials=False,
            allow_methods=["GET", "POST", "DELETE"],
            allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
        )

    middleware.install(app)
    middleware.install_exception_handlers(app)

    app.include_router(api_router)
    app.include_router(probe_router)

    return app


app = create_app()
