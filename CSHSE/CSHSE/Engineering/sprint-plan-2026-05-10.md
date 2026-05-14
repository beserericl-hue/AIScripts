---
name: Sprint Plan — 2026-05-10
description: Eight-sprint roadmap (~16 weeks) covering audit fixes, the missing evidence-document review pipeline, full automated + E2E test coverage, and operational polish.
type: plan
tags: [sprint-plan, roadmap]
plan_date: 2026-05-10
horizon: ~16 weeks (8 × 2-week sprints)
status: proposed
last_reviewed: 2026-05-10
---

# Sprint Plan — 2026-05-10

> **Status:** proposed. Not yet committed by the team. Supersede with a newer dated plan when the actual sprint cadence and team capacity are confirmed.

## Goals (in order)

1. **Stop the bleeding** — close the 6 critical security findings from [[security-audit-2026-05-10]] before any new feature ships.
2. **Deliver the missing evidence-document review pipeline** ([[evidence-document-review-pipeline]]). The portal can't actually do its job without this; today the AI only reads narratives, not the supporting evidence files the Handbook requires.
3. **Achieve real test coverage** — server unit + integration, client component, E2E end-to-end. The audit found zero tests; the foundation is now in place ([TESTING.md](../../../../TESTING.md)) but coverage is one example per layer.
4. **Make the system operable** — runbooks, deployment docs, missing email notifications, accessibility, and the documented-but-not-implemented n8n retry logic.

## Working assumptions

- 1 full-time engineer (or equivalent). Numbers below are days for one engineer; halve them for two working in parallel where independent.
- 2-week sprints, ~7 working days each after meetings/overhead.
- "Done" = code merged + tests passing + docs updated.
- Sprint goals are **load-bearing** — slipping a sprint goal triggers a re-plan, not a quiet drift.

## Sprint roster

| # | Sprint | Theme | Primary outcome |
|---|--------|-------|-----------------|
| 1 | S1 | Critical security | All 6 critical audit findings closed; webhook callbacks signed. |
| 2 | S2 | High-priority security + foundations | Rate limit, password reset, JWT short-TTL+refresh, RBAC tests. |
| 3 | S3 | Evidence document review (server + n8n) | New `evidence-document-review` workflow + server endpoints + cache. |
| 4 | S4 | Evidence review UI + email notifications | Per-file review pills surfaced in editor + reviewer; emails wired. |
| 5 | S5 | Test coverage expansion (server + client) | GridFS, evidence flows, autosave, RBAC matrix all under test. |
| 6 | S6 | Test coverage expansion (E2E) | Seeded DB; full coordinator/reviewer/lead-reader journeys. |
| 7 | S7 | Common-error checks + checklist | Matrix↔narrative congruence, missing-doc detection, pre-submit gate. |
| 8 | S8 | Polish | Ops runbook, docs, accessibility pass, ErrorLog rotation. |

---

## Sprint 1 — Critical security fixes (2 weeks)

**Goal:** every "Critical" finding from [[security-audit-2026-05-10]] closed; nothing new ships in front of these.

