---
name: CR-026 — Matrix correction: verify-in-context preview + per-row move/remove controls
description: When the AI suggests a matrix correction (CR-025 column inference, or future row inference), the PC must see the suggested change in the context of the full matrix with the affected row highlighted, and have controls to re-tag the row to a different spec, move it up/down, or remove it. Verification is mandatory before the correction is persisted.
type: change-request
cr_id: CR-026
status: proposed
priority: P0
source: User observation 2026-05-21 — CR-025 suggestions must be verified in context; PC needs row-level manipulation
sprint_target: Sprint 2B
tags: [matrix, verification, wizard, ux, ai-correction]
last_reviewed: 2026-05-21
---

# CR-026 — Matrix correction: verify-in-context preview + per-row move/remove controls

## Summary

[[change-requests/cr-025-ai-matrix-column-inference]] adds AI-suggested column → course mappings. But the PC must verify those suggestions before they're persisted — the AI will be wrong some of the time, and a wrong column mapping silently distorts every row that uses that column. The current Matrix step shows columns and rows in a flat table; there's no way to ask "what would this matrix actually look like if I accepted the AI's suggestion?"

Two verification gaps need to close:

1. **Context preview.** When the AI suggests a correction (column → course, or a row re-tag), the PC needs to see the entire matrix for that standard + sub-spec with the affected row highlighted as the proposed correction. The PC should be able to read across the row, see neighboring rows, and confirm the suggestion makes sense in the surrounding context — not just see the suggestion in isolation.

2. **Per-row controls.** When the AI places a row against the wrong spec (or the wrong column maps to the wrong course on that row), the PC needs to fix the row directly: re-tag it to a different spec ("move up/down" semantically), or remove it from the matrix entirely. Today's UI has no per-row affordance — the PC can only edit column headers globally.

Both gaps share the same UX surface: a per-spec matrix-preview pane that doubles as the verification + row-edit screen.

## Source quotes

User, 2026-05-21:

> "I like these changes, however the results must be verified by the PC. so how would the user verify where this is? Could there be a screen showing the entire matrix for that standard and subspec with the row highlited inside the matrix as suggested correction? This allows the PC to see what the corrected result looks like within the context of the matrix. Then the user could suggest move the row up/down/or remove. add that to the sprint"

## Decision

### 1. Verify-in-context preview pane

Add a third pane to the Matrix step (alongside the existing column inputs + the cell-table view): a **"Preview corrected matrix"** drawer. When the PC clicks any AI suggestion (column → course mapping in S2B.7, or any flagged row), the drawer opens showing:

- Header: spec code + standard title (e.g., "13.a — Knowledge, Theory, Skills, and Values")
- The full matrix table rendered as the PC would see it post-apply, with the AI's suggested change applied locally (not persisted yet)
- The affected row highlighted (amber outline + flash on open)
- Neighboring rows visible above + below for context (sticky standard headings per [[change-requests/cr-024-matrix-spec-bidirectional-link]])
- Footer: "Accept correction" + "Reject" + "Edit manually" buttons

The drawer is read-only EXCEPT for the row-level controls (next section). The PC's accept-or-reject decision is the verification gate; nothing is persisted until they accept.

### 2. Per-row controls

On every row in the preview pane (and in the main matrix cell-table when a row is selected):

- **"Move to different spec"** dropdown — re-tag the row to a different spec code (11.a → 11.b, etc.). Updates the row anchor (`id="matrix-{slug}-row-{std}-{spec}"`) and the spec-bucket assignment.
- **"Remove from matrix"** button — drop the row from this matrix's wire format entirely. Confirmation dialog: "This row will not be saved when you apply. The source document still has it; you can re-add it later from the curriculum matrix editor."
- **"Restore"** button — only visible on removed rows during the same wizard session; reverses the remove.

The "move up/down" semantics the user described maps to **"re-tag to a different spec"** — the visual order in the matrix is driven by spec ordering, so moving a row "up" means re-tagging it to a lower-numbered spec. The UI label clarifies this with a hover tooltip: "Move this row to a different spec — its position in the matrix follows the spec order."

### 3. Suggestion-source surfacing

Every AI suggestion in the preview pane shows a "Why this?" expandable rationale (the same one the inference endpoint returned). The PC sees:

- The merged-cell header text mammoth missed (if that was the source)
- The surrounding narrative excerpt that named the course (if that was the source)
- The RAG-retrieved prior-mapping from this institution (if that was the source)
- The Haiku confidence + a one-sentence summary

This converts "the AI says it's CHS 105" into "the AI says it's CHS 105 because row 2 of the merged-cell header reads 'CHS 105 — Human Services and Social Policy'" — which is verifiable.

### 4. Audit trail

Every accept / reject / row-move / row-remove is recorded as a correction event (extending the existing [[change-requests/cr-024-matrix-spec-bidirectional-link]] precursor corrections infrastructure shipped in `af81f7f`). The event payload includes:

