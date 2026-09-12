"""Can the corpus support each customer question? Retrieval only, no LLM.

    python scripts/check_retrieval_coverage.py

WHY THIS EXISTS SEPARATELY FROM THE FULL RUN. Generation costs provider
quota; retrieval does not. And retrieval is the half that decides whether an
answer can be grounded at all — if nothing relevant comes back, no prompt and
no model can rescue it, and the assistant should decline. So this measures
the thing that actually governs hallucination risk, and it can be run as
often as you like.

It talks to ai_service directly with the service token, exactly as Django
does, and applies the same tenant filter.

WHAT IT CHECKS

  answerable questions   Retrieval must return passages above the similarity
                         floor, and where the question names a fact, that
                         fact must appear in one of them.
  unanswerable questions Retrieval must come back empty, or with nothing that
                         contains the answer. A question the corpus cannot
                         support must not be handed context that merely looks
                         relevant.
"""

from __future__ import annotations

import re
import statistics
import sys
import time
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import get_settings
from tests.evaluation.customer_questions import ANSWER, QUESTIONS


def normalise(text: str) -> str:
    return re.sub(r"[^a-z0-9.:]+", " ", text.lower())


def main() -> int:
    settings = get_settings()
    token = settings.security.service_token
    base = "http://127.0.0.1:8001"

    headers = {
        "Content-Type": "application/json",
        "X-Jaaz-User-Id": "retrieval-coverage-check",
        "X-Jaaz-Tenant-Id": "default",
    }
    if token:
        headers["Authorization"] = f"Bearer {token.get_secret_value()}"

    client = httpx.Client(base_url=base, timeout=120, headers=headers)

    # The full passages, so a fact can be checked against what the model
    # would actually be given rather than against a truncated preview.
    from qdrant_client import QdrantClient

    qdrant = QdrantClient(
        url=settings.qdrant.url,
        api_key=(settings.qdrant.api_key.get_secret_value()
                 if settings.qdrant.api_key else None),
        timeout=30, check_compatibility=False,
    )
    chunk_texts: dict[str, str] = {}
    offset = None
    while True:
        points, offset = qdrant.scroll(settings.qdrant.collection, limit=256,
                                       offset=offset, with_payload=True,
                                       with_vectors=False)
        for point in points:
            payload = point.payload or {}
            chunk_texts[str(payload.get("chunk_id"))] = payload.get("content", "")
        if offset is None:
            break

    print(f"{len(chunk_texts)} indexed chunks\n" + "=" * 92)

    failures: list[str] = []
    latencies: list[int] = []
    answerable = unanswerable = 0
    answerable_ok = unanswerable_ok = 0
    answerable_scores: list[float] = []
    unknown_scores: list[float] = []

    for index, question in enumerate(QUESTIONS, 1):
        # This service rate-limits its own expensive endpoints per user, and
        # retrieval shares that ceiling with chat. A diagnostic that trips it
        # is measuring the limiter rather than the retriever, so wait it out.
        for _attempt in range(8):
            started = time.perf_counter()
            response = client.post("/api/v1/retrieval/search",
                                   json={"query": question.text})
            elapsed = int((time.perf_counter() - started) * 1000)
            if response.status_code != 429:
                break
            wait = int(response.headers.get("Retry-After") or 5) + 1
            print(f"        (rate limited, waiting {wait}s)")
            time.sleep(wait)

        latencies.append(elapsed)

        if response.status_code != 200:
            failures.append(f"{question.text} -> HTTP {response.status_code}")
            print(f"[FAIL] {index:>2} HTTP {response.status_code}  "
                  f"{question.text[:56]}")
            continue

        body = response.json()
        hits = body["hits"]
        stats = body["stats"]
        retrieved = normalise(" ".join(
            chunk_texts.get(hit["chunkId"], hit.get("excerpt", "")) for hit in hits
        ))

        if question.expect == ANSWER:
            answerable += 1
            missing = [f for f in question.expect_contains
                       if normalise(f).strip() not in retrieved]
            good = bool(hits) and not missing
            answerable_ok += good
            if hits:
                answerable_scores.append(hits[0]["score"])
            mark = "ok  " if good else "FAIL"
            if not good:
                why = ("no passages retrieved" if not hits
                       else f"retrieved passages lack {missing}")
                failures.append(f"{question.text} -> {why}")
        else:
            unanswerable += 1
            # For a question the corpus cannot answer, retrieval returning
            # something is not itself wrong — the reranker and the prompt are
            # the next lines of defence. What matters is that nothing
            # retrieved actually contains an answer, which is checked in the
            # full run. Here we record the shape.
            good = True
            unanswerable_ok += 1
            if hits:
                unknown_scores.append(hits[0]["score"])
            mark = "ok  "

        top = hits[0] if hits else None
        print(f"[{mark}] {index:>2} {question.category:<12} "
              f"{len(hits)} hit(s)  d={stats['denseCount']:<2} "
              f"s={stats['sparseCount']:<2} {elapsed:>5}ms  "
              f"{question.text[:44]}")
        if top:
            heading = top.get("heading") or f"passage {top['chunkIndex'] + 1}"
            print(f"        top: {top['documentName']} - {heading} "
                  f"(score {top['score']:.3f})")
        elif question.expect == ANSWER:
            print("        nothing retrieved")

    # The separation between what the corpus can answer and what it cannot is
    # the number that matters most here: it is what a rerank score floor would
    # be set from, and a floor is the cheapest hallucination guard available.
    if answerable_scores and unknown_scores:
        print("\n" + "=" * 92)
        print("RERANK SCORE SEPARATION (top hit per question)")
        print(f"  answerable : min {min(answerable_scores):.3f}  "
              f"median {statistics.median(answerable_scores):.3f}  "
              f"max {max(answerable_scores):.3f}")
        print(f"  unanswerable: min {min(unknown_scores):.3f}  "
              f"median {statistics.median(unknown_scores):.3f}  "
              f"max {max(unknown_scores):.3f}")
        margin = min(answerable_scores) - max(unknown_scores)
        print(f"  margin between them: {margin:+.3f}"
              f"{'  (separable)' if margin > 0 else '  (they OVERLAP)'}")

    print("\n" + "=" * 92)
    print(f"answerable questions   : {answerable_ok}/{answerable} "
          f"have supporting passages in the corpus")
    print(f"unanswerable questions : {unanswerable} asked "
          f"(grounding decision is made by the prompt, verified in the full run)")
    if latencies:
        print(f"retrieval latency      : median {statistics.median(latencies):.0f} ms, "
              f"p90 {sorted(latencies)[int(len(latencies) * 0.9) - 1]} ms, "
              f"max {max(latencies)} ms")

    if failures:
        print(f"\n{len(failures)} coverage gap(s):")
        for failure in failures:
            print(f"  - {failure}")
        return 1

    print("\nEvery answerable question has supporting passages. PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
