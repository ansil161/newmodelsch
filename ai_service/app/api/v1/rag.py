"""RAG diagnostics — the admin console's Test RAG page.

One route. It runs the production pipeline with tracing on and returns every
intermediate ranking beside the answer; see modules/rag/diagnostics.py.

Administrators only. The service token proves the request came from Django;
`X-Jaaz-Is-Admin` is Django saying this user may see retrieval internals,
which is a narrower permission than asking a question.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.dependencies import ChatCallerDep, ResourcesDep
from app.core.exceptions import ForbiddenError
from app.modules.rag.schemas import RagTestRequest, RagTestResponse

router = APIRouter(prefix="/rag", tags=["rag"])


@router.post("/test", response_model=RagTestResponse, response_model_by_alias=True)
async def run_rag_diagnostics(
    payload: RagTestRequest, caller: ChatCallerDep, resources: ResourcesDep
) -> RagTestResponse:
    if not caller.is_admin:
        raise ForbiddenError(
            "Retrieval diagnostics are available to knowledge-base administrators only."
        )
    return await resources.diagnostics.run(payload, caller)
