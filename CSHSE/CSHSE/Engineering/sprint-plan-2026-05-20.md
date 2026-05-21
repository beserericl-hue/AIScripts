---
name: Sprint Plan — 2026-05-20
description: Eight-sprint roadmap rewritten after the 2026-05-20 Beta Group Training webinar. Sprint 1 (AI wizard) is done. Sprint 2 splits into 2A (lockout core) and 2B (isolation audit + UX). Every CR-NNN from Engineering/change-requests/ is placed in a sprint with full user stories.
type: plan
tags: [sprint-plan, roadmap, webinar, post-beta]
plan_date: 2026-05-20
horizon: ~16 weeks (8 × 2-week sprints, plus Sprint 2.5)
status: proposed
supersedes: sprint-plan-2026-05-16
last_reviewed: 2026-05-20
---

# Sprint Plan — 2026-05-20

**Supersedes [[sprint-plan-2026-05-16]].** Rewritten in response to the 2026-05-20 Beta Group Training webinar ([[webinar-action-items-2026-05-20]]). The webinar produced 23 change requests (CR-001..CR-023) catalogued at [[change-requests/index]].

Sprint 1 (AI-Assisted Import Wizard) is **complete and in production** as of commit `4c37e68` on `developer` / awaiting promote to `main`. The wizard ran successfully against Stevenson + Kennesaw State during the webinar demo.

## How to read this plan

Each story includes:
- **CR reference** — the change-request page the story implements
- **User story** — "As a [role], I want [behavior] so that [outcome]"
- **Acceptance criteria** — checkable bullets, derived from CR acceptance
- **Files affected** — best-guess; refine on first day
- **Test plan** — unit / integration / E2E layers
- **Estimate** — engineer-days

Stories within a sprint are ordered by dependency: earlier stories block later ones.

## Sprint roster — at a glance

| # | Theme | New CRs included | Carryover from prior plan |
|---|---|---|---|
| 1 | AI Import Wizard | — | SHIPPED |
| **2A** | **Lockout + submission core** | CR-001, CR-005, CR-006, CR-007 | S2.2-S2.10 critical security |
| **2B** | **Isolation audit + UX** | CR-008, CR-014, CR-015, CR-017, CR-024 (UI half) | S2.11 document versioning |
| **3** | **Auth + assignment lockout** | CR-020, CR-022 | S3.1-S3.x auth + multi-PC |
| **4** | **Evidence AI + rubric + relay** | CR-003, CR-004, CR-018, CR-023, CR-024 (eval half) | S4.4 email host, S3.9 reader deadline |
| **5** | **Reader workflow** | CR-009, CR-010, CR-011, CR-021 | S5.10 reader DOCX (revised) |
| **6** | **Site visit + completion checks** | CR-012, CR-013 | S6.x error checks, S7.3 (merged) |
| **7** | **Board decisions + bug reporter + E2E** | CR-016 | S7.1, S7.2 board flow |
| **8** | **Joint Ventures** | — | S8.x JV entity |

---

# SPRINT 2A — Lockout + submission core (2 weeks, **PRIORITY**)

**Goal:** Land the sequencing layer (PC submit → lockout → reader access) that the entire reader workflow depends on. Without this, none of Sprints 4-7 can run.

**Start date:** 2026-05-21 (tomorrow)

**Stories:** 5

---

## S2A.1 — Self-study status state machine

**Source:** [[cr-005-pc-lockout-on-final-submit]], [[cr-006-two-stage-submission]]

**User story:**
> As a program coordinator, when I click "Submit for review" on a single standard I want that standard marked as ready but still editable, AND when I click "Final submit" on the whole self-study I want the entire document locked to read-only — so that I can iterate during the build but commit to the final version when I'm done.

**Files affected:**
- `server/src/models/SelfStudy.ts` — add `status: 'draft' | 'submitted-for-review' | 'in-review' | 'board-decision' | 'returned-to-pc' | 'accepted'`
- `server/src/models/StandardSection.ts` (or embedded) — add `status: 'in-progress' | 'submitted-for-review'`
- `server/src/services/selfStudyState.ts` (new) — transition validation
- `server/src/controllers/selfStudyController.ts` — `submitSection`, `revertSection`, `finalSubmit`, `unlock` endpoints
- Migration: existing self-studies → `draft`

**Acceptance:**
- [ ] `SelfStudy.status` enum present with all six values
- [ ] State transitions validated server-side; illegal transitions return 400
- [ ] `submitSection` is reversible by PC
- [ ] `finalSubmit` requires every standard `submitted-for-review` OR explicit override with reason
- [ ] `unlock` is admin-only
- [ ] Audit-log entry on every transition

