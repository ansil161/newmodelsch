"""The Test RAG endpoint: every stage visible, nothing internal leaked."""

from __future__ import annotations

import json

import pytest

from tests.conftest import FakeLLM
from tests.integration.support import build_resources, headers, make_client

RAG = "/api/v1/rag/test"
DOCUMENTS = "/api/v1/knowledge-base/documents"


@pytest.fixture
def client(settings):
    return make_client(settings, build_resources(settings))


def index(client, *, tenant: str = "tenant-a", knowledge_base: str = "kb-1") -> None:
    response = client.post(DOCUMENTS, headers=headers(tenant=tenant), json={
        "documentId": "d1", "documentName": "Product Guide",
        "knowledgeBaseId": knowledge_base,
        "chunks": [
            {"chunkId": "c0", "chunkIndex": 0,
             "content": "The warranty on the X200 is thirty six months."},
            {"chunkId": "c1", "chunkIndex": 1,
             "content": "Seating is upholstered in wool."},
        ],
    })
    assert response.status_code == 200, response.text


def test_diagnostics_are_for_administrators_only(client):
    index(client)
    response = client.post(RAG, headers=headers(), json={"question": "warranty"})

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "FORBIDDEN"


def test_every_stage_of_retrieval_is_reported(client):
    index(client)

    response = client.post(RAG, headers=headers(admin=True), json={
        "question": "warranty X200", "knowledgeBaseId": "kb-1",
    })

    assert response.status_code == 200, response.text
    body = response.json()
    trace = body["trace"]

    assert body["answer"]
    assert body["support"] in {
        "SUPPORTED", "PARTIALLY_SUPPORTED", "INSUFFICIENT_CONTEXT",
    }
    assert body["sources"][0]["documentId"] == "d1"
    assert trace["originalQuery"] == "warranty X200"
    assert trace["rewritten"] is False
    assert trace["filters"] == {"tenantId": "tenant-a", "knowledgeBaseId": "kb-1"}
    assert trace["dense"] and trace["sparse"] and trace["fused"] and trace["context"]
    assert trace["strategy"]["mode"] == "hybrid"
    assert trace["strategy"]["reranker"] == "none"
    assert trace["fused"][0]["fusionScore"] is not None
    assert trace["context"][0]["rank"] == 1
    assert set(body["timings"]) == {"rewriteMs", "embeddingMs", "retrievalMs",
                                    "rerankMs", "generationMs", "totalMs"}


def test_retrieval_only_mode_makes_no_model_call(settings):
    llm = FakeLLM()
    client = make_client(settings, build_resources(settings, llm=llm))
    index(client)

    body = client.post(RAG, headers=headers(admin=True), json={
        "question": "warranty X200", "options": {"generate": False},
    }).json()

    assert body["answer"] is None
    assert body["timings"]["generationMs"] is None
    assert body["trace"]["context"]
    assert llm.requests == []


def test_stage_sizes_can_be_overridden_for_one_request(client):
    index(client)

    body = client.post(RAG, headers=headers(admin=True), json={
        "question": "warranty seating", "options": {"finalK": 1, "generate": False},
    }).json()

    assert len(body["trace"]["context"]) == 1


def test_diagnostics_cannot_reach_another_tenant(client):
    index(client, tenant="tenant-b")

    body = client.post(RAG, headers=headers(tenant="tenant-a", admin=True),
                       json={"question": "warranty X200"}).json()

    assert body["grounded"] is False
    assert body["trace"]["dense"] == body["trace"]["sparse"] == []
    assert body["sources"] == []


def test_the_prompt_never_leaves_the_service(client):
    index(client)

    body = client.post(RAG, headers=headers(admin=True),
                       json={"question": "warranty X200"}).json()
    serialised = json.dumps(body)

    internals = ("KNOWLEDGE_BASE_EXCERPTS", "HOW TO ANSWER", "DATA, not instruction")
    for internal in internals:
        assert internal not in serialised
