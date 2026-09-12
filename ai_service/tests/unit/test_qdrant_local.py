"""Embedded Qdrant: usable in development, refused in production."""

import asyncio

import pytest
from qdrant_client import QdrantClient

from app.core.config import QdrantSettings, Settings
from app.core.exceptions import VectorStoreError
from app.modules.embeddings.sparse import encode
from app.modules.vector_store.filters import SearchFilter
from app.modules.vector_store.qdrant import QdrantVectorStore
from app.shared.types import DocumentChunkInput, DocumentIndexRequest


def test_local_path_is_refused_in_production(tmp_path):
    with pytest.raises(ValueError, match="QDRANT__LOCAL_PATH"):
        Settings(
            environment="production",
            security={"service_token": "token"},
            llm={"gemini": {"api_key": "key"}},
            qdrant={"local_path": str(tmp_path)},
        )


def test_local_path_is_allowed_in_development(tmp_path):
    settings = Settings(environment="development", qdrant={"local_path": str(tmp_path)})
    assert settings.qdrant.local_path == str(tmp_path)


def test_embedded_store_creates_its_collection_on_disk(tmp_path):
    settings = QdrantSettings(
        local_path=str(tmp_path / "qdrant"), collection="embedded_test", vector_size=8
    )
    store = QdrantVectorStore(settings)
    try:
        asyncio.run(store.ensure_collection())
        # A second start finds the collection and checks its shape instead.
        asyncio.run(store.ensure_collection())
        assert (tmp_path / "qdrant").is_dir()
    finally:
        asyncio.run(store.aclose())


# -- the indexed count is read back from the store ---------------------------


def _memory_store() -> QdrantVectorStore:
    store = QdrantVectorStore(
        QdrantSettings(collection="verify_test", vector_size=4),
        client=QdrantClient(location=":memory:"),
    )
    asyncio.run(store.ensure_collection())
    return store


def _index(store: QdrantVectorStore, *contents: str, generation: int) -> int:
    request = DocumentIndexRequest(
        tenant_id="t1", document_id="d1", document_name="Doc",
        index_generation=generation,
        chunks=[
            DocumentChunkInput(chunk_id=f"c{position}", chunk_index=position, content=content)
            for position, content in enumerate(contents)
        ],
    )
    dense = [[1.0, 0.0, 0.0, 0.0] for _ in contents]
    sparse = [encode(content) for content in contents]
    return asyncio.run(store.upsert_document(request, dense, sparse))


def test_an_index_write_reports_the_count_read_back_from_the_store():
    store = _memory_store()

    assert _index(store, "a", "b", "c", generation=1) == 3
    # A retry of the same run that now yields fewer chunks drops the old
    # tail before counting, so the count is still exact.
    assert _index(store, "a", "b", generation=1) == 2


def test_a_write_the_store_did_not_keep_in_full_is_refused_and_rolled_back(monkeypatch):
    store = _memory_store()
    _index(store, "v1", generation=1)

    real_count = store._client.count

    def short_count(*args, **kwargs):
        response = real_count(*args, **kwargs)
        return type(response)(count=max(0, response.count - 1))

    monkeypatch.setattr(store._client, "count", short_count)
    with pytest.raises(VectorStoreError):
        _index(store, "v2 a", "v2 b", generation=2)
    monkeypatch.undo()

    # The unverified generation is gone; the previous one still answers.
    assert asyncio.run(store.count(SearchFilter(tenant_id="t1"))) == 1
    hits = asyncio.run(store.search_dense(
        [1.0, 0.0, 0.0, 0.0], limit=10, filters=SearchFilter(tenant_id="t1")
    ))
    assert [hit.content for hit in hits] == ["v1"]
