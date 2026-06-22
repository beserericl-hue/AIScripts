"""Offline tests for the per-spec EvidenceSplitter.

The LLM call is stubbed so we test the grounding (anti-hallucination),
dedup, kind-normalisation and short-excerpt filtering deterministically.
"""
from __future__ import annotations

import json
import types

from app.matcher.evidence_splitter import EvidenceSplitter
from app.standards.loader import Specification


def _spec():
    return Specification(
        standard_code="5",
        spec_code="a",
        standard_title="Policies",
        spec_text="Provide documentation of admission policies.",
        program_level="bachelors",
        version="2025",
    )


def _fake_msg(payload: dict):
    block = types.SimpleNamespace(type="text", text=json.dumps(payload))
    return types.SimpleNamespace(content=[block])


def _splitter_returning(payload: dict) -> EvidenceSplitter:
    s = EvidenceSplitter(anthropic_key="test-key")
    s._call_with_retry = lambda prompt: _fake_msg(payload)  # type: ignore
    return s


NARRATIVE = (
    "The program follows the university admission process. Our policy states: "
    "'Applicants must hold a 2.5 GPA and submit two references before review.' "
    "Supporting materials include the catalog, the student handbook, the "
    "internship manual, and the program website."
)


def test_keeps_grounded_quoted_policy():
    s = _splitter_returning({"evidence": [
        {"kind": "quoted_policy", "label": "Admission GPA policy",
         "excerpt": "Applicants must hold a 2.5 GPA and submit two references before review."},
    ]})
    out = s.split(_spec(), NARRATIVE)
    assert len(out) == 1
    assert out[0].kind == "quoted_policy"
    assert "2.5 GPA" in out[0].excerpt


def test_drops_hallucinated_excerpt_not_in_source():
    s = _splitter_returning({"evidence": [
        {"kind": "quoted_policy", "label": "fabricated",
         "excerpt": "Applicants must submit a notarized loyalty oath and a blood sample."},
    ]})
    assert s.split(_spec(), NARRATIVE) == []


def test_drops_too_short_excerpt():
    s = _splitter_returning({"evidence": [
        {"kind": "artifact_list", "label": "x", "excerpt": "the catalog"},
    ]})
    assert s.split(_spec(), NARRATIVE) == []


def test_keeps_artifact_list_and_dedupes():
    excerpt = "the catalog, the student handbook, the internship manual, and the program website"
    s = _splitter_returning({"evidence": [
        {"kind": "artifact_list", "label": "Cited materials", "excerpt": excerpt},
        {"kind": "artifact_list", "label": "dup", "excerpt": excerpt},
    ]})
    out = s.split(_spec(), NARRATIVE)
    assert len(out) == 1
    assert out[0].kind == "artifact_list"


def test_unknown_kind_defaults_and_empty_handled():
    assert _splitter_returning({"evidence": []}).split(_spec(), NARRATIVE) == []
    s = _splitter_returning({"evidence": [
        {"kind": "bogus", "label": "L",
         "excerpt": "Supporting materials include the catalog, the student handbook"},
    ]})
    out = s.split(_spec(), NARRATIVE)
    assert len(out) == 1 and out[0].kind == "quoted_policy"


def test_non_json_response_is_safe():
    s = EvidenceSplitter(anthropic_key="test-key")
    s._call_with_retry = lambda prompt: types.SimpleNamespace(  # type: ignore
        content=[types.SimpleNamespace(type="text", text="sorry, no JSON here")]
    )
    assert s.split(_spec(), NARRATIVE) == []