**Test plan:**
- Unit: state-machine transitions (all 36 pairs)
- Integration: endpoint auth + permission checks
- E2E: PC submits 2/3 sections → final submit blocked → submits 3rd → final submit succeeds

**Estimate:** 3 days

---

## S2A.2 — PC lockout enforcement middleware

**Source:** [[cr-005-pc-lockout-on-final-submit]]

**User story:**
> As a program coordinator, once I've clicked Final Submit, I want the system to refuse my edit attempts cleanly with a "submitted" banner — so I can't accidentally damage a document under review.

**Files affected:**
- `server/src/middleware/lockout.ts` (new) — wraps write endpoints, returns 403 LOCKED for PC role on `status >= submitted-for-review`
- All write controllers (`narrativeController`, `evidenceController`, `selfStudyController`) — apply middleware
- `client/src/features/selfStudy/Editor/SelfStudyEditor.tsx` — read-only banner with submitted date
- `client/src/features/selfStudy/PrintView/` — verify unaffected by lockout

**Acceptance:**
- [ ] PC's write to any locked self-study endpoint returns 403 LOCKED
- [ ] Print endpoint stays open
- [ ] Read endpoints return data but client renders read-only UI
- [ ] Banner says "Submitted for review on YYYY-MM-DD — read only"
- [ ] Admin (Julia) writes succeed (admin is exempt)

**Test plan:**
- Integration: PC PATCH on locked record → 403; admin PATCH on locked → 200
- Client unit: editor renders read-only when status >= submitted
- E2E: PC submits → tries to edit narrative → sees banner + 403

**Estimate:** 2 days

---

## S2A.3 — Reader access gating

**Source:** [[cr-007-reader-access-after-submit]]

**User story:**
> As a reader, when I look at my dashboard I should only see self-studies that the program coordinator has actually finished and submitted — so I'm not reading a half-finished draft.

**Files affected:**
- `server/src/controllers/readerController.ts` — filter `status >= submitted-for-review` on every list/get
- `server/src/middleware/readerAccess.ts` (new) — guard middleware
- `client/src/features/reader/Dashboard.tsx` — group into "Available" + "Pending PC submission"

**Acceptance:**
- [ ] Reader GET /api/reader/self-studies returns only submitted+
- [ ] Reader GET /api/reader/self-studies/:id on `draft` returns 403
- [ ] Reader dashboard shows pending assignments with name only (no content)
- [ ] Security test: crafted ID for a draft → 403, no data leak

**Test plan:**
- Integration: reader role + draft target → 403; reader role + submitted target → 200
- E2E: assign reader → PC drafts → reader sees "pending" → PC submits → reader sees content

**Estimate:** 1.5 days

---

## S2A.4 — Both importers surfaced + labelled

**Source:** [[cr-001-both-importers-required]]

**User story:**
> As a program coordinator who has multiple authors working in parallel, I want a clearly-labelled choice between the legacy per-standard importer and the new AI import wizard — so I can pick the right tool for my workflow.

**Files affected:**
- `client/src/features/selfStudy/Editor/SelfStudyEditor.tsx` — two entry points: "Import document" + "AI Import" (with badge)
- `client/src/features/selfStudy/Editor/ImportChooser.tsx` (new) — landing modal explaining each
- [[wizard-user-guide-2026-05-20]] — add "When to pick each path" section

**Acceptance:**
- [ ] Both entry points visible from the editor
- [ ] AI Import is badged "AI"
- [ ] User-guide page updated
- [ ] No regression: legacy importer still works end-to-end
- [ ] Mixed-mode smoke test: legacy import + wizard run on same self-study merge cleanly

**Test plan:**
- E2E: legacy import 2 standards → wizard for 5 standards → verify all 7 populated

**Estimate:** 1 day

---

## S2A.5 — Final-submit confirmation + audit trail

**Source:** [[cr-006-two-stage-submission]] + audit trail bootstrap for S3

**User story:**
> As a program coordinator, when I click Final Submit I want a confirmation dialog explaining what happens (lockout, reader access) and asking me to confirm — so I don't accidentally lock myself out.

**Files affected:**
- `client/src/features/selfStudy/Editor/FinalSubmitModal.tsx` (new)
- `server/src/services/auditLog.ts` (new — bootstrapped here, fleshed out in S3)
- `server/src/models/AuditLogEntry.ts` (new)

**Acceptance:**
- [ ] Confirm modal lists: what gets locked, who gets access, how to unlock
- [ ] Free-text "submission note" optional field
- [ ] Audit log entry created with `actor`, `selfStudyId`, `action: 'final-submit'`, `timestamp`, `note`
- [ ] Cancel returns to editor with no state change

