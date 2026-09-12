"""
A stand-in for the AI service: the same methods as AIServiceClient, no network.

It keeps the vectors it was asked to index, keyed by (tenant, document), so a
test can assert what the AI service would hold — which tenant a write went
to, which generation replaced which, whether a delete really removed it.
Failures are queued per method (raised in order, one per call) or per
uploaded filename.
"""

import hashlib
from contextlib import contextmanager

DEFAULT_STREAM = [
    "event: message_start",
    'data: {"conversationId":null,"messageId":null}',
    "",
    ": keepalive",
    "",
    "event: sources",
    'data: {"sources":[{"documentName":"Guide","citationNumber":1}]}',
    "",
    "event: token",
    'data: {"delta":"Tuition is paid termly. "}',
    "",
    "event: message_complete",
    'data: {"answer":"Tuition is paid termly. [1]","sources":[],'
    '"metadata":{"support":"SUPPORTED","grounded":true,"totalMs":12,"contextChunkCount":1}}',
    "",
]


class FakeAIClient:
    def __init__(self):
        self.calls = []
        self.vectors = {}
        self.failures = {}
        self.file_failures = {}
        self.pages = {}
        self.before = {}
        self.stream_lines = None

    def fail(self, method, *errors):
        self.failures.setdefault(method, []).extend(errors)

    def calls_to(self, method):
        return [call for call in self.calls if call[0] == method]

    def _call(self, method, identity, **details):
        self.calls.append((method, identity, details))
        hook = self.before.get(method)
        if hook is not None:
            hook()
        queued = self.failures.get(method)
        if queued:
            raise queued.pop(0)

    # -- ingestion ---------------------------------------------------------

    def extract_file(self, identity, *, filename, content_type, data, request_id=None):
        self._call("extract_file", identity, filename=filename, data=data)
        if filename in self.file_failures:
            raise self.file_failures[filename]
        return extraction(data.decode("utf-8", "replace"), file_format=filename.rsplit(".", 1)[-1].lower())

    def extract_url(self, identity, url, *, request_id=None):
        self._call("extract_url", identity, url=url)
        text = self.pages.get(url, "Visiting hours are nine to four.\n\nThe office is by the gate.")
        return {**extraction(text, file_format="html", title="Fetched page title"), "sourceUrl": url}

    # How many of a document's chunks the fake vector store fails to keep, so
    # a test can see an index write the AI service's read-back comes up short on.
    indexed_shortfall = 0

    def index_document(self, identity, payload, *, request_id=None):
        self._call("index_document", identity, payload=payload)
        self.vectors[(identity.tenant_id, payload["documentId"])] = payload
        return {
            "documentId": payload["documentId"],
            "indexedChunks": len(payload["chunks"]) - self.indexed_shortfall,
            "embeddingModel": "fake-embedding",
            "dimensions": 16,
            "indexGeneration": payload["indexGeneration"],
        }

    def delete_document(self, identity, document_id, *, request_id=None):
        self._call("delete_document", identity, document_id=document_id)
        self.vectors.pop((identity.tenant_id, str(document_id)), None)
        return {"documentId": document_id, "deleted": True}

    def delete_knowledge_base(self, identity, knowledge_base_id, *, request_id=None):
        self._call("delete_knowledge_base", identity, knowledge_base_id=knowledge_base_id)
        for key, payload in list(self.vectors.items()):
            if key[0] == identity.tenant_id and payload["knowledgeBaseId"] == str(knowledge_base_id):
                del self.vectors[key]
        return {"knowledgeBaseId": knowledge_base_id, "deleted": True}

    def index_stats(self, identity, *, knowledge_base_id, timeout=None):
        self._call("index_stats", identity, knowledge_base_id=knowledge_base_id)
        return sum(
            len(payload["chunks"]) for (tenant, _), payload in self.vectors.items()
            if tenant == identity.tenant_id and payload["knowledgeBaseId"] == str(knowledge_base_id)
        )

    # -- retrieval and chat ------------------------------------------------

    def rag_test(self, identity, payload):
        self._call("rag_test", identity, payload=payload)
        return {
            "question": payload["question"],
            "answer": None if not payload["options"]["generate"] else "Tuition is paid termly. [1]",
            "support": "SUPPORTED",
            "grounded": True,
            "sources": [],
            "provider": "fake",
            "model": "fake-model",
            "invalidCitations": 0,
            "timings": {"rewriteMs": 0, "embeddingMs": 3, "retrievalMs": 10, "rerankMs": 0,
                        "generationMs": 20, "totalMs": 33},
            "trace": {
                "originalQuery": payload["question"],
                "filters": {"tenantId": identity.tenant_id, "knowledgeBaseId": payload["knowledgeBaseId"]},
                "strategy": {"mode": "hybrid", "fusedCount": 4},
                "dense": [], "sparse": [], "fused": [], "reranked": [], "context": [{"rank": 1}],
            },
        }

    def chat(self, identity, payload):
        self._call("chat", identity, payload=payload)
        return {
            "conversationId": payload.get("conversationId"),
            "messageId": None,
            "answer": "Tuition is paid termly. [1]",
            "sources": [{"documentId": "d1", "documentName": "Guide", "chunkId": "c1", "chunkIndex": 0,
                         "citationNumber": 1, "score": 0.9, "excerpt": "Tuition is paid termly."}],
            "metadata": {"provider": "fake", "model": "fake-model", "grounded": True, "support": "SUPPORTED",
                         "queryRewritten": False, "retrievalCount": 3, "contextChunkCount": 1, "totalMs": 12},
        }

    @contextmanager
    def stream_chat(self, identity, payload):
        self._call("stream_chat", identity, payload=payload)
        yield iter(self.stream_lines or DEFAULT_STREAM)


def extraction(text, *, file_format, title=None):
    """What the ingestion endpoint returns for a text: one chunk per paragraph."""
    paragraphs = [paragraph.strip() for paragraph in text.split("\n\n") if paragraph.strip()]
    chunks = [
        {
            "chunkIndex": index,
            "content": paragraph,
            "tokenCount": max(1, len(paragraph) // 4),
            "contentHash": hashlib.sha256(paragraph.encode()).hexdigest(),
            "metadata": {"page": None, "pages": [], "heading": None, "section": None},
        }
        for index, paragraph in enumerate(paragraphs)
    ]
    return {
        "format": file_format,
        "parser": "fake",
        "title": title,
        "pageCount": None,
        "characterCount": len(text),
        "chunkCount": len(chunks),
        "tokenCount": sum(chunk["tokenCount"] for chunk in chunks),
        "sourceUrl": None,
        "contentType": None,
        "warnings": [],
        "metadata": {},
        "chunks": chunks,
        "timings": {"fetchMs": 0, "extractionMs": 1, "chunkingMs": 1},
    }
