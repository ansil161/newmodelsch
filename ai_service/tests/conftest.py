"""Shared fixtures and fakes.

Nothing in this suite touches Hugging Face, Gemini, Groq, xAI or a Qdrant
cluster. Every network edge has a double, so the tests are deterministic,
free, and runnable with no credentials — which is the only way a test suite
gets run on every change rather than occasionally.
"""

from __future__ import annotations

import hashlib
import math
from collections.abc import AsyncIterator, Sequence
from typing import Any

import pytest

from app.core.config import Settings
from app.core.security import CallerIdentity
from app.modules.embeddings.base import EmbeddingProvider
from app.modules.embeddings.sparse import SparseVector
from app.modules.llm.base import (
    GenerationRequest,
    GenerationResult,
    LLMProvider,
    StreamChunk,
)
from app.modules.vector_store.base import VectorStore
from app.modules.vector_store.filters import SearchFilter
from app.shared.types import (
    ChunkMetadata,
    DocumentIndexRequest,
    RetrievalMethod,
    RetrievedChunk,
    TokenUsage,
)

DIMENSIONS = 16


# --------------------------------------------------------------------------
# Doubles
# --------------------------------------------------------------------------

class FakeEmbeddings(EmbeddingProvider):
    """Deterministic hashed embeddings.

    Not semantic, and does not need to be: these tests assert on ordering,
    plumbing and shape, never on whether "car" is near "automobile". Being
    deterministic is what matters — a fake with randomness makes ranking
    tests flaky.
    """

    name = "fake"

    def __init__(self, dimensions: int = DIMENSIONS) -> None:
        self._dimensions = dimensions
        self.document_calls: list[list[str]] = []
        self.query_calls: list[str] = []

    @property
    def model(self) -> str:
        return f"fake-{self._dimensions}"

    @property
    def dimensions(self) -> int:
        return self._dimensions

    async def embed_documents(self, texts: Sequence[str]) -> list[list[float]]:
        self.document_calls.append(list(texts))
        return [self._vector(text) for text in texts]

    async def embed_query(self, text: str) -> list[float]:
        self.query_calls.append(text)
        return self._vector(text)

    def _vector(self, text: str) -> list[float]:
        digest = hashlib.blake2b(
            text.lower().encode(), digest_size=self._dimensions
        ).digest()
        raw = [(byte / 255.0) - 0.5 for byte in digest]
        magnitude = math.sqrt(sum(v * v for v in raw)) or 1.0
        return [v / magnitude for v in raw]


class FakeLLM(LLMProvider):
    """Returns scripted text, and records what it was asked."""

    name = "fake-llm"

    def __init__(self, response: str = "An answer. [1]",
                 error: Exception | None = None) -> None:
        self.response = response
        self.error = error
        self.requests: list[GenerationRequest] = []

    @property
    def model(self) -> str:
        return "fake-model"

    async def generate(self, request: GenerationRequest) -> GenerationResult:
        self.requests.append(request)
        if self.error:
            raise self.error
        return GenerationResult(
            text=self.response, provider=self.name, model=self.model,
            usage=TokenUsage(prompt_tokens=10, completion_tokens=5, total_tokens=15),
        )

    async def stream(self, request: GenerationRequest) -> AsyncIterator[StreamChunk]:
        self.requests.append(request)
        if self.error:
            raise self.error
        # Word by word, which is close enough to how a real provider chunks
        # to catch reassembly bugs.
        for word in self.response.split(" "):
            yield StreamChunk(delta=word + " ")
        yield StreamChunk(
            done=True,
            usage=TokenUsage(prompt_tokens=10, completion_tokens=5, total_tokens=15),
        )


