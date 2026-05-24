---
name: CR-018 — Move AI evidence review off n8n into cshse-ai
description: Sprint 4 evidence-review stories (S4.1/S4.2/S4.3/S4.5) targeted n8n; the cshse-ai Python service is now the canonical AI surface. Re-target evidence review there.
type: change-request
cr_id: CR-018
status: shipped
priority: P1
source: [[sprint-plan-2026-05-11#sprint-3]], [[sprint-plan-2026-05-16]] (S4.x)
supersedes: S4.1, S4.2, S4.3, S4.5
sprint_target: Sprint 4 or 5
tags: [ai-service, evidence-review, n8n, deprecation]
last_reviewed: 2026-05-24
---

# CR-018 — Move AI evidence review off n8n into cshse-ai

## Phase 2b shipped 2026-05-24 — PDF extraction via pypdf

The PDF input path now lands. Substituted **pypdf** for marker-pdf:
the downstream consumer is ``extract_evidence_text``, which already
splits text into ~800-char chunks for embedding — marker-pdf's
strengths (table/figure preservation) are wasted there, and its model
weights pull a ~2 GB image into the ai-service container. pypdf is
pure-Python, ~200 KB, no system deps; deploy risk → zero.

What landed:
- ``ai-service/app/evidence/pdf_extract.py`` — ``extract_text_from_pdf_bytes``
  (in-memory) + ``extract_text_from_s3`` (Tigris/S3 streaming, reusing
  the ``CSHSE_S3_BUCKET`` / ``AWS_ENDPOINT_URL_S3`` env convention).
  50 MB sanity cap; per-page extraction so one corrupt page doesn't
  abort the whole document.
- ``ai-service/requirements.txt`` — ``pypdf==5.1.0`` added.
- ``ai-service/app/main.py`` — ``EvidenceExtractRequest`` accepts three
  input modes in priority order: ``markdown`` (cheapest), ``pdfBase64``
  (inline bytes), or ``documentS3Key`` + ``documentMimeType=application/pdf``
  (server-side fetch). Response now includes ``pdfSource`` + ``extractedChars``
  when PDF was the input.
- ``server/src/services/cshseAiClient.ts`` — ``EvidenceExtractRequest``
  matches the new shape (markdown / pdfBase64 / documentS3Key); response
  type carries the optional ``pdfSource`` + ``extractedChars`` fields.

6 new unit tests in ``tests/test_evidence_pdf.py`` covering:
single-page extraction, multi-page separation, empty/garbage/oversized
rejection, and an end-to-end PDF-bytes → text → chunked-upsert round
trip with the institution-stamping invariant preserved.

n8n archive: ``cshse-document-matcher.json`` and
``cshse-self-study-standard-validation.json`` moved to
``n8n-workflows/archived-superseded-by-cshse-ai/`` with a README
explaining the cshse-ai replacements. The JSON exports stay in-tree
for reference; they're not deployed in production. The other n8n
workflows (help chat, document upload, spec loader) are unrelated
and stay live.

## Phase 2 shipped 2026-05-24 — real extract/recommend/score implementations

The three endpoint stubs from Phase 1 upgraded to real handlers:
- `ai-service/app/evidence/extract.py` — paragraph-aware chunking
  (~800 chars, 80-char overlap; sliding-window fallback for oversized
  paragraphs), text-embedding-3-small embeddings, Qdrant upsert into
  `cshse_evidence_{env}` with institutionId + submissionId + documentId
  stamped on every payload.
- `ai-service/app/evidence/recommend.py` — embeds spec text from
  standards.loader, searches the evidence collection with a payload
  filter pinning both institutionId AND submissionId (regression guard
  against the [[../cross-institution-isolation-audit-2026-05-24]] Gap 2
  invariant).
- `ai-service/app/evidence/score.py` — Claude Haiku adjudicator with
  strict-then-loose JSON parser, 8000-char prompt cap, 600 max tokens
  out, confidence clamped to [0,1], optional matrixRows block (CR-024
  Sprint 4).
- `ai-service/app/config.py` — new `evidence_collection` property
  (`cshse_evidence_{env}`).
- `ai-service/app/main.py` — three endpoints upgraded from 501 stubs to
  real handlers. `/extract` returns 501 only when `markdown` is missing
  (PDF binary input ships in Phase 2b alongside the marker-pdf
  container binary).

12 new unit tests in `tests/test_evidence_phase2.py` covering:
chunking edge cases, institution stamping on every chunk, payload
filter pinning, JSON parser robustness.

Phase 2b remaining: marker-pdf binary in the container + the PDF →
markdown extraction wrapper that calls into extract_evidence_text.
n8n removal is a separate slice (no production traffic to remove yet —
the new endpoints don't have a Reader-side caller in production today).



## Phase 1 shipped 2026-05-24 — contract + auth-wired stubs

Phase 1 establishes the three-endpoint contract on cshse-ai + the typed client on the Node side. The endpoints accept the HMAC-signed request, validate the body via Pydantic, and return HTTP 501 with a structured `{ phase: "phase-1-stub", ready: false, detail }` body. Callers check the `ready` flag (NOT the HTTP status) so Phase 2 deploy is a feature-flag-style flip, not a coordinated server+client release.

What landed:
- `ai-service/app/evidence/__init__.py` — module skeleton + `EVIDENCE_PHASE_NOT_IMPLEMENTED_BODY` shared response shape.
- `ai-service/app/main.py` — three `@app.post` handlers for `/ai/evidence/extract`, `/ai/evidence/recommend`, `/ai/evidence/score`. Each gates on HMAC + parses a `BaseModel` request body (so request-shape regressions surface immediately) before returning the 501-with-body stub. Confirmed via `app.main` import: 3 evidence routes registered.
- `server/src/services/cshseAiClient.ts` — NEW. Typed `extractEvidence` / `recommendEvidence` / `scoreEvidence` methods. Shared `postSigned` helper that reuses the same HMAC format (`t=<unix>,v1=<hex>`) the existing `aiImportController.postToAIService` uses. `_unwrapStubResponse` short-circuits 501-with-`ready:false` into `{ ready: false, phase, detail }` so callers don't throw. `isEvidencePhase2Ready()` predicate for feature-detection.

What remains for Phase 2:
- `ai-service/app/evidence/extract.py` — Marker-pdf → markdown → text-embedding-3-small embeddings → upsert into `cshse_evidence_{env}` Qdrant collection.
- `ai-service/app/evidence/recommend.py` — RAG retrieval with per-institution payload filter.
- `ai-service/app/evidence/score.py` — Claude Haiku adjudication; accepts the optional `matrixRows` parameter per CR-024 Sprint 4.
- `cshse_evidence_{env}` Qdrant collection bootstrap.
- Server callers: replace the n8n calls with `cshseAiClient` methods.
- Archive old n8n nodes; verify no production traffic.

CR stays `in-progress` until Phase 2 ships.



## Summary

The original sprint plan ([[sprint-plan-2026-05-11]] Sprint 3, renumbered to Sprint 4 in [[sprint-plan-2026-05-16]]) put evidence-review AI on n8n. Since then the team built `cshse-ai` (Python FastAPI + Qdrant + Claude Haiku) for the AI Import Wizard. n8n is no longer the right place for AI work: it doesn't have direct vector-store access, lacks per-institution RAG, and complicates the security audit ([[cr-017-cross-institution-isolation-audit]]).

This CR supersedes stories **S4.1, S4.2, S4.3, S4.5** in the existing plan.

## Source quotes

This is an engineering-driven CR, not webinar-derived, but it's flagged in [[webinar-action-items-2026-05-20]] under "Existing CRs that need revision."

## Decision

Migrate evidence-review pipeline endpoints from n8n to `cshse-ai`:

- `POST /ai/evidence/extract` — Marker-pdf → markdown → text-embedding-3-small embeddings stored in `cshse_evidence_{env}` Qdrant collection
- `POST /ai/evidence/recommend` — Given a spec, retrieve top-k matching evidence chunks (RAG)
- `POST /ai/evidence/score` — Claude Haiku adjudicates whether the evidence supports the spec; returns confidence + rationale

Reuses cshse-ai's:
- HMAC service-to-service auth ([[ai-service-overview]])
- Per-env collection naming
- Per-institution payload filter

n8n stays for non-AI workflows (e.g., scheduled emails, S3.7 email host).

## Acceptance

- [ ] Three new endpoints on cshse-ai with unit + integration tests.
- [ ] `cshse_evidence_{env}` Qdrant collection bootstrapped.
- [ ] Node service calls cshse-ai for evidence review (not n8n).
- [ ] Old n8n nodes archived; no production traffic remains.
- [ ] Documentation: [[evidence-document-review-pipeline]] updated to reflect cshse-ai as the canonical path.

## Files affected

- `ai-service/app/evidence/` (new module)
- `ai-service/app/main.py` — new endpoints
- `server/src/services/cshseAiClient.ts` — new methods
- [[evidence-document-review-pipeline]] — update

## Dependencies

- cshse-ai infrastructure (shipped Sprint 1)

## Open questions

- Do we need a backwards-compat n8n shim for any in-flight workflow? Lean no — the webinar made clear this work hasn't started yet.
