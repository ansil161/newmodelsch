"""Retrieval and answer-quality evaluation.

    pytest tests/evaluation -m evaluation -s

WHAT THIS IS. A harness that indexes the golden corpus, runs every question
through the real retrieval pipeline, and reports hit rate, recall, precision,
MRR and nDCG — plus groundedness and citation correctness on the generated
answers.

WHAT THE NUMBERS MEAN HERE. The default run uses the deterministic fake
embeddings from conftest, which are hashed, not semantic. Under those, dense
retrieval contributes almost nothing and sparse retrieval does the work, so
the absolute scores are a floor, not a quality claim. What the harness proves
is that the *measurement* works end to end and that hybrid retrieval beats
either half alone even on a hostile embedding.

Point it at real providers to get real numbers:

    EMBEDDING__PROVIDER=huggingface_api EMBEDDING__API_KEY=… \\
    RERANKER__PROVIDER=huggingface_api  RERANKER__API_KEY=… \\
    pytest tests/evaluation -m evaluation -s

The thresholds asserted below are deliberately loose. This is a regression
detector, not a grade: it should fail when someone breaks fusion or inverts a
filter, and it should not fail because a model was retrained.
"""

from __future__ import annotations

import pytest

from app.core.security import CallerIdentity
from app.modules.embeddings.service import EmbeddingService
from app.modules.indexing.service import IndexingService
from app.modules.rag.pipeline import RagPipeline
from app.modules.retrieval.fusion import RankedList, reciprocal_rank_fusion
from app.modules.retrieval.models import RetrievalQuery
from app.modules.retrieval.query_rewrite import QueryRewriter
from app.modules.retrieval.reranking import NoopReranker
from app.modules.retrieval.service import RetrievalService
from app.modules.vector_store.filters import SearchFilter
from app.shared.types import ChunkMetadata, DocumentChunkInput, DocumentIndexRequest
from tests.conftest import FakeEmbeddings, FakeLLM, FakeVectorStore
from tests.evaluation import metrics
from tests.evaluation.dataset import CASES, CORPUS

pytestmark = pytest.mark.evaluation

TENANT = "tenant-eval"
TOP_K = 5


@pytest.fixture
async def harness(settings):
    """Corpus indexed, retrieval wired, ready to query."""
    embeddings = EmbeddingService(settings.embedding, provider=FakeEmbeddings())
    store = FakeVectorStore()
    indexing = IndexingService(embeddings, store)

    for document in CORPUS:
        await indexing.index_document(
            DocumentIndexRequest(
                tenant_id=TENANT,
                document_id=document.id,
                document_name=document.name,
                document_type=document.doc_type,
                chunks=[
                    DocumentChunkInput(
                        chunk_id=f"{document.id}-{index}",
                        chunk_index=index,
                        content=content,
                        metadata=ChunkMetadata(page=index + 1),
                    )
                    for index, content in enumerate(document.chunks)
                ],
            )
        )

    retrieval = RetrievalService(
        embeddings, store, NoopReranker(), settings.retrieval
    )
    return embeddings, store, retrieval, settings


def filters() -> SearchFilter:
    return SearchFilter.for_caller(
        CallerIdentity(user_id="evaluator", tenant_id=TENANT)
    )


def documents_of(chunks) -> list[str]:
    """Ranked document ids, de-duplicated, keeping first appearance."""
    seen: list[str] = []
    for chunk in chunks:
        if chunk.document_id not in seen:
            seen.append(chunk.document_id)
    return seen


# --------------------------------------------------------------------------
# Retrieval
# --------------------------------------------------------------------------

