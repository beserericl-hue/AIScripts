---
name: AI Import — Stevenson Matrices Smoke Test 2026-05-19
description: End-to-end smoke test of the new matrix-as-first-class-entity slice against the real 353 MB Stevenson self-study HTML — verifies the wizard's matrix extractor finds both CSHSE matrices, injects per-row anchors, and stops leaking matrix rows into individual spec cards.
type: review
tags: [ai-import, sprint-1, stevenson, matrices, smoke-test, audit]
audit_date: 2026-05-19
auditor: claude
last_reviewed: 2026-05-19
---

# AI Import — Stevenson Matrices Smoke Test (2026-05-19)

Smoke test for the matrix-as-first-class-entity work landed in `5ad2efb`. Two defects from the [[ai-import-wizard-preview-stevenson-2026-05-18|prior Stevenson run]] motivated the change:

1. **Data tables flattened to monospace text** in the review pane — the user wanted `<table>` HTML preserved so they can see actual rows and columns.
2. **Curriculum matrix rows polluting individual spec cards** — the matrix tables were being chopped up by deep_walker and assigned to whichever spec each row most resembled, fragmenting the matrix into noise.

The fix turns matrices into one entity per CSHSE anchor (`MatrixHSR` + `Matrix2`), with per-row anchor ids so the wizard's spec cards can deep-link to the exact row.

## Stage 1 — Offline pipeline tests (in CI)

5 new integration tests against a Stevenson-shaped fixture in [ai-service/tests/test_matrix_pipeline_integration.py](../../ai-service/tests/test_matrix_pipeline_integration.py):

- `test_pipeline_suppresses_matrices_from_deep_walker_output` — both matrices skipped, the non-matrix faculty roster still surfaces.
- `test_pipeline_extracts_both_matrices_with_anchors` — `MatrixHSR` (21 cells) + `Matrix2` (12 cells) detected.
- `test_pipeline_row_anchors_are_addressable_per_spec` — every spec the wizard renders a button for has a matching `<tr id="…">` in the HTML.
- `test_pipeline_cells_carry_full_metadata` — `columnHeader`, `contentTypes`, `depth`, `rowAnchor` all round-trip.
- `test_pipeline_faculty_roster_still_emerges_as_normal_section` — non-matrix data tables still flow as deep_walker sections.

Plus 4 wire-format unit tests in [test_matrix_wire_format.py](../../ai-service/tests/test_matrix_wire_format.py) and an updated [test_deep_walker.py](../../ai-service/tests/test_deep_walker.py) curriculum-matrix test that locks the new `skip_matrices=True` default.

Full gate run: Python **135 passed / 4 skipped**, server vitest **38 passed**, client vitest **29 passed / 2 skipped**, client tsc **clean**.

## Stage 2 — Offline smoke test along the S3 → mammoth → extractor path

Script: [ai-service/scripts/smoke_test_stevenson_matrix.py](../../ai-service/scripts/smoke_test_stevenson_matrix.py)

Same flow the wizard worker takes: pulls the source DOCX directly from Tigris S3 via `_resolve_s3_to_local` (the production code path), runs mammoth → HTML, then deep_walker + `build_wire_matrices`. No GridFS shortcut — this proves the bytes that came back from S3 produce the right matrices.

| Step | Result |
|---|---|
| S3 download (`versioned/submission/.../v1/2024_CSHSE_Self-Study_Stevenson_University.docx`) | **13.3 MB DOCX in 0.8s** |
| mammoth → HTML | **353.0 MB in 15.0s** |
| `deep_walk(skip_matrices=True)` | **182 sections in 4.0s**, **0 `table_curriculum_matrix` leaks** |
| `build_wire_matrices()` | **2 matrices in 11.5s**, both `<table>` tags consumed |
| MatrixHSR | 395 cells, 10 standards covered |
| Matrix2 (Non-HS) | 42 cells, 8 standards covered |
| **Total** | **437 matrix cells** vs. **0** before this commit |
| Row anchor verification | All sampled `id="matrix-{slug}-row-{std}-{spec}"` present in `htmlSnippet` |
| Wire metadata | `columnIndex`, `columnHeader`, `codeRaw`, `contentTypes`, `depth`, `rowAnchor`, `confidence` all populated |

## Stage 3 — Live wizard pipeline run on deployed cshse-ai (e6c51a8)

Script: [ai-service/scripts/smoke_test_live_wizard.py](../../ai-service/scripts/smoke_test_live_wizard.py)

Kicks off a fresh `/ai/import/start` job against `cshse-ai-develop.up.railway.app` with a synthetic `importId` pointing at the same Stevenson S3 source. Polls the snapshot endpoint until terminal state. Does NOT touch any existing SelfStudyImport records.

| Stage | Wall time | Result |
|---|---|---|
| download_s3 | 0.8s | 13.3 MB DOCX from Tigris |
| format_detect | <1s | `self_study` (confidence 1.00) |
| mammoth | 15s | 352.98 MB HTML |
| deep_walker | ~15s | 557 sections (down from 564 pre-fix — matrices suppressed correctly in production) |
| matcher | ~2.5 min | 557 / 557 classified |
| coverage_review | ~1 min | 86 specs reviewed |
| **matrix_extract** | **15s** | **2 matrices, 437 cells, 0 errors** |
| gap_fill | skipped | deferred to sub-sprint 1.b |

