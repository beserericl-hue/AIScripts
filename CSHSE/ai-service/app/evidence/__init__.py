"""CR-018 — Evidence-review pipeline endpoints.

Phase 1 (this commit): module skeleton + endpoint stubs returning HTTP
501 with a structured "phase":"not_implemented" body. Establishes the
contract for follow-on Phase 2 work without locking the wire format.

Phase 2 (open):
  - ``extract`` — Marker-pdf → markdown → text-embedding-3-small →
    upsert into ``cshse_evidence_{env}`` Qdrant collection.
  - ``recommend`` — RAG retrieval for a given spec; returns top-k
    matching evidence chunks with institutionId payload filter.
  - ``score`` — Claude Haiku adjudication of evidence-vs-spec match;
    returns confidence + rationale + matrix-row references when present.

Each endpoint will reuse cshse-ai's HMAC service-to-service auth,
per-env Qdrant collection naming, and per-institution payload filter
(see [[../cross-institution-isolation-audit-2026-05-24]] Gap 2).
"""
from __future__ import annotations

__all__ = ["EVIDENCE_PHASE", "EVIDENCE_PHASE_NOT_IMPLEMENTED_BODY"]


# Wire-shape constants the endpoint stubs return so callers can branch on
# them without parsing free-text error messages.
EVIDENCE_PHASE = "phase-1-stub"
EVIDENCE_PHASE_NOT_IMPLEMENTED_BODY = {
    "phase": EVIDENCE_PHASE,
    "ready": False,
    "doc": "https://docs.cshse.org/internal/cr-018",
    "detail": (
        "Evidence-review endpoints are wired but the matcher / RAG / "
        "scoring logic ships in CR-018 Phase 2. Callers should expect "
        "this 501 response until Phase 2 deploys; treat as a feature "
        "flag, not a deploy error."
    ),
}
