"""Versioned indexing, knowledge-base scoping and metadata filters, end to end.

The guarantees the admin console depends on: a new version replaces the old
only once it is complete; a failed write leaves the old version answering;
a retry changes nothing; deleting a knowledge base touches nothing else; and
a chat scoped to some knowledge bases or categories can never retrieve from
outside them.
"""

from __future__ import annotations

import pytest

from tests.conftest import FakeLLM
from tests.integration.support import build_resources, headers, make_client

DOCUMENTS = "/api/v1/knowledge-base/documents"
CHAT = "/api/v1/chat"


@pytest.fixture
def resources(settings):
    return build_resources(settings)


@pytest.fixture
def client(settings, resources):
    return make_client(settings, resources)


def index(client, *, document_id: str, chunks: list[str], generation: int | None = None,
          version: int = 1, knowledge_base: str = "kb-1", tenant: str = "tenant-a",
          category: str | None = None, tags: tuple[str, ...] = (),
          source_url: str | None = None, metadata: dict | None = None):
    payload = {
        "documentId": document_id,
        "documentName": f"Document {document_id}",
        "knowledgeBaseId": knowledge_base,
        "documentVersion": version,
        "category": category,
        "tags": list(tags),
        "sourceUrl": source_url,
        "chunks": [
            {"chunkId": f"{document_id}-v{version}-{position}", "chunkIndex": position,
             "content": content, "metadata": metadata or {}}
            for position, content in enumerate(chunks)
        ],
    }
    if generation is not None:
        payload["indexGeneration"] = generation
    return client.post(DOCUMENTS, headers=headers(tenant=tenant), json=payload)


def contents(resources) -> list[str]:
    return sorted(point["content"] for point in resources.vector_store.points)


# -- versions ---------------------------------------------------------------

def test_a_new_version_replaces_the_old_one(client, resources):
    index(client, document_id="d1", chunks=["old a", "old b", "old c"], generation=1)
    response = index(client, document_id="d1", chunks=["new a"],
                     generation=2, version=2)

    assert response.json()["indexGeneration"] == 2
    assert contents(resources) == ["new a"]
    assert resources.vector_store.points[0]["document_version"] == 2


def test_a_failed_write_leaves_the_previous_version_answering(client, resources):
    index(client, document_id="d1", chunks=["v1 a", "v1 b"], generation=1)
    resources.vector_store.fail_write_after = 1

    response = index(client, document_id="d1", chunks=["v2 a", "v2 b", "v2 c"],
                     generation=2, version=2)

    assert response.status_code >= 500
    assert contents(resources) == ["v1 a", "v1 b"]


def test_retrying_the_same_run_is_idempotent(client, resources):
    for _ in range(3):
        index(client, document_id="d1", chunks=["a", "b"], generation=5)

    assert contents(resources) == ["a", "b"]


def test_a_retry_that_produces_fewer_chunks_leaves_no_tail(client, resources):
    index(client, document_id="d1", chunks=["a", "b", "c"], generation=5)
    index(client, document_id="d1", chunks=["a", "b"], generation=5)

    assert contents(resources) == ["a", "b"]


# -- knowledge bases --------------------------------------------------------

def test_deleting_a_knowledge_base_removes_only_its_vectors(client, resources):
    index(client, document_id="d1", chunks=["one"], knowledge_base="kb-1")
    index(client, document_id="d2", chunks=["two"], knowledge_base="kb-2")
    index(client, document_id="d3", chunks=["three"], knowledge_base="kb-1",
          tenant="tenant-b")

    response = client.delete("/api/v1/knowledge-base/bases/kb-1", headers=headers())

    assert response.status_code == 200
    assert response.json() == {"knowledgeBaseId": "kb-1", "deleted": True}
    assert {(p["tenant_id"], p["document_id"]) for p in resources.vector_store.points} \
        == {("tenant-a", "d2"), ("tenant-b", "d3")}


def test_stats_count_a_knowledge_base_within_the_callers_tenant(client):
    index(client, document_id="d1", chunks=["a", "b"], knowledge_base="kb-1")
    index(client, document_id="d9", chunks=["x", "y", "z"], knowledge_base="kb-1",
          tenant="tenant-b")

    body = client.get("/api/v1/knowledge-base/stats",
                      params={"knowledgeBaseId": "kb-1"}, headers=headers()).json()

    assert body == {"knowledgeBaseId": "kb-1", "documentId": None, "points": 2}


# -- scoped retrieval ---------------------------------------------------------

def chat(client, **payload):
    response = client.post(CHAT, headers=headers(), json=payload)
    assert response.status_code == 200, response.text
    return response.json()


def cited(body) -> set[str]:
    return {source["documentId"] for source in body["sources"]}


def test_category_and_tag_filters_narrow_retrieval(client):
    index(client, document_id="fees", category="fees", tags=("finance",),
          chunks=["Tuition fees are paid every term."])
    index(client, document_id="bus", category="transport", tags=("buses",),
          chunks=["Bus fees are paid every term."])

    assert cited(chat(client, message="fees paid every term",
                      filters={"categories": ["fees"]})) == {"fees"}
    assert cited(chat(client, message="fees paid every term",
                      filters={"tags": ["buses"]})) == {"bus"}


def test_a_chat_scoped_to_knowledge_bases_never_sees_the_others(client):
    index(client, document_id="a", knowledge_base="kb-1",
          chunks=["The library opens at nine."])
    index(client, document_id="b", knowledge_base="kb-2",
          chunks=["The library opens at ten."])

    assert cited(chat(client, message="when does the library open",
                      filters={"knowledgeBaseIds": ["kb-2"]})) == {"b"}

    nothing = chat(client, message="when does the library open",
                   filters={"knowledgeBaseIds": []})
    assert nothing["sources"] == []
    assert nothing["metadata"]["grounded"] is False


def test_citations_carry_the_version_section_and_source_url(client):
    index(client, document_id="d1", version=3, source_url="https://school.example/fees",
          metadata={"page": 3, "heading": "Fees", "section": "Admissions › Fees"},
          chunks=["Tuition fees are paid every term."])

    source = chat(client, message="tuition fees")["sources"][0]

    assert source["documentVersion"] == 3
    assert source["section"] == "Admissions › Fees"
    assert source["sourceUrl"] == "https://school.example/fees"
    assert source["page"] == 3


def test_every_answer_reports_how_well_it_is_supported(settings):
    llm = FakeLLM(response="Tuition is termly. [1]")
    resources = build_resources(settings, llm=llm)
    client = make_client(settings, resources)
    index(client, document_id="d1", chunks=["Tuition fees are paid every term."])

    assert chat(client, message="tuition fees")["metadata"]["support"] == "SUPPORTED"
    assert chat(client, message="school uniform colour",
                filters={"knowledgeBaseIds": []})["metadata"]["support"] \
        == "INSUFFICIENT_CONTEXT"