**Final snapshot from cshse-ai:** `status: parsed, errors: []`, `matrices.length: 2`
- `matrix-hsr` — 395 cells, `rowsMatched: 75`, `columnHeaders: []`
- `matrix-non-hsr` — 42 cells, `rowsMatched: 76`, `columnHeaders: 11`

End-to-end wall time from `queued` → `parsed`: **4 min 16 sec**. The wizard's `aiMatrices` field is now populated on every Stevenson-format import.

### What the live test proved

1. `_resolve_s3_to_local` still works (no AWS/Tigris regression).
2. The CSHSE matrix-template DOCX files are present in the production Docker image after the `e6c51a8` bundling fix.
3. `_extract_matrices_safe()` runs after `coverage_review` without crashing.
4. The matrices payload survives JSON serialization → HMAC-signed snapshot → snapshot endpoint without truncation (verified all 437 cells + per-row anchor ids end-to-end).
5. The matcher's section count fell from 564 → 557, confirming `deep_walker(skip_matrices=True)` is suppressing the same `<table>` tags that `build_wire_matrices` claimed.

## Surfaces wired in this commit

- **Wizard SpecRail** — new `Matrices (N)` synthetic entry above Standard 1 (visible only when matrices were detected).
- **Wizard middle pane** — new `MatricesView` renders each matrix's full `<table>` with row anchors + column-header chips + per-matrix cell-count badges.
- **Wizard spec cards** — each spec whose row is in any matrix shows a `📊 View in Matrix X (N cells)` button at the top of the card list; clicking deep-links to the row.
- **`applyAIImport`** — creates one `CurriculumMatrix` document per matrix (standards[] grouped by std/spec with courseAssessments[]; rawContent[] seeded with the row-anchored HTML so the existing MatrixEditor surfaces them).
- **`SelfStudyEditor`** — new `View in matrix` button next to the spec breadcrumb for Standards 11-21; switches to the curriculum tab and passes `scrollToSpec={std, spec}` to the MatrixEditor.
- **`CurriculumMatrixEditor`** — new `scrollToSpec` / `onScrollConsumed` props; expands the relevant Standard accordion, finds the row by id, scrolls smoothly to center, applies a 2.2s flash-highlight, then clears the target.

## Known follow-ups

- `matrix-hsr` reports `columnHeaders.length = 0` against the real Stevenson HTML — the table's first row in mammoth's conversion doesn't have detectable course-code text (likely from merged or empty header cells). Column index still works for cell addressing, but the column-header chip strip above the matrix is empty for HSR. Easy fix in `_column_headers()` to fall back to parsing `<colgroup>` or auto-numbering when row 0 yields empties.
- Template-format docs (Kennesaw State) still skip matrix_extract because the template walker reads from the DOCX path and doesn't keep HTML around. Reworking template_walker to surface raw HTML is a small follow-up.
- The persisted `CurriculumMatrix` docs use `rawContent[]` (one entry per matrix, no standardCode) so they surface in the existing MatrixEditor's "Other Imported Sections" group. Splitting that into per-standard sections is a separate UX polish.

## Files

| Path | Change |
|---|---|
| [ai-service/app/matrix/wire_format.py](../../ai-service/app/matrix/wire_format.py) | NEW — `build_wire_matrices()` + row-anchor injection |
| [ai-service/app/import_jobs.py](../../ai-service/app/import_jobs.py) | Un-defer matrix_extract; `_extract_matrices_safe()` |
| [ai-service/app/splitter/deep_walker.py](../../ai-service/app/splitter/deep_walker.py) | `skip_matrices=True` default |
| [ai-service/app/splitter/sections.py](../../ai-service/app/splitter/sections.py) | `Section.html_snippet` |
| [server/src/models/SelfStudyImport.ts](../../server/src/models/SelfStudyImport.ts) | `htmlSnippet` on IAIBucketItem / IAITag |
| [server/src/controllers/aiImportController.ts](../../server/src/controllers/aiImportController.ts) | `markModified('aiMatrices')`; CurriculumMatrix doc creation |
| [client/src/store/aiImportStore.ts](../../client/src/store/aiImportStore.ts) | `MatrixData`, `MatrixCell`, `selectedMatrixRowAnchor`, `selectMatrixRow` |
| [client/src/features/selfStudy/Editor/AIImport/review/SpecRail.tsx](../../client/src/features/selfStudy/Editor/AIImport/review/SpecRail.tsx) | `Matrices (N)` synthetic entry |
| [client/src/features/selfStudy/Editor/AIImport/review/ItemCardList.tsx](../../client/src/features/selfStudy/Editor/AIImport/review/ItemCardList.tsx) | `MatricesView` + per-spec link bar + HTML snippet render |
| [client/src/features/selfStudy/MatrixEditor/CurriculumMatrixEditor.tsx](../../client/src/features/selfStudy/MatrixEditor/CurriculumMatrixEditor.tsx) | `scrollToSpec` prop + flash highlight |
| [client/src/features/selfStudy/Editor/SelfStudyEditor.tsx](../../client/src/features/selfStudy/Editor/SelfStudyEditor.tsx) | `View in matrix` button on spec breadcrumb |
