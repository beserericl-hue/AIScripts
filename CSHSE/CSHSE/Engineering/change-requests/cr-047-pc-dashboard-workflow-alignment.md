---
name: CR-047 — PC Dashboard reorganized to follow the self-study workflow
description: The Program Coordinator dashboard (/dashboard) shows four generic accreditation-admin cards (Items In Spec Completed, Pending Requests, Deadline, Site Visit) + admin-uploaded spec docs. It does not reflect the PC's actual work pipeline. Reorganize it around the same IMPORT → DRAFTS → SELF-STUDY → SUBMIT workflow CR-045 established on the editor toolbar — surface the imported file, the draft counts (CVs / Syllabi / Projects-Papers / Introductions / per-spec review items), and the self-study committed counts.
type: change-request
cr_id: CR-047
status: shipped
priority: P1
source: User direction 2026-05-27 — "The PC Dashboard needs to be reorganized to follow the workflow that is occurring. This should include the file that was imported, the numbers of items in draft numbers of CVs, Sylibi, Projects and Plans, and number of items in each spec in review, and the numbers of items in the self study. This should follow the workflow for the PC."
sprint_target: Sprint 5 follow-on — pairs with CR-045 (toolbar) and CR-046 (introduction surface) as the third workflow-alignment CR.
tags: [ui, dashboard, workflow, program-coordinator, counts]
last_reviewed: 2026-05-28
revision_history:
  - 2026-05-27 — proposed
  - 2026-05-27 — accepted; four open questions resolved (Projects==Plans, no new evidence; per-spec only >0; deep-link pre-filtered Review; PC-relevant admin panels shown collapsed-if-empty, non-PC content hidden)
  - 2026-05-28 — shipped; commits df24cb6 (feat) + d49cd5d (e2e hardening); verified on cshse-develop (server 6 integration tests, client 12 unit tests, e2e 35 green)
---

# CR-047 — PC Dashboard reorganized to follow the self-study workflow

## Status: SHIPPED 2026-05-28

Delivered on `cshse-develop`. Commits `df24cb6` (feature) + `d49cd5d`
(e2e hardening).

**What shipped**

- **Server** — `GET /api/submissions/:id/workflow-summary`
  (`server/src/controllers/submissionController.ts:362`,
  wired at `server/src/routes/submissions.ts:67`). Pure read; rolls up
  the latest import, the `aiReviewState` draft counts (cvs / syllabi /
  papers / introductions / per-spec >0 buckets), the committed
  self-study counts (specs validated via `standardsStatus`, non-empty
  narratives, `CurriculumMatrix.rawContent` rows, non-deleted
  `SupportingEvidence`) and submit readiness. Owner-PC / admin auth,
  403 cross-institution. No schema change. (Converted the controller's
  `require()` lazy-loads to top-level ESM imports so it loads under the
  test runner.)
- **Client** — `client/src/features/dashboard/WorkflowSummary.tsx`
  (new) renders the four sections; `Dashboard.tsx` PC-branch fetches the
  summary and renders it, demotes Change Requests + Site Visits into a
  collapsed "Accreditation status" strip (auto-expanded when there's
  pending content), and drops the admin spec-file list from the PC view.
  DRAFTS tiles / per-spec rows deep-link into the editor's Review
  surface pre-selected to the matching `SpecRail` key via a new
  `?view=review&specKey=` (and `?view=import`) mount-effect on
  `SelfStudyEditor.tsx`.
- **Tests** — `server/tests/integration/workflow-summary.test.ts` (6:
  count correctness + auth owner/cross-inst-403/unauth-401/admin/fresh);
  `client/src/features/dashboard/WorkflowSummary.test.tsx` (12: four
  sections, tile counts, per-spec >0 filter, empty-import, deep-link
  callbacks, submit enable/disable);
  `e2e/tests/35_pc_dashboard_workflow.spec.ts` (2: dashboard rollup +
  tile deep-link to Review). All green against `cshse-develop`.

Original acceptance criteria (below) all met. The per-spec deep-link
opens the Review surface pre-selected to the matching rail key (synthetic
`_cvs` / `_evidence-docs:syllabus` / `_evidence-docs:paper` /
`_intro:document`, or a real spec key `1.a`).

## Status: ACCEPTED 2026-05-27

Four open questions answered by the user 2026-05-27:

1. **"Plans"** — Projects and Plans are **the same thing**. No new
   evidence type. The DRAFTS "Projects" tile counts
   `evidenceDocs.docSubKind === 'paper'`; there is no separate "Plans"
   count.
2. **Per-spec breakdown** — list only specs with > 0 review items.
3. **Deep-link** — DRAFTS tiles open the Review surface pre-filtered
   to that kind.
