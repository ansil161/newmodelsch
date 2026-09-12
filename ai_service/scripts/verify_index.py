"""Check that the collection is shaped correctly and holds what it should.

    python scripts/verify_index.py --known-ids known-ids.txt

Answers four questions an operator actually has after an indexing run:

  * Is the collection configured the way the embedding model needs it —
    right width, cosine, a sparse channel, and the payload indexes every
    retrieval filter depends on?
  * Does every vector carry the payload a citation is built from?
  * Does every document Django owns have vectors, and does every vector
    belong to a document Django owns?
  * Do the stored vectors actually have unit length, which is what makes
    cosine and dot product agree?

Read-only. It changes nothing and is safe to run against production.
"""

from __future__ import annotations

import argparse
import math
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import get_settings
from app.modules.vector_store.filters import (
    INDEXED_KEYWORD_FIELDS,
    PayloadField,
)

OK, BAD, WARN = "  ok  ", " FAIL ", " warn "
# What a citation is assembled from. A vector missing any of these can be
# retrieved but not attributed, which is worse than not retrieving it.
CITATION_FIELDS = (
    PayloadField.TENANT_ID,
    PayloadField.DOCUMENT_ID,
    PayloadField.DOCUMENT_NAME,
    PayloadField.CHUNK_ID,
    PayloadField.CHUNK_INDEX,
    PayloadField.CONTENT,
)


def line(status: str, label: str, detail: str = "") -> None:
    print(f"[{status}] {label:<38}{detail}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--known-ids", type=Path, required=True,
                        help="file of document ids Django owns, one per line")
    parser.add_argument("--sample-vectors", type=int, default=25,
                        help="how many vectors to pull for the norm check")
    args = parser.parse_args()

    known = {
        stripped
        for raw in args.known_ids.read_text(encoding="utf-8").splitlines()
        if (stripped := raw.strip()) and not stripped.startswith("#")
    }

    settings = get_settings()
    from qdrant_client import QdrantClient

    client = QdrantClient(
        url=settings.qdrant.url,
        api_key=(settings.qdrant.api_key.get_secret_value()
                 if settings.qdrant.api_key else None),
        timeout=settings.qdrant.timeout_seconds,
        check_compatibility=False,
    )
    collection = settings.qdrant.collection
    failures = 0

    # -- collection shape --------------------------------------------------
    print("\nCollection configuration\n" + "-" * 74)
    info = client.get_collection(collection)
    params = info.config.params

    dense = (params.vectors or {}).get("dense")
    if dense is None:
        line(BAD, "dense vector", "missing")
        failures += 1
    else:
        expected = settings.embedding.dimensions
        good = dense.size == expected and str(dense.distance) .endswith("Cosine")
        line(OK if good else BAD, "dense vector",
             f"{dense.size} dimensions, {dense.distance}"
             f"{'' if good else f' (expected {expected}, Cosine)'}")
        failures += 0 if good else 1

    sparse = (params.sparse_vectors or {}).get("sparse")
    if sparse is None:
        line(BAD, "sparse channel", "missing - hybrid retrieval is dense-only")
        failures += 1
    else:
        modifier = getattr(getattr(sparse, "modifier", None), "value", None)
        line(OK if modifier == "idf" else WARN, "sparse channel",
             f"present, modifier={modifier}")

    indexed = set((info.payload_schema or {}).keys())
    missing = set(INDEXED_KEYWORD_FIELDS) - indexed
    line(OK if not missing else BAD, "payload indexes",
         ", ".join(sorted(indexed)) if not missing else f"missing {sorted(missing)}")
    failures += 0 if not missing else 1

    # -- contents ----------------------------------------------------------
    print("\nContents\n" + "-" * 74)
    documents: dict[str, dict[str, Any]] = defaultdict(
        lambda: {"points": 0, "name": "", "headings": 0, "characters": 0}
    )
    incomplete = 0
    offset = None
    while True:
        points, offset = client.scroll(collection, limit=256, offset=offset,
                                       with_payload=True, with_vectors=False)
        for point in points:
            payload = point.payload or {}
            entry = documents[str(payload.get(PayloadField.DOCUMENT_ID, ""))]
            entry["points"] += 1
            entry["name"] = payload.get(PayloadField.DOCUMENT_NAME, "")
            entry["characters"] += len(payload.get(PayloadField.CONTENT, ""))
            if (payload.get(PayloadField.METADATA) or {}).get("heading"):
                entry["headings"] += 1
            if any(payload.get(field) in (None, "") for field in CITATION_FIELDS):
                incomplete += 1
        if offset is None:
            break

    total_points = sum(d["points"] for d in documents.values())
    line(OK, "points", str(total_points))
    line(OK, "documents with vectors", str(len(documents)))

    line(OK if incomplete == 0 else BAD, "citation payload complete",
         "every vector" if incomplete == 0
         else f"{incomplete} vector(s) missing fields")
    failures += 0 if incomplete == 0 else 1

    with_headings = sum(d["headings"] for d in documents.values())
    line(OK if with_headings else WARN, "vectors carrying a section heading",
         f"{with_headings}/{total_points}")

    # -- document/vector agreement ----------------------------------------
    print("\nDocument to vector agreement\n" + "-" * 74)
    orphans = set(documents) - known
    unindexed = known - set(documents)

    line(OK if not orphans else BAD, "vectors with no Django document",
         "none" if not orphans else f"{len(orphans)} document(s)")
    failures += 0 if not orphans else 1

    line(OK if not unindexed else BAD, "Django documents with no vectors",
         "none" if not unindexed else f"{len(unindexed)}: {sorted(unindexed)}")
    failures += 0 if not unindexed else 1

    # -- vector norms ------------------------------------------------------
    print("\nVector integrity\n" + "-" * 74)
    sample, _ = client.scroll(collection, limit=args.sample_vectors,
                              with_payload=False, with_vectors=True)
    norms = []
    for point in sample:
        vector = (point.vector or {}).get("dense") if isinstance(point.vector, dict) \
            else point.vector
        if vector:
            norms.append(math.sqrt(sum(value * value for value in vector)))
    if not norms:
        line(WARN, "unit length", "no vectors sampled")
    else:
        worst = max(abs(1.0 - n) for n in norms)
        # BGE output is L2-normalised, which is what lets cosine and dot
        # product agree. A drift here means something re-scaled the vectors.
        good = worst < 1e-3
        line(OK if good else BAD, "unit length (L2 normalised)",
             f"{len(norms)} sampled, worst deviation {worst:.2e}")
        failures += 0 if good else 1

    # -- inventory ---------------------------------------------------------
    print("\nIndexed documents\n" + "-" * 74)
    for entry in sorted(documents.values(), key=lambda d: d["name"]):
        print(f"  {entry['points']:>3} chunks  {entry['characters']:>6} chars  "
              f"{entry['headings']:>3} w/heading   {entry['name']}")

    print("\n" + "-" * 74)
    if failures:
        print(f"{failures} check(s) FAILED")
        return 1
    print("All checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
