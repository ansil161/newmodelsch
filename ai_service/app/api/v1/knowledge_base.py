"""Knowledge-base endpoints, called by Django's ingestion worker.

Not by a browser. These write to the vector store and are reachable only with
the service token.

WHY INDEXING IS SYNCHRONOUS HERE. There is already a queue in front of this:
Django's ingestion worker claims jobs with `SELECT … FOR UPDATE SKIP LOCKED`,
extracts and chunks through the ingestion endpoints, and calls this one. The
user's HTTP request ended long before that. A second queue behind the first
would add a status-tracking problem — Django could no longer tell a document
it had marked READY from one still waiting in this service's queue — for no
latency the user experiences.

Bulk work that genuinely needs a worker of its own — re-embedding the whole
collection after a model change — is `app/workers/jobs/reindex.py`.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query, status

from app.api.dependencies import CallerDep, IndexCallerDep, ResourcesDep
from app.core.logging import bind_context, get_logger
from app.modules.indexing.schemas import (
    DeleteDocumentResponse,
    DeleteKnowledgeBaseResponse,
    IndexDocumentRequest,
    IndexDocumentResponse,
    IndexStatsResponse,
)
from app.modules.vector_store.filters import SearchFilter
from app.shared.types import ChunkMetadata, DocumentChunkInput, DocumentIndexRequest

logger = get_logger(__name__)

router = APIRouter(prefix="/knowledge-base", tags=["knowledge-base"])


@router.post(
    "/documents",
    response_model=IndexDocumentResponse,
    response_model_by_alias=True,
    status_code=status.HTTP_200_OK,
)
async def index_document(
    payload: IndexDocumentRequest,
    caller: IndexCallerDep,
    resources: ResourcesDep,
) -> IndexDocumentResponse:
    """Embed and index a document's chunks, replacing anything stored for it."""
    bind_context(document_id=payload.document_id, tenant_id=caller.tenant_id)

    request = DocumentIndexRequest(
        # From the authenticated caller, never the body. A client cannot
        # write into another tenant's collection by asking to.
        tenant_id=caller.tenant_id,
        document_id=payload.document_id,
        document_name=payload.document_name,
        document_type=payload.document_type,
        knowledge_base_id=payload.knowledge_base_id,
        language=payload.language,
        document_version=payload.document_version,
        index_generation=payload.index_generation,
        source_type=payload.source_type,
        category=payload.category,
        tags=payload.tags,
        source_url=payload.source_url,
        chunks=[
            DocumentChunkInput(
                chunk_id=chunk.chunk_id,
                chunk_index=chunk.chunk_index,
                content=chunk.content,
                token_count=chunk.token_count,
                metadata=ChunkMetadata.model_validate(chunk.metadata or {}),
            )
            for chunk in payload.chunks
        ],
    )

    result = await resources.indexing.index_document(request)

    return IndexDocumentResponse(
        documentId=result.document_id,
        indexedChunks=result.indexed_chunks,
        embeddingModel=result.embedding_model,
        dimensions=result.dimensions,
        indexGeneration=result.index_generation,
    )


@router.delete(
    "/documents/{document_id}",
    response_model=DeleteDocumentResponse,
    response_model_by_alias=True,
)
async def delete_document(
    document_id: str, caller: IndexCallerDep, resources: ResourcesDep
) -> DeleteDocumentResponse:
    """Remove a document from the index.

    Idempotent: deleting something already gone succeeds. Django calls this
    when a document is deleted, and a delete that failed because the vectors
    were already absent would leave the two stores permanently disagreeing.
    """
    bind_context(document_id=document_id, tenant_id=caller.tenant_id)
    await resources.indexing.delete_document(caller.tenant_id, document_id)
    return DeleteDocumentResponse(documentId=document_id, deleted=True)


@router.delete(
    "/bases/{knowledge_base_id}",
    response_model=DeleteKnowledgeBaseResponse,
    response_model_by_alias=True,
)
async def delete_knowledge_base(
    knowledge_base_id: str, caller: IndexCallerDep, resources: ResourcesDep
) -> DeleteKnowledgeBaseResponse:
    """Remove every vector of one knowledge base. Idempotent, like the above."""
    bind_context(knowledge_base_id=knowledge_base_id, tenant_id=caller.tenant_id)
    await resources.indexing.delete_knowledge_base(caller.tenant_id, knowledge_base_id)
    return DeleteKnowledgeBaseResponse(knowledgeBaseId=knowledge_base_id, deleted=True)


@router.get("/stats", response_model=IndexStatsResponse, response_model_by_alias=True)
async def index_stats(
    caller: CallerDep,
    resources: ResourcesDep,
    knowledge_base_id: Annotated[
        str | None, Query(alias="knowledgeBaseId", max_length=64)
    ] = None,
    document_id: Annotated[str | None, Query(alias="documentId", max_length=64)] = None,
) -> IndexStatsResponse:
    """Vector count for a knowledge base or document, within the caller's tenant."""
    filters = SearchFilter.for_caller(
        caller,
        knowledge_base_id=knowledge_base_id,
        document_ids=(document_id,) if document_id else None,
    )
    points = await resources.indexing.count(filters)
    return IndexStatsResponse(
        knowledgeBaseId=knowledge_base_id, documentId=document_id, points=points
    )
