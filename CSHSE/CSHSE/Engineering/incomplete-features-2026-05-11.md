---
name: Incomplete Features — 2026-05-11
description: Product-requirements-driven audit of what the CSHSE portal must support (per the 2024 Member Handbook) versus what the code actually implements. Supersedes the 2026-05-10 review.
type: review
tags: [tech-debt, incomplete, audit, product-requirements, handbook]
audit_date: 2026-05-11
auditor: claude
last_reviewed: 2026-05-11
---

# Incomplete Features — 2026-05-11

**Supersedes [[incomplete-features-2026-05-10]].** That review catalogued code-smell incompleteness (stubs, TODOs, broken wiring). This one walks down [[product-requirements]] tier by tier and asks of each line "where is this in the code?" Each requirement is one of:

- ✅ **Implemented** — visible end-to-end, no major gap.
- ⚠️ **Partial** — built but missing meaningful behavior. Listed below.
- ❌ **Missing** — no code path. Listed below.
- 🚫 **Compliance gap** — implementation exists but **violates** a Handbook hard requirement. Treated as the highest priority below.

Items carried from the prior audit are marked `[carried 05-10]`.

## Compliance gaps (Handbook hard requirements — HIGHEST PRIORITY)

The Handbook explicitly lists three things the portal must NOT violate (see [[product-requirements|Hard requirements]]). Each must be addressed before accreditation can run on this software.

### 🚫 H1. Reader identity is surfaced to Program Coordinators via comments

**Handbook rule:** *"Reader feedback is confidential and available only to Board members."* *"No direct reader↔program contact."*

**Code reality:** [server/src/controllers/commentController.ts:181-192](../../../../server/src/controllers/commentController.ts) sets `authorName: req.user!.name` and `authorRole: req.user!.role` on every comment at creation, then persists them. When a Program Coordinator opens [client/src/features/comments/CommentSidebar.tsx](../../../../client/src/features/comments/CommentSidebar.tsx), the reader's real name + role appears next to the comment text. There is no role-aware redaction at read time.

**Fix scope:** introduce a `displayName` resolver that returns `"Reader 1"`/`"Reader 2"`/`"Lead Reader"` to Program Coordinators while preserving real identity for Lead Reader and Board views. Add a role-aware GET handler instead of trusting the persisted `authorName`. Audit-log every viewer.

### 🚫 H2. No audit log for superuser impersonation

**Handbook rule:** *"Reader feedback is confidential and available only to Board members."*

**Code reality:** [server/src/middleware/auth.ts:59-63](../../../../server/src/middleware/auth.ts) accepts `X-Impersonated-Role` from any superuser. There is no `ImpersonationAudit` model, no log of who impersonated whom and when, and no UI surface to review such events. A superuser viewing reader feedback as a Program Coordinator role is undetectable.

**Fix scope:** new `ImpersonationAudit` model. Append on every impersonation start/stop. Admin-only listing UI. Required before this software handles real submissions.

### 🚫 H3. URL accessibility check is cosmetic; password-protected links are not detected

**Handbook rule:** *"Hyperlinks must work, must NOT be password-protected."*

**Code reality:** [server/src/controllers/evidenceController.ts:466](../../../../server/src/controllers/evidenceController.ts) hardcodes `isAccessible: true` at insert time. The `SupportingEvidence.url.lastVerified` field exists on the schema but **nothing in the codebase ever populates it** (grep confirms zero writers other than the hardcoded `true`). A coordinator can paste a 404 URL or a Google-Drive-private link and the system records it as accessible.

**Fix scope:** on `POST /api/submissions/:id/evidence/url`, fire a probe (HTTP HEAD + GET-200-or-401 check) before save. Periodic re-probe via a cron / on-demand "verify all links" action. Mark `isAccessible: false` and surface a red badge in `EvidenceManager` / `FileLibrary` / `EvidencePanel`.

