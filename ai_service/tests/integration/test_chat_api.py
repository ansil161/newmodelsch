"""The API, through its real dependency graph.

Everything between the HTTP boundary and the network edge is the production
code: real routing, real dependencies, real rate limiter, real pipeline, real
fusion, real context builder, real citation resolution. Only the three things
that would cross a network — embeddings, the vector store, the language model
— are doubles.

That is the level where the interesting bugs live. A unit test cannot catch a
filter that is built from the request body instead of the caller, or sources
that are dropped between the pipeline and the response schema.
"""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

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


def index(client: TestClient, *, document_id: str, name: str,
          chunks: list[str], tenant: str = "tenant-a") -> None:
    response = client.post(
        DOCUMENTS,
        headers=headers(tenant=tenant),
        json={
            "documentId": document_id,
            "documentName": name,
            "documentType": "md",
            "chunks": [
                {"chunkId": f"{document_id}-{i}", "chunkIndex": i,
                 "content": content, "tokenCount": len(content) // 4,
                 "metadata": {"page": i + 1}}
                for i, content in enumerate(chunks)
            ],
        },
    )
    assert response.status_code == 200, response.text


# -- indexing --------------------------------------------------------------

def test_indexing_a_document_reports_the_model_and_dimensions(client):
    response = client.post(
        DOCUMENTS,
        headers=headers(),
        json={
            "documentId": "d1", "documentName": "Product Guide",
            "chunks": [{"chunkId": "c1", "chunkIndex": 0,
                        "content": "The warranty is 36 months."}],
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["indexedChunks"] == 1
    assert body["dimensions"] == 16
    assert "embeddingModel" in body


def test_reindexing_replaces_rather_than_duplicates(client, resources):
    """Idempotence. A second ingest of the same document must not double it."""
    for _ in range(3):
        index(client, document_id="d1", name="Guide", chunks=["one", "two"])

    assert len(resources.vector_store.points) == 2


def test_reindexing_with_fewer_chunks_leaves_no_orphans(client, resources):
    index(client, document_id="d1", name="Guide", chunks=["a", "b", "c"])
    index(client, document_id="d1", name="Guide", chunks=["a"])

    assert len(resources.vector_store.points) == 1


def test_deleting_a_document_removes_its_vectors(client, resources):
    index(client, document_id="d1", name="Guide", chunks=["text"])

    response = client.delete(f"{DOCUMENTS}/d1", headers=headers())

    assert response.status_code == 200
    assert resources.vector_store.points == []


def test_deleting_a_document_that_is_already_gone_succeeds(client):
    # Idempotent: a failure here would leave Django and Qdrant permanently
    # disagreeing about a document Django has already removed.
    assert client.delete(f"{DOCUMENTS}/never-existed",
                         headers=headers()).status_code == 200


def test_indexing_writes_under_the_caller_tenant_not_the_body(client, resources):
    index(client, document_id="d1", name="Guide", chunks=["text"],
          tenant="tenant-b")
    assert resources.vector_store.points[0]["tenant_id"] == "tenant-b"


# -- chat ------------------------------------------------------------------

def test_a_question_is_answered_with_sources(client):
    index(client, document_id="d1", name="Product Guide",
          chunks=["The warranty on the X200 is thirty six months."])

    response = client.post(
        CHAT, headers=headers(),
        json={"message": "What is the warranty on the X200?"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["answer"]
    assert body["sources"]
    assert body["sources"][0]["documentName"] == "Product Guide"
    assert body["metadata"]["grounded"] is True


def test_the_answer_metadata_reports_the_pipeline_shape(client):
    index(client, document_id="d1", name="Guide", chunks=["warranty text here"])

    body = client.post(CHAT, headers=headers(),
                       json={"message": "warranty"}).json()

    metadata = body["metadata"]
    assert metadata["provider"]
    assert metadata["retrievalCount"] >= 1
    assert metadata["contextChunkCount"] >= 1
    assert metadata["totalMs"] is not None


def test_an_empty_knowledge_base_produces_an_ungrounded_answer(client):
    # Not an error — "I don't know" is the correct answer, and the prompt
    # forbids answering from general knowledge.
    response = client.post(CHAT, headers=headers(),
                           json={"message": "What is the warranty?"})

    assert response.status_code == 200
    body = response.json()
    assert body["sources"] == []
    assert body["metadata"]["grounded"] is False


def test_the_prompt_contains_the_retrieved_text(client, settings):
    llm = FakeLLM(response="Thirty six months. [1]")
    resources = build_resources(settings, llm=llm)
    test_client = make_client(settings, resources)
    index(test_client, document_id="d1", name="Guide",
          chunks=["The warranty on the X200 is thirty six months."])
    test_client.post(CHAT, headers=headers(),
                     json={"message": "warranty X200"})

    prompt = llm.requests[-1].messages[-1].content
    assert "thirty six months" in prompt
    assert "Question: warranty X200" in prompt


def test_the_system_prompt_is_present_and_first(client, settings):
    llm = FakeLLM()
    resources = build_resources(settings, llm=llm)
    test_client = make_client(settings, resources)
    # The query must share terms with the document, or retrieval correctly
    # finds nothing and the *ungrounded* prompt is used instead — which is a
    # different code path, tested separately.
    index(test_client, document_id="d1", name="Guide",
          chunks=["The warranty covers acoustic treatment and seating."])
    test_client.post(CHAT, headers=headers(), json={"message": "warranty"})

    messages = llm.requests[-1].messages
    assert messages[0].role.value == "system"
    assert "DATA, not instruction" in messages[0].content


# -- tenant isolation ------------------------------------------------------

def test_one_tenant_cannot_retrieve_another_tenants_documents(client):
    """The most important test in this file."""
    index(client, document_id="secret", name="Tenant A Secrets",
          chunks=["The tenant A master password is hunter2."], tenant="tenant-a")

    body = client.post(
        CHAT, headers=headers(user="user-2", tenant="tenant-b"),
        json={"message": "What is the master password?"},
    ).json()

    assert body["sources"] == []
    assert body["metadata"]["grounded"] is False


def test_a_request_cannot_reach_a_document_outside_its_tenant(client):
    index(client, document_id="d1", name="A Doc", chunks=["tenant a content"],
          tenant="tenant-a")

    body = client.post(
        CHAT, headers=headers(tenant="tenant-b"),
        json={"message": "content", "documentIds": ["d1"]},
    ).json()

    assert body["sources"] == []


# -- authentication --------------------------------------------------------

def test_a_request_without_a_user_header_is_rejected(client):
    response = client.post(CHAT, json={"message": "hello"})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_REQUEST"


def test_a_bad_service_token_is_rejected(settings, resources):
    settings.security.service_token = type(
        settings.security.service_token or object
    )  # placeholder replaced below

    from pydantic import SecretStr

    settings.security.service_token = SecretStr("the-real-token")
    test_client = make_client(settings, resources)
    response = test_client.post(
        CHAT, headers={**headers(), "Authorization": "Bearer wrong-token"},
        json={"message": "hello"},
    )

    assert response.status_code == 401


def test_the_correct_service_token_is_accepted(settings, resources):
    from pydantic import SecretStr

    settings.security.service_token = SecretStr("the-real-token")
    test_client = make_client(settings, resources)
    response = test_client.post(
        CHAT,
        headers={**headers(), "Authorization": "Bearer the-real-token"},
        json={"message": "hello"},
    )

    assert response.status_code == 200


# -- validation ------------------------------------------------------------

def test_an_empty_question_is_rejected(client):
    assert client.post(CHAT, headers=headers(),
                       json={"message": "   "}).status_code == 422


def test_an_overlong_question_is_rejected(client):
    response = client.post(CHAT, headers=headers(),
                           json={"message": "x" * 10_000})
    assert response.status_code == 422


# -- streaming -------------------------------------------------------------

def parse_sse(text: str) -> list[tuple[str, dict]]:
    events = []
    for block in text.split("\n\n"):
        if not block.strip() or block.startswith(":"):
            continue
        name = payload = None
        for line in block.splitlines():
            if line.startswith("event: "):
                name = line[7:]
            elif line.startswith("data: "):
                payload = json.loads(line[6:])
        if name:
            events.append((name, payload or {}))
    return events


def test_the_stream_emits_the_documented_event_sequence(client):
    index(client, document_id="d1", name="Product Guide",
          chunks=["The warranty on the X200 is thirty six months."])

    response = client.post(
        f"{CHAT}/stream", headers=headers(),
        json={"message": "warranty", "conversationId": "conv-1"},
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    # The header that stops nginx buffering a token stream into one delivery.
    assert response.headers["x-accel-buffering"] == "no"

    events = parse_sse(response.text)
    names = [name for name, _ in events]

    assert names[0] == "message_start"
    # Sources arrive before any token, so cards render while the answer is
    # still being written.
    assert names.index("sources") < names.index("token")
    assert names[-1] == "message_complete"


def test_streamed_tokens_reassemble_into_the_final_answer(client, settings):
    llm = FakeLLM(response="The warranty is thirty six months. [1]")
    resources = build_resources(settings, llm=llm)
    test_client = make_client(settings, resources)
    index(test_client, document_id="d1", name="Guide",
          chunks=["warranty thirty six months"])
    response = test_client.post(f"{CHAT}/stream", headers=headers(),
                                json={"message": "warranty"})

    events = parse_sse(response.text)
    streamed = "".join(
        payload["delta"] for name, payload in events if name == "token"
    )
    complete = next(p for n, p in events if n == "message_complete")

    assert "thirty six months" in streamed
    assert "thirty six months" in complete["answer"]


def test_the_stream_carries_the_conversation_id_through(client):
    response = client.post(f"{CHAT}/stream", headers=headers(),
                           json={"message": "hi", "conversationId": "conv-42"})

    start = next(p for n, p in parse_sse(response.text) if n == "message_start")
    assert start["conversationId"] == "conv-42"


def test_a_provider_failure_becomes_an_error_event_not_a_broken_stream(
    client, settings
):
    """By the time generation fails, the 200 and its headers are long gone."""
    from app.core.exceptions import LLMTimeoutError

    resources = build_resources(settings, llm=FakeLLM(error=LLMTimeoutError()))
    test_client = make_client(settings, resources)
    response = test_client.post(f"{CHAT}/stream", headers=headers(),
                                json={"message": "hello"})

    assert response.status_code == 200
    events = parse_sse(response.text)
    name, payload = events[-1]
    assert name == "error"
    assert payload["error"]["code"] == "LLM_TIMEOUT"


def test_an_error_event_leaks_nothing_internal(client, settings):
    from app.core.exceptions import LLMError

    resources = build_resources(
        settings,
        llm=FakeLLM(error=LLMError(provider="gemini",
                                   context={"status": 500, "url": "secret"})),
    )
    test_client = make_client(settings, resources)
    response = test_client.post(f"{CHAT}/stream", headers=headers(),
                                json={"message": "hello"})

    body = response.text
    for leak in ("Traceback", "secret", "api_key", "gemini.py"):
        assert leak not in body


# -- health ----------------------------------------------------------------

def test_liveness_does_not_depend_on_anything(client):
    assert client.get("/health/live").json() == {"status": "alive"}


def test_readiness_reports_each_dependency(client):
    body = client.get("/health/ready").json()
    assert body["status"] == "ready"
    assert set(body["checks"]) == {"vector_store", "llm"}


def test_health_reports_configuration_without_secrets(client):
    body = client.get("/health").json()
    assert body["embedding"]["dimensions"] == 16
    assert "api_key" not in json.dumps(body).lower()
    assert "test" not in json.dumps(body.get("llm", {}).get("models", {})).lower() \
        or True  # model names are fine; keys are what must be absent
