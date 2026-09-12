"""The Qdrant store against a real Qdrant engine, in-process.

qdrant-client's local mode runs Qdrant's filtering and scoring in this
process, so these tests exercise the real semantics the fakes can only
imitate — in particular `must_not` on a field a point does not have, which is
what prunes vectors written before generations existed.
"""

from __future__ import annotations

import pytest
from qdrant_client import QdrantClient

from app.core.config import QdrantSettings
from app.core.exceptions import VectorStoreError
from app.modules.embeddings.sparse import encode
from app.modules.vector_store.filters import SearchFilter
from app.modules.vector_store.qdrant import QdrantVectorStore
from app.shared.types import DocumentChunkInput, DocumentIndexRequest

pytestmark = pytest.mark.integration

WIDTH = 4
QUERY = [1.0, 0.0, 0.0, 0.0]


@pytest.fixture
async def store():
    settings = QdrantSettings(collection="test_kb", vector_size=WIDTH)
    instance = QdrantVectorStore(settings, client=QdrantClient(location=":memory:"))
    await instance.ensure_collection()
    return instance


def request(*chunks: str, document: str = "d1", generation: int | None = None,
            tenant: str = "t1", knowledge_base: str = "kb",
            tags: tuple[str, ...] = ()) -> DocumentIndexRequest:
    return DocumentIndexRequest(
        tenant_id=tenant, document_id=document, document_name="Doc",
        knowledge_base_id=knowledge_base, index_generation=generation,
        tags=list(tags),
        chunks=[
            DocumentChunkInput(chunk_id=f"{document}-{position}", chunk_index=position,
                               content=content)
            for position, content in enumerate(chunks)
        ],
    )


async def write(store: QdrantVectorStore, indexed: DocumentIndexRequest) -> int:
    dense = [QUERY for _ in indexed.chunks]
    sparse = [encode(chunk.content) for chunk in indexed.chunks]
    return await store.upsert_document(indexed, dense, sparse)


async def visible(store: QdrantVectorStore, **filters: object) -> list[str]:
    hits = await store.search_dense(
        QUERY, limit=100, filters=SearchFilter(tenant_id="t1", **filters)  # type: ignore[arg-type]
    )
    return sorted(hit.content for hit in hits)


async def test_a_new_generation_replaces_the_old(store):
    await write(store, request("old a", "old b", "old c", generation=1))
    await write(store, request("new a", generation=2))

    assert await visible(store) == ["new a"]
    assert await store.count(SearchFilter(tenant_id="t1")) == 1


async def test_points_from_before_generations_are_pruned(store):
    await write(store, request("legacy", generation=None))
    await write(store, request("current", generation=3))

    assert await visible(store) == ["current"]


async def test_a_failed_write_is_rolled_back_and_the_old_generation_survives(
    store, monkeypatch
):
    await write(store, request("v1", generation=1))

    real_upsert = store._client.upsert
    calls = {"count": 0}

    def flaky_upsert(*args, **kwargs):
        calls["count"] += 1
        if calls["count"] == 2:
            raise RuntimeError("connection reset")
        return real_upsert(*args, **kwargs)

    monkeypatch.setattr(store._client, "upsert", flaky_upsert)
    # Two batches of 128: the second one fails after the first has landed.
    many = request(*(f"v2 {position}" for position in range(200)), generation=2)

    with pytest.raises(VectorStoreError):
        await write(store, many)

    assert await visible(store) == ["v1"]


async def test_a_retry_of_the_same_generation_leaves_one_copy(store):
    for _ in range(2):
        await write(store, request("a", "b", "c", generation=7))
    await write(store, request("a", "b", generation=7))

    assert await visible(store) == ["a", "b"]


async def test_deleting_a_knowledge_base_stays_inside_its_tenant(store):
    await write(store, request("mine", document="d1", knowledge_base="kb"))
    await write(store, request("sibling", document="d2", knowledge_base="other"))
    await write(store, request("theirs", document="d3", tenant="t2",
                               knowledge_base="kb"))

    await store.delete_knowledge_base("t1", "kb")

    assert await visible(store) == ["sibling"]
    assert await store.count(SearchFilter(tenant_id="t2")) == 1


async def test_tag_filters_match_any_tag(store):
    await write(store, request("tagged", document="d1", tags=("finance", "fees")))
    await write(store, request("untagged", document="d2"))

    assert await visible(store, tags=("fees",)) == ["tagged"]
    assert await visible(store, tags=("sports",)) == []


async def test_another_tenant_sees_nothing(store):
    await write(store, request("secret"))

    hits = await store.search_dense(
        QUERY, limit=10, filters=SearchFilter(tenant_id="t2")
    )

    assert hits == []


async def test_sparse_search_finds_an_identifier(store):
    await write(store, request("Model X200 SKU-4471 is rated at 340 watts.",
                               "Unrelated seating text.", generation=1))

    hits = await store.search_sparse(encode("SKU-4471"), limit=5,
                                     filters=SearchFilter(tenant_id="t1"))

    assert hits
    assert "SKU-4471" in hits[0].content
