---
name: CR-024 — Matrix ↔ spec bidirectional link (wizard + self-study + AI eval)
description: Clicking a spec auto-scrolls every matrix to that spec's row, both in the wizard review step and the self-study editor. A "Matrix" button appears under any spec that has matrix coverage. AI evaluation reads matrix rows alongside narrative + evidence.
type: change-request
cr_id: CR-024
status: proposed
priority: P1
source: User observation 2026-05-21 — wizard matrix step does not sync to spec selection; post-apply matrix linkage missing
sprint_target: Sprint 2B + Sprint 4
tags: [matrix, ui, wizard, self-study, ai-evaluation, hotlink]
last_reviewed: 2026-05-21
---

# CR-024 — Matrix ↔ spec bidirectional link

## Summary

Today the wizard's matrix view shows the full Human Services Courses matrix and Non-Human Services Courses matrix one after the other, top-to-bottom. When a coordinator clicks Standard 13.a in the spec rail, the matrix area does not scroll to row 13.a — the coordinator has to find it manually in a 79-row table, then repeat for the second matrix. The standards editor already has `scrollToSpec` plumbing ([[ai-import-stevenson-matrices-2026-05-19]] shipped this for Standards 11-21), but the wizard review step and the post-apply linkage are missing.

The webinar reinforced that matrices are first-class content. The board reads matrix coverage right next to narrative + evidence when deciding compliance. The system should treat matrix rows as another signal type — equal weight to narrative and evidence — and link them bidirectionally so the coordinator and reader both see "this is the matrix evidence for this spec" without scrolling.

## Source quotes

User, 2026-05-21:

> "When I am display a matrix and I click on the Standard that requires a matrix, I expect to see the matrix displayed where the standard label in the matrix is shown. I expected the matrix doc to automatically scroll down and show the matrix at that standard. Clicking on Standard 11 should show the first matrix. Clicking on standard 21 should show the rows where Standard 21 is labeled. Etc. Both the matrices (human services and non-human services) should be displayed at the correct label."

> "Put a Matrix button under the standard that contains a matrix. Once the content is moved over to the self study editor, this matrix will be hotlinked (via document links for the full document, and display linked to the section in the self study editor). When the standard and substandard is evaluated, any document links is evaluated along with the narrative and supporting evidence, and document."

## Decision

Three deliverables, split across two sprints:

### Sprint 2B — Wizard matrix sync (UI only)

1. **Spec-click syncs matrices.** In the wizard review step, clicking a spec in the rail scrolls EVERY matrix in the matrix view to that spec's row and flash-highlights it. Both matrices scroll independently and simultaneously.
2. **"View in matrix" button per spec.** When a spec has matrix coverage (one or more rows tagged to it across any matrix), a "Matrix" affordance appears on the spec card (rail + center pane). Click → switches to the Matrices view at the row.
3. **Sticky standard label in matrix view.** As the matrix scrolls, the standard heading at the top of the row group ("Standard 11", "Standard 12", …) stays pinned so the coordinator knows where they are.

### Sprint 4 — Post-apply matrix hotlink + AI evaluation

4. **Persistent matrix hotlink.** After Apply, every spec in the self-study editor that has matrix coverage shows a "Matrix" link in the breadcrumb area. Click → opens the curriculum-matrix editor scrolled to that row (this already exists for Standards 11-21 but is not consistent across all matrix-tagged specs).
5. **Document-level hotlink to source.** The matrix view also exposes a "Source document" link that opens [[ShowInSourceModal]] at the matrix's original `<table>` location in the imported DOCX.
6. **AI evaluation reads matrix rows.** When the reader-review AI ([[cr-018-ai-evidence-review-via-cshse-ai]]) scores a spec, the prompt includes the matrix row(s) tagged to that spec alongside the narrative + evidence-text + evidence-file content. Output rationale cites the matrix row explicitly when it informed the score.

## Acceptance

### Sprint 2B half