async def test_retrieval_quality_report(harness, capsys):
    _, _, retrieval, _ = harness
    scores = metrics.RetrievalScores()
    rows: list[tuple[str, float, str]] = []

    for case in CASES:
        if case.unanswerable:
            continue
        result = await retrieval.retrieve(
            RetrievalQuery(text=case.question, filters=filters())
        )
        ranked = documents_of(result.chunks)
        scores.add(ranked, case.relevant_documents, TOP_K)
        rows.append((
            case.question,
            metrics.reciprocal_rank(ranked, case.relevant_documents),
            ", ".join(ranked[:3]) or "(nothing)",
        ))

    summary = scores.averaged()

    with capsys.disabled():
        print("\n\n  RETRIEVAL QUALITY")
        print("  " + "-" * 76)
        for question, rr, top in rows:
            flag = "ok  " if rr > 0 else "MISS"
            print(f"  {flag} rr={rr:.2f}  {question[:44]:<44} -> {top[:26]}")
        print("  " + "-" * 76)
        print("  " + "  ".join(f"{k}={v}" for k, v in summary.items()))

    # A regression gate, not a grade. Sparse retrieval alone should clear
    # this on a corpus with this much lexical overlap.
    assert summary["hit_rate"] >= 0.6, summary
    assert summary["mrr"] >= 0.5, summary


async def test_hybrid_beats_either_half_alone(harness, capsys):
    """The claim that justifies the whole hybrid design.

    Run each retriever on its own over the same questions and compare. If
    fusion is not adding anything, one of the two halves is broken or the
    weights are wrong — and this is how that becomes visible.
    """
    embeddings, store, _, settings = harness

    dense_only = metrics.RetrievalScores()
    sparse_only = metrics.RetrievalScores()
    hybrid = metrics.RetrievalScores()

    for case in CASES:
        if case.unanswerable:
            continue

        dense_vector, sparse_vector = await embeddings.encode_query(case.question)
        dense_hits = await store.search_dense(
            dense_vector, limit=30, filters=filters()
        )
        sparse_hits = await store.search_sparse(
            sparse_vector, limit=30, filters=filters()
        )
        fused = reciprocal_rank_fusion(
            [RankedList(dense_hits), RankedList(sparse_hits)],
            k=settings.retrieval.fusion_k,
        )

        dense_only.add(documents_of(dense_hits), case.relevant_documents, TOP_K)
        sparse_only.add(documents_of(sparse_hits), case.relevant_documents, TOP_K)
        hybrid.add(documents_of(fused), case.relevant_documents, TOP_K)

    with capsys.disabled():
        print("\n  RETRIEVER COMPARISON")
        print("  " + "-" * 76)
        for label, scores in (("dense ", dense_only), ("sparse", sparse_only),
                              ("hybrid", hybrid)):
            values = scores.averaged()
            print(f"  {label}  " + "  ".join(
                f"{k}={v}" for k, v in values.items() if k != "cases"
            ))
        print("  " + "-" * 76)
        print("  Note: dense uses hashed fake embeddings here, so its score is")
        print("  a floor. Set EMBEDDING__PROVIDER for a real measurement.")

    # Fusion must never be worse than its best input.
    assert hybrid.averaged()["hit_rate"] >= dense_only.averaged()["hit_rate"]
    assert hybrid.averaged()["hit_rate"] >= sparse_only.averaged()["hit_rate"]


async def test_identifier_lookup_is_found_by_the_lexical_half(harness):
    """SKU-4471 is what sparse retrieval exists for.

    A dense-only system fails this and the failure is invisible in aggregate
    metrics dominated by prose questions.
    """
    embeddings, store, _, _ = harness

    _, sparse_vector = await embeddings.encode_query(
        "What is the power rating of SKU-4471?"
    )
    hits = await store.search_sparse(sparse_vector, limit=10, filters=filters())

    assert "product-catalogue" in documents_of(hits)
    assert any("SKU-4471" in hit.content for hit in hits)


async def test_retrieval_respects_the_tenant_boundary(harness):
    _, _, retrieval, _ = harness

    result = await retrieval.retrieve(
        RetrievalQuery(
            text="warranty",
            filters=SearchFilter.for_caller(
                CallerIdentity(user_id="intruder", tenant_id="another-tenant")
            ),
        )
    )

    assert result.chunks == []