class FakeVectorStore(VectorStore):
    """An in-memory store with the same contract as Qdrant's.

    Scoring is dot product for dense and term-overlap for sparse — enough to
    produce a stable, sensible ordering so retrieval and fusion can be tested
    without a cluster.
    """

    name = "fake"

    def __init__(self) -> None:
        self.points: list[dict[str, Any]] = []
        self.deleted: list[tuple[str, str]] = []
        self.deleted_knowledge_bases: list[tuple[str, str]] = []
        self.dense_calls = 0
        self.sparse_calls = 0
        self.fail_sparse = False
        self.fail_dense = False
        # Fail the write after this many points, to exercise rollback.
        self.fail_write_after: int | None = None

    async def ensure_collection(self) -> None:
        return None

    async def upsert_document(
        self, request: DocumentIndexRequest,
        dense_vectors: Sequence[Sequence[float]],
        sparse_vectors: Sequence[SparseVector],
    ) -> int:
        """The same contract as Qdrant's: write the new generation, then prune."""
        tenant, document = request.tenant_id, request.document_id
        generation = request.index_generation
        if generation is None:
            await self.delete_document(tenant, document)

        written = []
        for chunk, dense, lexical in zip(
            request.chunks, dense_vectors, sparse_vectors, strict=True
        ):
            limit = self.fail_write_after
            if limit is not None and len(written) >= limit:
                # Roll back this generation's partial write, as Qdrant does.
                self.points = [p for p in self.points if p not in written]
                raise RuntimeError("write failed part-way")
            point = {
                "tenant_id": tenant,
                "knowledge_base_id": request.knowledge_base_id,
                "document_id": document,
                "document_name": request.document_name,
                "document_type": request.document_type,
                "document_version": request.document_version,
                "index_generation": generation,
                "source_type": request.source_type,
                "source_url": request.source_url,
                "category": request.category,
                "tags": list(request.tags),
                "language": request.language,
                "chunk_id": chunk.chunk_id,
                "chunk_index": chunk.chunk_index,
                "content": chunk.content,
                "metadata": chunk.metadata,
                "dense": list(dense),
                "sparse": lexical,
            }
            # Same (document, generation, chunk index) is the same point id.
            self.points = [
                p for p in self.points
                if not (p["tenant_id"] == tenant and p["document_id"] == document
                        and p["index_generation"] == generation
                        and p["chunk_index"] == chunk.chunk_index)
            ]
            self.points.append(point)
            written.append(point)

        if generation is not None:
            self.points = [
                p for p in self.points
                if not (p["tenant_id"] == tenant and p["document_id"] == document
                        and (p["index_generation"] != generation
                             or p["chunk_index"] >= len(request.chunks)))
            ]
        return len(request.chunks)

    async def delete_document(self, tenant_id: str, document_id: str) -> None:
        self.deleted.append((tenant_id, document_id))
        self.points = [
            point for point in self.points
            if not (point["tenant_id"] == tenant_id
                    and point["document_id"] == document_id)
        ]

    async def delete_knowledge_base(self, tenant_id: str,
                                    knowledge_base_id: str) -> None:
        self.deleted_knowledge_bases.append((tenant_id, knowledge_base_id))
        self.points = [
            point for point in self.points
            if not (point["tenant_id"] == tenant_id
                    and point["knowledge_base_id"] == knowledge_base_id)
        ]

    async def count(self, filters: SearchFilter) -> int:
        return 0 if filters.matches_nothing else len(self._visible(filters))

    async def search_dense(
        self, vector: Sequence[float], *, limit: int, filters: SearchFilter,
        score_threshold: float | None = None,
    ) -> list[RetrievedChunk]:
        self.dense_calls += 1
        if self.fail_dense:
            raise RuntimeError("dense search unavailable")

        scored = []
        for point in self._visible(filters):
            score = sum(a * b for a, b in zip(vector, point["dense"], strict=True))
            if score_threshold is not None and score < score_threshold:
                continue
            scored.append((score, point))

        scored.sort(key=lambda pair: -pair[0])
        return [
            self._to_chunk(point, score, RetrievalMethod.DENSE)
            for score, point in scored[:limit]
        ]

    async def search_sparse(
        self, vector: SparseVector, *, limit: int, filters: SearchFilter,
    ) -> list[RetrievedChunk]:
        self.sparse_calls += 1
        if self.fail_sparse:
            raise RuntimeError("sparse search unavailable")

        query_terms = set(vector.indices)
        scored = []
        for point in self._visible(filters):
            overlap = query_terms & set(point["sparse"].indices)
            if overlap:
                scored.append((float(len(overlap)), point))

        scored.sort(key=lambda pair: -pair[0])
        return [
            self._to_chunk(point, score, RetrievalMethod.SPARSE)
            for score, point in scored[:limit]
        ]

    async def health(self) -> bool:
        return True

    def _visible(self, filters: SearchFilter) -> list[dict[str, Any]]:
        """Every constraint Qdrant's filter builder applies, applied the same way."""
        if filters.matches_nothing:
            return []
        visible = [p for p in self.points if p["tenant_id"] == filters.tenant_id]
        if filters.knowledge_base_id:
            visible = [p for p in visible
                       if p["knowledge_base_id"] == filters.knowledge_base_id]
        if filters.knowledge_base_ids is not None:
            bases = set(filters.knowledge_base_ids)
            visible = [p for p in visible if p["knowledge_base_id"] in bases]
        if filters.document_ids is not None:
            allowed = set(filters.document_ids)
            visible = [p for p in visible if p["document_id"] in allowed]
        if filters.document_types:
            allowed_types = set(filters.document_types)
            visible = [p for p in visible if p["document_type"] in allowed_types]
        if filters.source_types:
            kinds = set(filters.source_types)
            visible = [p for p in visible if p["source_type"] in kinds]
        if filters.categories:
            visible = [p for p in visible if p["category"] in set(filters.categories)]
        if filters.tags:
            wanted = set(filters.tags)
            visible = [p for p in visible if wanted & set(p["tags"])]
        if filters.language:
            visible = [p for p in visible if p["language"] == filters.language]
        return visible

    @staticmethod
    def _to_chunk(point: dict[str, Any], score: float,
                  method: RetrievalMethod) -> RetrievedChunk:
        chunk = RetrievedChunk(
            chunk_id=point["chunk_id"],
            document_id=point["document_id"],
            document_name=point["document_name"],
            chunk_index=point["chunk_index"],
            content=point["content"],
            metadata=point["metadata"],
            source_url=point.get("source_url"),
            source_type=point.get("source_type"),
            document_version=point.get("document_version"),
            methods=[method],
        )
        if method is RetrievalMethod.DENSE:
            chunk.dense_score = score
        else:
            chunk.sparse_score = score
        return chunk


