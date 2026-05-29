---
name: Sprint Plan — 2026-05-29
description: Re-baselined roadmap after a code-vs-vault reconciliation on 2026-05-29. Supersedes the 2026-05-20 plan, which predated ~24 shipped CRs and was badly out of sync. The PC/authoring half (AI import wizard → review → dashboard → submit) is shipped and polished. The reader/review/board half is SERVER-scaffolded (models + controllers for reviews, 0-3 scores, compilations, audit log, assignments, site visits) but has NO client UI — so the remaining work is dominated by reader-side client + wiring + verification, plus six genuinely-greenfield features.
type: plan
tags: [sprint-plan, roadmap, reconciliation, post-import-wizard]
plan_date: 2026-05-29
horizon: ~12 weeks (Sprint R + 6 × 2-week sprints)
status: proposed
supersedes: sprint-plan-2026-05-20
last_reviewed: 2026-05-29
---

# Sprint Plan — 2026-05-29

**Supersedes [[sprint-plan-2026-05-20]].** That plan was written the day after the Beta webinar and assumed only Sprint 1 (the AI import wizard) was done. Since then ~24 CRs shipped (the entire importer-hardening + workflow-alignment track, CR-024 … CR-048), and a code-vs-vault reconciliation on 2026-05-29 revealed that much of the *reader-side* server stack was also already scaffolded but never tracked. This plan re-baselines on **verified reality**.

## TL;DR — the actual picture

The product has two halves:

1. **PC / authoring half** — `IMPORT → DRAFTS → SELF-STUDY → SUBMIT`. **Shipped and polished**, live on `cshse-develop`. The AI import wizard, TOC-anchored detection, the decoupled+persisted Review surface, the curriculum matrix, the workflow dashboard, the editor, and the finish-review bookkeeping all work end-to-end (CR-001, 015, 017, 024, 027–037, 039–048).

2. **Reader / review / board half** — **server-scaffolded, client-absent.** The server has models + controllers for reviews, 0-3 scores, lead-reader compilations, comments, change requests, site visits, assignments, and an append-only audit log. But the **client has no reader or lead-reader UI** — `client/src/App.tsx:78-81` routes only `dashboard`, `self-study`, and `admin/*`, and `client/src/features/` contains only `admin, changeRequests, comments, dashboard, selfStudy, siteVisits` (no `reader/`, no `leadReader/`). A reader literally cannot score a spec today.

So the remaining roadmap is **mostly reader-side client UI + wiring + verification of the existing server scaffolding**, plus six features that are genuinely not built at all.

## Reconciliation table — vault status vs. code reality (2026-05-29)

Evidence cited as `path:line`. "True state" is the honest status; several CRs marked `proposed` in the tracker already have working server code.