4. **Admin panels** — keep the PC-relevant ones (the PC's own Change
   Requests + their institution's Site Visits), demoted below the
   workflow and collapsed when empty. Everything that is NOT
   PC-relevant stays hidden from the PC (it already lives only in the
   non-PC dashboard branch).

Mirrors CR-045's plain-English IMPORT → DRAFTS → SELF-STUDY → SUBMIT
workflow on the landing dashboard so the PC sees the same mental
model the moment they log in.

## Source quote

User, 2026-05-27 (annotated dashboard screenshot):

> "The PC Dashboard needs to be reorganized to follow the workflow
> that is occurring. This should include the file that was imported,
> the numbers of items in draft numbers of CVs, Sylibi, Projects and
> Plans, and number of items in each spec in review, and the numbers
> of items in the self study. This should follow the workflow for the
> PC."

## Problem

The current PC dashboard (`client/src/features/dashboard/Dashboard.tsx:442-735`)
is built for accreditation **administration**, not the PC's authoring
work:

- Four stat cards: **Items In Spec Completed** (1/83), **Pending
  Requests** (0), **Deadline**, **Site Visit**. Three of those four
  are about scheduling / approvals — peripheral to a PC who is mid-way
  through building their self-study.
- **My Change Requests** + **Scheduled Site Visits** panels — both
  typically empty for a PC who's still authoring.
- **Files** section shows admin-uploaded *spec documents*
  (`category: 'dashboard_document'`, filtered by the institution's
  `specId`) — NOT the file the PC actually imported. The PC's own
  uploaded self-study (`SelfStudyImport.originalFilename`) is absent.

Nothing on the dashboard reflects where the PC is in their pipeline:
what they imported, what's waiting in Drafts, what's committed to the
self-study. The PC has to open the editor to learn any of it.

## Decision

Rebuild the PC dashboard body as a **workflow pipeline** matching
CR-045's vocabulary. Four sections, top to bottom, left to right:

```
┌─ 1. IMPORT ─────────────────────────────────────────────────────────┐
│ 📄 2024 CSHSE Self-Study Stevenson University.docx                  │
│    imported May 26 · parsed · 352 MB        [Open Importer]         │
│ (multiple files → list them; none yet → "No document imported yet") │
└─────────────────────────────────────────────────────────────────────┘

┌─ 2. DRAFTS — waiting in Review ─────────────────────────────────────┐
│  CVs        Syllabi     Projects    Introductions   Spec items      │
│   15          30          11            4              64           │
│  (each is a click-through to the Review surface, filtered)          │
│  ── Items in review, by spec ──                                     │
│  1.a  2   1.b  5   2.c  3   …  (only specs with > 0 review items)   │
└─────────────────────────────────────────────────────────────────────┘

┌─ 3. SELF-STUDY — committed ─────────────────────────────────────────┐
│  Specs validated   Narratives written   Matrix rows   Evidence files│
│     1 / 83              12                  412            9         │
│  [progress bar]                              [Open Self-Study]      │
└─────────────────────────────────────────────────────────────────────┘

┌─ 4. SUBMIT ─────────────────────────────────────────────────────────┐
│  Deadline Apr 29, 2026 · 1/83 validated · Not ready to submit       │
│  [Submit Self-Study for Review]  (disabled until all validated)     │
└─────────────────────────────────────────────────────────────────────┘
```

The accreditation-admin panels (Change Requests, Site Visits) move
**below** the workflow as a collapsed "Accreditation status" strip —
still present (a PC with a pending deadline change needs to see it),
but no longer the headline.

### Data sources (all already persisted)

| Metric | Source |
|---|---|
| Imported file name / date / status | `SelfStudyImport.originalFilename`, `.createdAt`, `.aiStatus` (the PC's imports on the submission) |
| Draft: CVs | `Submission.aiReviewState.cvs.length` |
| Draft: Syllabi | `aiReviewState.evidenceDocs` where `docSubKind === 'syllabus'` |
| Draft: Projects/Papers | `aiReviewState.evidenceDocs` where `docSubKind === 'paper'` |
| Draft: Introductions | `aiReviewState.introductions` item count |
| Draft: per-spec review items | `aiReviewState.buckets[std.spec]` → narratives + evidenceText + evidenceFiles lengths |
| Self-study: specs validated | `Submission.standardsStatus` (already computed as `pcStats`) |
| Self-study: narratives written | `Submission.narratives` non-empty count |
| Self-study: matrix rows | `CurriculumMatrix` cell count (already surfaced in the editor) |
| Self-study: evidence files | supporting-evidence file count |
| Deadline / submit readiness | `Institution.accreditationDeadline` + `pcStats` (already present) |

Everything is on the `Submission` doc (`aiReviewState`) or derivable
from data the dashboard already fetches. The only new server work is a
**dashboard-summary endpoint** that rolls these counts up server-side
so the client doesn't ship the full (potentially large) `aiReviewState`
to the landing page.

### New server endpoint

```
GET /api/submissions/:id/workflow-summary
→ {
    import: { filename, importedAt, aiStatus, fileCount } | null,
    drafts: {
      cvs, syllabi, papers, introductions,
      specItems: number,                      // total across buckets
      bySpec: [{ std, spec, count }, ...]     // only specs with count > 0
    },
    selfStudy: {
      specsValidated, specsTotal,
      narrativesWritten, matrixRows, evidenceFiles
    },
    submit: { deadline, validated, total, ready }
  }
```

Owner-PC / locked-submission auth, mirrors the existing
`/:id/review` gate. Pure read; computed from the persisted
`aiReviewState` + `standardsStatus` + the import records.

## Acceptance

**Server**
- `GET /api/submissions/:id/workflow-summary` returns the shape above. Owner-PC or admin; 403 cross-institution; 404 missing submission.
- Counts are derived, never stored — no schema change.

**Client (PC dashboard)**
- Four workflow sections render top-to-bottom: IMPORT, DRAFTS, SELF-STUDY, SUBMIT, each with a plain-English label matching CR-045.
- IMPORT shows the PC's imported file(s) with name + date + parse status; empty state "No document imported yet" with an "Open Importer" CTA.
- DRAFTS shows count tiles for CVs / Syllabi / Projects / Introductions / Spec items; a per-spec breakdown lists only specs with > 0 review items; each tile/row deep-links into the editor's Review surface.
- SELF-STUDY shows specs-validated (X/Y) + narratives/matrix/evidence counts with the existing progress bar; "Open Self-Study" CTA.
- SUBMIT shows deadline + validation + a Submit CTA (disabled until all validated) — reuses the editor's submit-readiness logic.
- Accreditation-admin panels (Change Requests, Site Visits) demoted below the workflow, collapsed by default when empty.
- Loading + empty states for each section.

**Tests**
- `server/tests/integration/...workflow-summary` — count correctness (seed a submission with known aiReviewState; assert each count); auth (owner / cross-institution 403 / unauth 401).
- `client` Dashboard unit test — renders the four workflow sections; count tiles reflect the summary payload; empty-import state; deep-link onClick fires navigation.
- `e2e/tests/35_pc_dashboard_workflow.spec.ts` — seed a submission with drafts; dashboard shows the import file + draft counts + per-spec rows; clicking a draft tile lands on the Review surface.

## Files affected

**Server**
- `server/src/controllers/submissionController.ts` (or a new `dashboardController.ts`) — `getWorkflowSummary`.
- `server/src/routes/submissions.ts` — wire `GET /:id/workflow-summary`.
- `server/tests/integration/workflow-summary.test.ts` — new.

**Client**
- `client/src/features/dashboard/Dashboard.tsx` — replace the PC branch's stat cards + panels with the four workflow sections. Add a `workflow-summary` query.
- `client/src/features/dashboard/WorkflowSummary.tsx` — **new** presentational component (the four sections), so the Dashboard file doesn't balloon.
- `client/src/features/dashboard/Dashboard.test.tsx` — new/extended.
- `e2e/tests/35_pc_dashboard_workflow.spec.ts` — new.

## Dependencies

- [[cr-045-self-study-editor-toolbar-workflow-alignment]] — **shipped**. Establishes the IMPORT/DRAFTS/SELF-STUDY/SUBMIT vocabulary this dashboard mirrors. Deep-links target the views CR-045 defined.
- [[cr-043-decouple-review-from-wizard-persist-across-reimport]] — **shipped**. The `aiReviewState` the draft counts read from is its persistence model.
- [[cr-040-appendix-papers-as-supporting-evidence-files]] / [[cr-033-cv-supporting-evidence]] — **shipped**. Produce the evidenceDocs / cvs the DRAFTS tiles count.

## Effort estimate

| Task | Machine time |
|---|---|
| Server workflow-summary endpoint + auth + tests | ~45 min |
| WorkflowSummary.tsx component (4 sections + tiles) | ~50 min |
| Dashboard.tsx PC-branch rewrite + query wiring | ~30 min |
| Dashboard unit test + E2E | ~35 min |
| **Total** | **~2 hours 40 min** |

## Open questions

All four resolved 2026-05-27 (see top of page):

1. **"Plans"** — RESOLVED: Projects == Plans, same thing. No new evidence type. "Projects" tile counts `docSubKind === 'paper'`.
2. **Per-spec breakdown** — RESOLVED: only specs with > 0 review items.
3. **Deep-link** — RESOLVED: DRAFTS tiles open the Review surface pre-filtered to that kind.
4. **Admin panels** — RESOLVED: PC-relevant panels (Change Requests + Site Visits) shown, demoted, collapsed-if-empty; non-PC content stays hidden.

## Out of scope

- Reader / Lead Reader / Admin dashboard — unchanged (their workflow is review, not authoring). This CR only touches the `isProgramCoordinator` branch.
- Real-time count updates (websocket) — counts refresh on dashboard load / the existing Refresh button. Live updates are a separate concern.

## Reference

- Current dashboard: `client/src/features/dashboard/Dashboard.tsx:442-735` (PC branch).
- Draft-count source shape: `Submission.aiReviewState` (`server/src/models/Submission.ts:79-109`).
- Validated-spec logic already in the dashboard: `Dashboard.tsx:362-384` (`pcStats`).
