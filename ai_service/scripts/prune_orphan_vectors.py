"""Remove vectors for documents the system of record no longer knows about.

    python scripts/prune_orphan_vectors.py            # report only
    python scripts/prune_orphan_vectors.py --apply    # delete

WHAT COUNTS AS AN ORPHAN. Django's `Document` table is the system of record:
it owns the file, the upload, the status and the audit trail. A point in
Qdrant whose `document_id` has no matching row is not a document — nobody can
open it, delete it through the console, or say where it came from. It can
still be retrieved and cited, which is the dangerous part: an answer grounded
in a passage that no longer has a source.

HOW THEY GET THERE. Two ways, both real:

  * A test suite pointed at a configured cluster. Django's knowledge-base
    tests index their fixtures through whatever `RAG_VECTOR_STORE` names, so
    with that set to `ai_service` they wrote documents called "notes", "a"
    and "manual" straight into production. Fixed by pinning the store in the
    test base, but the debris outlives the fix.
  * A delete that failed after the row was already gone. The vector store
    deliberately logs and continues in that case rather than turning "the
    document is deleted" into a 500 — and says the orphans are cleaned up
    later. This is later.

The tenant is read from each point rather than assumed, so a multi-tenant
collection is pruned correctly.
"""

from __future__ import annotations

import argparse
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import get_settings


def known_document_ids(path: Path) -> set[str]:
    """The document ids Django owns, read from a file.

    A file rather than a database query, because the two services keep
    separate virtualenvs on purpose — this one has no Django and no Postgres
    driver, and adding them so a maintenance script can run would drag the
    whole ORM into the AI service's dependency tree.

    Produce it from the Django project:

        python manage.py shell -c "
        from knowledge_base.models import Document
        print('\\n'.join(str(d) for d in
              Document.objects.values_list('id', flat=True)))" > known-ids.txt
    """
    if not path.is_file():
        raise SystemExit(
            f"No such file: {path}\n"
            f"Generate it from the Django project first — see this script's "
            f"--help for the one-liner."
        )
    return {
        line.strip()
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.startswith("#")
    }


def scan(client: Any, collection: str) -> dict[str, dict[str, Any]]:
    """Group every point in the collection by its document."""
    documents: dict[str, dict[str, Any]] = defaultdict(
        lambda: {"points": 0, "name": "", "tenant": "", "characters": 0}
    )
    offset = None
    while True:
        points, offset = client.scroll(
            collection, limit=256, offset=offset,
            with_payload=True, with_vectors=False,
        )
        for point in points:
            payload = point.payload or {}
            entry = documents[str(payload.get("document_id", ""))]
            entry["points"] += 1
            entry["name"] = payload.get("document_name", "")
            entry["tenant"] = payload.get("tenant_id", "")
            entry["characters"] += len(payload.get("content", ""))
        if offset is None:
            return dict(documents)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--known-ids", type=Path, required=True,
        help="file of document ids Django owns, one per line",
    )
    parser.add_argument(
        "--apply", action="store_true",
        help="actually delete. Without it, nothing is changed.",
    )
    args = parser.parse_args()

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

    known = known_document_ids(args.known_ids)
    found = scan(client, collection)

    keep = {d: v for d, v in found.items() if d in known}
    orphans = {d: v for d, v in found.items() if d not in known}

    total = sum(v["points"] for v in found.values())
    print(f"collection        : {collection}")
    print(f"points            : {total}")
    print(f"documents in Qdrant: {len(found)}")
    print(f"documents Django owns: {len(known)}")

    kept_points = sum(v["points"] for v in keep.values())
    print(f"\nKEEP - {len(keep)} document(s), {kept_points} point(s)")
    for document_id, entry in sorted(keep.items(), key=lambda kv: kv[1]["name"]):
        print(f"  {entry['points']:>3} pts  {entry['name']!r}  {document_id}")

    print(f"\nORPHANS — {len(orphans)} document(s), "
          f"{sum(v['points'] for v in orphans.values())} point(s)")
    by_name: dict[str, list[str]] = defaultdict(list)
    for document_id, entry in orphans.items():
        by_name[entry["name"]].append(document_id)
    for name, ids in sorted(by_name.items()):
        print(f"  {len(ids):>3} doc(s)  {name!r}")

    if not orphans:
        print("\nNothing to prune.")
        return 0

    if not args.apply:
        print("\nDry run. Re-run with --apply to delete the orphans above.")
        return 0

    from qdrant_client import models

    removed = 0
    for document_id, entry in orphans.items():
        client.delete(
            collection_name=collection,
            points_selector=models.FilterSelector(
                filter=models.Filter(must=[
                    models.FieldCondition(
                        key="tenant_id",
                        match=models.MatchValue(value=entry["tenant"]),
                    ),
                    models.FieldCondition(
                        key="document_id",
                        match=models.MatchValue(value=document_id),
                    ),
                ])
            ),
            wait=True,
        )
        removed += entry["points"]

    remaining = client.get_collection(collection).points_count
    print(f"\nDeleted {removed} point(s). Collection now holds {remaining}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