| CR | Vault says | Code reality (evidence) | True state |
|---|---|---|---|
| CR-003 0-3 rubric | proposed | `server/src/models/Score.ts:10,42` — `score: 0\|1\|2\|3` enum + validation. **No reader UI** (no `features/reader`). | **server built, client missing** |
| CR-004 comment redaction/relay | proposed | `models/Comment.ts` has **no** `relayed`/`redact`/`originalReaderId`/`pcLabel` fields. | **not started** |
| CR-005 PC lockout | proposed | `server/src/middleware/submissionLockout.ts` — full lockout middleware, mounted on write routes in `routes/submissions.ts`. Client read-only banner in `SelfStudyEditor.tsx`. | **functionally built — verify + close** |
| CR-006 two-stage submission | proposed | `submissionController.ts` — `submitStandard`, `revertStandard:644`, `markStandardComplete:852`, `submitSelfStudy:1015`; status machine `Submission.ts:272` (8 states). `client/.../FinalSubmitModal.tsx`. | **functionally built — verify + close** |
| CR-007 reader access after submit | proposed | `reviewController.ts:165` gates by review status; `leadReaderController.ts:68` filters submissions by `readers_assigned/under_review/review_complete`. **No reader client.** | **server built, client missing** |
| CR-008 pre-submission validation popup | proposed | No preflight endpoint; only `services/validationService.ts:134` (AI-path completeness). The submit popup is not built. | **not started** |
| CR-009 compilation tab | proposed | `models/LeadReaderCompilation.ts` + `controllers/leadReaderController.ts` (getMyCompilations, compiledAssessments, commentThreads). **No client tab.** | **server built, client missing** |
| CR-010 direct messaging | proposed | No `DirectMessage`/message model or controller. | **not started** |
| CR-011 suggestions consolidation doc | proposed | No `suggestionsDocx`; `reports.ts` exists but not this export. | **not started (verify reports.ts)** |
| CR-012 site-visit partial-compliance checklist | proposed | `models/SiteVisit.ts` + `siteVisitController.ts` + client `features/siteVisits`. Checklist auto-population from score=1 unconfirmed. | **partial — verify** |
| CR-013 site-visit itinerary builder | proposed | `SiteVisit.ts` has `scheduledDate`/`teamMembers`; co-edit itinerary unconfirmed. | **partial — verify** |
| CR-016 in-app bug reporter | proposed | `models/ErrorLog.ts` + `routes/errorLogs.ts` = system error logging, NOT the user-facing "Report issue" + screenshot capture. | **not started (infra adjacent)** |
| CR-018 evidence AI | in-progress | ai-service extract/recommend/score live + tested; **no production reader caller, `cshse_evidence_{env}` not bootstrapped, n8n not archived.** Blocked on the reader client. | **in-progress (correct)** |
| CR-020 lock/unlock audit-trail UI | proposed | `models/AuditLogEntry.ts` + `services/auditLog.ts:20` (`recordAuditEvent`). **No admin audit-trail UI** (`features/admin` has no AuditTrail). | **server built, UI missing** |
| CR-021 reader file attachments | proposed | `models/Comment.ts` has no attachment fields. | **not started** |
| CR-022 reader assignment lockout | proposed | `models/Assignment.ts` + `leadReaderController.ts` exist; admin-only-when-locked semantic unconfirmed. | **partial — verify** |
| CR-023 Julia relay console | proposed | No relay endpoints in `commentController.ts`/`leadReaderController.ts`; no client RelayConsole. | **not started** |

**Shipped (verified, 24):** CR-001, 015, 017, 024, 027, 028, 029, 031, 032, 033, 034, 035, 036, 037, 039, 040, 041, 042, 043, 044, 045, 046, 047, 048.
**Dead:** CR-002, 014, 025, 026 superseded · CR-019 rejected · CR-038 retired.

### What this changes vs. the 05-20 plan

- The 05-20 plan treated CR-003/005/006/007/009/012/013/020/022 as greenfield future sprints. **They are mostly already coded on the server.** The real work for them is **client UI + wiring + tests + a status-correction pass**, not building from scratch.
- The genuinely-greenfield remaining features are a short list: **CR-004, CR-008, CR-010, CR-011, CR-021, CR-023**, plus **finishing CR-018**.
- The single biggest gap is structural: **there is no reader/lead-reader client app.** Sprints 3–5 are dominated by building it on top of the existing server endpoints.

---

# Sprint R — Reconcile & verify (1 week, do first)

**Goal:** Make the tracker tell the truth and de-risk the assumption that the server scaffolding works. Without this, every estimate below is a guess.

**Stories:**

- **R.1 — Verify + close the lockout/submission stack (CR-005, CR-006).** Exercise `submissionLockout` + the status machine + `submitStandard`/`revertStandard`/`submitSelfStudy` + `FinalSubmitModal` end-to-end. Add integration + E2E coverage if thin. Confirm an audit-log entry fires on each transition. If clean → mark CR-005/006 **shipped**; if gaps → enumerate them as Sprint 2A stories.
- **R.2 — Smoke the reader-side server endpoints (CR-003, CR-007, CR-009, CR-020, CR-022).** Hit `reviewController`, `scores`, `leadReaderController`, `auditLog`, `Assignment` with seeded data; record which are functional vs. dead scaffolding. Produce a one-page "reader server API truth table."
- **R.3 — Correct the CR tracker.** Flip the reconciled CR statuses (proposed → in-progress / shipped per R.1–R.2 findings); update [[change-requests/index]]; supersede this reconciliation into each CR's revision_history.
- **R.4 — Verify CR-012/013/016 partials.** Confirm what `features/siteVisits` + `SiteVisit` actually deliver vs. the CR acceptance.

**Estimate:** 5 days. **Output:** an accurate tracker + a verified server API surface the next sprints build on.

---

# Sprint 2A — Submission lockout completion (2 weeks)

**Goal:** Finish the submission/lockout layer to its CR acceptance. (Core middleware + endpoints exist per Sprint R; this closes the gaps.)

