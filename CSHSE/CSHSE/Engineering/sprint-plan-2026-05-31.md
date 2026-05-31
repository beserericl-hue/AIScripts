---
name: Sprint Plan 2026-05-31 — Portal completion plan
description: Verified status of every change request as of 2026-05-31, the full inventory of deferred tasks, and a phased Sprint 10–14 plan to finish the CSHSE Accreditation Self-Study Portal. Supersedes sprint-plan-2026-05-29.
type: plan
plan_date: 2026-05-31
status: proposed
tags: [sprint-plan, completion, change-requests, verification, roadmap]
last_reviewed: 2026-05-31
---

# Sprint Plan 2026-05-31 — Portal completion plan

> **Supersedes** [[sprint-plan-2026-05-29]]. That plan drove Sprints 4–9 (lead-reader workflow, site visit, board, audit UI, JV grouping, notification pass) to completion. This plan is the **finish line**: a code-verified inventory of everything left and a phased Sprint 10–14 schedule to ship it.

## How this plan was built

On 2026-05-31 every CR whose catalog status looked stale was **re-verified against the actual code** (three parallel read-only investigations across `server/src`, `client/src`, `ai-service/app`). The findings below carry `path:line` evidence and correct several drifted statuses. The headline: the early P0/P1 reader-workflow CRs are mostly shipped, but four carry **real, code-confirmed gaps** that were papered over by a "shipped" label, and the verification surfaced **two latent bugs** (one security) in the submit/lock/read core.

---

## 1. Verified CR status matrix (2026-05-31)

| CR | Catalog said | File said | **Verified reality** | Gap? |
|---|---|---|---|---|
| CR-003 0-3 rubric | in-progress | shipped | **PARTIAL** — capture is 0-3 end-to-end; reader **report still renders pass/fail** | ✅ gap |
| CR-004 identity redaction | proposed | shipped | **SHIPPED** — `commentSerializer` is the single redaction point | — |
| CR-005 PC lockout | in-progress | shipped | **PARTIAL** — evidence routes unlocked + client inputs not disabled | ✅ gap |
| CR-006 two-stage submit | in-progress | shipped | **SHIPPED** — per-standard submit/revert + final submit both exist | — |
| CR-007 reader access gate | in-progress | shipped | **PARTIAL** — permissive (not assigned-only) + `?status` leak bug | ✅ gap |
| CR-008 pre-submit validation | proposed | in-progress | **PARTIAL** — preflight popup shipped; override-with-reason missing | ✅ gap |
| CR-023 Julia relay workflow | proposed | shipped | **PARTIAL** — endpoints + RelayConsole built but **RelayConsole never mounted** | ✅ gap |
| CR-025 matrix column inference | proposed | superseded | **NOT-STARTED / superseded** by CR-029 (dropdowns removed by design) | decide |
| CR-026 matrix verify-in-context | proposed | superseded | **PARTIAL** — verify + remove shipped via CR-029; per-row **move missing** | ✅ gap |
| CR-049 AI section eval | proposed | shipped | **SHIPPED** — `/ai/section/evaluate` + submit auto-seed + broken call fixed | — |
| CR-050 N/A specs don't block | proposed | shipped | **SHIPPED** — pass-OR-excluded gate, server + client | — |

**Catalog reconciled:** CR-004 / CR-006 / CR-049 / CR-050 promoted to `shipped`; CR-008 → `in-progress`; CR-025 / CR-026 → `superseded`; partial-gap notes added to CR-003 / CR-005 / CR-007 / CR-023.

### Latent bugs surfaced during verification (fold into the relevant sprint)
- **BUG-A (security, P1):** `listSubmissions` lets a reader pass `?status=draft` which **substitutes** for the reader allow-list filter (`server/src/controllers/submissionController.ts:1444-1446`), so a reader can enumerate draft submissions' existence/metadata. The single-record `getSubmission` gate still blocks opening them. Fix: **intersect** the explicit status param with the reader allow-list, never replace it.
- **BUG-B (data integrity, P1):** Evidence mutation routes (`server/src/routes/evidence.ts:112-166`) have **no `submissionLockout`** and `evidenceController` has zero lock checks — a PC whose study is finally submitted/locked can still add/edit/delete/link supporting evidence. Fix: mount `submissionLockout` on the evidence mutation routes (this is part of CR-005).

---

## 2. Complete inventory of remaining work

### Track A — Verified-PARTIAL CRs (close the gap to finish the CR)