### 🚫 H4. PDF preference not enforced on upload

**Handbook rule:** *"PDF strongly preferred. Documents must be PDF for archival permanence."*

**Code reality:** [client/src/features/selfStudy/EvidenceManager/FileUpload.tsx:33-46](../../../../client/src/features/selfStudy/EvidenceManager/FileUpload.tsx) and [server/src/controllers/evidenceController.ts:881-...](../../../../server/src/controllers/evidenceController.ts) accept Word, PowerPoint, Excel, and image types alongside PDF. There is no per-upload nudge ("This is a .docx — convert to PDF?") and no nightly job to convert legacy uploads.

**Fix scope:** soft block (modal: "PDF strongly preferred — convert?") for non-PDF uploads. Server-side convert-to-PDF action for legacy Word/PowerPoint files via libreoffice or a managed converter.

## Tier 1 — already substantially built (verify status)

These were called "already substantially built" by [[product-requirements]]. Audit confirms most are. Gaps below.

### ⚠️ T1.1. Per-Standard / per-Spec narrative editing
**✅ Implemented.** TipTap NarrativeEditor + useAutoSave + `Submission.narratives` Map. See [[narrative-storage]].

But: **spec-letter dropdown drift** ([client/src/features/selfStudy/EvidenceManager/EvidenceViewer.tsx:300](../../../../client/src/features/selfStudy/EvidenceManager/EvidenceViewer.tsx)) hardcodes `['a'..'h']` while [server/src/data/standards.ts](../../../../server/src/data/standards.ts) defines only `a`–`f`. Coordinators can link evidence to non-existent specs `g`/`h`.

### ⚠️ T1.2. Curriculum matrix (I/T/K/S × L/M/H grid)
**⚠️ Backend rich; client missing.** Server-side model + endpoints (`addCourse`, `updateAssessment`, `duplicateStandardRow`, `removeStandardRow`, `importMatrix`, `exportMatrix`, parsing, etc.) are fully implemented in [server/src/controllers/matrixController.ts](../../../../server/src/controllers/matrixController.ts) and [server/src/models/CurriculumMatrix.ts](../../../../server/src/models/CurriculumMatrix.ts).

**Client only displays imported `rawContent[]` HTML** ([client/src/features/selfStudy/MatrixEditor/CurriculumMatrixEditor.tsx](../../../../client/src/features/selfStudy/MatrixEditor/CurriculumMatrixEditor.tsx) — 261 lines, view-only). It does not call `POST .../course`, `PUT .../assessment`, etc. So a coordinator cannot create or edit the spreadsheet today — only import its raw HTML from a tagged document.

**Fix scope:** spreadsheet-style cell editor wired to the existing backend endpoints. The schema (CourseEntry × StandardMapping × CourseAssessment) is the right shape; the UI is the missing piece.

### ⚠️ T1.3. Evidence file upload per Spec, with versioning
**Mostly built, with carry-forward defects.**

- ✅ Three upload UIs (EvidencePanel inline / EvidenceManager split-panel / FileLibrary accordion) backed by `POST /api/submissions/:id/evidence/upload`. See [[evidence-file-storage]].
- ✅ Versioning chain via `previousVersionId` / `replacedById` works.
- ⚠️ `[carried 05-10]` `isS3Configured()` bug forces base64-in-Mongo storage ([[storage-layer]]).
- ⚠️ EvidenceManager link dropdown is hardcoded + buggy (H1.1 above).
- ⚠️ Unassigned files (no `standardCode`) are bucketed under `"unassigned"` but never rendered in FileLibrary — invisible.
- ⚠️ Two-description-field tech debt (`description` vs `metadata.description`).
- ⚠️ `imageMetadata.ocrText` and `linkedNarratives[]` are dead fields.