- **S2A.1 — Audit trail on every transition (CR-006, CR-020 server).** Ensure `recordAuditEvent` is called on submit/revert/final-submit/unlock with `actor`, `action`, `timestamp`, optional note. (`auditLog.ts` exists; wire any missing call sites.)
- **S2A.2 — Pre-submission validation popup (CR-008, genuinely new).** New `GET /api/submissions/:id/preflight` returning `{ errors, warnings }` (empty specs, missing CSHSE-required specs, short narratives, low-confidence matches). `FinalSubmitModal` consumes it; override requires a reason logged to audit.
- **S2A.3 — Unlock path + admin-only enforcement (CR-005).** Confirm/`add` an admin `unlock` endpoint; verify PC write → 403 LOCKED, admin write → 200, print endpoint stays open.

**Estimate:** ~5 days.

---

# Sprint 3 — Reader review client (2 weeks, the big missing piece)

**Goal:** Build the reader-facing app on top of the existing server endpoints. This is greenfield CLIENT work; the server (Score 0-3, reviewController, access gating) already exists.

- **S3.1 — Reader route + dashboard.** New `features/reader/` + a `reader` route. Reader dashboard lists only submissions at `submitted+` (CR-007 client); "pending PC submission" group shows name only.
- **S3.2 — Reader review screen + 0-3 score selector (CR-003 client).** Per-spec 4-level selector (Non/Partial/Largely/Fully) with helper text, wired to the `Score` model + `scores`/`reviews` routes. Persist + reload prior score.
- **S3.3 — Reader access hardening + tests (CR-007).** Integration + E2E: reader on a `draft` submission → 403; on `submitted` → 200, no cross-institution leak.

**Estimate:** ~8 days.

---

# Sprint 4 — Evidence AI finish + comments redaction + relay (2 weeks)

- **S4.1 — Finish CR-018.** Wire the reader-side caller to `extractEvidence`/`recommendForSpec`/`scoreEvidenceAgainstSpec`; bootstrap `cshse_evidence_{env}` Qdrant collection with per-institution payload filter; archive the n8n evidence nodes; update [[cr-018-ai-evidence-review-via-cshse-ai]] → shipped.
- **S4.2 — Comment threading + identity redaction (CR-004, new).** Add `relayed`, `relayedText`, `pcLabel`, `originalReaderId`, `boardEscalated` to `Comment.ts`; role-aware serializer so PC role never sees reader identity. ACL tests.
- **S4.3 — Julia relay console (CR-023, new).** `relayController` (`relay`/`unrelay`/`escalate-to-board`) + `features/admin/RelayConsole/`. Edit relayed text without touching original; bulk relay; audit-logged.

**Estimate:** ~10 days.

---

# Sprint 5 — Lead-reader workflow (2 weeks)

- **S5.1 — Compilation tab client (CR-009 client).** Build `features/leadReader/CompilationTab/` over the existing `LeadReaderCompilation` server: all readers' scores side-by-side, disagreement/zero highlighting, editable final score (audit-logged).
- **S5.2 — Suggestions consolidation DOCX (CR-011, new).** `suggestionsDocx` + export endpoint with internal/PC-facing (anonymized) modes.
- **S5.3 — Reader file attachments on comments (CR-021, new).** `Comment.attachments[]` + composer paperclip + S3 `reader-attachments/` prefix; ACL follows relay state.
- **S5.4 — Portal direct messaging (CR-010, greenfield).** `DirectMessageThread`/`DirectMessage` models + controller + `features/reader/Messages/`; PC role has no access (tested).

**Estimate:** ~11 days (consider splitting DM into 5B).

---

# Sprint 6 — Site visit completion (2 weeks)

- **S6.1 — Partial-compliance checklist (CR-012).** Verify/complete auto-population of a site-visit checklist from Final score 0/1; visit-team verify toggle + notes; export.
- **S6.2 — Itinerary builder (CR-013).** Lead-reader + PC co-edit itinerary over the existing `SiteVisit` model; per-slot links to checklist items; DOCX export.
- **S6.3 — Reader assignment lockout (CR-022).** Admin-only assignment changes once `submitted+`; reason required; audit-logged.

**Estimate:** ~8 days.

---

# Sprint 7 — Board decisions + bug reporter + audit UI + E2E (2 weeks)

