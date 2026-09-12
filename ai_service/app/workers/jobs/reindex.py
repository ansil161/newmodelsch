"""Re-embed and re-index the knowledge base.

WHEN THIS IS NEEDED. Changing the embedding model, its dimensions, or the
sparse tokeniser invalidates every stored vector. The old ones do not become
wrong-looking — they become silently incomparable with new queries, which is
worse, because retrieval keeps returning confident nonsense. Same for a
change to chunk size: the stored chunks no longer match how new documents are
split.

WHY THIS IS A JOB AND NOT AN ENDPOINT. A few hundred documents is tens of
thousands of embedding calls and tens of minutes. That belongs to a worker
process that can be watched, restarted and stopped — not to an HTTP request.

WHY IT PULLS FROM DJANGO. Django is the system of record for documents: it
holds the files, the extracted text and the chunk boundaries. Re-indexing
walks that source rather than trying to reconstruct chunks from vectors that
are, by hypothesis, the thing being replaced.

IDEMPOTENT AND RESTARTABLE. Each document is indexed with the same
delete-then-write as a first-time ingest, keyed on
(tenant, document, chunk index). Killing this halfway and running it again
leaves the collection correct, with the documents it already did simply done
twice.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any

import httpx

from app.core.exceptions import AIServiceError
from app.core.logging import Stopwatch, bind_context, get_logger
from app.modules.indexing.service import IndexingService
from app.shared.types import ChunkMetadata, DocumentChunkInput, DocumentIndexRequest

logger = get_logger(__name__)

_PAGE_SIZE = 25


@dataclass
class ReindexProgress:
    documents_total: int = 0
    documents_done: int = 0
    documents_failed: int = 0
    chunks_indexed: int = 0
    failures: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return {
            "documents_total": self.documents_total,
            "documents_done": self.documents_done,
            "documents_failed": self.documents_failed,
            "chunks_indexed": self.chunks_indexed,
            # Ids only. A failure list containing document *content* would
            # put knowledge-base text into an operator log.
            "failed_document_ids": self.failures[:50],
        }


class DjangoKnowledgeBaseClient:
    """Reads documents and their chunks from the main backend.

    Uses the same shared-secret scheme in reverse: Django trusts this service
    with a token, and this service holds one for Django's internal endpoints.
    """

    def __init__(self, base_url: str, token: str,
                 client: httpx.AsyncClient | None = None) -> None:
        self._base = base_url.rstrip("/")
        self._owns_client = client is None
        self._client = client or httpx.AsyncClient(
            timeout=httpx.Timeout(60.0, connect=10.0),
            headers={"Authorization": f"Bearer {token}"},
        )

    async def iter_documents(
        self, tenant_id: str
    ) -> AsyncIterator[dict[str, Any]]:
        page = 1
        while True:
            response = await self._client.get(
                f"{self._base}/api/internal/knowledge-base/documents/",
                params={"page": page, "pageSize": _PAGE_SIZE, "status": "ready"},
                headers={"X-Jaaz-Tenant-Id": tenant_id},
            )
            response.raise_for_status()
            body = response.json()

            for document in body.get("results", []):
                yield document

            meta = body.get("meta") or {}
            if page >= int(meta.get("totalPages", 1)):
                return
            page += 1

    async def fetch_chunks(self, document_id: str, tenant_id: str
                           ) -> list[dict[str, Any]]:
        response = await self._client.get(
            f"{self._base}/api/internal/knowledge-base/documents/"
            f"{document_id}/chunks/",
            headers={"X-Jaaz-Tenant-Id": tenant_id},
        )
        response.raise_for_status()
        results: list[dict[str, Any]] = response.json().get("results", [])
        return results

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()


async def run_reindex(
    indexing: IndexingService,
    source: DjangoKnowledgeBaseClient,
    *,
    tenant_id: str,
    progress: ReindexProgress | None = None,
) -> ReindexProgress:
    state = progress or ReindexProgress()

    with Stopwatch() as timer:
        async for document in source.iter_documents(tenant_id):
            document_id = str(document.get("id"))
            bind_context(document_id=document_id)
            state.documents_total += 1

            try:
                chunks = await source.fetch_chunks(document_id, tenant_id)
                if not chunks:
                    logger.info("Skipping a document with no chunks")
                    continue

                result = await indexing.index_document(
                    DocumentIndexRequest(
                        tenant_id=tenant_id,
                        document_id=document_id,
                        document_name=str(document.get("name", "")),
                        document_type=str(document.get("contentType", "")),
                        # Everything a retrieval filter reads has to survive
                        # a re-embed, or the document silently drops out of
                        # its knowledge base's searches afterwards.
                        knowledge_base_id=str(
                            document.get("knowledgeBaseId") or "default"
                        ),
                        language=str(document.get("language") or "en"),
                        document_version=int(document.get("documentVersion") or 1),
                        source_type=str(document.get("sourceType") or "file"),
                        category=document.get("category") or None,
                        tags=[str(tag) for tag in document.get("tags") or []],
                        source_url=document.get("sourceUrl") or None,
                        chunks=[
                            DocumentChunkInput(
                                chunk_id=str(chunk["id"]),
                                chunk_index=int(chunk["chunkIndex"]),
                                content=chunk["content"],
                                token_count=int(chunk.get("tokenCount", 0)),
                                metadata=ChunkMetadata.model_validate(
                                    chunk.get("metadata") or {}
                                ),
                            )
                            for chunk in chunks
                        ],
                    )
                )
                state.documents_done += 1
                state.chunks_indexed += result.indexed_chunks

            except (AIServiceError, httpx.HTTPError) as error:
                # One bad document must not abandon the other four hundred.
                state.documents_failed += 1
                state.failures.append(document_id)
                logger.warning(
                    "Reindex failed for a document; continuing",
                    extra={"document_id": document_id,
                           "error_type": type(error).__name__},
                )

    logger.info(
        "Reindex complete",
        extra={**state.as_dict(), "duration_ms": timer.milliseconds},
    )
    return state