**Test plan:**
- E2E: PC clicks Final Submit → modal → cancel → no change → re-click → confirm → status changes

**Estimate:** 1.5 days

---

# SPRINT 2B — Isolation audit + UX (2 weeks)

**Goal:** Ship the cross-institution audit document the board needs, plus the small UX wins from the webinar (drag-drop, hyperlinks, validation popup).

**Stories:** 5

---

## S2B.1 — Cross-institution isolation audit document

**Source:** [[cr-017-cross-institution-isolation-audit]]

**User story:**
> As the CSHSE board (via Julia), I want a written audit confirming that no program can see another program's data, including the AI service paths — so I can answer member questions like Paul Datti's confidently.

**Files affected:**
- New vault page `Engineering/cross-institution-isolation-audit-2026-05-DD.md` (review-type, dated)
- Updates to [[security-audit-2026-05-10]] cross-references

**Acceptance:**
- [ ] Enumerates every API endpoint that touches institution data
- [ ] Documents the scoping mechanism for each (institutionId filter, RBAC, etc.)
- [ ] Documents AI service Qdrant payload filter on every collection
- [ ] Documents S3 bucket prefix scoping
- [ ] Documents `CROSS_INSTITUTION_SEARCH_ENABLED` flag default-off
- [ ] Eric + one other engineer sign off

**Test plan:**
- See S2B.2

**Estimate:** 2 days

---

## S2B.2 — Cross-institution negative-case test suite

**Source:** [[cr-017-cross-institution-isolation-audit]]

**User story:**
> As an engineer, I want automated tests that prove a user from institution A cannot reach institution B's data — so we never regress.

**Files affected:**
- `server/tests/isolation/` (new folder)
  - `selfStudy.test.ts` — PC from inst A → inst B self-study returns 403
  - `evidence.test.ts` — same for evidence
  - `comments.test.ts` — same for comments
  - `aiService.test.ts` — Qdrant payload filter assertions
- `ai-service/tests/test_isolation.py` — Qdrant queries scoped by `institutionId`

**Acceptance:**
- [ ] 12+ negative tests, one per API surface
- [ ] Tests run on every CI build
- [ ] Any test failure blocks deploy

**Test plan:**
- Self-validating — the tests ARE the test plan

**Estimate:** 2 days

---

## S2B.3 — Drag-and-drop multi-file evidence upload

**Source:** [[cr-014-drag-drop-multi-file]]

**User story:**
> As a program coordinator, I want to drag a folder of PDFs onto the evidence panel and have them all upload — instead of clicking a picker once per file.

**Files affected:**
- `client/src/features/selfStudy/Editor/EvidenceUploader.tsx` — add drop zone with directory traversal
- `server/src/controllers/evidenceController.ts` — batched upload endpoint or accept multiple parts in one request
- Reuse `client/src/features/selfStudy/Editor/AIImport/steps/UploadStep.tsx` drop-zone code

**Acceptance:**
- [ ] Drop multiple files at once; all queue + upload
- [ ] Per-file progress bar
- [ ] Failure of one file doesn't abort the rest
- [ ] File-size cap enforced server-side
- [ ] Existing click-to-browse still works

**Test plan:**
- E2E: drop 5 PDFs → all 5 upload → all 5 visible in spec evidence list

**Estimate:** 1.5 days

---

## S2B.4 — Narrative hyperlink preservation

**Source:** [[cr-015-narrative-hyperlink-preservation]]

**User story:**
> As a program coordinator, when I paste Word content with embedded hyperlinks I want those links preserved and clickable in the narrative editor — so reviewers can follow the references.

**Files affected:**
- Test fixtures: a DOCX with inline + autolink + bookmark hyperlinks
- `ai-service/tests/test_hyperlink_preservation.py` — DOCX → splitter → bucket → apply, assert anchors
- `client/src/features/selfStudy/Editor/NarrativeEditor.tsx` — TipTap config; possibly add Link extension
- `client/src/extensions/PasteHandler.ts` — verify anchor preservation
- Fixes if any of the three pipelines drop anchors

**Acceptance:**
- [ ] DOCX hyperlinks survive mammoth conversion
- [ ] Hyperlinks survive AI Import apply path
- [ ] Word-paste preserves anchors in TipTap
- [ ] Reader view renders clickable links

**Test plan:**
- Integration tests in both Python + Node test suites
- E2E: PC pastes Word text with URL → editor renders → save → reload → link still works

**Estimate:** 1.5 days

---

