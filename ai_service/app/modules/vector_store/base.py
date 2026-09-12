"""The vector store contract.

Four operations, because that is all a knowledge base needs: write a
document's vectors, remove them, search densely, search lexically.

Dense and sparse search are separate methods rather than one `search(mode=)`
because they take different inputs and the caller runs them concurrently.
Fusing them is the retrieval layer's job, not the store's — a store that
returned an already-fused ranking would make RRF untestable and the weights
unreachable.

Every method takes a `SearchFilter`. It is not optional and has no default:
an unfiltered query against a multi-tenant collection is the bug this
interface exists to make impossible to write by accident.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Sequence

from app.modules.embeddings.sparse import SparseVector
from app.shared.types import DocumentIndexRequest, RetrievedChunk

from .filters import SearchFilter


class VectorStore(ABC):
    name: str = "unknown"

    @abstractmethod
    async def ensure_collection(self) -> None:
        """Create the collection and its indexes if they do not exist.

        Idempotent — called on every startup.
        """

    @abstractmethod
    async def upsert_document(
        self,
        request: DocumentIndexRequest,
        dense_vectors: Sequence[Sequence[float]],
        sparse_vectors: Sequence[SparseVector],
    ) -> int:
        """Replace everything stored for one document with these vectors.

        Replace, not append. Re-processing a document must never leave the
        previous run's chunks alongside the new ones, or the knowledge base
        answers from a version of the document that no longer exists.

        Returns how many points the store holds for this write, read back
        from the store — never simply the number sent. A write the store did
        not keep in full raises VectorStoreError instead of returning.
        """

    @abstractmethod
    async def delete_document(self, tenant_id: str, document_id: str) -> None: ...

    @abstractmethod
    async def delete_knowledge_base(self, tenant_id: str,
                                    knowledge_base_id: str) -> None:
        """Remove every point of one knowledge base, within one tenant."""

    @abstractmethod
    async def count(self, filters: SearchFilter) -> int:
        """Points matching a filter. Exact, for health checks, not for search."""

    @abstractmethod
    async def search_dense(
        self, vector: Sequence[float], *, limit: int, filters: SearchFilter,
        score_threshold: float | None = None,
    ) -> list[RetrievedChunk]: ...

    @abstractmethod
    async def search_sparse(
        self, vector: SparseVector, *, limit: int, filters: SearchFilter,
    ) -> list[RetrievedChunk]: ...

    @abstractmethod
    async def health(self) -> bool:
        """Cheap liveness probe for the readiness endpoint."""

    # An optional hook, deliberately concrete: a provider that holds no
    # sockets and no model memory should not have to write an empty
    # override just to satisfy the ABC.
    async def aclose(self) -> None:  # noqa: B027
        ...
