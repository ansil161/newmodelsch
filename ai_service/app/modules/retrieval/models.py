"""Retrieval inputs and outputs.

`RetrievalResult` carries the stage counts as well as the chunks. They are
what makes a bad answer diagnosable: "dense 30, sparse 0, fused 30, reranked
6" says the lexical half found nothing, which is a completely different
problem from "dense 0, sparse 30".

`RetrievalTrace` goes one step further, for the admin console's diagnostics:
every intermediate ranking, not just its length.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.modules.vector_store.filters import SearchFilter
from app.shared.types import RetrievedChunk


@dataclass(frozen=True)
class RetrievalOverrides:
    """Per-request stage sizes. None means the configured default.

    For diagnostics and evaluation sweeps, which need to vary the parameters
    for one request without mutating the settings every other request reads.
    """

    dense_top_k: int | None = None
    sparse_top_k: int | None = None
    rerank_top_k: int | None = None
    final_k: int | None = None


@dataclass(frozen=True)
class RetrievalQuery:
    text: str
    filters: SearchFilter
    # None → fall back to the configured defaults. Present so an evaluation
    # run can sweep the parameters without mutating global settings.
    dense_top_k: int | None = None
    sparse_top_k: int | None = None
    rerank_top_k: int | None = None
    final_k: int | None = None
    # Record every intermediate ranking on the result. Off for chat: the
    # copies cost memory on the hot path and nothing reads them.
    trace: bool = False


@dataclass
class RetrievalTrace:
    """Every ranking the pipeline produced, for one query.

    Copies, not references. The reranker writes its scores onto the chunks it
    is given, so a reference to the fused list taken before reranking would
    show reranker scores by the time anyone read it.
    """

    dense: list[RetrievedChunk] = field(default_factory=list)
    sparse: list[RetrievedChunk] = field(default_factory=list)
    # The candidates handed to the reranker, with fusion scores only.
    fused: list[RetrievedChunk] = field(default_factory=list)
    reranked: list[RetrievedChunk] = field(default_factory=list)
    parameters: dict[str, Any] = field(default_factory=dict)


@dataclass
class RetrievalResult:
    chunks: list[RetrievedChunk] = field(default_factory=list)

    dense_count: int = 0
    sparse_count: int = 0
    fused_count: int = 0
    reranked_count: int = 0

    embedding_ms: int = 0
    retrieval_ms: int = 0
    rerank_ms: int = 0

    trace: RetrievalTrace | None = None

    @property
    def is_empty(self) -> bool:
        return not self.chunks

    def as_log_fields(self) -> dict[str, int]:
        return {
            "dense_count": self.dense_count,
            "sparse_count": self.sparse_count,
            "fused_count": self.fused_count,
            "reranked_count": self.reranked_count,
            "final_count": len(self.chunks),
            "embedding_ms": self.embedding_ms,
            "retrieval_ms": self.retrieval_ms,
            "rerank_ms": self.rerank_ms,
        }