## S2B.6 — Wizard matrix ↔ spec sync (UI half of CR-024)

**Source:** [[cr-024-matrix-spec-bidirectional-link]]

**User story:**
> As a program coordinator using the wizard, when I click a spec in the rail I want every visible matrix to scroll to that spec's row automatically — so I can see at a glance which courses cover that spec without hunting through a 79-row table twice.

**Files affected:**
- `client/src/features/selfStudy/Editor/AIImport/review/MatrixView.tsx` — accept `selectedSpecKey`; scroll both matrices in parallel + flash-highlight rows
- `client/src/store/aiImportStore.ts` — spec-rail clicks dispatch `selectMatrixRow` alongside `setSelectedKey`
- `client/src/features/selfStudy/Editor/AIImport/review/SpecRail.tsx` — dispatch the matrix anchor on click
- `client/src/features/selfStudy/Editor/AIImport/review/ItemCardList.tsx` — render a "Matrix" button on spec cards with matrix coverage
- `client/src/features/selfStudy/Editor/AIImport/review/MatrixHeading.tsx` — sticky standard heading inside the scrolling matrix region

**Acceptance:**
- [ ] Clicking 11.a in the rail scrolls every matrix to row 11.a + flashes for 1.5s
- [ ] Specs with no matrix coverage do not trigger a scroll
- [ ] "Matrix" button shown on spec cards that have matrix coverage; click jumps to the matrix view at the row
- [ ] Standard headings ("Standard 11", …) stay pinned as the matrix scrolls

**Test plan:**
- Client unit tests for `MatrixView` scroll behavior
- E2E: click 11.a → both matrices scroll → click 13.a → both scroll → click 9.c (no coverage) → no scroll, no error

**Estimate:** 1.5 days

---

## S2B.5 — Pre-submission validation popup

**Source:** [[cr-008-pre-submission-validation-popup]]

**User story:**
> As a program coordinator, when I click Final Submit I want a popup listing every spec that's missing narrative or evidence, with a link to fix each one — so I don't lock myself out with gaps.

**Files affected:**
- `server/src/controllers/selfStudyController.ts` — new `GET /:id/preflight` endpoint returning `{ errors: [], warnings: [] }`
- `server/src/services/preflight.ts` (new) — completeness checks
- `client/src/features/selfStudy/Editor/FinalSubmitModal.tsx` (from S2A.5) — consume preflight result; require override + reason on errors

**Acceptance:**
- [ ] Preflight returns errors for empty specs + missing required-by-CSHSE specs
- [ ] Preflight returns warnings for low-confidence AI matches + short narratives
- [ ] Modal links to each offending spec
- [ ] Override requires reason; reason persists in audit log

**Test plan:**
- Integration: preflight on a self-study with gaps → expected errors
- E2E: submit with gap → modal lists it → click → editor scrolls → fix → re-submit → succeeds

**Estimate:** 2 days

---

# SPRINT 3 — Auth hardening + assignment lockout + audit-trail UI (2 weeks)

**Goal:** Close the remaining auth/RBAC findings from `security-audit-2026-05-10` + finish the audit-trail UI that S2A bootstrapped + lock down reader assignment changes.

**Stories:** 4 new + carryover

---

## S3.1 — Auth hardening (carryover from sprint-plan-2026-05-16)

