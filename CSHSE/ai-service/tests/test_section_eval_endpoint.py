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


# --- CR-049 Sprint 2.5 finish: hint activation ----------------------------

def test_endpoint_wires_hints_fn_from_corrections_store(client, monkeypatch):
    """The endpoint MUST build a hints_fn from retrieve_for_section + thread
    it into evaluate_section. We patch the store retrieval to return one
    canned example and assert it lands in the Haiku prompt."""
    # Patch the corrections store the endpoint pulls from.
    from app.corrections.store import CorrectionExample

    captured: dict = {}

    def fake_retrieve(*, section_text, institution_id, program_level, **kw):
        captured["section_text"] = section_text
        captured["institution_id"] = institution_id
        captured["program_level"] = program_level
        return [
            CorrectionExample(
                expected_std="1",
                expected_spec="a",
                source_heading="Section 1.a",
                source_text="Reader override: regional accreditation met despite scanned PDF link.",
                score=0.91,
                correction_type="section_eval_override",
            )
        ]

    import app.main as main_mod
    monkeypatch.setattr(main_mod, "retrieve_for_section", fake_retrieve, raising=False)
    # The endpoint imports retrieve_for_section + format_examples_for_prompt
    # inside _build_section_hints_fn (lazy), so patch the module they live in.
    import app.corrections.store as store_mod
    monkeypatch.setattr(store_mod, "retrieve_for_section", fake_retrieve)

    # Capture the prompt the LLM sees so we can assert hint injection.
    seen_prompts: list[str] = []

    class _FakeAnthropic:
        def __init__(self, *a, **k):
            self.messages = SimpleNamespace(create=self._create)

        def _create(self, *, model, max_tokens, messages):
            seen_prompts.append(messages[0]["content"])
            payload = json.dumps({"verdict": "pass", "rationale": "ok", "criteriaCoverage": [], "improvementSuggestions": []})
            return SimpleNamespace(content=[SimpleNamespace(text=payload)])

    import app.section_eval.evaluate as ev_mod
    monkeypatch.setattr(ev_mod, "Anthropic", _FakeAnthropic)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setenv("ENABLE_SECTION_EVAL_HINTS", "true")
    from app.config import get_settings
    get_settings.cache_clear()

    resp = _post(client, {
        "institutionId": "stevenson",
        "submissionId": "sub-1",
        "programLevel": "bachelors",
        "specs": [{"standardCode": "1", "specCode": "a", "criteria": "regionally accredited"}],
        "narrativeHtml": "<p>The program is regionally accredited by MSCHE; see attached letter.</p>",
    })
    assert resp.status_code == 200
    assert seen_prompts, "LLM was not called"
    prompt = seen_prompts[0]
    # The hint block from format_examples_for_prompt should appear in the prompt.
    assert "Previously-corrected examples" in prompt
    assert "section_eval_override" in prompt
    # The retrieve call must be scoped per-institution + per-program-level.
    assert captured["institution_id"] == "stevenson"
    assert captured["program_level"] == "bachelors"
    # And the section_text anchor must be the *stripped* narrative, not raw HTML.
    assert "<p>" not in captured["section_text"]
    assert "regionally accredited" in captured["section_text"]
    get_settings.cache_clear()


def test_endpoint_skips_hints_when_disabled(client, monkeypatch):
    """ENABLE_SECTION_EVAL_HINTS=false must disable the hints lookup
    entirely (no Qdrant call, no hint block in the prompt)."""
    called = {"count": 0}

    def fake_retrieve(**_kw):
        called["count"] += 1
        return []

    import app.corrections.store as store_mod
    monkeypatch.setattr(store_mod, "retrieve_for_section", fake_retrieve)

    seen_prompts: list[str] = []

    class _FakeAnthropic:
        def __init__(self, *a, **k):
            self.messages = SimpleNamespace(create=self._create)

        def _create(self, *, model, max_tokens, messages):
            seen_prompts.append(messages[0]["content"])
            return SimpleNamespace(content=[SimpleNamespace(text=json.dumps({"verdict": "pass", "rationale": "ok", "criteriaCoverage": [], "improvementSuggestions": []}))])

    import app.section_eval.evaluate as ev_mod
    monkeypatch.setattr(ev_mod, "Anthropic", _FakeAnthropic)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setenv("ENABLE_SECTION_EVAL_HINTS", "false")
    from app.config import get_settings
    get_settings.cache_clear()

    resp = _post(client, {
        "institutionId": "stevenson",
        "submissionId": "sub-1",
        "programLevel": "bachelors",
        "specs": [{"standardCode": "1", "specCode": "a", "criteria": "x"}],
        "narrativeHtml": "<p>real narrative content</p>",
    })
    assert resp.status_code == 200
    assert called["count"] == 0, "retrieve_for_section must not be called when hints disabled"
    assert "Previously-corrected examples" not in seen_prompts[0]
    get_settings.cache_clear()