- `correction_type`: `accept_column_suggestion` | `reject_column_suggestion` | `row_retag` | `row_remove` | `row_restore`
- `before` + `after` state
- `ai_rationale` (if the action was on an AI suggestion)
- `pc_reason` (optional free-text — required only on `row_remove`)

These flow into the same `cshse_corrections_{env}` Qdrant collection that already feeds future imports. Row-level corrections improve future row-tagging the same way column-level corrections improve future column inference.

## Acceptance

### Preview pane

- [ ] Clicking any AI column suggestion opens the "Preview corrected matrix" drawer
- [ ] Drawer shows the full matrix with the suggested column mapping applied locally
- [ ] Affected row is amber-highlighted + flashes for 1.5s on open
- [ ] Neighboring rows above + below visible with sticky standard headings
- [ ] "Why this?" rationale expandable per suggestion
- [ ] Accept → persists; Reject → discards; Edit manually → switches to the existing column-input free-text fallback
- [ ] Drawer can be closed without affecting the underlying matrix state

### Row controls

- [ ] Every row in the matrix has a "Move to different spec" dropdown + "Remove from matrix" button
- [ ] "Remove" requires confirmation and shows the source-document fallback ("you can re-add this later")
- [ ] Removed rows can be restored within the same wizard session
- [ ] Re-tagging a row updates its anchor (`id` attribute) + spec-bucket assignment
- [ ] Re-tagging does not corrupt other rows in the same matrix

### Audit trail

- [ ] Every accept / reject / re-tag / remove / restore is recorded as a correction event
- [ ] Events flow into `cshse_corrections_{env}` keyed by institution
- [ ] A second import for the same institution surfaces prior corrections as additional RAG hints to the AI

### Test plan

- Client unit: drawer open/close, row-control state machine, restore-after-remove
- Client integration: accept a column suggestion → row anchor updated, dropdown saved, store action fired
- E2E: PC reaches Matrix step → AI suggests Col 4 = CHS 105 with 0.92 confidence → PC clicks suggestion → preview drawer opens → PC reads context, sees "Why this?" rationale (merged-cell header excerpt) → accepts → drawer closes → matrix shows CHS 105 in Col 4 → PC then re-tags row 13.a to 13.b → row moves down → PC removes row 13.b → confirmation → row hidden → PC restores → row reappears → apply → matrix is saved correctly with all PC adjustments

## Files affected

### client

- `client/src/features/selfStudy/Editor/AIImport/steps/MatrixStep.tsx` — drawer mount, row-control wiring
- `client/src/features/selfStudy/Editor/AIImport/steps/MatrixPreviewDrawer.tsx` (new) — the verify-in-context preview
- `client/src/features/selfStudy/Editor/AIImport/steps/MatrixRowControls.tsx` (new) — move-spec dropdown + remove + restore
- `client/src/store/aiImportStore.ts` — `retagRow(matrixSlug, rowAnchor, newSpec)`, `removeRow(matrixSlug, rowAnchor)`, `restoreRow(matrixSlug, rowAnchor)`, `acceptColumnSuggestion`, `rejectColumnSuggestion`, all writing correction events

### server

- `server/src/controllers/aiImportController.ts` — handle row-level corrections in `applyAIImport`; persist into `aiMatrices` row anchors + spec-bucket assignments
- `server/src/services/cshseAiClient.ts` — `recordCorrection(event)` — already exists from `af81f7f`; extend payload schema to include row-level events

### ai-service

- `ai-service/app/corrections/store.py` — extend `ingest_correction` to accept the new `correction_type` values; surface row-level corrections in future-import RAG (currently only column-level)

## Dependencies

- [[change-requests/cr-025-ai-matrix-column-inference]] — provides the suggestions that need verifying
- [[change-requests/cr-024-matrix-spec-bidirectional-link]] — provides the sticky standard headings + row-anchor scrolling the preview uses
- Existing corrections store (commit `af81f7f`) — extended here to support row-level events

## Open questions

- Should the preview drawer be a side panel or a full-screen modal? **Decision: side panel.** Coordinator needs to compare the suggestion against the column inputs on the main pane; full-screen would hide that context.
- Can the PC drag-and-drop rows to re-tag? **Decision: no, dropdown only for v1.** Drag-and-drop adds DnD library scope without a meaningful UX win — the dropdown is two clicks, the drag would be one. Defer.
- What about bulk accept of all high-confidence AI suggestions? **Decision: yes, add an "Accept all green" button at the top of the column-inputs pane.** Lets PC fly through the 8-10 columns the AI got right at >0.85 with one click, then verify the yellow/red ones individually.
- Does removing a row in the wizard also remove it from the post-apply CurriculumMatrix doc? **Decision: yes.** Removal is a PC-authoritative decision. Source document still has the row; the PC can re-add via the standards editor matrix editor (already exists) if they change their mind.
