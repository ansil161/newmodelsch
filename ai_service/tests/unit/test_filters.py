"""Retrieval filters — the data-isolation boundary.

These are the tests that matter most in the whole suite. The failure they
guard against is one tenant reading another's documents, which is the worst
thing this service could do.
"""

from __future__ import annotations

from app.core.security import CallerIdentity
from app.modules.vector_store.filters import SearchFilter


def caller(**kwargs) -> CallerIdentity:
    return CallerIdentity(**{"user_id": "u1", "tenant_id": "tenant-a", **kwargs})


def test_the_tenant_always_comes_from_the_caller():
    assert SearchFilter.for_caller(caller()).tenant_id == "tenant-a"


def test_a_caller_with_no_allow_list_may_see_the_whole_tenant():
    # None means "everything this tenant owns" — which is not "everything".
    assert SearchFilter.for_caller(caller()).document_ids is None


def test_a_request_can_narrow_the_caller_scope():
    filters = SearchFilter.for_caller(caller(), document_ids=("d1", "d2"))
    assert filters.document_ids == ("d1", "d2")


def test_a_request_cannot_widen_the_caller_scope():
    """The intersection is taken, never the union.

    A client asking for a document it may not see gets nothing — not an
    error, which would confirm the document exists.
    """
    restricted = caller(allowed_document_ids=("d1",))
    filters = SearchFilter.for_caller(restricted, document_ids=("d1", "d2", "d99"))
    assert filters.document_ids == ("d1",)


def test_asking_only_for_forbidden_documents_matches_nothing():
    restricted = caller(allowed_document_ids=("d1",))
    filters = SearchFilter.for_caller(restricted, document_ids=("d99",))

    assert filters.document_ids == ()
    assert filters.matches_nothing is True


def test_an_empty_allow_list_is_honoured_as_empty():
    # An empty allow-list is a real answer, not a missing one. Treating it as
    # "no filter" would show a restricted caller everything.
    filters = SearchFilter.for_caller(caller(allowed_document_ids=()))
    assert filters.matches_nothing is True


def test_a_caller_allow_list_applies_with_no_request_filter():
    restricted = caller(allowed_document_ids=("d1", "d2"))
    assert SearchFilter.for_caller(restricted).document_ids == ("d1", "d2")


def test_the_knowledge_base_filter_is_carried_through():
    filters = SearchFilter.for_caller(caller(), knowledge_base_id="kb-7")
    assert filters.knowledge_base_id == "kb-7"


def test_a_full_scope_filter_does_not_match_nothing():
    assert SearchFilter.for_caller(caller()).matches_nothing is False


def test_two_tenants_produce_different_filters():
    a = SearchFilter.for_caller(caller(tenant_id="tenant-a"))
    b = SearchFilter.for_caller(caller(tenant_id="tenant-b"))
    assert a.tenant_id != b.tenant_id