### ✅ T1.4. Reader / Lead Reader split-screen workspace + comments
**Built.** Reviewer view via [client/src/features/selfStudy/Editor/NarrativeEditorWithComments.tsx](../../../../client/src/features/selfStudy/Editor/NarrativeEditorWithComments.tsx) + `CommentSidebar` + `ReaderLockedBanner`. **But see H1 above** — reader identity leaks to PC.

### ✅ T1.5. Lead Reader compilation view + final-determination capture
**Built — surprisingly rich.** 16 endpoints in [server/src/routes/leadReviews.ts](../../../../server/src/routes/leadReviews.ts): compilations, comparison view, **disagreement detection**, comment threads with replies, **reader reminders**, bulk-determination setting, export. Backed by [server/src/models/LeadReaderCompilation.ts](../../../../server/src/models/LeadReaderCompilation.ts).

⚠️ Reader-reminder endpoint (`POST /lead-reviews/:id/reminder`) likely hits the stubbed `emailService` — needs verification. If emails are stubbed, reminders are silently no-ops.

### ⚠️ T1.6. Site Visit scheduling and itinerary capture
**Partial.** [server/src/controllers/siteVisitController.ts](../../../../server/src/controllers/siteVisitController.ts) + [client/src/features/siteVisits/SiteVisitScheduler.tsx](../../../../client/src/features/siteVisits/SiteVisitScheduler.tsx) cover scheduling, team-member assignment, status badges, agenda capture.

- ⚠️ `[carried 05-10]` All 4 notification email sites in `siteVisitController.ts:181-296` are stubbed.
- ❌ **No "mock site visit checklist + itinerary builder using the Handbook's 2.5-day sample agenda as the template"** (Tier 3 item but called out specifically by the Handbook). Today's UI is free-form; no template to start from.

## Tier 2 — partially built or missing

### ❌ T2.1. AI review of evidence files themselves
**Missing — the highest-value Tier-2 gap.** Today's validation never opens the uploaded PDFs/DOCXs; only filename + type are sent to n8n ([validationService.ts:187-193](../../../../server/src/services/validationService.ts)).

Full design is in [[evidence-document-review-pipeline]]. Sequenced in [[sprint-plan-2026-05-10|Sprint 3]]. Prerequisites: fix `isS3Configured()`; harden `callWebhook()`. **No code progress since 2026-05-10.**

### ❌ T2.2. Handbook "Common Errors" checks
The Handbook §IV explicitly enumerates checks the portal should mechanize. **None are implemented:**

