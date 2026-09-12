"""Ingestion endpoints: a file or a URL in, chunks out.

Called by Django's ingestion worker, never by a browser, and reachable only
with the service token. Nothing here writes to the index — extraction and
indexing are separate calls so the worker can store the chunks, report the
stage to the console, and index them as a second step. See
modules/ingestion/__init__.py.

No business logic lives here. A route validates, delegates, and returns.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, File, Form, UploadFile

from app.api.dependencies import IndexCallerDep, ResourcesDep
from app.core.logging import bind_context
from app.modules.ingestion.schemas import ExtractionResponse, ExtractUrlRequest
from app.modules.ingestion.service import file_too_large

router = APIRouter(prefix="/ingestion", tags=["ingestion"])

_READ_CHUNK_BYTES = 1024 * 1024


@router.post("/extract", response_model=ExtractionResponse,
             response_model_by_alias=True)
async def extract_file(
    caller: IndexCallerDep,
    resources: ResourcesDep,
    file: Annotated[UploadFile, File()],
    filename: Annotated[str | None, Form(max_length=255)] = None,
    content_type: Annotated[
        str | None, Form(alias="contentType", max_length=255)
    ] = None,
) -> ExtractionResponse:
    """Parse, clean and chunk an uploaded file."""
    bind_context(tenant_id=caller.tenant_id)
    data = await _read_bounded(file, resources.settings.ingestion.max_file_bytes)
    result = await resources.ingestion.extract_file(
        data,
        filename=filename or file.filename or "",
        content_type=content_type or file.content_type,
    )
    return ExtractionResponse.of(result)


@router.post("/extract-url", response_model=ExtractionResponse,
             response_model_by_alias=True)
async def extract_url(
    payload: ExtractUrlRequest, caller: IndexCallerDep, resources: ResourcesDep
) -> ExtractionResponse:
    """Fetch a page through the SSRF-safe fetcher, then parse and chunk it."""
    bind_context(tenant_id=caller.tenant_id)
    result = await resources.ingestion.extract_url(payload.url)
    return ExtractionResponse.of(result)


async def _read_bounded(upload: UploadFile, limit: int) -> bytes:
    """Read an upload, refusing it the moment it passes the size limit."""
    buffer = bytearray()
    while chunk := await upload.read(_READ_CHUNK_BYTES):
        buffer.extend(chunk)
        if len(buffer) > limit:
            raise file_too_large(limit)
    return bytes(buffer)
