"""The expensive things, built once.

An HTTP client, a Qdrant client, an embedding model. Each is costly to
create — TLS handshakes, connection pools, several hundred megabytes of
weights — and cheap to share. Building any of them per request is the single
most effective way to make an AI service slow, and it is an easy mistake to
make because the code reads identically either way.

So they are constructed at startup, held here, and handed to request handlers
by FastAPI's dependency system. Not module-level globals: a global is
initialised at import time, which breaks tests, breaks `--reload`, and makes
the failure of a dependency at startup indistinguishable from an import
error. `AppResources` is created in the lifespan, stored on `app.state`, and
closed on shutdown.
"""

from __future__ import annotations

from dataclasses import dataclass

import httpx

from app.modules.chat.service import ChatService
from app.modules.embeddings.service import EmbeddingService
from app.modules.indexing.service import IndexingService
from app.modules.ingestion.service import IngestionService
from app.modules.ingestion.url_fetcher import SafeUrlFetcher
from app.modules.llm.base import LLMProvider
from app.modules.llm.factory import build_llm_provider
from app.modules.rag.diagnostics import RagDiagnostics
from app.modules.rag.pipeline import RagPipeline
from app.modules.retrieval.query_rewrite import QueryRewriter
from app.modules.retrieval.reranking import Reranker, build_reranker
from app.modules.retrieval.service import RetrievalService
from app.modules.vector_store.base import VectorStore
from app.modules.vector_store.qdrant import QdrantVectorStore

from .config import Settings
from .logging import get_logger

logger = get_logger(__name__)


@dataclass
class AppResources:
    settings: Settings
    http: httpx.AsyncClient
    embeddings: EmbeddingService
    vector_store: VectorStore
    reranker: Reranker
    llm: LLMProvider
    retrieval: RetrievalService
    indexing: IndexingService
    chat: ChatService
    ingestion: IngestionService
    diagnostics: RagDiagnostics

    @classmethod
    def build(cls, settings: Settings) -> AppResources:
        # One client for every outbound provider call. Shared so connections
        # and TLS sessions are reused across Gemini, Groq and the reranker.
        http = httpx.AsyncClient(
            timeout=httpx.Timeout(60.0, connect=10.0),
            limits=httpx.Limits(max_connections=64, max_keepalive_connections=32),
        )

        embeddings = EmbeddingService(settings.embedding)
        vector_store = QdrantVectorStore(settings.qdrant)
        reranker = build_reranker(settings.reranker)
        llm = build_llm_provider(settings.llm, client=http)

        retrieval = RetrievalService(
            embeddings, vector_store, reranker, settings.retrieval
        )
        rewriter = QueryRewriter(
            llm, settings.query_rewrite, settings.conversation
        )
        pipeline = RagPipeline(retrieval, llm, rewriter, settings)

        return cls(
            settings=settings,
            http=http,
            embeddings=embeddings,
            vector_store=vector_store,
            reranker=reranker,
            llm=llm,
            retrieval=retrieval,
            indexing=IndexingService(embeddings, vector_store),
            chat=ChatService(pipeline),
            # Its own HTTP client, not the shared one: the fetcher pins
            # connections to vetted addresses and disables keep-alive, which
            # would be wrong for the provider calls the shared client makes.
            ingestion=IngestionService(settings.ingestion,
                                       SafeUrlFetcher(settings.url_fetch)),
            diagnostics=RagDiagnostics(pipeline),
        )

    async def start(self) -> None:
        """Prepare dependencies that can be prepared before serving.

        The collection check is fatal: a service whose vector store is
        missing or the wrong shape cannot answer anything, and discovering
        that on the first user's question is worse than not starting.

        Model warm-up is not fatal. With the local provider it loads several
        hundred megabytes; if that fails, the service can still serve health
        checks and report why.
        """
        await self.vector_store.ensure_collection()

        try:
            self.embeddings.warm_up()
        except Exception:
            logger.exception(
                "Embedding warm-up failed; the first request will retry"
            )

        warm = getattr(self.reranker, "warm_up", None)
        if callable(warm):
            try:
                warm()
            except Exception:
                logger.exception(
                    "Reranker warm-up failed; reranking will degrade to the "
                    "fused ordering"
                )

        logger.info(
            "AI service ready",
            extra={
                "embedding_provider": self.embeddings.provider_name,
                "embedding_model": self.embeddings.model,
                "dimensions": self.embeddings.dimensions,
                "reranker": self.reranker.name,
                "vector_store": self.vector_store.name,
                "collection": self.settings.qdrant.collection,
                "llm_primary": self.settings.llm.primary,
                "llm_fallback": self.settings.llm.fallback,
            },
        )

    async def aclose(self) -> None:
        """Release everything, in reverse order of dependency."""
        for closer in (
            self.ingestion,
            self.chat,
            self.llm,
            self.reranker,
            self.embeddings,
            self.vector_store,
        ):
            close = getattr(closer, "aclose", None)
            if close is None:
                continue
            try:
                await close()
            except Exception:
                logger.exception(
                    "Error while shutting down a resource",
                    extra={"resource": type(closer).__name__},
                )
        await self.http.aclose()
