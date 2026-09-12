"""Ask the running stack every customer question and grade what comes back.

    python scripts/run_customer_questions.py

Needs Django on :8000 and ai_service on :8001, and signs in as a real member
account — so what is measured is the whole path a customer takes: cookie
auth, Django, the trust boundary, retrieval, Gemini, streaming, citations.
Nothing is stubbed. That is the point; a version of this with fakes would
grade the fakes.

WHAT IS GRADED

  grounded      Did the assistant answer from retrieved context, or decline?
                Compared against what the corpus can honestly support.
  cited         Does an answer carry at least one citation?
  supported     Does a cited passage actually contain the fact the answer
                states? This is the check that separates a citation from a
                decoration, and it is the one worth having.
  latency       Time to the first token and to the complete answer, per
                question, because an average hides the questions that hurt.

A REFUSE case that answers anyway is the most serious failure here, and is
reported first.
"""

from __future__ import annotations

import json
import os
import re
import statistics
import sys
import time
from dataclasses import dataclass
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import get_settings
from tests.evaluation.customer_questions import ANSWER, QUESTIONS, REFUSE

BASE = os.environ.get("JAAZ_BASE_URL", "http://127.0.0.1:8000")

# Read from the environment, never written here. A password in a script is a
# password in version control, in every clone of the repository and in every
# CI log that echoes the file — and "it is only a test account" stops being
# true the first time the same script is pointed at a real deployment.
#
#     set JAAZ_TEST_EMAIL=member@jaaz.test
#     set JAAZ_TEST_PASSWORD=...
EMAIL = os.environ.get("JAAZ_TEST_EMAIL", "")
PASSWORD = os.environ.get("JAAZ_TEST_PASSWORD", "")

# Phrases the no-context prompt produces. Used only as a secondary signal;
# `grounded` from the service metadata is the authority.
DECLINE = re.compile(
    r"not (currently )?(available|found)|could not find|no information|"
    r"does not (contain|cover)|not in the .{0,30}knowledge base|unable to find",
    re.IGNORECASE,
)


@dataclass
class Result:
    question: str
    category: str
    expect: str
    answer: str
    grounded: bool
    sources: list[dict]
    metadata: dict
    first_token_ms: int
    total_ms: int
    missing_facts: list[str]
    unsupported_facts: list[str]
    error: str = ""

    @property
    def declined(self) -> bool:
        return not self.grounded or bool(DECLINE.search(self.answer))

    @property
    def behaved(self) -> bool:
        if self.error:
            return False
        if self.expect == REFUSE:
            return self.declined
        return self.grounded and bool(self.sources)

    @property
    def citations_ok(self) -> bool:
        return not self.missing_facts and not self.unsupported_facts


def normalise(text: str) -> str:
    return re.sub(r"[^a-z0-9.:]+", " ", text.lower())


def new_conversation(client: httpx.Client, headers) -> dict:
    """A fresh conversation, waiting out the write throttle if it bites.

    Django limits chat writes per user per minute, deliberately. A harness
    that treats its own throttling as a product failure grades the throttle
    rather than the assistant.
    """
    for _attempt in range(6):
        response = client.post("/api/chat/conversations/", json={},
                               headers=headers())
        if response.status_code == 201:
            return response.json()["conversation"]
        if response.status_code == 429:
            wait = int(response.headers.get("Retry-After") or 10) + 1
            print(f"        (throttled by Django, waiting {wait}s)")
            time.sleep(wait)
            continue
        raise RuntimeError(f"conversation create failed: {response.status_code}")
    raise RuntimeError("still throttled after six attempts")


