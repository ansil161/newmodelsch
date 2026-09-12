"""Knowledge-base and metadata narrowing, and how Qdrant is asked for it.

Everything here can only narrow a caller's scope. The Qdrant filter builders
are static, so the exact conditions sent to the store are asserted without a
cluster.
"""

from __future__ import annotations

from qdrant_client import models

from app.core.security import CallerIdentity
from app.modules.vector_store.filters import SearchFilter
from app.modules.vector_store.qdrant import QdrantVectorStore, point_id
from app.shared.schemas import RetrievalFiltersIn, build_search_filter

CALLER = CallerIdentity(user_id="u1", tenant_id="tenant-a")


def test_an_empty_knowledge_base_list_matches_nothing():
    # Django sends the knowledge bases a chat may search. None enabled is
    # "none", never "no constraint".
    assert SearchFilter.for_caller(CALLER, knowledge_base_ids=[]).matches_nothing


def test_a_knowledge_base_outside_the_allowed_list_matches_nothing():
    filters = SearchFilter.for_caller(
        CALLER, knowledge_base_id="kb-9", knowledge_base_ids=["kb-1", "kb-2"]
    )
    assert filters.matches_nothing


def test_metadata_constraints_are_carried_through():
    filters = build_search_filter(CALLER, filters=RetrievalFiltersIn(
        categories=["fees"], tags=["finance"], sourceTypes=["url"], language="en",
    ))

    assert filters.categories == ("fees",)
    assert filters.tags == ("finance",)
    assert filters.source_types == ("url",)
    assert filters.language == "en"
    assert filters.tenant_id == "tenant-a"


def test_document_ids_from_both_places_are_intersected():
    filters = build_search_filter(
        CALLER, document_ids=["a", "b"],
        filters=RetrievalFiltersIn(documentIds=["b", "c"]),
    )
    assert filters.document_ids == ("b",)


def test_describe_names_the_tenant_and_every_constraint():
    filters = build_search_filter(CALLER, knowledge_base_id="kb-1",
                                  filters=RetrievalFiltersIn(tags=["t"]))

    assert filters.describe() == {"tenantId": "tenant-a", "knowledgeBaseId": "kb-1",
                                  "tags": ["t"]}


def test_the_tenant_is_always_the_first_condition():
    built = QdrantVectorStore._build_filter(SearchFilter(tenant_id="tenant-a"))

    first = built.must[0]
    assert first.key == "tenant_id"
    assert first.match == models.MatchValue(value="tenant-a")


def test_list_constraints_become_match_any():
    built = QdrantVectorStore._build_filter(SearchFilter(
        tenant_id="t", knowledge_base_ids=("k1", "k2"), tags=("a", "b"),
        categories=("c",), source_types=("url",),
    ))
    conditions = {condition.key: condition.match for condition in built.must}

    assert conditions["knowledge_base_id"] == models.MatchAny(any=["k1", "k2"])
    assert conditions["tags"] == models.MatchAny(any=["a", "b"])
    assert conditions["category"] == models.MatchAny(any=["c"])
    assert conditions["source_type"] == models.MatchAny(any=["url"])


def test_pruning_removes_every_generation_but_the_new_one():
    built = QdrantVectorStore._document_filter("t", "d", exclude_generation=7)

    assert [condition.key for condition in built.must] == ["tenant_id", "document_id"]
    assert built.must_not[0].key == "index_generation"
    assert built.must_not[0].match == models.MatchValue(value=7)


def test_the_tail_filter_selects_chunks_past_the_new_count():
    built = QdrantVectorStore._document_filter(
        "t", "d", generation=7, chunk_index_from=3
    )
    conditions = {condition.key: condition for condition in built.must}

    assert conditions["chunk_index"].range == models.Range(gte=3)
    assert conditions["index_generation"].match == models.MatchValue(value=7)


def test_point_ids_are_stable_and_distinct_per_generation():
    assert point_id("t", "d", 0, 1) == point_id("t", "d", 0, 1)
    assert point_id("t", "d", 0, 1) != point_id("t", "d", 0, 2)
    # Points written before generations existed keep their original ids.
    assert point_id("t", "d", 0) == point_id("t", "d", 0, None)
    assert point_id("t", "d", 0) != point_id("t", "d", 0, 1)