# --------------------------------------------------------------------------
# Fixtures
# --------------------------------------------------------------------------

@pytest.fixture
def settings() -> Settings:
    return Settings(
        environment="testing",
        qdrant={"url": "http://localhost:6333", "vector_size": DIMENSIONS},
        embedding={"provider": "huggingface_api", "api_key": "test",
                   "dimensions": DIMENSIONS},
        reranker={"provider": "none"},
        llm={"primary": "gemini", "fallback": None,
             "gemini": {"api_key": "test", "model": "test-model"}},
        rate_limit={"enabled": False},
        security={"service_token": None},
    )


@pytest.fixture
def caller() -> CallerIdentity:
    return CallerIdentity(user_id="user-1", tenant_id="tenant-a")


@pytest.fixture
def other_caller() -> CallerIdentity:
    return CallerIdentity(user_id="user-2", tenant_id="tenant-b")


@pytest.fixture
def fake_embeddings() -> FakeEmbeddings:
    return FakeEmbeddings()


@pytest.fixture
def fake_store() -> FakeVectorStore:
    return FakeVectorStore()


@pytest.fixture
def fake_llm() -> FakeLLM:
    return FakeLLM()


def chunk(
    chunk_id: str, *, document: str = "doc-1", name: str = "Product Guide",
    index: int = 0, content: str = "text", dense: float | None = None,
    sparse: float | None = None, page: int | None = None,
) -> RetrievedChunk:
    """A RetrievedChunk with sensible defaults, for ranking tests."""
    return RetrievedChunk(
        chunk_id=chunk_id,
        document_id=document,
        document_name=name,
        chunk_index=index,
        content=content,
        metadata=ChunkMetadata(page=page, pages=[page] if page else []),
        dense_score=dense,
        sparse_score=sparse,
        methods=[RetrievalMethod.DENSE if dense is not None
                 else RetrievalMethod.SPARSE],
    )