def load_chunk_texts() -> dict[str, str]:
    """Every indexed chunk, keyed by chunk id.

    The chat API returns a truncated `excerpt` — a reading window, cut to a
    few hundred characters so a source card stays readable. Checking whether
    a citation supports a claim against that window would fail whenever the
    supporting sentence happens to sit past the cut, which is a property of
    the window and says nothing about the citation.

    So support is checked against the passage the model was actually given.
    Reading it straight from the vector store is the only way to see it: it
    is deliberately not exposed over the API, and deliberately not stored
    with the conversation.
    """
    settings = get_settings()
    from qdrant_client import QdrantClient

    client = QdrantClient(
        url=settings.qdrant.url,
        api_key=(settings.qdrant.api_key.get_secret_value()
                 if settings.qdrant.api_key else None),
        timeout=settings.qdrant.timeout_seconds,
        check_compatibility=False,
    )
    texts: dict[str, str] = {}
    offset = None
    while True:
        points, offset = client.scroll(settings.qdrant.collection, limit=256,
                                       offset=offset, with_payload=True,
                                       with_vectors=False)
        for point in points:
            payload = point.payload or {}
            texts[str(payload.get("chunk_id"))] = payload.get("content", "")
        if offset is None:
            return texts


def ask(client: httpx.Client, question, chunk_texts: dict[str, str]) -> Result:
    def headers() -> dict[str, str]:
        return {"X-CSRFToken": client.cookies.get("csrftoken"), "Referer": BASE}

    # A fresh conversation each time: history would let one answer prime the
    # next, and every question here is meant to stand alone.
    conversation = new_conversation(client, headers)

    answer, sources, metadata, error = "", [], {}, ""
    started = time.perf_counter()
    first_token: float | None = None

    try:
        with client.stream(
            "POST", f"/api/chat/conversations/{conversation['id']}/messages/stream/",
            json={"message": question.text}, headers=headers(),
        ) as response:
            if response.status_code != 200:
                response.read()
                return Result(question.text, question.category, question.expect,
                              "", False, [], {}, 0, 0, [], [],
                              error=f"HTTP {response.status_code}")
            buffer = ""
            for chunk in response.iter_text():
                buffer += chunk
                while "\n\n" in buffer:
                    frame, buffer = buffer.split("\n\n", 1)
                    event = data = None
                    for line in frame.split("\n"):
                        if line.startswith("event:"):
                            event = line[6:].strip()
                        elif line.startswith("data:"):
                            data = line[5:].strip()
                    if not event or not data:
                        continue
                    payload = json.loads(data)
                    if event == "token" and first_token is None:
                        first_token = time.perf_counter()
                    elif event == "message_complete":
                        answer = payload.get("answer", "")
                        sources = payload.get("sources", [])
                        metadata = payload.get("metadata", {})
                    elif event == "error":
                        error = payload.get("error", {}).get("code", "ERROR")
    except Exception as exc:
        error = f"{type(exc).__name__}: {exc}"

    total_ms = int((time.perf_counter() - started) * 1000)
    ttft_ms = int((first_token - started) * 1000) if first_token else 0

    # Does the answer state the fact, and does a cited passage back it up?
    missing, unsupported = [], []
    haystack = normalise(answer)
    # The full passages the model was given, not the truncated preview.
    cited = normalise(" ".join(
        chunk_texts.get(s.get("chunkId", ""), s.get("excerpt", ""))
        for s in sources
    ))
    for fact in question.expect_contains:
        needle = normalise(fact).strip()
        if needle not in haystack:
            missing.append(fact)
        elif needle not in cited:
            unsupported.append(fact)

    return Result(question.text, question.category, question.expect, answer,
                  bool(metadata.get("grounded")), sources, metadata,
                  ttft_ms, total_ms, missing, unsupported, error)


