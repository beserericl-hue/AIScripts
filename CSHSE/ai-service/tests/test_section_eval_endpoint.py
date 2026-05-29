"""CR-049 Phase 1 — system / integration + E2E tests for /ai/section/evaluate.

Layers (per user direction — real CSHSE spec data makes all three possible):
  - SYSTEM/INTEGRATION: drive the HMAC-verified FastAPI endpoint with real
    CSHSE specification criteria (load_specifications) + a patched/absent LLM.
    Validates HTTP wiring, HMAC, Pydantic validation, shape, and that real
    spec criteria propagate per-spec.
  - E2E (opt-in): run the real evaluator against a real Anthropic LLM with a
    real spec + narrative. Skipped unless RUN_LLM_E2E=1 + ANTHROPIC_API_KEY.
    (Full server→ai-service→LLM E2E lands with CR-049 Phase 2 server wiring.)

Unit coverage of the pure helpers lives in test_section_eval.py.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.standards.loader import load_specifications

_HMAC_SECRET = "section-eval-test-secret"
_PATH = "/ai/section/evaluate"


def _sign(body: bytes) -> dict:
    ts = int(time.time())
    digest = hmac.new(_HMAC_SECRET.encode(), f"{ts}.".encode() + body, hashlib.sha256).hexdigest()
    return {"x-service-signature": f"t={ts},v1={digest}", "content-type": "application/json"}


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setenv("NODE_SERVICE_HMAC_SECRET", _HMAC_SECRET)
    monkeypatch.setenv("CSHSE_ENV", "dev")
    from app.config import get_settings

    get_settings.cache_clear()
    from app.main import app

    yield TestClient(app)
    get_settings.cache_clear()


def _real_specs(n: int = 5) -> list[dict]:
    """First n real CSHSE bachelor specs as evaluator input (criteria = spec_text)."""
    specs = load_specifications("bachelors")[:n]
    return [
        {"standardCode": s.standard_code, "specCode": s.spec_code, "criteria": s.spec_text}
        for s in specs
    ]


def _post(client, payload: dict, *, sign: bool = True):
    body = json.dumps(payload).encode()
    headers = _sign(body) if sign else {"content-type": "application/json"}
    return client.post(_PATH, data=body, headers=headers)


# --- HMAC + validation ----------------------------------------------------

def test_missing_hmac_returns_401(client):
    resp = _post(client, {"institutionId": "i", "submissionId": "s", "specs": _real_specs(1)}, sign=False)
    assert resp.status_code == 401


def test_bad_hmac_returns_401(client):
    body = json.dumps({"institutionId": "i", "submissionId": "s", "specs": _real_specs(1)}).encode()
    resp = client.post(_PATH, data=body, headers={"x-service-signature": "t=1,v1=deadbeef", "content-type": "application/json"})
    assert resp.status_code == 401


def test_malformed_body_returns_422(client):
    # missing required institutionId / submissionId / specs
    resp = _post(client, {"narrativeHtml": "<p>x</p>"})
    assert resp.status_code == 422


# --- system: real spec criteria through the endpoint ----------------------

def test_real_specs_return_one_row_each(client):
    specs = _real_specs(5)
    resp = _post(client, {
        "institutionId": "inst-1",
        "submissionId": "sub-1",
        "specs": specs,
        "narrativeHtml": "<p>The program is regionally accredited by MSCHE.</p>",
        "supportingEvidenceText": ["Accreditation letter excerpt."],
    })
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["perSpec"]) == 5
    # every row carries a valid verdict + matches a requested spec
    requested = {(s["standardCode"], s["specCode"]) for s in specs}
    for row in body["perSpec"]:
        assert (row["standardCode"], row["specCode"]) in requested
        assert row["verdict"] in {"pass", "needs_improvement", "fail"}
        assert "sourcesUsed" in row


def test_degraded_without_api_key_is_200(client):
    # No ANTHROPIC_API_KEY in the test env → graceful degradation, not a 500.
    resp = _post(client, {
        "institutionId": "inst-1",
        "submissionId": "sub-1",
        "specs": _real_specs(1),
        "narrativeHtml": "<p>x</p>",
    })
    assert resp.status_code == 200
    row = resp.json()["perSpec"][0]
    assert row["verdict"] == "needs_improvement"
    assert "degraded" in row["rationale"]


def test_patched_llm_yields_pass_verdict_through_endpoint(client, monkeypatch):
    """Full endpoint → evaluate_section → (patched) LLM path produces a verdict."""
    class _FakeAnthropic:
        def __init__(self, *a, **k):
            self.messages = SimpleNamespace(create=self._create)

        def _create(self, *, model, max_tokens, messages):
            payload = json.dumps({"verdict": "pass", "rationale": "meets criteria", "criteriaCoverage": [], "improvementSuggestions": []})
            return SimpleNamespace(content=[SimpleNamespace(text=payload)])

    import app.section_eval.evaluate as ev
    monkeypatch.setattr(ev, "Anthropic", _FakeAnthropic)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    from app.config import get_settings
    get_settings.cache_clear()

    resp = _post(client, {
        "institutionId": "inst-1",
        "submissionId": "sub-1",
        "specs": _real_specs(2),
        "narrativeHtml": "<p>The program is regionally accredited.</p>",
    })
    assert resp.status_code == 200
    rows = resp.json()["perSpec"]
    assert len(rows) == 2
    assert all(r["verdict"] == "pass" for r in rows)
    get_settings.cache_clear()


# --- E2E (opt-in) — real LLM against a real spec --------------------------

@pytest.mark.skipif(
    os.getenv("RUN_LLM_E2E") != "1" or not os.getenv("ANTHROPIC_API_KEY"),
    reason="real-LLM E2E: set RUN_LLM_E2E=1 + ANTHROPIC_API_KEY to run",
)
def test_e2e_real_llm_evaluates_a_real_spec():
    from app.section_eval import evaluate_section

    spec = _real_specs(1)[0]
    out = evaluate_section(
        institution_id="e2e-inst",
        submission_id="e2e-sub",
        specs=[spec],
        narrative_html="<p>Stevenson University is accredited by the Middle States Commission on Higher Education (MSCHE).</p>",
        supporting_evidence_text=["MSCHE accreditation status letter, current through 2030."],
    )
    row = out["perSpec"][0]
    assert row["verdict"] in {"pass", "needs_improvement", "fail"}
    assert isinstance(row["rationale"], str) and row["rationale"].strip()
    assert row["standardCode"] == spec["standardCode"]