| ID | What remains | Evidence anchor |
|---|---|---|
| **CR-003** | Render the **0-3 rubric** (Non/Partial/Largely/Fully) in the reader report instead of the legacy Y/N/N-A compliance ternary. The reader PDF reads `Review.assessments[].compliance`, never the `Score` collection. | `server/src/services/pdfGenerator.ts:163-167,218-262,738-745`; rubric source `server/src/models/Score.ts:10,35-44` |
| **CR-005** | (1) Mount `submissionLockout` on evidence mutation routes (BUG-B). (2) Make client `isReadOnly`/new `isEditingDisabled` incorporate `isSubmissionLocked` so editor inputs are actually disabled for a locked PC, not just bannered. | `server/src/routes/evidence.ts:112-166`; `client/.../SelfStudyEditor.tsx:485,2150-2154,2713,2742,2757,2769,2831,2857` |
| **CR-007** | (1) Fix `?status` enumeration leak (BUG-A). (2) Product call: flip permissive reader read → **assigned-only** (restrict `getSubmission`/`listSubmissions` to `assignedReaders`/`leadReader`). | `server/src/controllers/submissionController.ts:84-94,1433-1446` |
| **CR-008** | Override-with-reason branch ("Sprint 2B"): a "submit anyway" control gated behind a required reason in `FinalSubmitModal`, a server bypass that accepts override+reason instead of hard-blocking on `missingValidations`, and a dedicated audit-log branch. | `client/.../FinalSubmitModal.tsx:239`; `server/.../submissionController.ts:1600-1654` |
| **CR-023** | (1) **Mount `RelayConsole`** into an admin/lead-reader route — it is fully built and wired to relay/un-relay/escalate/queue endpoints but **never imported anywhere** (dead UI). (2) Decide whether suggestions need a per-suggestion relay step distinct from comment relay (today suggestions are only bulk-included/excluded by DOCX `mode`). | `client/src/features/admin/RelayConsole/RelayConsole.tsx` (orphaned); endpoints `server/src/controllers/commentController.ts:480-606`, `routes/comments.ts:111-133` |
| **CR-026** | Per-row **move/reassign-to-another-spec** correction control in the Matrix step (verify-in-context + remove already shipped via CR-029; only subspec re-tag exists today). | `client/.../AIImport/steps/MatrixStep.tsx:230,272-289` |
| **CR-025** | **Decision needed:** column→course inference + dropdown was deliberately removed by the CR-029 one-row redesign. Either formally close as WON'T-DO or re-open as a distinct post-beta enhancement. | `client/.../AIImport/steps/MatrixStep.tsx:4-8,570-583` |

### Track B — Deferred follow-ons of shipped CRs

| Parent | Deferred task | Size |
|---|---|---|
| CR-053 | Reaccreditation **auto-spin-up** — when `expiresAt` nears, create a `type:'reaccreditation'` submission + notify PC | medium |
| CR-053 | External **scheduler/cron** to fire `POST /api/board/run-cycle-reminders` on a cadence + a **Board-Console "Run reminders" button** | small |
| CR-010 | Widen notification **producers** (comment-relayed, board decision-recorded, reader-assignment → call `notify`) | small each |
| CR-010 | **Mount the Messages view** (`features/reader/Messages/`) — standalone today; pick a parent (reader review tab / CompilationTab side panel) | small |
| CR-052 | More first-time **hint wirings** beyond first-Final / first-verify (the `useOnceHint` ledger is the reusable primitive) | small each |
| CR-011 | CSHSE-**branded DOCX** header/footer + logo (covers all three docx exports) | small |
| CR-009 | Final-score **visibility to readers** (one-liner on the read gate; "transparency" default per the CR) | trivial |
| CR-022 | Lead-reader **"Request change from admin"** UI affordance (server contract already live) | small |
| CR-016 | Auto-**screenshot** via html2canvas in the bug reporter (~800 KB bundle hit) | small |
| CR-019 | Dashboard **JV section grouping** (admin / lead-reader section headers) | medium |
| CR-019 | JV **reporting filter** dropdown + `?jointVentureId` on existing report endpoints | small |
| CR-019 | **PC dashboard JV badge** mount (component exists, drop on the row) | trivial |
| — | **Layout nav links** for `/admin/board`, `/admin/audit-trail`, `/admin/joint-ventures`, `/site-visit/:id/checklist`, `/site-visit/:id/itinerary` (direct-URL-only today) | small |

### Track C — Cleanup / infra
- **n8n validation dead-code removal** — `validationService.triggerValidation` (~`server/src/services/validationService.ts:218+`) + `/api/webhooks/n8n/callback`. No longer on the submit path since CR-049; ~600 LOC.
- **n8n evidence-node archival** — external workflow definitions on the n8n instance (ops task, not server code).

### Track D — Tests / QA
- **CR-043/044 regression test plan** ([[test-plan-cr043-cr044-regression-2026-05-25]]) — P0, ready-to-execute, **not yet run** (~30 unit + ~30 integration + ~10 E2E + ~5 @slow Stevenson real-file).
- **Triage** [[critical-error-processing-review-2026-05-22]] — 14 ranked findings, not triaged.
- **Promote or retire** the two draft E2E docs ([[ai-import-wizard-e2e-regression-plan-2026-05-22]], [[ai-import-wizard-e2e-coverage-review-2026-05-22]]).
- **Deeper UI-driven E2E** — full reader → lead → board walkthrough (today only S7.4 API smoke).
- **Full server-suite green run** — not re-run since Sprint 9 (only the 3 touched suites). Expect ~456/456.

