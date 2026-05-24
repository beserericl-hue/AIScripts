"""CR-018 Phase 2 — evidence module tests.

Covers:
- ``extract.extract_evidence_text`` chunks markdown + upserts with
  institutionId in every payload (regression guard against the
  cross-institution-isolation Gap 2).
- ``score._parse_response`` handles strict + lenient + malformed inputs.
- ``recommend.recommend_evidence`` always pins institutionId in the
  Qdrant payload filter (the audit Gap 2 invariant).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import pytest

from app.evidence.extract import _split_into_chunks, extract_evidence_text
from app.evidence.recommend import recommend_evidence
from app.evidence.score import _parse_response


@dataclass
class _FakeEmbedder:
    def embed_one(self, text: str) -> list[float]:
        return [float(len(text) % 7), 0.1, 0.2]


class _SpyStore:
    def __init__(self) -> None:
        self.upserts: list[dict] = []
        self.searches: list[dict] = []

    def ensure_collection(self, name: str) -> None:
        pass

    def upsert(self, collection, *, vectors, payloads, ids):
        self.upserts.append({"collection": collection, "payloads": payloads, "ids": ids})

    def search(self, collection, *, query_vector=None, top_k=5, payload_filter=None, **kw):
        # Some callers use positional query_vector; accept either.
        self.searches.append(
            {"collection": collection, "payload_filter": payload_filter, "top_k": top_k}
        )
        return []


# ---------------------------------------------------------------- chunk


def test_split_into_chunks_short_text_single_chunk() -> None:
    assert _split_into_chunks("hello world") == ["hello world"]


def test_split_into_chunks_respects_paragraph_boundaries() -> None:
    # Three small paragraphs that all fit in one chunk together.
    para1 = "a" * 200
    para2 = "b" * 200
    para3 = "c" * 200
    text = "\n\n".join([para1, para2, para3])
    chunks = _split_into_chunks(text, chunk_chars=800, overlap_chars=80)
    # 200 + 200 + 200 + (2 * 2 joiner overhead) = 604 < 800 → single chunk.
    assert len(chunks) == 1
    assert "aaa" in chunks[0]
    assert "bbb" in chunks[0]
    assert "ccc" in chunks[0]


def test_split_into_chunks_sliding_window_for_oversized_paragraph() -> None:
    huge = "x" * 2000
    chunks = _split_into_chunks(huge, chunk_chars=500, overlap_chars=50)
    # 2000 chars, step = 450, so chunks at 0, 450, 900, 1350, 1800 → 5 chunks
    assert len(chunks) >= 4
    assert all(len(c) <= 500 for c in chunks)


def test_split_into_chunks_empty_input_returns_empty() -> None:
    assert _split_into_chunks("") == []
    assert _split_into_chunks("   \n\n   ") == []


# ------------------------------------------------------------- extract


def test_extract_evidence_text_stamps_institution_on_every_chunk() -> None:
    spy = _SpyStore()
    fake_emb = _FakeEmbedder()
    out = extract_evidence_text(
        institution_id="inst-A",
        submission_id="sub-1",
        document_id="doc-1",
        markdown="Para one body text.\n\nPara two body text.",
        embedder=fake_emb,
        store=spy,
    )
    assert out["chunksUpserted"] >= 1
    assert spy.upserts, "store.upsert must have been called"
    for payload in spy.upserts[0]["payloads"]:
        assert payload["institutionId"] == "inst-A"
        assert payload["submissionId"] == "sub-1"
        assert payload["documentId"] == "doc-1"


def test_extract_evidence_text_requires_institution() -> None:
    with pytest.raises(ValueError):
        extract_evidence_text(
            institution_id="",
            submission_id="sub-1",
            document_id="d",
            markdown="anything",
            embedder=_FakeEmbedder(),
            store=_SpyStore(),
        )


# ----------------------------------------------------------- recommend


def test_recommend_pins_institution_in_payload_filter() -> None:
    spy = _SpyStore()
    fake_emb = _FakeEmbedder()
    out = recommend_evidence(
        institution_id="inst-B",
        submission_id="sub-2",
        standard_code="7",
        spec_code="b",
        embedder=fake_emb,
        store=spy,
    )
    assert spy.searches, "store.search must have been called"
    pf = spy.searches[0]["payload_filter"]
    assert pf is not None
    assert pf["institutionId"] == "inst-B"
    assert pf["submissionId"] == "sub-2"
    assert out["standardCode"] == "7"


def test_recommend_requires_institution() -> None:
    with pytest.raises(ValueError):
        recommend_evidence(
            institution_id="",
            submission_id="s",
            standard_code="1",
            spec_code="a",
            embedder=_FakeEmbedder(),
            store=_SpyStore(),
        )


# ------------------------------------------------------- score parsing


def test_score_parser_strict_json() -> None:
    raw = '{"confidence": 0.85, "rationale": "good", "citations": []}'
    out = _parse_response(raw)
    assert out["confidence"] == 0.85
    assert out["rationale"] == "good"


def test_score_parser_extracts_json_from_prose_wrapping() -> None:
    raw = 'I would say: {"confidence": 0.42, "rationale": "weak"} done.'
    out = _parse_response(raw)
    assert out["confidence"] == 0.42


def test_score_parser_fail_safe_on_garbage() -> None:
    out = _parse_response("the model went off-script")
    assert out["confidence"] == 0.0
    assert "could not parse" in out["rationale"].lower() or "malformed" in out["rationale"].lower()


def test_score_parser_empty_response() -> None:
    out = _parse_response("")
    assert out["confidence"] == 0.0