| Common-error check | Status | Where it would live |
|--------------------|--------|---------------------|
| Matrix ↔ narrative congruence (each Spec cited in narrative is in the matrix) | ❌ Missing | New service joining `Submission.narratives` and `CurriculumMatrix.standards`. |
| Missing Specs (every standard's required specs have non-empty narrative) | ❌ Missing | New `validationService.checkCompletion()` over `narratives` Map. |
| Missing required document types (syllabi for every required course, advisory minutes, etc. — see [[product-requirements]] for the full list) | ❌ Missing | New "required documents per Spec" rule set; UI banner per Spec. |
| Inconsistent data across sections (e.g., enrollment numbers cited differently) | ❌ Missing | Hard problem; LLM check is plausible. |
| Unlinked references (narrative cites "Appendix C" but no Appendix C uploaded) | ❌ Missing | Cross-reference scanner over narrative HTML vs `SupportingEvidence`. |
| Broken / expired hyperlinks | ❌ Missing | See H3 above — URL probe. |

These are the cheap, mechanical wins. Pick one per sprint.

### ⚠️ T2.3. Email notifications at every workflow transition
**`[carried 05-10]` All stubbed.** Workflow-critical events still silently succeed:

| Controller | Lines | What goes unnotified |
|------------|-------|----------------------|
| `siteVisitController.ts` | 181-296 (4 sites) | New visit scheduled / updated / cancelled / completed |
| `changeRequestController.ts` | 156-307 (3 sites) | New request / approved / denied |
| `institutionController.ts` | 143, 263, 303 | Invitation / lead-reader assignment / deletion |
| `readerLockController.ts` | 239 | Send-back-for-correction notification to PC |
| `invitationController.ts` | (check) | Invitation email itself |
| `leadReaderController.ts` reminder endpoint | (check) | Reader-overdue reminder |

`emailService` is wired in but **none of these flows call it**. Configure SMTP (or SES/SendGrid), then sweep each stub call site.

### ❌ T2.4. Self-Study Completion Checklist
**Missing — no pre-submit gate.** The Handbook lists required document types (syllabi, curriculum matrix, advisory minutes, field placement manuals, student handbooks, evaluation forms, signed Certificate Page, surveys, achievement data, program budget, library/student services/technology resources, glossary, etc.). The portal today lets a coordinator submit with zero evidence uploaded.

**Fix scope:** new `SubmissionChecklist` derivation from current state. Block `POST /api/submissions/:id/submit` if required-document categories are empty. UI panel in [SubmissionWorkflow](../../../../client/src/features/selfStudy/SubmissionWorkflow/) showing per-category coverage.

### ⚠️ T2.5. PDF / hyperlink hygiene checks
See H3, H4 in the compliance section.

### ⚠️ T2.6. Exit / notification flow for Board decisions
**Schema exists, automation missing.** `Submission.decision: { outcome, decidedBy, decidedAt, comments }` ([Submission.ts:59-64](../../../../server/src/models/Submission.ts)) captures the Board's outcome (`approve | deny | conditional`). But:

- ❌ No automated informal-notice-within-10-days email.
- ❌ No formal-notice-within-30-days email.
- ❌ No public-website-post-within-30-days hook.

**Fix scope:** event hook on `Submission.decision` write → schedule three notifications via a job queue. Mark each as sent with a timestamp on `Submission.decision`.

### ⚠️ T2.7. 45-day reader deadline tracking
**Field present, automation missing.** [server/src/models/Review.ts:80](../../../../server/src/models/Review.ts) has `assignedAt: Date`. There is **no `dueAt`, no overdue surface, no reminder cron**. The Handbook says readers have 45 days; nothing in the system tracks that.

**Fix scope:** add `dueAt = assignedAt + 45 days` (configurable). Daily cron flagging reviews ≥7 days from due. Lead reader's existing `POST /lead-reviews/:id/reminder` endpoint becomes useful once the emailService stubs are filled.

## Tier 3 — nice-to-haves implied by the Handbook

### ❌ T3.1. Two-year deadline tracking for Initial Accreditation
**Missing.** Institution model has `accreditationDeadline` but no "if not complete in 24 months, program forfeits and must reapply as Initial" workflow.

### ❌ T3.2. Membership / dues lifecycle integration
**Missing.** No `Membership` model. Handbook says membership lapse → automatic accreditation lapse. No code path.

### ❌ T3.3. Cycle scheduler (5-year interim, 10-year full)
**Missing.** No recurring-event model for accreditation cycles. No reminder system.

### ❌ T3.4. Mock site visit checklist + 2.5-day itinerary template
**Missing.** Per T1.6 above — no template; today's UI is free-form.

## Carried items from 2026-05-10 audit

For traceability, every item from [[incomplete-features-2026-05-10]] still applies unless otherwise noted:

| 05-10 # | Item | 05-11 status |
|---------|------|--------------|
| 1 | Email notifications stubbed across 4 controllers | ✅ Still open — expanded scope at T2.3 above. |
| 2 | N8N Document Matcher built but never invoked | ✅ Still open — verified `processWithAI: true` is still a no-op at [importController.ts:3176](../../../../server/src/controllers/importController.ts). |
| 3 | `isS3Configured()` bug | ✅ Still open — incorporated into T1.3 and T2.1 prerequisites. |
| 4 | No retry on n8n webhooks | ✅ Still open — single POST + 30s timeout at [validationService.ts:240-273](../../../../server/src/services/validationService.ts). |
| 5 | No tests | 🟡 Partly resolved — test infrastructure landed (Vitest server + client; Playwright E2E). Some coverage. Most areas still untested. See [TESTING.md](../../../../TESTING.md). |
| 6 | PDF image extraction hardcoded zero | ✅ Still open. |
| 7 | Profile auto-save has no failure surface | ✅ Still open. |
| 8 | Help Chat depends on three external services with no fallback | ✅ Still open. |
| 9 | Reader role RBAC is fragile | ✅ Still open — superuser-impersonation is still the de-facto test path. Worsened by H1, H2 above. |
| 10 | PDF / DOCX preview no streaming | ✅ Still open. |

## New non-tier observations

### N1. Outcome notification fields exist but go nowhere
The `Submission.decision` schema captures `outcome | decidedBy | decidedAt | comments` — perfect for downstream automation, but nothing reads it after write. See T2.6.

### N2. `LeadReaderCompilation` "comment threads" feature is rich but undocumented in user-facing docs
16 endpoints including [createCommentThread, addThreadMessage, toggleThreadResolved](../../../../server/src/routes/leadReviews.ts). No coordinator-facing documentation explains how Lead Readers use this. Likely *the* feature that needs a UI walk-through; otherwise it ships dark.

### N3. Spec letter range drift is a **real bug**, not just doc drift
[client/src/features/selfStudy/EvidenceManager/EvidenceViewer.tsx:300](../../../../client/src/features/selfStudy/EvidenceManager/EvidenceViewer.tsx) — see T1.1 / [[evidence-file-storage]].

### N4. CurriculumMatrix client-server asymmetry
Rich backend, view-only frontend (T1.2). This is the largest "we're already half done" feature in the codebase — finishing the spreadsheet UI is high-leverage.

### N5. No "what changed since last reader assessment" delta view
When a coordinator gets a section sent back for correction, then resubmits, there's no diff surface for the reader to see exactly what changed. Reviewers re-read the entire Spec narrative.

### N6. No bulk evidence upload by Spec range
A coordinator uploading 50 syllabi for a course catalog has to upload each one individually with a Standard/Sub-standard pick. Bulk-import with auto-classification (via the unused Document Matcher) would close this gap.

## Suggested sequencing (revises [[sprint-plan-2026-05-10]] priorities)

Order by Handbook-compliance criticality + leverage:

1. **H1, H2** — reader identity redaction + impersonation audit. Compliance-blocker for handling real submissions. ~1 sprint.
2. **T2.3 emails** + **T2.7 reader deadlines** — together. The 45-day deadline is meaningless without notifications. ~1 sprint.
3. **T1.3 isS3 fix** then **T2.1 evidence AI review** — see [[evidence-document-review-pipeline]] for full sprint sequence.
4. **T1.2 matrix client editor** — finishes a Tier 1 requirement with mostly-existing backend.
5. **T2.4 completion checklist** + **H3, H4** — pre-submit gate and link/PDF hygiene together (they share validation surface).
6. **T2.2 common-error checks** — pick one per sprint thereafter (matrix-narrative congruence is the easiest mechanizable win).
7. **T2.6 board-decision notifications** + **N1** — close the post-decision loop.
8. **Tier 3** — defer until Tier 1/2 are clean.

## Related

- [[product-requirements]] — the source-of-truth this audit is built against
- [[incomplete-features-2026-05-10]] — prior code-smell audit; superseded but cross-referenced for "carried" items
- [[security-audit-2026-05-10]] — H2 connects to L3 in that review
- [[evidence-document-review-pipeline]] — full design for T2.1
- [[sprint-plan-2026-05-10]] — sequencing baseline (revised in this review's last section)
- [[narrative-storage]] / [[evidence-file-storage]] / [[import-marker-mechanism]] — the durable concept pages that this audit cites
