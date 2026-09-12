"""The production dependency graph, with fakes only where it would leave the box.

Shared by every integration test module. Everything between the HTTP boundary
and the network edge is real: routing, dependencies, rate limiter, pipeline,
fusion, context builder, citation resolution, ingestion. Only embeddings, the
vector store, the language model and — for URL ingestion — DNS and HTTP are
doubles.
"""

from __future__ import annotations

import httpx
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.lifecycle import AppResources
from app.main import create_app
from app.modules.chat.service import ChatService
from app.modules.embeddings.service import EmbeddingService
from app.modules.indexing.service import IndexingService
from app.modules.ingestion.service import IngestionService
from app.modules.ingestion.url_fetcher import SafeUrlFetcher
from app.modules.llm.fallback import FallbackLLMProvider
from app.modules.rag.diagnostics import RagDiagnostics
from app.modules.rag.pipeline import RagPipeline
from app.modules.retrieval.query_rewrite import QueryRewriter
from app.modules.retrieval.reranking import NoopReranker
from app.modules.retrieval.service import RetrievalService
from tests.conftest import FakeEmbeddings, FakeLLM, FakeVectorStore


def build_resources(settings: Settings, *, llm: FakeLLM | None = None,
                    fetcher: SafeUrlFetcher | None = None) -> AppResources:
    embeddings = EmbeddingService(settings.embedding, provider=FakeEmbeddings())
    store = FakeVectorStore()
    reranker = NoopReranker()
    provider = llm or FakeLLM()
    chain = FallbackLLMProvider([provider])

    retrieval = RetrievalService(embeddings, store, reranker, settings.retrieval)
    rewriter = QueryRewriter(chain, settings.query_rewrite, settings.conversation)
    pipeline = RagPipeline(retrieval, chain, rewriter, settings)

    return AppResources(
        settings=settings,
        http=httpx.AsyncClient(),
        embeddings=embeddings,
        vector_store=store,
        reranker=reranker,
        llm=chain,
        retrieval=retrieval,
        indexing=IndexingService(embeddings, store),
        chat=ChatService(pipeline),
        ingestion=IngestionService(
            settings.ingestion, fetcher or SafeUrlFetcher(settings.url_fetch)
        ),
        diagnostics=RagDiagnostics(pipeline),
    )


def make_client(settings: Settings, resources: AppResources) -> TestClient:
    """A client whose app never runs its lifespan.

    TestClient only triggers startup and shutdown when used as a context
    manager. Skipping it is the point: the real lifespan builds an
    AppResources from settings and calls `ensure_collection()`, which would
    reach for a live Qdrant cluster and hang the suite. Resources are
    injected instead.
    """
    app = create_app(settings)
    app.state.resources = resources
    return TestClient(app)


def headers(user: str = "user-1", tenant: str = "tenant-a", *,
            admin: bool = False) -> dict[str, str]:
    values = {"X-Jaaz-User-Id": user, "X-Jaaz-Tenant-Id": tenant}
    if admin:
        values["X-Jaaz-Is-Admin"] = "true"
    return values