def test_endpoint_hint_qdrant_failure_does_not_break_eval(client, monkeypatch):
    """Qdrant going down inside the hint lookup must NOT take the
    evaluation with it — the section evaluator still returns a verdict."""
    def boom(**_kw):
        raise RuntimeError("qdrant unreachable")

    import app.corrections.store as store_mod
    monkeypatch.setattr(store_mod, "retrieve_for_section", boom)

    class _FakeAnthropic:
        def __init__(self, *a, **k):
            self.messages = SimpleNamespace(create=self._create)

        def _create(self, *, model, max_tokens, messages):
            return SimpleNamespace(content=[SimpleNamespace(text=json.dumps({"verdict": "pass", "rationale": "ok", "criteriaCoverage": [], "improvementSuggestions": []}))])

    import app.section_eval.evaluate as ev_mod
    monkeypatch.setattr(ev_mod, "Anthropic", _FakeAnthropic)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setenv("ENABLE_SECTION_EVAL_HINTS", "true")
    from app.config import get_settings
    get_settings.cache_clear()

    resp = _post(client, {
        "institutionId": "stevenson",
        "submissionId": "sub-1",
        "programLevel": "bachelors",
        "specs": [{"standardCode": "1", "specCode": "a", "criteria": "x"}],
        "narrativeHtml": "<p>n</p>",
    })
    assert resp.status_code == 200
    assert resp.json()["perSpec"][0]["verdict"] == "pass"
    get_settings.cache_clear()


def test_endpoint_skips_hints_when_no_institution(client, monkeypatch):
    """An empty institutionId must short-circuit hint retrieval — better
    no hints than cross-institution leakage."""
    called = {"count": 0}

    def fake_retrieve(**_kw):
        called["count"] += 1
        return []

    import app.corrections.store as store_mod
    monkeypatch.setattr(store_mod, "retrieve_for_section", fake_retrieve)

    class _FakeAnthropic:
        def __init__(self, *a, **k):
            self.messages = SimpleNamespace(create=self._create)

        def _create(self, *, model, max_tokens, messages):
            return SimpleNamespace(content=[SimpleNamespace(text=json.dumps({"verdict": "pass", "rationale": "ok", "criteriaCoverage": [], "improvementSuggestions": []}))])

    import app.section_eval.evaluate as ev_mod
    monkeypatch.setattr(ev_mod, "Anthropic", _FakeAnthropic)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    monkeypatch.setenv("ENABLE_SECTION_EVAL_HINTS", "true")
    from app.config import get_settings
    get_settings.cache_clear()

    # Note: ai-service's _evaluate_one_spec normally requires a non-empty
    # institution_id at evaluate_section level too — confirm that
    # boundary at the hint layer here.
    resp = _post(client, {
        "institutionId": "x",  # evaluate_section requires it; we drop hints because the closure checks
        "submissionId": "sub-1",
        "programLevel": "bachelors",
        "specs": [{"standardCode": "1", "specCode": "a", "criteria": "x"}],
        "narrativeHtml": "<p>n</p>",
    })
    assert resp.status_code == 200
    # institution_id was non-empty, so retrieval is allowed — confirm the
    # control test is sound. The "no institution → no hints" branch is
    # better exercised through the helper directly:
    from app.main import _build_section_hints_fn
    from app.config import Settings
    hf = _build_section_hints_fn(
        institution_id="",
        program_level="bachelors",
        narrative_text="x",
        settings=Settings(enable_section_eval_hints=True),
    )
    assert hf is None
    # And opt-out short-circuits regardless of institution_id:
    hf2 = _build_section_hints_fn(
        institution_id="stevenson",
        program_level="bachelors",
        narrative_text="x",
        settings=Settings(enable_section_eval_hints=False),
    )
    assert hf2 is None
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