| Story | Audit ref | Acceptance | Days |
|-------|-----------|------------|------|
| Rotate the leaked spec-loader API key, add `gitleaks` to git pre-commit, document rotation procedure | C1 | New key in n8n credentials; old key revoked; pre-commit blocks pushes containing common secret patterns | 1 |
| Refuse to boot in production without `JWT_SECRET ≥ 32 bytes`; centralize all reads into one config module | C3 | `npm start` exits non-zero on missing/short secret in `NODE_ENV=production`; `'development-secret-key'` literal removed from code | 1 |
| HMAC-sign the four webhook callbacks; reject duplicate `executionId` | C2 | All 4 callback endpoints reject unsigned/forged requests with 401; replay returns 409; integration tests in `webhook-callback-security.test.ts` inverted to assert the new behavior | 3 |
| Lock CORS to `process.env.ALLOWED_ORIGINS` (comma-separated allow-list); add `helmet()` defaults | C4 | Cross-origin request from a non-allowed origin is blocked in browser; `Strict-Transport-Security` header present | 1 |
| Bind help-chat sessions to authenticated user IDs (server-side `sha256(userId + clientSessionId)`); set Redis TTL | C5 | Two different users with identical client sessionId get separate chat history; integration test added | 1 |
| Fix `isS3Configured()` export so evidence flows actually land in S3 | (incomplete #3) | New evidence upload appears in S3 (verified with AWS CLI), not as base64 in Mongo; integration test stubs S3 client and asserts the path taken | 1 |

**Sprint 1 tests required:** webhook-signature integration test, JWT-boot guard unit test, S3-vs-base64 path test, rate-limit boot test (M1 prep).

**Risks:** rotating the API key breaks any external system using it; coordinate with whoever runs the n8n instance.

---

## Sprint 2 — High-priority security + RBAC test foundations (2 weeks)

**Goal:** harden auth surface; lay test infrastructure for role-based access control.

| Story | Audit ref | Acceptance | Days |
|-------|-----------|------------|------|
| `express-rate-limit` on `/api/auth/login`; lock account after N failed attempts | H1 | 5 wrong attempts/IP/15min returns 429; 10 wrong on a single account sets `isActive=false` | 1 |
| Forgot-password / reset-password flow with signed token (≤1h, single-use) | H7 | Existing user can recover via email link; tokens invalidated after one use; rate-limited | 2 |
| JWT 1-hour TTL + refresh-token rotation; logout writes `jti` to a Mongo TTL revocation collection | H2 | `/api/auth/me` 401s after 1h; `/refresh` issues new token; logout makes the old token reject | 2 |
| Server-side HTML sanitization (sanitize-html) on imported documents *before* GridFS storage | H3 | Word doc with `<script>alert(1)</script>` lands in GridFS without the script; client renders safely | 1 |
| Migrate JWT storage from localStorage to httpOnly cookie (server sets cookie; client interceptor stops attaching `Authorization`) | H5 | Token not visible in `document.cookie`; XSS demo no longer exfiltrates token | 2 |
| Audit-log every superuser impersonation switch | L3 | New `ImpersonationAudit` collection; admin UI shows last 100 entries | 1 |

**Sprint 2 tests required:** rate-limit integration, token-revocation integration, sanitize-html unit (give the malicious payload, assert tags stripped).

**Risks:** httpOnly cookie migration touches every authenticated client request — high blast radius. Feature-flag during rollout.

---

## Sprint 3 — Evidence document review pipeline, server + n8n (2 weeks)

**Goal:** stand up the new [[evidence-document-review-pipeline|evidence-document-review]] workflow end-to-end. Surface stays minimal in this sprint; UI lands in S4.

| Story | Acceptance | Days |
|-------|------------|------|
| New n8n workflow `cshse-evidence-document-review.json` per the design doc — webhook in, per-file `file_result` callbacks streaming out | Workflow imports and runs against a fixture submission; per-file judgments returned | 3 |
| Server: `POST /api/submissions/:id/standards/:code/specs/:spec/review-evidence` triggers it; generates ≤5-min presigned S3 URLs (M4) | Endpoint exists, RBAC gated, returns 202 with `jobId` | 1 |
| Server: `POST /api/webhooks/evidence-review/callback` (HMAC-signed per S1 pattern); writes `EvidenceReviewResult` records | Callback persists results; integration test covers happy path + duplicate dedup | 2 |
| Cache: dedup by `(evidenceId, evidenceVersionId, standardCode, specCode)` so revalidation only touches changed files | Re-running the same validation hits cache for unchanged files (assert via DB count) | 1 |
| Implement actual retry/backoff on outbound n8n calls (the README has been claiming this for months — see [[n8n-integration]] drift table) | `validationService.callWebhook` retries 3× with exp backoff on 5xx / network errors; metric/log per attempt | 2 |
| OCR fallback path for image-only PDFs using existing Tesseract.js dep | Image-only PDF returns text extracted via OCR; confidence stored on result | 1 |

**Sprint 3 tests required:** evidence-review trigger + callback integration tests, cache-hit unit test, retry/backoff unit test (with fake timers).

**Risks:** OpenAI cost + privacy. Add an institution-level opt-out; surface "evidence sent to OpenAI" in admin UI before any production traffic.

---

## Sprint 4 — Evidence review UI + email notifications (2 weeks)

**Goal:** make the new pipeline visible in the UI; finish the long-stubbed email notifications.

| Story | Acceptance | Days |
|-------|------------|------|
| EvidenceManager: per-file row shows ✓ supports / ◐ partial / ✗ not relevant / pending pill, with click-through panel | Pill renders from `EvidenceReviewResult`; panel shows quoted passage + rationale + confidence | 2 |
| NarrativeEditor validation modal grows an "Evidence" tab listing per-file findings + gap analysis | Tab appears alongside narrative feedback; rendered from existing modal pattern | 1 |
| Reviewer workspace: same evidence pills visible to readers/lead readers | Reader can see what AI thought of each file before forming their own opinion; pills are read-only | 1 |
| Wire `nodemailer` send for the four stubbed notification sites (siteVisit, changeRequest, institution, readerLock) | Each previously-stubbed email actually sends; templates live in `server/src/templates/email/`; failures log to ErrorLog | 3 |
| Email template tests + delivery test using nodemailer JSON transport | Snapshot of generated email body for each template | 1 |
| Admin "test email" UI that fires a known template to a chosen address | Button on admin settings; success toast + ErrorLog entry on failure | 1 |

**Sprint 4 tests required:** EvidenceManager component test (RTL), reviewer-pill component test, email-template snapshot tests.

**Risks:** SMTP config is operator-side. Ship Mailtrap / JSON-transport defaults so dev works without credentials.

---

## Sprint 5 — Server + client test coverage expansion (2 weeks)

**Goal:** convert the test foundation into real coverage of the highest-risk areas.

### Server (vitest + supertest + mongodb-memory-server)

| Story | Days |
|-------|------|
| `gridFsService` marker round-trip: `insertHtmlMarker` followed by `restoreMarker` returns the original HTML byte-for-byte; covers table-fragment splits | 1.5 |
| `s3Service` integration with `mock-aws-s3` / `s3rver` — upload, download, delete, presigned URL TTL | 1 |
| `evidenceController` permission matrix — coordinator/reader/lead-reader/admin × own-vs-other-institution × CRUD (table-driven) | 1.5 |
| Outbound webhook retry/backoff (from S3) — table-driven tests across success / 5xx / network error / timeout | 1 |
| `validationService` end-to-end with mocked n8n callback timing | 1 |

### Client (vitest + RTL + MSW)

| Story | Days |
|-------|------|
| `NarrativeEditor` autosave debounce + don't-save-on-load (the bug that was fixed in `ae798a8`) | 1 |
| `DocumentViewer` table-aware row removal across the cases in the memory file (boundary touches, multi-row spans, orphaned cells) | 1 |
| `EvidenceManager` happy path + delete-error-toast (regression for [[frontend-architecture|silent-failure]]) | 1 |
| `WebhookSettings` form: API key never echoed back from server load; password input toggle | 0.5 |

**Sprint 5 deliverable:** test files exist for every Tier-1 surface; CI failure when any test breaks.

---

## Sprint 6 — E2E coverage with seeded data (2 weeks)

**Goal:** exercise full user journeys in a real browser against a real (seeded) backend.

| Story | Days |
|-------|------|
| Seed/teardown endpoint (`/api/test/seed`, only mounted when `NODE_ENV=test` or `E2E_SEED=1`) that creates known fixture users, an institution, a submission with a partial self-study, an assigned reader, a lead reader | 2 |
| Re-enable the `.skip`-ped Playwright login test; add programmatic-login helper | 0.5 |
| **Coordinator journey**: log in → create submission → import sample DOCX → tag 2 sections → finish tagging → edit narrative → upload evidence → trigger validation → see result | 2 |
| **Reviewer journey**: log in → open assigned review → mark Y/N/NA on 3 specs → add comments → submit | 1.5 |
| **Lead-reader journey**: log in → view multi-reader comparison → resolve a disagreement → set final determination | 1.5 |
| **Admin journey**: invite a coordinator → impersonate to verify → configure a webhook → test it | 1 |
| Visual regression budget — Playwright `toHaveScreenshot()` for 5 critical pages | 0.5 |

**Sprint 6 risk:** Playwright tests are inherently slow + flaky. Cap E2E suite total runtime at 5 minutes; anything slower gets factored into smaller specs.

---

## Sprint 7 — Common-error checks + Self-Study Completion Checklist (2 weeks)

**Goal:** mechanize the Handbook §IV "Common Errors" list so the portal catches them before a reader does.

| Story | Acceptance | Days |
|-------|------------|------|
| Matrix↔narrative congruence check (each course in matrix is referenced in at least one narrative; each narrative course exists on matrix) | Pre-submit warning lists discrepancies; can be overridden with rationale | 1.5 |
| Required-document-type detector — the Handbook lists ~14 document categories; flag missing categories | Warning if any category has zero linked evidence; categories are configurable | 1 |
| Hyperlink hygiene — every URL evidence is HEAD-checked at upload + nightly; flag 4xx/5xx, redirects to login pages | Linked URL with auth wall flagged; admin sees a link-health page | 2 |
| PDF-only check on uploaded evidence (Handbook is explicit) — non-PDFs get a warning, not a hard block | Warning surfaces at upload; coordinator can dismiss with a reason | 0.5 |
| Self-Study Completion Checklist as a pre-submit gate (configurable items based on the Handbook §IV checklist) | Submit button disabled until all required checklist items pass; bypass requires admin role | 2 |
| Cycle reminders — interim self-study reminder 6 months before due (Handbook §II); 10-year full reaccreditation reminder 12 months out | Email + dashboard banner | 1 |

---

## Sprint 8 — Polish (1–2 weeks, scope-flexible)

**Goal:** make the system operable + accessible.

| Story | Days |
|-------|------|
| `DEPLOY.md` runbook: Railway + MongoDB Atlas + S3 + SMTP + n8n | 1 |
| `N8N-SETUP.md`: how to import all six workflows + Supabase schema; credential mapping | 1 |
| `ADMIN-RUNBOOK.md`: invite users, configure webhooks, troubleshoot common deployment issues | 1 |
| Update `server/.env.example` with every env var read by the code today (per [[documentation-gaps-2026-05-10]]) | 0.5 |
| Accessibility pass: `aria-label` on every icon-only button (today there are 3 in the entire client); keyboard navigation through the editor toolbar | 2 |
| `ErrorLog` collection TTL (90d) + size cap; admin-side log viewer with pagination | 1 |
| ADRs documenting GridFS-vs-S3 split, no-job-queue decision, hybrid base64/S3 fallback | 1 |
| Restore-marker atomicity fix in `gridFsService` (current restore is non-atomic; can leave orphan files) | 2 |

---

## Cross-cutting tracks (not single-sprint)

These run alongside the sprints, not inside any one:

- **Test coverage ratchet** — never let coverage drop. Add a CI gate (when CI lands) that fails on coverage decrease.
- **Audit re-run** — re-run [[security-audit-2026-05-10|the security audit]] at the end of S2 and again at the end of S8. Save as `security-audit-YYYY-MM-DD.md` (don't edit the original). The newest review supersedes the previous.
- **Doc freshness** — every PR touching a Tier-1 surface must update its concept page (e.g., touching `gridFsService` updates [[storage-layer]]).

## Risks & dependencies

- **n8n operator availability.** Several sprints (S1, S3, S4) need someone with access to the production n8n instance. If that's the same engineer as the app dev, no problem; if not, schedule joint sessions.
- **OpenAI cost runaway** in S3/S4. Add per-institution daily token caps before the new pipeline can run on a real submission.
- **httpOnly cookie migration in S2** is the highest-blast-radius change in this plan. Feature-flag it; do a phased rollout.
- **Seed endpoint in S6** must be hard-gated. A `/api/test/seed` reachable in production is the next critical-audit finding waiting to happen.
- **Email deliverability** in S4 — Gmail / Outlook will spam-fold mail from a new sending domain. Plan SPF/DKIM/DMARC setup as part of the operator handoff.

## Success metrics (review at end of each sprint)

| Metric | Baseline (2026-05-10) | Sprint-end target |
|--------|-----------------------|-------------------|
| Critical audit findings | 6 | S1: 0 |
| High audit findings | 7 | S2: ≤2 |
| Server line coverage | (unknown — no tests existed before this week) | S5: ≥60% |
| Client line coverage | (same) | S5: ≥50% |
| E2E coverage of journeys | 0 | S6: 4 (coordinator, reviewer, lead-reader, admin) |
| Pre-submit checklist passes block submit | no | S7: yes |
| Stubbed `// TODO: send email` sites | 11 | S4: 0 |
| Documented n8n setup | partial | S8: complete (`N8N-SETUP.md` exists) |

## Out of scope for this plan

- Public-facing program directory / accreditation status website (CSHSE has this separately).
- Membership dues lifecycle integration with Update Management, Inc.
- Mobile-native app — current responsive UI is sufficient.
- Migration off Railway / MongoDB Atlas.

## Related

- [[product-requirements]] — what the portal must support
- [[evidence-document-review-pipeline]] — the missing functionality that drives S3 + S4
- [[security-audit-2026-05-10]] — drives S1 + S2
- [[incomplete-features-2026-05-10]] — drives S3 + S4 + S8
- [[documentation-gaps-2026-05-10]] — drives S8
