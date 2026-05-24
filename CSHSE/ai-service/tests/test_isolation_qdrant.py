"""CR-017 Gap 2 — Qdrant payload-filter assertion test.

Proves that ``retrieve_for_section`` always builds a Qdrant payload
filter that pins ``institutionId`` (and ``programLevel``), so the
matcher never sees corrections written under any other institution.

We don't need a live Qdrant for this — a fake VectorStore captures the
``payload_filter`` argument and we assert on it.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import pytest

from app.corrections.store import retrieve_for_section, ingest_correction
from app.vector.qdrant_ops import SearchHit


@dataclass
class _FakeEmbedder:
    def embed_one(self, text: str) -> list[float]:
        # Deterministic small vector — content doesn't matter for the
        # payload-filter test; it just needs to be a list[float].
        return [0.1, 0.2, 0.3]


class _SpyStore:
    """Captures every search() call so the test can assert the filter."""
    def __init__(self) -> None:
        self.search_calls: list[dict[str, Any]] = []
        self.upsert_calls: list[dict[str, Any]] = []
        self.ensured_collections: list[str] = []

    def ensure_collection(self, name: str) -> None:
        self.ensured_collections.append(name)

    def search(
        self,
        collection: str,
        query_vector: list[float],
        top_k: int = 5,
        payload_filter: dict[str, Any] | None = None,
    ) -> list[SearchHit]:
        self.search_calls.append(
            {
                "collection": collection,
                "top_k": top_k,
                "payload_filter": payload_filter,
            }
        )
        return []

    def upsert(
        self,
        collection: str,
        *,
        vectors: list[list[float]],
        payloads: list[dict[str, Any]],
        ids: list[str],
    ) -> None:
        self.upsert_calls.append(
            {
                "collection": collection,
                "vectors": vectors,
                "payloads": payloads,
                "ids": ids,
            }
        )


@pytest.fixture
def fake_embedder() -> _FakeEmbedder:
    return _FakeEmbedder()


@pytest.fixture
def spy_store() -> _SpyStore:
    return _SpyStore()


def test_retrieve_always_pins_institution_id_in_payload_filter(
    fake_embedder: _FakeEmbedder, spy_store: _SpyStore
) -> None:
    retrieve_for_section(
        section_text="The program assesses client outcomes via direct observation.",
        institution_id="inst-A",
        program_level="bachelors",
        embedder=fake_embedder,
        store=spy_store,  # type: ignore[arg-type]
    )
    assert len(spy_store.search_calls) == 1, (
        "retrieve_for_section must call store.search() exactly once"
    )
    pf = spy_store.search_calls[0]["payload_filter"]
    assert pf is not None, "payload_filter must be set"
    assert pf.get("institutionId") == "inst-A", (
        "institutionId MUST appear in every payload_filter — otherwise the "
        "matcher could surface corrections from a different institution."
    )
    assert pf.get("programLevel") == "bachelors"


def test_retrieve_returns_empty_without_institution_id(
    fake_embedder: _FakeEmbedder, spy_store: _SpyStore
) -> None:
    # Defense-in-depth: a missing institutionId must short-circuit to []
    # rather than fall through to an unfiltered Qdrant query.
    out = retrieve_for_section(
        section_text="anything",
        institution_id=None,
        program_level="bachelors",
        embedder=fake_embedder,
        store=spy_store,  # type: ignore[arg-type]
    )
    assert out == []
    assert spy_store.search_calls == [], (
        "When institution_id is missing the store must NOT be queried "
        "(otherwise an unfiltered search could return any institution's "
        "corrections)."
    )


def test_ingest_writes_institution_id_into_payload(
    fake_embedder: _FakeEmbedder, spy_store: _SpyStore
) -> None:
    ingest_correction(
        {
            "correctionId": "corr-1",
            "institutionId": "inst-X",
            "programLevel": "bachelors",
            "expectedStd": "7",
            "expectedSpec": "b",
            "sourceText": "Faculty have terminal degrees.",
            "sourceHeading": "Personnel",
        },
        embedder=fake_embedder,
        store=spy_store,  # type: ignore[arg-type]
    )
    assert len(spy_store.upsert_calls) == 1
    payload = spy_store.upsert_calls[0]["payloads"][0]
    assert payload["institutionId"] == "inst-X", (
        "Every persisted correction must stamp the originating "
        "institutionId on the payload so the retrieve filter has "
        "something to match on."
    )
    assert payload["programLevel"] == "bachelors"


def test_two_institutions_never_cross_via_payload_filter(
    fake_embedder: _FakeEmbedder, spy_store: _SpyStore
) -> None:
    # Run retrieve twice as two different institutions; assert each call's
    # filter is scoped to the right institutionId. This is the end-to-end
    # invariant the audit relies on.
    retrieve_for_section(
        section_text="x",
        institution_id="inst-A",
        program_level="bachelors",
        embedder=fake_embedder,
        store=spy_store,  # type: ignore[arg-type]
    )
    retrieve_for_section(
        section_text="y",
        institution_id="inst-B",
        program_level="masters",
        embedder=fake_embedder,
        store=spy_store,  # type: ignore[arg-type]
    )
    filters = [c["payload_filter"] for c in spy_store.search_calls]
    assert filters[0]["institutionId"] == "inst-A"
    assert filters[1]["institutionId"] == "inst-B"
    # Neither filter accidentally includes the OTHER institution.
    assert "inst-B" not in str(filters[0])
    assert "inst-A" not in str(filters[1])
