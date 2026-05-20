---
name: CR-018 — Move AI evidence review off n8n into cshse-ai
description: Sprint 4 evidence-review stories (S4.1/S4.2/S4.3/S4.5) targeted n8n; the cshse-ai Python service is now the canonical AI surface. Re-target evidence review there.
type: change-request
cr_id: CR-018
status: proposed
priority: P1
source: [[sprint-plan-2026-05-11#sprint-3]], [[sprint-plan-2026-05-16]] (S4.x)
supersedes: S4.1, S4.2, S4.3, S4.5
sprint_target: Sprint 4 or 5
tags: [ai-service, evidence-review, n8n, deprecation]
last_reviewed: 2026-05-20
---

# CR-018 — Move AI evidence review off n8n into cshse-ai

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
