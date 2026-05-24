---
name: CR-035 — "Keep this row" populates the structured Curriculum Matrix at the matching spec row
description: When the coordinator clicks "Keep this row" on the wizard's Matrix step, the row's full structured cell data from the original document (course codes per column — I, T, K, S, L/M/H combinations) must land in the Self-Study's Curriculum Matrix at the spec the row belongs to. Today "Keep" appears to be a no-op that just accepts AI routing; the structured cells may not be written through to the CurriculumMatrix MongoDB collection. This CR closes that gap so what the coordinator sees in the wizard's "row in your original document" preview is byte-for-byte what shows up on the Curriculum Matrix tab post-Apply.
type: change-request
cr_id: CR-035
status: shipped
priority: P0
source: User observation 2026-05-22 on the Spec 11.b row in the Matrix step. User expected "Keep this row" to write the original document row (e.g. course codes "I,KM" in col 2, "KM" in col 4, "ITKSH" in cols 8/9/10, "KM" in col 11, "I,KM" in col 12) into the Curriculum Matrix viewable on the Self-Study editor's "Curriculum Matrix" tab. User is not certain this happens today and wants the fidelity guaranteed.
sprint_target: Sprint 4 (post-demo) — schedule immediately, do NOT touch during demo
tags: [wizard, matrix, apply, curriculum-matrix, fidelity, p0]
last_reviewed: 2026-05-24
---

# CR-035 — "Keep this row" populates the Curriculum Matrix

## Source quote

User, 2026-05-22 (looking at the Matrix step for Spec 11.b — historical roots of human services):

> "I am not clear on the modifications to the matrix that will be made. The original row has the correct items from the row columns, so if i select keep this row, will the original row that is displayed which is correct, be used to replace the curriculum matrix at that row? My expectation is that it would do just that and i will see that row (with the course labeled in the first column) be in the curriculum matrix in the imported matrices in the review panel. If not, this needs to happen."

## The expectation in one sentence

When the wizard's Matrix step shows me the original row from my uploaded document and I click "Keep this row," the **exact same row** — first-column label plus every column's course code (I / T / K / S / L / M / H combinations) — must appear in the post-Apply Self-Study Editor's **Curriculum Matrix** tab at the spec that row was routed to.

## What we know about today's behavior

From `client/src/features/selfStudy/Editor/AIImport/steps/MatrixStep.tsx` and `client/src/store/aiImportStore.ts`:

- The Matrix step renders three actions per row:
  1. **Keep this row** — appears to be a **no-op**. There is no `keepMatrixRow` action in the store, and the button click handler doesn't write any `matrixRowEdits` entry. The AI's already-inferred subspec routing is implicitly accepted.
  2. **Remove this row** — writes `matrixRowEdits[matrixId|rowAnchor] = { kind: 'remove' }`.
  3. **Retag to different subspec** — writes `matrixRowEdits[matrixId|rowAnchor] = { kind: 'retag', newStd, newSpec }`.