def main() -> int:
    if not EMAIL or not PASSWORD:
        print(
            "Set JAAZ_TEST_EMAIL and JAAZ_TEST_PASSWORD before running.\n"
            "They are read from the environment so that no account credential\n"
            "is ever written into this repository."
        )
        return 2

    client = httpx.Client(base_url=BASE, timeout=300, follow_redirects=True)
    client.get("/api/auth/csrf/")
    login = client.post(
        "/api/auth/login/", json={"email": EMAIL, "password": PASSWORD},
        headers={"X-CSRFToken": client.cookies.get("csrftoken"), "Referer": BASE},
    )
    if login.status_code != 200:
        print(f"Could not sign in as {EMAIL}: {login.status_code}")
        return 1

    chunk_texts = load_chunk_texts()
    print(f"Loaded {len(chunk_texts)} indexed chunks for citation checking")

    results: list[Result] = []
    print(f"Asking {len(QUESTIONS)} questions\n" + "=" * 96)

    for index, question in enumerate(QUESTIONS, 1):
        result = ask(client, question, chunk_texts)

        # Gemini's free tier allows 20 generate_content calls a minute and
        # there is no fallback provider configured, so a burst of questions
        # exhausts it. That is a quota, not a defect in the answer — wait it
        # out and ask again rather than recording a failure the assistant did
        # not cause. Once only: a second 429 means something else is wrong.
        if result.error == "LLM_UNAVAILABLE":
            print("        (provider quota, waiting 45s and retrying once)")
            time.sleep(45)
            result = ask(client, question, chunk_texts)

        results.append(result)

        mark = "ok  " if result.behaved else "FAIL"
        if result.behaved and not result.citations_ok:
            mark = "cite"
        shape = "grounded" if result.grounded else "declined"
        print(f"[{mark}] {index:>2}/{len(QUESTIONS)} {question.category:<12} "
              f"{shape:<9} {result.total_ms:>6}ms  {question.text[:56]}")
        if result.error:
            print(f"        error: {result.error}")
        if result.missing_facts:
            print(f"        answer omits: {result.missing_facts}")
        if result.unsupported_facts:
            print(f"        NOT IN ANY CITED PASSAGE: {result.unsupported_facts}")

    # -- summary -------------------------------------------------------------
    answered = [r for r in results if r.expect == ANSWER]
    refused = [r for r in results if r.expect == REFUSE]

    print("\n" + "=" * 96)
    print("BEHAVIOUR")
    print(f"  answerable   : {sum(r.behaved for r in answered)}/{len(answered)}"
          f" answered from the corpus")
    print(f"  unanswerable : {sum(r.behaved for r in refused)}/{len(refused)}"
          f" correctly declined")

    hallucinated = [r for r in refused if not r.behaved]
    if hallucinated:
        print("\n  HALLUCINATION - answered something the corpus does not contain:")
        for r in hallucinated:
            print(f"    {r.question}\n      -> {r.answer[:150]}")

    unsupported = [r for r in results if r.unsupported_facts]
    if unsupported:
        print("\n  UNSUPPORTED CITATIONS - fact stated but not in any cited passage:")
        for r in unsupported:
            print(f"    {r.question} -> {r.unsupported_facts}")

    errors = [r for r in results if r.error]
    if errors:
        print(f"\n  ERRORS ({len(errors)}):")
        for r in errors:
            print(f"    {r.question} -> {r.error}")

    print("\nCITATIONS")
    grounded = [r for r in results if r.grounded]
    with_sources = [r for r in grounded if r.sources]
    print(f"  grounded answers carrying at least one source: "
          f"{len(with_sources)}/{len(grounded)}")
    if grounded:
        print(f"  mean sources per grounded answer: "
              f"{statistics.mean(len(r.sources) for r in grounded):.1f}")

    timed = [r for r in results if r.total_ms and not r.error]
    if timed:
        totals = sorted(r.total_ms for r in timed)
        ttfts = sorted(r.first_token_ms for r in timed if r.first_token_ms)
        print("\nLATENCY (end to end, through Django)")
        print(f"  total   median {statistics.median(totals):>6.0f} ms   "
              f"p90 {totals[int(len(totals) * 0.9) - 1]:>6} ms   "
              f"max {totals[-1]:>6} ms")
        if ttfts:
            print(f"  first token median {statistics.median(ttfts):>6.0f} ms   "
                  f"p90 {ttfts[int(len(ttfts) * 0.9) - 1]:>6} ms")
        stages = [(r.metadata.get("retrievalMs") or 0,
                   r.metadata.get("generationMs") or 0) for r in timed]
        print(f"  retrieval median {statistics.median(s[0] for s in stages):>6.0f} ms")
        print(f"  generation median {statistics.median(s[1] for s in stages):>5.0f} ms")

    failures = sum(1 for r in results if not r.behaved) + len(unsupported)
    print("\n" + "=" * 96)
    print("RESULT: PASS" if failures == 0 else f"RESULT: {failures} problem(s)")
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