# --------------------------------------------------------------------------
# Generation
# --------------------------------------------------------------------------

async def test_answer_quality_report(harness, settings, capsys):
    """Groundedness and citation correctness over the answerable cases.

    The fake LLM echoes the retrieved context, which makes this a measurement
    of *what the pipeline put in the prompt* rather than of a model's
    reasoning. That is the useful half to regression-test: if the right facts
    never reach the prompt, no model can produce a correct answer.
    """
    _, _, retrieval, _ = harness

    grounded_total = 0.0
    citation_total = 0.0
    answerable = [case for case in CASES if not case.unanswerable]

    rows = []
    for case in answerable:
        result = await retrieval.retrieve(
            RetrievalQuery(text=case.question, filters=filters())
        )
        context_text = " ".join(chunk.content for chunk in result.chunks)

        grounded = metrics.groundedness(context_text, case.expected_facts)
        cited = metrics.citation_correctness(
            documents_of(result.chunks)[:1], case.relevant_documents
        )
        grounded_total += grounded
        citation_total += cited
        rows.append((case.question, grounded, cited))

    with capsys.disabled():
        print("\n  ANSWER QUALITY (facts present in the assembled context)")
        print("  " + "-" * 76)
        for question, grounded, cited in rows:
            flag = "ok  " if grounded else "MISS"
            print(f"  {flag} fact={grounded:.0f} citation={cited:.2f}  "
                  f"{question[:48]}")
        print("  " + "-" * 76)
        print(f"  groundedness={grounded_total / len(answerable):.2f}  "
              f"citation_correctness={citation_total / len(answerable):.2f}")

    assert grounded_total / len(answerable) >= 0.5


async def test_the_system_refuses_when_the_corpus_cannot_answer(harness, settings):
    """The property a confident RAG system lacks.

    A pipeline that always answers is not accurate. These questions have no
    basis in the corpus, and the ungrounded prompt must be the one selected.
    """
    _, _, retrieval, _ = harness
    llm = FakeLLM(response="I could not find anything about that.")
    rewriter = QueryRewriter(llm, settings.query_rewrite, settings.conversation)
    pipeline = RagPipeline(retrieval, llm, rewriter, settings)

    for case in CASES:
        if not case.unanswerable:
            continue

        prepared = await pipeline.prepare(case.question, [], filters())

        # Either nothing was retrieved, or what was retrieved does not
        # contain the answer — in both cases the answer must not assert one.
        if not prepared.grounded:
            assert "Nothing in the knowledge base matched" in (
                prepared.request.system_prompt or ""
            )
        result = await pipeline.generate(prepared)
        assert metrics.refusal(result.answer), case.question


# --------------------------------------------------------------------------
# The metrics themselves
# --------------------------------------------------------------------------

def test_metric_arithmetic():
    """A quietly wrong metric is worse than no metric."""
    retrieved = ["a", "b", "c", "d"]
    relevant = {"b", "d"}

    assert metrics.hit_rate(retrieved, relevant) == 1.0
    assert metrics.hit_rate(["x", "y"], relevant) == 0.0
    assert metrics.recall_at_k(retrieved, relevant, 4) == 1.0
    assert metrics.recall_at_k(retrieved, relevant, 2) == 0.5
    assert metrics.precision_at_k(retrieved, relevant, 4) == 0.5
    assert metrics.reciprocal_rank(retrieved, relevant) == 0.5
    assert metrics.reciprocal_rank(["b"], relevant) == 1.0
    assert metrics.reciprocal_rank(["x"], relevant) == 0.0

    perfect = metrics.ndcg_at_k(["b", "d"], relevant, 5)
    worse = metrics.ndcg_at_k(["a", "b", "c", "d"], relevant, 5)
    assert perfect == pytest.approx(1.0)
    assert worse < perfect


def test_refusal_detection():
    assert metrics.refusal("I could not find anything about that.")
    assert metrics.refusal("The knowledge base does not contain that.")
    assert not metrics.refusal("The warranty is thirty-six months.")