---

## 3. Phased completion schedule (Sprint 10 → 14)

Ordered by risk to a real reader cycle: integrity/security first, then report fidelity, then completion of board/notification, then polish, then cleanup/QA.

### Sprint 10 — Submission-integrity hardening (P0/P1) 🔒
Close the core submit/lock/read gaps + the two latent bugs. **This is the gate before any live institution submits.**
- **CR-005 finish** — `submissionLockout` on evidence routes (BUG-B); client inputs disabled when locked.
- **CR-007 finish** — fix `?status` reader-enumeration leak (BUG-A); flip permissive → assigned-only (confirm product intent first).
- **CR-008 finish** — override-with-reason control + server bypass + audit branch.
- **Acceptance:** locked PC cannot mutate evidence (403); locked editor inputs are visibly disabled; reader cannot enumerate drafts via `?status`; reader reads scoped to assignment; PC can override a soft-failing preflight with a logged reason. New integration tests pin each.

### Sprint 11 — Reader-report fidelity + relay workflow (P0/P1) 📄
Make the reader-facing outputs and the Julia relay loop real.
- **CR-003 finish** — 0-3 rubric in the reader PDF (+ suggestions DOCX), replacing pass/fail.
- **CR-023 finish** — mount `RelayConsole`; resolve the suggestion-relay question.
- **CR-009 follow-on** — final-score visibility to readers (read-gate one-liner).
- **CR-011 follow-on** — CSHSE-branded DOCX header/footer/logo across all three exports.
- **Acceptance:** reader report shows Non/Partial/Largely/Fully sourced from `Score`; Julia can reach the relay queue and relay/escalate from the UI; readers see final scores; exported docs carry CSHSE branding. Unzip-and-grep tests assert rubric + branding in the DOCX/PDF.

### Sprint 12 — Board + notification completion (P1) 🔔
- **CR-053 follow-on** — reaccreditation auto-spin-up + external scheduler/Board-Console trigger for `run-cycle-reminders`.
- **CR-010 follow-on** — widen notification producers (relay, decision, assignment); mount the Messages view.
- **CR-052 follow-on** — additional first-time hints on the high-traffic surfaces.
- **Acceptance:** an expiring accreditation auto-creates a reaccreditation submission + notifies the PC; reminders fire on a schedule; the listed producers emit notifications; Messages is reachable in the reader workspace.

### Sprint 13 — Admin / JV surfaces + UX polish (P2) ✨
- **CR-019 follow-ons** — dashboard JV section grouping; reporting filter + `?jointVentureId`; PC dashboard badge mount.
- **CR-022 follow-on** — lead-reader "Request change from admin" affordance.
- **CR-016 follow-on** — html2canvas auto-screenshot (behind a flag to manage bundle size).
- **CR-026 finish** — per-row move/reassign in the Matrix step.
- **CR-025 decision** — close WON'T-DO or schedule as enhancement.
- **Layout nav links** for all direct-URL admin/site-visit routes.

### Sprint 14 — Cleanup + test hardening 🧹
- **n8n dead-code removal** (validation webhook + `triggerValidation`); archive external n8n evidence nodes.
- **Execute the CR-043/044 regression plan**; triage the 14 critical-error-review findings; promote/retire the two draft E2E plans; build the deeper reader→lead→board UI E2E.
- **Full server + client + ai-service suite green run** on `developer`; then a coordinated push.

---

## 4. Definition of "portal complete"

The portal is feature-complete for the CSHSE accreditation lifecycle when:
1. **Sprints 10–11 land** — submission integrity is airtight (no leaks, real lockout, logged overrides) and the reader-facing report + relay workflow are correct and branded. *(This is the true beta-ready bar.)*
2. **Sprint 12 lands** — the board/cycle loop closes automatically (reminders + reaccreditation) and notifications cover every cross-actor event.
3. **Sprints 13–14** are polish + hygiene — desirable for GA, not blocking a supervised reader cycle.

After Sprint 11 there are **no open P0/P1 correctness gaps**; everything remaining is P2 polish, follow-on enhancements, cleanup, and test depth.

---

## 5. Notes for the next session
- The verification evidence (file:line) above is current as of `8976fe7` on `developer`. Re-grep before editing — the codebase moves.
- Treat **BUG-A** and **BUG-B** as the highest-priority items in this whole plan; they're live security/integrity holes, not features.
- Per vault rules this is a `plan` page — supersede with a new dated plan rather than rewriting it as reality drifts.
