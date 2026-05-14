---
name: Documentation Gaps — 2026-05-10
description: What docs exist (and how fresh), and what's missing that materially blocks new contributors and operators.
type: review
tags: [docs, audit]
audit_date: 2026-05-10
auditor: claude
last_reviewed: 2026-05-10
---

# Documentation Gaps — 2026-05-10

## What exists

| Doc | Path | Freshness | Notes |
|-----|------|-----------|-------|
| Project README | [Readme.md](../../../../Readme.md) | Good | Covers recent S3, help chat, accessibility work. **Claims n8n retries that don't exist.** |
| API reference | [docs/api.md](../../../../docs/api.md) | Good | Comprehensive, includes Help Document endpoints. |
| Import deep-dive | [docs/IMPORT_PROCESS_REFERENCE.md](../../../../docs/IMPORT_PROCESS_REFERENCE.md) | Good | GridFS / placeholder system explained. |
| N8N integration guide | [docs/n8n-workflow-integration-guide.md](../../../../docs/n8n-workflow-integration-guide.md) | Fair | Outdated vs. current workflow JSONs. |
| Reader/Lead-Reader system | [Reader_LeadReader_Comment_System.md](../../../../Reader_LeadReader_Comment_System.md) | Unclear | Spec-style doc; verify against current model. |
| Role navigation | [RoleNavigation.md](../../../../RoleNavigation.md) | Unclear | Predates recent reviewer-role UI work. |
| Server `.env.example` | [server/.env.example](../../../../server/.env.example) (referenced) | **Poor** | **Missing all S3 vars.** |

## Critical doc-vs-code drift

1. **Readme advertises n8n retry/backoff that don't exist.** Either implement the retries or correct the doc. (See [[n8n-integration]] drift table.)
2. **Recent features absent from Readme:** profile auto-save (commit `ac5cadd`), settings cogwheel replacing Logout (`0515d2d`), admin-invite-Administrator (`ebfd196`), simplified change-password for impersonated users (`8a342fe`).
3. **`server/.env.example` is missing** `AWS_ENDPOINT_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION`, `AWS_S3_BUCKET_NAME`. New operators have to read [s3Service.ts:16-39](../../../../server/src/services/s3Service.ts) to know what to set.

## What's missing that materially matters

### Operations / runbooks
- **Deployment runbook** for Railway: required env vars, MongoDB Atlas setup, S3 provisioning, healthcheck behavior.
- **JWT secret rotation** procedure (especially given [[security-audit-2026-05-10|C3]] and [[security-audit-2026-05-10|C1]]).
- **GridFS housekeeping**: how to run `cleanupOrphanedFiles`, expected cadence, rollback strategy.
- **Database backup/restore**: how to dump + restore the GridFS buckets in particular.

### N8N setup guide
- How to import the five JSON workflows into a fresh n8n instance.
- How to wire credentials (OpenAI, Supabase, Redis, callback API key).
- Test procedures for each workflow's webhook URL.
- The Supabase pgvector schema is already in [n8n-workflows/supabase-help-documents.sql](../../../../n8n-workflows/supabase-help-documents.sql) but the procedure to apply it is undocumented.
- How to vectorize the help knowledge base (which docs to upload, in what order, expected counts).

### Admin runbook
- How to invite users at each role (incl. the new admin-invite-admin flow).
- How to configure each webhook in `WebhookSettings` and verify it works end-to-end.
- How to upload spec PDFs and what success looks like.
- How impersonation actually works for support cases.

### Email / SMTP
- Gmail App Password generation steps.
- Sendgrid / Mailgun alternatives.
- Note that email is **mostly stubbed** today (see [[incomplete-features-2026-05-10|#1]]).

### Engineering reference
- **ERD** of the data model — `Submission ↔ Standard ↔ Spec ↔ ValidationResult ↔ SupportingEvidence ↔ ReviewAssessment`.
- GridFS bucket structure (`htmlContent`, `images`) — referenced in code, never explained in docs.
- Architecture decision records (ADRs): why GridFS over S3 for HTML, why hybrid base64/S3 for evidence, why no job queue.
- Sequence diagrams for the [[import-pipeline]] (upload → tag → finish), validation flow, help chat.
- Threat model.

### Onboarding
- "First 15 minutes" / "what to read first" guide.
- Quick local-dev recipe that doesn't require S3, n8n, or Supabase to be configured (can the app run with all of these unset?).

### Known issues / troubleshooting
- Recent superuser impersonation workarounds.
- The `isS3Configured()` bug ([[incomplete-features-2026-05-10|#3]]).
- Auto-save load-on-save race that was fixed.
- File-download auth that was fixed.

## Suggested doc additions (priority order)

1. **DEPLOY.md** — the full Railway + MongoDB Atlas + S3 + n8n setup, with copy-pasteable env-var checklist.
2. **Update `server/.env.example`** with all S3 and n8n vars used in code today.
3. **N8N-SETUP.md** — how to deploy the five workflows and the Supabase schema.
4. **Fix Readme retry/backoff section** to match reality.
5. **ADMIN-RUNBOOK.md** — invite, configure, troubleshoot.
6. **ARCHITECTURE.md** — pull the ERD + sequence diagrams in.

## Related

- [[security-audit-2026-05-10]]
- [[incomplete-features-2026-05-10]]
- [[n8n-integration]] — drift table is the source of truth for the n8n side
- [[system-architecture]]