Multi-PC + JWT refresh + role enum cleanup. See [[sprint-plan-2026-05-11#sprint-2]] for details.

**Estimate:** 4 days

---

## S3.2 — Reader assignment lockout

**Source:** [[cr-022-reader-assignment-lockout]]

**User story:**
> As an admin (Julia), once a self-study is in review I want to be the only one who can add or remove readers — so the chain of custody is preserved.

**Files affected:**
- `server/src/controllers/readerAssignmentController.ts` — admin-only check for `status >= submitted`
- `client/src/features/leadReader/Assignments/` — replace "reassign" with "request change from admin" once locked

**Acceptance:**
- [ ] Reader-assignment endpoints reject non-admin writes on locked records
- [ ] Reason field required on every change
- [ ] Audit log entry per assignment change
- [ ] Lead reader sees "Request change from admin" form, not the assignment editor

**Estimate:** 2 days

---

## S3.3 — Admin lock/unlock audit-trail UI

**Source:** [[cr-020-account-lock-unlock-audit-trail]]

**User story:**
> As an admin, I want one screen showing every lock, unlock, assignment change, and relay event with who did it, when, and why — so I can answer reader and PC questions about timeline.

**Files affected:**
- `server/src/controllers/auditController.ts` (new) — list + filter + CSV export
- `server/src/models/AuditLogEntry.ts` — append-only enforcement (`pre-update`/`pre-delete` hooks reject)
- `client/src/features/admin/AuditTrail/` (new folder)

**Acceptance:**
- [ ] Audit entries can't be edited or deleted
- [ ] UI filters by actor, target type, date range
- [ ] CSV export
- [ ] Non-admin access returns 403

**Estimate:** 3 days

---

## S3.4 — Multi-PC support (carryover)

Allow multiple PCs per institution. See [[sprint-plan-2026-05-11#sprint-2]].

**Estimate:** 2 days

---

# SPRINT 4 — 0-3 rubric + evidence AI + Julia relay (2 weeks)

**Goal:** Land the scoring rubric the board needs, migrate evidence AI off n8n into cshse-ai, and ship the Julia relay console.

**Stories:** 6

---

## S4.1 — 0-3 compliance rubric schema + migration

**Source:** [[cr-003-zero-to-three-compliance-rubric]]

**User story:**
> As a reader, I want to score each spec on a 4-level rubric (Non / Partial / Largely / Fully) instead of pass/fail — so my scoring matches how CSHSE actually evaluates compliance.

**Files affected:**
- `server/src/models/Review.ts` — `score: 0 | 1 | 2 | 3`
- Migration script for any existing pass/fail data
- `server/src/utils/rubric.ts` — label/value mapping

**Acceptance:**
- [ ] Score enum present
- [ ] Migration runs cleanly on dev Mongo
- [ ] All downstream consumers (DOCX export, compilation tab) updated

**Estimate:** 1.5 days

---

## S4.2 — Reader review UI with rubric

**Source:** [[cr-003-zero-to-three-compliance-rubric]]

**User story:**
> As a reader, I want a clear 4-button (or dropdown) score selector per spec with helper text describing each level — so I score consistently with other readers.

**Files affected:**
- `client/src/features/reader/Review/SpecScoreSelector.tsx` (new)
- Reader review route — integrate

**Acceptance:**
- [ ] Selector renders 4 options with hover descriptions
- [ ] Score persists on selection
- [ ] Previous score loads on revisit

**Estimate:** 1.5 days

---

## S4.3 — Evidence review on cshse-ai (supersedes S4.1/S4.2/S4.3/S4.5 from prior plan)

**Source:** [[cr-018-ai-evidence-review-via-cshse-ai]]

**User story:**
> As a reader, I want the AI to surface which evidence files appear to support which specs — so I can spot-check rather than read everything cold.

**Files affected:**
- `ai-service/app/evidence/` (new module)
  - `extract.py` — Marker-pdf for PDFs, mammoth for DOCX, plain for TXT
  - `embed.py` — text-embedding-3-small to Qdrant
  - `score.py` — Haiku adjudication: does this evidence support this spec? (returns confidence + rationale)
- `ai-service/app/main.py` — `POST /ai/evidence/extract`, `/recommend`, `/score`
- New Qdrant collection: `cshse_evidence_{env}`
- `server/src/services/cshseAiClient.ts` — `extractEvidence`, `recommendForSpec`, `scoreEvidenceAgainstSpec`

**Acceptance:**
- [ ] Three endpoints with unit + integration tests
- [ ] Qdrant collection bootstrapped + per-institution payload filter
- [ ] n8n nodes for evidence review archived
- [ ] [[evidence-document-review-pipeline]] updated

**Estimate:** 4 days

---

## S4.4 — Comment threading + identity redaction model

**Source:** [[cr-004-comment-threading-identity-redaction]]

**User story:**
> As a program coordinator, I want to see relayed reader comments but never reader names — so the review process stays double-blind.

**Files affected:**
- `server/src/models/Comment.ts` (new or updated) — `relayed`, `relayedText`, `pcLabel`, `originalReaderId`, `boardEscalated`
- `server/src/services/commentSerializer.ts` (new) — role-aware serialization
- Integration tests: PC role never sees `originalReaderId` via any API surface

**Acceptance:**
- [ ] PC role API responses omit reader names
- [ ] Reader/lead-reader role API responses show full identity
- [ ] Server-side ACL test passes
- [ ] Mongoose schema enforces shape

**Estimate:** 2 days

---

## S4.5 — Julia relay console

**Source:** [[cr-023-julia-relay-workflow]]

**User story:**
> As Julia (admin), I want one screen showing every reader comment for a self-study, with the ability to edit + redact + relay to the PC or escalate to the board — so I can triage efficiently.

**Files affected:**
- `server/src/controllers/relayController.ts` (new) — `relay`, `unrelay`, `escalate-to-board` endpoints
- `client/src/features/admin/RelayConsole/` (new folder)
  - `RelayList.tsx` — left pane, grouped by standard
  - `RelayEditor.tsx` — right pane: edit, anonymize, send
- Audit-log integration

**Acceptance:**
- [ ] All reader-tier comments visible on left pane
- [ ] Edit relayed text without touching original
- [ ] `pcLabel` setter
- [ ] "Send to PC" + "Send to Board" buttons
- [ ] Bulk-relay multi-select
- [ ] Audit log entry per action

**Estimate:** 4 days

---

## S4.7 — Persistent matrix hotlinks + AI evaluation includes matrix rows (Sprint 4 half of CR-024)

**Source:** [[cr-024-matrix-spec-bidirectional-link]]

**User story:**
> As a reader (and program coordinator after the apply), I want every spec with matrix coverage to show "Matrix" + "Source document" links right in its header, and when the AI scores the spec it must include the matrix row content alongside narrative + evidence — so the curriculum matrix is treated as first-class evaluation evidence, not a side artifact.

**Files affected:**
- `client/src/features/selfStudy/Editor/SelfStudyEditor.tsx` — extend the existing "View in matrix" affordance from the hardcoded Standards 11-21 range to every spec with `aiMatrices` coverage; add "Source document" link next to it
- `ai-service/app/evidence/score.py` (new in S4.3 / [[cr-018]]) — accept `matrix_rows: list[MatrixRow]`; include verbatim in the Haiku prompt under a `<matrix>` block
- `server/src/services/cshseAiClient.ts` — `scoreEvidenceAgainstSpec(specId)` resolves `aiMatrices` rows tagged to the spec and passes them through
- Regression-verify `applyAIImport` still persists `aiMatrices` row anchors into `CurriculumMatrix.rawContent[]` (already shipped per `4c37e68`)

**Acceptance:**
- [ ] "Matrix" link on every spec header where matrix coverage exists (not just Standards 11-21)
- [ ] "Source document" link opens [[ShowInSourceModal]] at the matrix `<table>` anchor in the source DOCX
- [ ] AI scoring payload for a spec includes the matrix row(s) when coverage exists
- [ ] Haiku rationale references the matrix row when it informed the score
- [ ] Existing in-editor "View in matrix" flash + scroll behavior preserved

**Test plan:**
- Integration: apply wizard output → reload editor → "Matrix" link on every covered spec
- ai-service unit: prompt builder includes a `<matrix>` block when `matrix_rows` is non-empty
- E2E: reader drills into 13.a → clicks "Matrix" → matrix editor scrolls to row + flashes → clicks "Source document" → modal opens at original table

**Estimate:** 2.5 days

---

## S4.6 — Email host on server + reader deadline emails (S4.4 + S3.9 carryover)

**Source:** [[sprint-plan-2026-05-11#sprint-3]]

Move off Gmail SMTP onto a server-managed SES/Resend setup. Add 45-day reader-deadline emails.

**Estimate:** 3 days

---

# SPRINT 5 — Reader workflow (compilation, DMs, suggestions doc) (2 weeks)

**Goal:** Give the lead reader the tools to drive consensus + produce the artifacts the board and VP for accreditation consume.

**Stories:** 5

---

## S5.1 — Compilation tab (lead reader)

**Source:** [[cr-009-compilation-tab-lead-reader]]

**User story:**
> As a lead reader, I want one screen showing every spec with all readers' scores side-by-side and disagreements highlighted — so I can drive a consensus discussion and set the final score.

**Files affected:**
- `client/src/features/leadReader/CompilationTab/` (new)
- `server/src/controllers/compilationController.ts` (new)
- Tab visible only to lead-reader + admin roles

**Acceptance:**
- [ ] Virtualized table: every spec, columns = Reader 1/2/3/Final
- [ ] Yellow row = disagreement >= 1; Red row = any 0 score
- [ ] Final score editable; audit-logged
- [ ] Click reader cell → opens that reader's comment for the spec

**Estimate:** 4 days

---

## S5.2 — Compilation report DOCX export

**Source:** [[cr-009-compilation-tab-lead-reader]]

**User story:**
> As a lead reader, when I finish compilation I want a single DOCX I can send to Julia and the board — so I don't have to re-format.

**Files affected:**
- `server/src/services/compilationDocx.ts` (new) — reuses S5.10 reader-report scaffolding

**Acceptance:**
- [ ] DOCX mirrors the table + lead-reader comments
- [ ] CSHSE branding (header/footer + logo)
- [ ] Internal + PC-facing modes

**Estimate:** 2 days

---

## S5.3 — Suggestions consolidation document

**Source:** [[cr-011-suggestions-consolidation-doc]]

**User story:**
> As a lead reader, I want a single DOCX consolidating every reader's suggestions per standard, with two output modes (internal full-identity vs PC-facing anonymized) — so the VP for accreditation can act on them.

**Files affected:**
- `server/src/services/suggestionsDocx.ts` (new)
- `server/src/controllers/compilationController.ts` — `POST /:id/export-suggestions` with `?mode=internal|pc-facing`

**Acceptance:**
- [ ] Internal mode shows reader names
- [ ] PC-facing mode strips identity server-side
- [ ] Standard grouping with TOC

**Estimate:** 2 days

---

## S5.4 — Portal direct messaging

**Source:** [[cr-010-portal-direct-messaging]]

**User story:**
> As a lead reader, I want to send a direct message to another reader inside the portal — so I don't have to use email to ask for clarification.

**Files affected:**
- `server/src/models/DirectMessageThread.ts` + `DirectMessage.ts` (new)
- `server/src/controllers/messageController.ts` (new)
- `client/src/features/reader/Messages/` (new folder)
- Compilation tab side-panel inline DM
- Email + in-app notification on new message

**Acceptance:**
- [ ] Thread scoped to one self-study + participants list
- [ ] PC role has no API access (verified by test)
- [ ] Notifications fire on new messages
- [ ] Audit log preserves content

**Estimate:** 3.5 days

---

## S5.5 — Reader-uploaded files on comments

**Source:** [[cr-021-reader-uploaded-files]]

**User story:**
> As a reader, I want to attach a PDF or DOCX to a comment so I can share a reference document with the lead reader and (after relay) the PC.

**Files affected:**
- `server/src/models/Comment.ts` — `attachments: [{ s3Key, filename, mimeType, sizeBytes }]`
- Comment composer UI — paperclip
- S3 prefix: `reader-attachments/`

**Acceptance:**
- [ ] Multi-file attach
- [ ] 25 MB per file, type whitelist (PDF, DOCX, TXT)
- [ ] Attachment ACL follows comment `relayed` state

**Estimate:** 2 days

---

# SPRINT 6 — Site visit + completion checks (2 weeks)

**Stories:** 4

---

## S6.1 — Site-visit partial-compliance checklist

**Source:** [[cr-012-site-visit-partial-compliance-tracking]]

**User story:**
> As a lead reader, when I finalize compilation I want every spec scored "Partial (1)" to auto-populate a site-visit checklist — so the visit team verifies in person.

**Files affected:**
- `server/src/models/SiteVisitChecklistItem.ts` (new)
- `server/src/services/checklistGenerator.ts` (new) — runs on compilation finalize
- `client/src/features/siteVisit/Checklist/` (new)

**Acceptance:**
- [ ] Auto-population on Final score → 0 or 1
- [ ] Visit-team UI: verified toggle + note field
- [ ] DOCX/PDF export

**Estimate:** 3 days

---

## S6.2 — Site-visit itinerary builder

**Source:** [[cr-013-site-visit-itinerary-builder]]

**User story:**
> As a lead reader and PC, I want to co-edit the site-visit itinerary in the portal — instead of emailing dates back and forth.

**Files affected:**
- `server/src/models/SiteVisit.ts` (new)
- `server/src/controllers/siteVisitController.ts` (new)
- `client/src/features/siteVisit/Itinerary/` (new)

**Acceptance:**
- [ ] Lead reader + PC co-edit; other readers read-only
- [ ] Per-slot link to relevant checklist items
- [ ] DOCX export
- [ ] Conflict resolution via last-writer-wins + audit-log diff

**Estimate:** 4 days

---

## S6.3 — Completion checklist (S6.x carryover, refactored)

**Source:** [[sprint-plan-2026-05-11#sprint-5]] common-error checks

**User story:**
> As a program coordinator, before final submit I want a completion checklist showing me every required item (narrative per spec, evidence per CSHSE-required spec, curriculum matrix filled) — so I know I'm ready.

Largely the same as S2B.5 (pre-submission validation popup); this story extends it with a persistent dashboard view rather than just a modal.

**Estimate:** 2 days

---

## S6.4 — Common-error checks (carryover)

Handbook-rule violations: URL hygiene, PDF-preferred for evidence, narrative minimum length, etc.

**Estimate:** 2 days

---

# SPRINT 7 — Board decisions + bug reporter + E2E (2 weeks)

**Stories:** 4

---

## S7.1 — Board decisions + cycle scheduler (carryover from sprint-plan-2026-05-16)

Board votes Accept / Table / Deny / Suspend / Revoke. Cycle scheduler for re-accreditation reminders.

**Estimate:** 5 days

---

## S7.2 — In-app bug reporter

**Source:** [[cr-016-in-app-bug-reporter]]

**User story:**
> As any user, when something looks wrong I want to click "Report issue" and have the system auto-capture my screenshot + route + console state — so I don't have to email Eric a screenshot every time.

**Files affected:**
- `client/src/components/BugReporter/` (new)
- `server/src/controllers/bugReportController.ts` (new)
- `server/src/models/BugReport.ts` (new)

**Acceptance:**
- [ ] Floating button on all signed-in routes
- [ ] Auto-captures screenshot (html2canvas) + route + UA + build SHA + recent console errors
- [ ] User can redact screenshot before submit
- [ ] Submit creates persistent record + email notification

**Estimate:** 3 days

---

## S7.3 — E2E coverage expansion

Cover the new lockout/submission/reader workflow with Playwright tests against the seeded dev DB.

**Estimate:** 4 days

---

## S7.4 — Polish + runbook

Operational runbooks for the new admin surfaces (relay console, audit trail, lock/unlock).

**Estimate:** 2 days

---

# SPRINT 8 — Joint Ventures (2 weeks, unchanged)

JV entity + admin UI + dashboard grouping. See [[sprint-plan-2026-05-11#sprint-7]] for the full spec.

**CR-019 stays rejected** — no beta institution surfaced a JV need at the webinar.

---

## Cross-sprint operational tasks

1. **2026-05-20:** `e9a63f8` (streaming HTML) + `4c37e68` (vault CRs) pushed to `origin/developer`.
2. **Sprint 2A kickoff (2026-05-21):** start with S2A.1 (status state machine) — every other Sprint 2A story depends on it.
3. **Mark superseded stories** in [[sprint-plan-2026-05-16]]: S4.1, S4.2, S4.3, S4.5 (n8n evidence), S2.1 (identity), S5.10 (rubric), S7.3 (site visit).
4. **Schedule beta institution check-ins** at the end of each sprint to surface blockers early.

## What to start tomorrow morning (2026-05-21)

Three parallel tracks. All single-engineer-eligible; the work is mostly serializable but the listed first task in each track has no dependencies.

### Track A — backend status machine

1. **First commit (morning):** Add `SelfStudy.status` enum + `StandardSection.status` enum to Mongoose schemas. Add migration script. Run on dev. (S2A.1, ~3h)
2. Stub `selfStudyState.ts` service with the transition validator. (S2A.1, ~2h)
3. Wire `submitSection` + `revertSection` endpoints. (S2A.1, ~3h)
4. End-of-day: PR open with state machine + unit tests passing.

### Track B — lockout middleware + client read-only

1. **First commit (morning):** Write `lockout.ts` middleware that checks `req.user.role` + `selfStudy.status` and returns 403 LOCKED. (S2A.2, ~2h)
2. Wire middleware into write controllers. Run server tests. (S2A.2, ~2h)
3. Add read-only banner to `SelfStudyEditor.tsx`. (S2A.2, ~3h)
4. End-of-day: integration test pass for "PC PATCH on locked = 403".

### Track C — both-importers UX (lighter, parallelizable)

1. Update `SelfStudyEditor.tsx` entry points to surface both legacy + AI Import. (S2A.4, ~2h)
2. Add the AI badge component. (S2A.4, ~1h)
3. Update [[wizard-user-guide-2026-05-20]] with "When to pick each path". (S2A.4, ~1h)
4. End-of-day: PR open; smoke-test mixed-mode by hand.

### Track D — planning + comms

1. Mark superseded stories in [[sprint-plan-2026-05-16]] with a `superseded:` frontmatter note.
2. Email the Sprint 2A kickoff plan to Julia for sign-off on the lockout semantics.
3. Open a tracking issue per sprint in Github (or whatever tracker is in use); link each story to its CR page.

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Sprint 2A state machine has subtle bugs that lock real PCs out | Medium | High | Comprehensive unit tests on transitions; staged rollout to dev only |
| Julia disagrees with S2A.1 semantics after seeing the kickoff plan | Medium | High | Email her the plan on day 1; pause work if she objects |
| Sprint 4 evidence migration breaks live n8n flows | Low | Medium | n8n hasn't been built for evidence yet per webinar; low risk |
| Sprint 5 DM/relay/comments adds Mongo write volume that triggers Atlas plan upgrade | Low | Low | Monitor; defer to Sprint 8 polish if needed |
| Stevenson institution returns and the AI service is down due to deploy | Low | Medium | Already mitigated by the "no push during wizard run" rule |
