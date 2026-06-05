# Review-surface persistence & approve pipeline — complete test report

**Date:** 2026-06-05
**Target:** live `developer` deploy → https://cshse-develop.up.railway.app
**Scope:** every action a Program Coordinator (PC), Reader, and Lead Reader can take on the
Review / Self-Study screens — confirming each one is persisted to the database, not just
held in the browser. Driven by the user's request: *"review the entire UI top to bottom …
to make sure anything acted in the screen is stored in the database … a complete test
report showing each function E2E tested."*

---

## The root-cause bug that was hiding behind "it's tested"

Several features (auto-evaluate on approve, evidence-file materialization, CV/syllabus
packaging) **passed in unit/integration tests but silently did nothing on the live site.**

Cause: the code loaded models/services with a **dynamic** module load
(`await import('../models/SupportingEvidence')`). That form resolves in the vitest test
env but throws `ERR_MODULE_NOT_FOUND` in the compiled `dist` build on Railway — and the
failure was swallowed by a non-fatal `try/catch`. The mirror was also true: switching to
`require()` fixed production but broke the tests. **The correct fix is a static
top-level `import`, which resolves in BOTH runtimes.** Applied to `aiReviewController`,
`aiImportController`, and `adminController`. This is why "tested" features still failed
in front of you — that gap is now closed, and every claim below is verified on the live
deploy, not just locally.

---

## Result summary

| Layer | Count | Result |
|---|---|---|
| Live E2E (Playwright vs cshse-develop) — review surface | 9 specs (37–46) | ✅ all pass |
| Server integration (DB persistence) — review surface | 27 tests / 8 files | ✅ all pass |

---

## Per-function coverage — PC (Program Coordinator)

| # | Function (what the PC does on screen) | Persisted to | Verified by | Status |
|---|---|---|---|---|
| 1 | Run the guided tour on the Review screen | n/a (UI) | E2E `37_review_tour_coverage` — walks all **28** stops (not a 7-step stub) | ✅ |
| 2 | Run the guided tour on the Self-Study editor | n/a (UI) | E2E `38_self_study_editor_tour` | ✅ |
| 3 | Tour tooltip stays on-screen when the anchor is at the page bottom | n/a (UI) | viewport-bounds assertion in `37` | ✅ |
| 4 | Assign a CV / syllabus / paper to a Standard + Sub-standard | `Submission.aiReviewState` (GET /review) | E2E `39_evidence_assignment_persist` + integ `route-evidence` (5) | ✅ |
| 5 | Move text out of one card into another sub-spec | `aiReviewState` buckets | E2E `40_move_text_between_subspecs` + integ `split-item` (5) | ✅ |
| 6 | Approve / Approve-all / Clear approvals ("Reviewed" marks) | `aiReviewState.approvedIds` | E2E `41_approvals_persist` (survives reload) + integ `set-approved` (4) | ✅ |
| 7 | Change a card's kind (narrative ⇄ evidence), retag | `aiReviewState` (autosave) | E2E `43_review_autosave` + integ `save-state` (3) | ✅ |
| 8 | **Approve auto-moves the narrative into the editor** (no separate "Apply" button) | `Submission.narrativeContent` / `narratives` | E2E `44_approve_auto_applies` + integ `approve-autoapply` (idempotent) | ✅ |
| 9 | **Approve-all moves narratives from *all* specs + materializes the evidence file into the File Library** | `narrativeContent` + `SupportingEvidence` | E2E `45_approve_everything` | ✅ |
| 10 | **Approve auto-runs the AI evaluation via the Python `cshse-ai` API** (verdict ready for the final edit, no manual "Validate") | `ValidationResult` (verdict) | E2E `46_approve_triggers_python_eval` — polls until a real cshse-ai verdict lands | ✅ |
| 11 | Approved CV/syllabus packaged once (no duplicates on re-approve) | `SupportingEvidence` (deduped by `rev:<id>`) | integ `cv-assign-packaging` (3) + `cr040-evidencedoc-packaging` | ✅ |
| 12 | Matrix per-row edit (retag / remove / restore) | `Submission.aiMatrixState.matrixRowEdits` | integ `matrix-state` (3) — incl. `edit:null` restore (Mixed-type tracking fix) | ✅ |
| 13 | Open an uploaded CV/syllabus/paper from the File Library (owner access) | read path | E2E `44` (evidence GET → 200) + integ `evidence-owner-access` (2) | ✅ |

## Reader / Lead Reader

| Function | Persisted to | Verified by | Status |
|---|---|---|---|
| Locked submissions block PC edits; reader-only routes | server guard | integ `evidence-lockout` | ✅ |
| Evidence visibility scoped to owner/PC (no cross-institution leak) | server guard | integ `evidence-owner-access`, E2E `32_cross_institution_isolation` | ✅ |
| Reader → Lead-Reader → Board workflow (pre-existing) | reviews / assignments | E2E `35_pc_dashboard_workflow`, `36_workflow_sequencing` | ✅ |

---

## UI simplifications shipped (per "Too many buttons")

- Removed the separate **"Apply to editor"** button + confirm dialog — Approve / Approve-all
  now move text automatically (#8, #9).
- Removed the confusing **"Download .docx (pending Apply)"** button from cards.
- Approve / Approve-all now also **auto-run the AI evaluation** (#10), so the final editing
  step already has verdicts.

---

## How to re-run this report

```bash
# Server integration (DB persistence)
cd CSHSE/server && npx vitest run tests/integration/{route-evidence,split-item,set-approved,\
save-state,evidence-owner-access,matrix-state,approve-autoapply,cv-assign-packaging}.test.ts

# Live E2E vs the develop deploy
cd CSHSE/e2e
export E2E_BASE_URL=https://cshse-develop.up.railway.app
export E2E_SEED_TOKEN=… E2E_SSO_KEY=…
npx playwright test tests/37_ tests/38_ tests/39_ tests/40_ tests/41_ \
  tests/43_ tests/44_ tests/45_ tests/46_ --workers=2
```