- At Apply time, `apply()` reads `matrixRowEdits` and **forwards remove + retag edits** to the server. Plain-keep rows ride along by absence-of-edit.
- The Review screen "surfaces kept matrix rows under their resolved subspec" (per task #4 in the completed task list). What's surfaced is a **CardItem of kind `'matrix'`** in `ItemCardList.tsx` — i.e. a card with the row's preview text.

What is **not verified**, and what this CR demands we verify and fix if broken:

- Whether `apply()` writes each kept matrix row's structured cell data into the `CurriculumMatrix` MongoDB collection (`server/src/models/CurriculumMatrix.ts`).
- Whether the cell-by-cell course codes from the original document table are preserved (not just the spec label).
- Whether the Self-Study Editor's **Curriculum Matrix** top-nav tab, post-Apply, displays a row for spec 11.b containing exactly the cells the wizard previewed.

The user can see the original row in the wizard preview pane. Anything less than the same cells in the Curriculum Matrix tab post-Apply is a fidelity break.

## Open investigation (do this first, before coding)

A ~2-hour read-only investigation. Output is a short note appended to this CR.

1. Inspect `server/src/controllers/importController.ts` apply path — search for `CurriculumMatrix` writes during an import-apply.
2. Inspect `client/src/store/aiImportStore.ts` `apply()` — what payload does it send for matrices? Is each kept row included with its cell data?
3. Inspect `ai-service/app/splitter/deep_walker.py` (and friends) — does the matrix extractor preserve cell-by-cell course-code text per row in the `MatrixData` it emits, or is the row reduced to a header + flat text?
4. Manually drive a fresh import → click Keep on a single row → Apply → open the Self-Study Editor's Curriculum Matrix tab → eyeball whether the codes match the wizard preview.

Three possible outcomes:

| Outcome | What it means | Fix scope |
|---|---|---|
| **A. Apply already writes structured cells** | Today's "Keep this row" already does what the user expects; we just lack a visible confirmation | Add a "Verify in Curriculum Matrix" link on the kept-matrix card + close this CR |
| **B. Apply writes the row label but flattens cells** | Course codes lost; row arrives in CurriculumMatrix as text instead of structured cells | Mid-size fix — extend the apply payload, extend the CurriculumMatrix write logic, preserve the cell array |
| **C. Apply doesn't write the row at all** | Kept rows surface on Review as cards but never become structured CurriculumMatrix entries | Largest fix — build the missing apply branch end-to-end |

This CR's effective scope is **whichever of B or C the investigation lands on**, or **outcome A's "add the verify link"** if we're already correct.

## Required behavior (the fix target)

Regardless of which of B / C the investigation finds, the end state is:

1. The wizard's `MatrixData` payload, emitted by `ai-service`, includes for every detected row:
   - `row_anchor` (already exists)
   - `row_label` (the first-column text — "The historical roots of human services" in the screenshot)
   - `cells: Array<{ column_index: number; column_header?: string; value: string }>` — every original column's value preserved verbatim. `value: 'I,KM'`, `value: 'ITKSH'`, etc. Empty cells get `value: ''` (not omitted) so column alignment is preserved.
   - `resolved_std` + `resolved_spec` (already inferred by the matrix-column inference CR-025)
2. The wizard store retains `cells` on every matrix row carried through to apply.
3. `apply()` sends a payload that includes, per kept row: `{ row_anchor, row_label, cells, resolved_std, resolved_spec, matrix_type }`.
4. The server's apply handler either creates or updates a `CurriculumMatrix` document for the submission, and writes the row's cells into the appropriate row of that matrix.
   - If a row for this spec already exists (multi-import case), the user is prompted: "A row for spec 11.b already exists in your Curriculum Matrix. Replace, merge, or keep both?" — default Replace.
5. Post-Apply, the Self-Study Editor's Curriculum Matrix tab shows the spec's row with cells matching the wizard preview byte-for-byte.

**Retag interaction:** if the coordinator retags a row to a different subspec, the cells follow the row — they end up in the new subspec's Curriculum Matrix row, not the original.

**Remove interaction:** removed rows do NOT write to the Curriculum Matrix.

## UI affordance (small, additive)

On the Matrix step, alongside the existing `Keep this row` / `Remove this row` / `Retag` buttons, add a passive confirmation line under the row preview:

> ✓ Keeping this row will populate **Curriculum Matrix → Spec 11.b** with the cells above.

This sets the coordinator's expectation explicitly before they click Keep. Tooltip on the kept-row card in Review:

> Cells from this row will land in the Curriculum Matrix at spec 11.b on Apply.

## Acceptance criteria

1. Investigation note appended to this CR within 24 hours of pickup, documenting which of outcomes A / B / C is current reality.
2. After the fix, a fresh import → Matrix step → Keep three different rows under three different specs → Apply → opening the Self-Study Editor's Curriculum Matrix tab shows three rows with cell values matching the wizard's previews exactly.
3. A retag of a row to a different subspec moves that row's cells to the retag target.
4. A remove of a row results in NO row in the Curriculum Matrix for that spec.
5. The Matrix-step UI shows the "will populate Curriculum Matrix → Spec X.Y" confirmation line under each row preview.
6. Existing CR-029 invariants (Removed-rows section, Restore, hard-refresh persistence) remain intact.
7. New E2E spec `10_review_matrix.spec.ts` (planned in [[../ai-import-wizard-e2e-regression-plan-2026-05-22]]) extended to assert post-Apply Curriculum Matrix fidelity.

## Out of scope

- Matrix column-header inference (already covered by CR-025).
- Editing cell values in the wizard (cells are read-only; coordinator edits the Curriculum Matrix post-Apply).
- Multi-matrix merge UX beyond the simple Replace/Merge/Keep-both prompt above.
- Migrating prior imports that landed without structured cells — too risky, leave them be.

## Risk

- **Data loss on re-import.** If a coordinator imports twice, the second Apply could overwrite Curriculum Matrix rows. Mitigated by the Replace/Merge/Keep-both prompt on per-row conflict.
- **Empty-cell drift.** Some columns are intentionally blank. The `value: ''` rule preserves alignment but reviewers should confirm blanks render as blanks, not as missing.
- **Column-count mismatch** between matrices of different degree levels (Associate vs Baccalaureate vs Master's). The `column_index` field handles this; column headers should be sourced from the standards definition for the degree level.

## Engineering size

Pending the investigation outcome:

- **A (today is correct):** S — half a day for the verify-link UI.
- **B (cells flattened):** M — ~2 days for the payload + write-path + UI.
- **C (no write at all):** L — ~4 days end-to-end.

## Schedule

**Do not touch during the live demo.** Pick this up at the start of Sprint 4. Investigation note first; only then size and schedule the fix.

## Related

- [[cr-025-ai-matrix-column-inference]] — column-header inference dependency.
- [[cr-026-matrix-correction-verify-in-context]] — verify-in-context preview already implemented; this CR makes the "verify" go all the way through Apply.
- [[cr-029-matrix-step-redesign-simple]] — the parent redesign that put Keep/Remove/Retag on each row.
- [[../ai-import-wizard-e2e-regression-plan-2026-05-22]] — section "Step 4 — Matrix" and "Step 6 — Apply" must add post-Apply Curriculum Matrix fidelity assertions.