- **S7.1 — Board decisions + cycle scheduler** (carryover): Accept/Table/Deny/Suspend/Revoke + re-accreditation reminders.
- **S7.2 — In-app bug reporter (CR-016).** `features/components/BugReporter/` (screenshot via html2canvas + route + build SHA + console errors) + `BugReport` model. (Distinct from `ErrorLog`.)
- **S7.3 — Admin audit-trail UI (CR-020 client).** `features/admin/AuditTrail/` over the existing `AuditLogEntry` + `auditController` (filter, CSV export, append-only).
- **S7.4 — E2E coverage expansion** across the new reader/review/board flows.

**Estimate:** ~12 days.

---

# Sprint 8 — Joint Ventures (dormant)

CR-019 stays **rejected** — no beta institution surfaced a JV need. Revive only on demand.

---

## Critical path & sequencing

1. **Sprint R first, always.** Everything below assumes the server scaffolding works; verify it before estimating.
2. **Sprint 3 (reader client) unblocks the most.** CR-018 finish (S4.1), the compilation tab (S5.1), and board decisions (S7.1) all need a reader app to exist.
3. **The greenfield short-list** (CR-004, 008, 010, 011, 021, 023) is the only from-scratch work; everything else is client-over-existing-server or verification.

## Risk register (delta from 05-20)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Server "scaffolding" is dead code that doesn't actually work | Medium | High | Sprint R smoke-tests every reader endpoint before building UI on it |
| CR statuses stay wrong and mislead planning again | High (if Sprint R skipped) | Medium | R.3 corrects the tracker; this plan is the single source of truth until then |
| Reader client is larger than estimated (no existing UI patterns to copy) | Medium | Medium | Reuse the PC editor/dashboard component patterns; timebox S3.1 |
| CR-018 stays blocked indefinitely | Medium | Medium | It is explicitly sequenced after the reader client (S4.1), not before |

## Logical starting point — what to do first

The reconciliation already ran (this plan), and the CR tracker has been corrected: CR-003/005/006/007/009/012/013/020/022 flipped `proposed → in-progress`; the genuinely-greenfield CR-004/008/010/011/016/021/023 stay `proposed`; CR-018 stays `in-progress`. So **Sprint R is now down to verification, not status archaeology.** Start here:

### Step 1 — Prove the submission/lockout stack (½ day, no new code expected)
This is the most-built, least-risky piece and it's the gate for the reader half. Seed a submission and exercise the real endpoints:
- PC `submitStandard` → status flips, still editable; `revertStandard` → back to in_progress.
- PC `submitSelfStudy` (final) → `submissionLockout` returns **403 LOCKED** on a subsequent PC narrative PATCH; admin PATCH → 200; print/read stays open.
- Confirm an `AuditLogEntry` is written on each transition (`services/auditLog.ts:20`).
- **If green:** mark CR-005 + CR-006 **shipped**. **If gaps:** they become the Sprint 2A backlog (most likely gap: audit-on-transition + the CR-008 preflight popup, which is genuinely missing).

### Step 2 — Smoke the reader server endpoints (½ day)
Hit `reviewController`, `scores`, `leadReaderController`, `Assignment` with a seeded `submitted` submission. Record functional-vs-dead in a one-page truth table. This tells you whether Sprint 3 builds on solid endpoints or has to fix them first.

### Step 3 — Begin the reader client (Sprint 3) — the first real build
This is the highest-leverage build: it unblocks CR-018's finish (S4.1), the compilation tab (S5.1), and board decisions (S7.1), none of which can be exercised without a reader app.
- **First commit:** scaffold `client/src/features/reader/` + a `reader` route in `App.tsx`, gated to the reader/lead-reader roles, listing only `submitted+` submissions (CR-007 client).
- **Then:** the per-spec 0-3 score selector (CR-003 client) wired to the existing `Score` model — confirm/correct, not build-from-scratch, on the server side.

**One-line summary:** verify the lockout stack (½ day) → smoke the reader endpoints (½ day) → build the reader client, starting with the route + dashboard. The greenfield features (CR-004/008/010/011/021/023) slot into Sprints 2A/4/5 as called out above; **none of them is the right first move** — the reader client is.

## Provenance

- Reconciliation performed 2026-05-29 against `developer` @ `f9e6706` (post-CR-048).
- Verified-shipped set cross-checked against `change-requests/*.md` frontmatter + commit history.
- Code citations are live `path:line` references; the reader-client gap is confirmed from `client/src/App.tsx` routes + `client/src/features/` directory listing.
