"""
CR-018 — AI evidence review stub-contract guard.

CR-018 Phase 1 shipped three endpoint stubs under /ai/evidence/* that
return HTTP 501 with a structured body so the typed cshse-server client
can branch on the {phase, ready:false, ...} payload without parsing the
free-text reason. Phase 2 (real extract / RAG / scoring) is partially
shipped — the 501 fallback fires only when callers send NO extractable
input (no markdown, no PDF, no S3 key) to /ai/evidence/extract.

This test pins the Phase-1 contract:
   1. EVIDENCE_PHASE / EVIDENCE_PHASE_NOT_IMPLEMENTED_BODY constants keep
      their current wire shape (typed callers depend on these keys).
   2. /ai/evidence/extract returns 501 with that body when no markdown /
      pdfBase64 / documentS3Key is provided.
   3. HMAC gate fires (missing/bad signature → 401, NOT 501).
   4. All three endpoints are routable + HMAC-gated (route registration
      regression catcher).

Catches: a future refactor that renames `phase` → `version` (breaks the
client predicate), or a contributor who drops the 501 fallback because
"Phase 2 always returns something now."
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    """FastAPI client with a deterministic HMAC secret + dev env."""
    with patch.dict(
        os.environ,
        {"NODE_SERVICE_HMAC_SECRET": "test-cr018-secret", "CSHSE_ENV": "dev"},
        clear=False,
    ):
        from app.config import get_settings
        get_settings.cache_clear()
        from app.main import app
        yield TestClient(app)
        get_settings.cache_clear()


def _sign(body: bytes, secret: str = "test-cr018-secret") -> dict:
    ts = int(time.time())
    digest = hmac.new(
        secret.encode(), f"{ts}.".encode() + body, hashlib.sha256
    ).hexdigest()
    return {"x-service-signature": f"t={ts},v1={digest}"}


def test_evidence_phase_constant_unchanged():
    """The 'phase' value is part of the typed client's branch predicate.
    Renaming or version-bumping it without updating the client breaks
    the {ready:false} fallback path."""
    from app.evidence import EVIDENCE_PHASE, EVIDENCE_PHASE_NOT_IMPLEMENTED_BODY

    assert EVIDENCE_PHASE == "phase-1-stub"
    assert EVIDENCE_PHASE_NOT_IMPLEMENTED_BODY["phase"] == "phase-1-stub"
    assert EVIDENCE_PHASE_NOT_IMPLEMENTED_BODY["ready"] is False
    assert "detail" in EVIDENCE_PHASE_NOT_IMPLEMENTED_BODY
    assert isinstance(EVIDENCE_PHASE_NOT_IMPLEMENTED_BODY["detail"], str)


def test_extract_returns_501_with_phase_body_when_no_input(client):
    """/ai/evidence/extract with empty markdown + no PDF inputs falls
    back to the CR-018 Phase-1 501 contract. The schema (extract request)
    requires institutionId + submissionId; sending those with everything
    else null hits the 501 fallback inside the handler."""
    body = json.dumps(
        {
            "institutionId": "inst-1",
            "submissionId": "sub-1",
            # All three input modes empty → fallback fires.
            "markdown": None,
            "pdfBase64": None,
            "documentS3Key": None,
        }
    ).encode()
    res = client.post("/ai/evidence/extract", content=body, headers=_sign(body))
    assert res.status_code == 501, f"got {res.status_code}: {res.text}"
    body_out = res.json()
    detail = body_out.get("detail", {})
    assert isinstance(detail, dict), f"detail should be dict; got {detail!r}"
    assert detail.get("phase") == "phase-1-stub"
    assert detail.get("ready") is False
    assert detail.get("endpoint") == "evidence.extract"
    assert "reason" in detail


def test_extract_rejects_unsigned_request_with_401(client):
    """The HMAC gate fires. Send a body that WOULD pass Pydantic
    validation but with no signature header — must get 401 from the
    auth dependency, NOT 501 (which would leak the doc URL + endpoint
    name in the structured body to unauthenticated callers)."""
    body = json.dumps(
        {
            "institutionId": "inst-1",
            "submissionId": "sub-1",
            "markdown": None,
        }
    ).encode()
    res = client.post("/ai/evidence/extract", content=body)  # NO signature
    assert res.status_code == 401, f"got {res.status_code}: {res.text}"


def test_extract_with_bad_signature_returns_401(client):
    """Tampered/invalid signature → 401, not 501."""
    body = json.dumps(
        {
            "institutionId": "inst-1",
            "submissionId": "sub-1",
            "markdown": None,
        }
    ).encode()
    res = client.post(
        "/ai/evidence/extract",
        content=body,
        headers={"x-service-signature": "t=1,v1=deadbeef"},
    )
    assert res.status_code == 401


def test_recommend_and_score_endpoints_are_registered_and_signed(client):
    """Phase-1 contract: the three CR-018 endpoints are wired and
    HMAC-gated. Send a valid Pydantic body so we don't hit 422
    pre-auth, then assert the auth gate fires."""
    recommend_body = json.dumps(
        {
            "institutionId": "i1",
            "submissionId": "s1",
            "standardCode": "1",
            "specCode": "a",
        }
    ).encode()
    res = client.post("/ai/evidence/recommend", content=recommend_body)  # unsigned
    assert res.status_code == 401, f"recommend gate: {res.status_code} {res.text}"

    score_body = json.dumps(
        {
            "institutionId": "i1",
            "submissionId": "s1",
            "standardCode": "1",
            "specCode": "a",
            "candidateChunks": [],
        }
    ).encode()
    res = client.post("/ai/evidence/score", content=score_body)  # unsigned
    assert res.status_code == 401, f"score gate: {res.status_code} {res.text}"