- [ ] In the wizard review step, clicking any spec in the rail scrolls every visible matrix to its row for that spec.
- [ ] The scrolled-to row flash-highlights for 1.5 s (matching the existing CurriculumMatrixEditor flash).
- [ ] If a spec has no matrix coverage in either matrix, no scroll happens (don't jump to a blank view).
- [ ] A "Matrix" button is visible on every spec card where matrix coverage exists; clicking it switches to the Matrices view and scrolls to the row.
- [ ] Standard headings ("Standard 11", …) stay sticky as the matrix scrolls.

### Sprint 4 half

- [ ] After Apply, every spec in the self-study editor with matrix coverage shows a "Matrix" link in its header.
- [ ] Clicking the link opens the curriculum-matrix editor scrolled to the row (using the existing `scrollToSpec` + `matrixScrollTarget` plumbing).
- [ ] A "Source document" link opens [[ShowInSourceModal]] at the row's original `<table>` anchor in the DOCX.
- [ ] When AI evaluates a spec (per [[cr-018-ai-evidence-review-via-cshse-ai]]), the prompt includes any matrix row tagged to that spec.
- [ ] The AI's rationale references the matrix row explicitly when it influenced the score (e.g., "Matrix row 13.a shows coverage in CHS 380 and CHS 441 …").
- [ ] An evaluation that ignores a matrix row when narrative + evidence are weak is treated as a model error in test cases.

## Files affected

### Sprint 2B half (UI only)

- `client/src/features/selfStudy/Editor/AIImport/review/MatrixView.tsx` (or current path) — accept `selectedSpecKey` prop + scroll-to-row + flash on change
- `client/src/store/aiImportStore.ts` — when `selectMatrixRow` or `setSelectedKey` fires, both matrices get the same anchor. Already has `selectedMatrixRowAnchor`; extend so spec-rail clicks dispatch it.
- `client/src/features/selfStudy/Editor/AIImport/review/SpecRail.tsx` — spec-button click dispatches matrix-scroll anchor in addition to selecting the spec
- `client/src/features/selfStudy/Editor/AIImport/review/ItemCardList.tsx` — render a "Matrix" button on spec cards with matrix coverage
- `client/src/features/selfStudy/Editor/AIImport/review/MatrixHeading.tsx` — add `position: sticky` to standard heading rows

### Sprint 4 half (eval + persistence)

- `server/src/models/SelfStudyImport.ts` — already has `aiMatrices` with row anchors; verify shape persists through `applyAIImport`
- `server/src/controllers/aiImportController.ts` — confirm `aiMatrices` survives apply; populate `CurriculumMatrix.rawContent[]` row anchors (already done per `4c37e68` summary — verify regression-free)
- `client/src/features/selfStudy/Editor/SelfStudyEditor.tsx` — extend "View in matrix" affordance from Standards 11-21 to every spec with matrix coverage (currently hardcoded range)
- `client/src/features/selfStudy/Editor/SelfStudyEditor.tsx` — add "Source document" link per spec when `aiMatrices[].rowAnchor` is present
- `ai-service/app/evidence/score.py` (new, from [[cr-018]]) — accept `matrix_rows: list[MatrixRow]` in scoring payload; include verbatim in Haiku prompt
- `server/src/services/cshseAiClient.ts` — `scoreEvidenceAgainstSpec(specId)` builds payload that pulls `aiMatrices` rows tagged to the spec and passes them through

## Test plan

### Sprint 2B

- **Client unit:** `MatrixView` scrolls when `selectedSpecKey` changes; flash class applied + removed after 1.5 s.
- **Client unit:** spec-rail click dispatches both `setSelectedKey` and `selectMatrixRow`.
- **E2E:** Wizard review → click spec 11.a → both matrices scroll + flash row 11.a. Click 13.a → matrices scroll to 13.a. Click 9.c (no matrix) → no scroll, no error.

### Sprint 4

- **Integration:** Apply wizard output → reload editor → "Matrix" link appears on every spec with `aiMatrices` row coverage.
- **Integration:** AI scoring payload for a spec includes matrix-row text when coverage exists.
- **Unit (ai-service):** Haiku prompt structure when `matrix_rows` is non-empty includes a dedicated `<matrix>` section before `<narrative>` and `<evidence>`.
- **E2E:** Reader views compilation, drills into Standard 13.a, clicks "Matrix" → matrix editor opens scrolled to row 13.a. Clicks "Source document" → modal opens at original `<table>` location.

## Dependencies

- **Sprint 2B half:** Already-shipped `aiMatrices` + `selectMatrixRow` store action (commit `5ad2efb` + `dc93689`). Pure UI work.
- **Sprint 4 half:** Depends on [[cr-018-ai-evidence-review-via-cshse-ai]] (the AI scoring endpoint exists). Read-only on the data; no schema change.

## Open questions

- Should the "Matrix" button appear on the spec rail itself, or only on the spec card in the center pane? **Decision: both.** Rail gets a small grid icon; card gets a full "Matrix" button. Avoids hunting.
- For specs in multiple matrices (rare — usually one matrix per program level), do we scroll to the first match or both? **Decision: scroll both.** The review pane already shows matrices stacked; both scrolls happen in parallel.
- Should AI evaluation weight matrix rows higher than narrative? **Decision: equal weight.** Matrix is one of four signals; the rubric scorer adjudicates the totality. Defer differential weighting to a future CR if readers ask for it.
