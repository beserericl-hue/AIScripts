---
name: CR-025 — AI matrix column inference + course catalog dropdown
description: The Matrix step's free-text column inputs are unusable. Replace with an AI-driven course-name inference step (RAG against the curriculum-matrix section in Qdrant) + a course-catalog dropdown that the coordinator confirms rather than types from scratch.
type: change-request
cr_id: CR-025
status: superseded
superseded_by: CR-029
priority: P0
source: User observation 2026-05-21 — Matrix step Col 1..N is unfixable by hand; no catalog, no instructions, no algorithm
sprint_target: Sprint 2B
tags: [matrix, ai-service, wizard, rag, qdrant, ux]
last_reviewed: 2026-05-21
---

# CR-025 — AI matrix column inference + course catalog dropdown

## Summary

The wizard's Matrix step asks the coordinator to map every column ("Col 1", "Col 2", … up to 26) to a course name from their program catalog. Today the input is free-text with the placeholder hint "No courses yet — type a code and press Enter." This is unusable:

- The coordinator has no idea which course "Col 4" represents — mammoth strips merged-cell formatting from the DOCX, so the original column header is gone.
- There is no catalog dropdown — the coordinator must type every course code from memory, with no spell-check or validation.
- There is no algorithm in the UI for figuring out which course a column is. The original DOCX has the answer (merged-cell headers, surrounding narrative course mentions), but the coordinator has no way to navigate that from this screen.
- The "Show original source-document table" collapsible at the top shows the raw extraction but doesn't help the coordinator read merged cells either.

The AI service already has the full document text, the matrix section HTML (with the merged-cell course headers intact), and per-institution Qdrant collections. It can infer the column→course mapping with high confidence. The coordinator's job should be **confirm + override**, not "type 26 course codes from memory."

This is exactly the kind of work the AI importer should do. Adding it now closes the most-broken screen in the wizard and adds a corrections-learning loop for future imports.

## Source quotes

User, 2026-05-21:

> "I am not sure at all what to do with this screen. How do I find the course that this row is located in? There is no instruction on how to fix this. Also this is something that the AI importer can possibly do. Loading in the entire curriculum matrix section of the document into the Qdrant vectorbase putting it in a private section that only stevenson can see, why can't we search the database and let the RAG AI system find these rows and insert them into the correct matrix. you have the spec and the subspec and you can find the spot where this row matches. If there are multiple rows inside the curriculum matrix that match identically, then you can also look at the generated matrix to see if the row is in the matrix, and skip the row. This can be a correction step inside the initial import, or you can do all at once with a separate API call to the AI importer services. Yes, you can code an additional AI API call to do this. This is in scope of the project."

> "The course may be different and the algorithm to correct this screen by hand is flawed. You write down the name of the course (why can't this be a dropdown?) and then do what? Nothing is clear."

> "An automated process can clear this up and publish the matrix. This is also learning for the AI parser to clean this up during the initial import."

## Decision

Three deliverables, all in Sprint 2B (S2B.7):

### 1. ai-service: matrix-column inference endpoint

New endpoint `POST /ai/matrix/infer-columns` on cshse-ai. Inputs:

```json
{
  "importId": "...",
  "institutionId": "...",
  "matrixSlug": "human-services-courses" | "non-human-services-courses",
  "rawTableHtml": "...",          // the original <table> from mammoth, merged cells intact
  "columnCount": 13,
  "knownCourses": ["CHS 105", "CHS 224", ...]  // optional, from program catalog if available
}
```

Server-side flow:

1. Embed the `rawTableHtml` + surrounding 200 words of context into a temporary Qdrant query.
2. RAG-search the `cshse_matrix_columns_{env}` collection (per-institution payload filter) for similar already-mapped matrix columns from prior imports.
3. Use Claude Haiku to read the raw HTML (which still has merged-cell course headers — mammoth strips them at the DOM level but they're recoverable from the raw bytes), the surrounding narrative course mentions, and the RAG results.
4. Return `[{columnIndex: 0, suggestedCourse: "CHS 105", confidence: 0.95, rationale: "Merged-cell header row 2 reads 'CHS 105 Human Services and Social Policy' across columns 1-2"}, …]`.
5. On wizard apply, store the confirmed mappings in `cshse_matrix_columns_{env}` keyed by institution + matrix slug — feeding next-run inference.

### 2. ai-service: ingest curriculum-matrix section into a private Qdrant collection

New step in `import_jobs.py`:

- When the splitter finds a curriculum matrix anchor (already detected — see [[ai-import-stevenson-matrices-2026-05-19]]), embed the surrounding 4-6 paragraphs of narrative (the part before + after the table that names courses) into `cshse_matrix_context_{env}`.
- Payload: `{ institutionId, importId, matrixSlug, sectionTitle, embeddedAt }`.
- This is per-institution-private; the same payload filter mechanism CR-017 documents.

The infer-columns endpoint consults this collection alongside the raw table HTML.

### 3. Client: course catalog dropdown + AI-assisted confirm UI

Replace the free-text inputs on the Matrix step with a dropdown chooser:

- Dropdown populated from: (a) any courses the AI inferred via S2B.7-step-1, (b) any prior-mapped courses for this institution from `cshse_matrix_columns`, (c) free-text fallback for net-new courses.
- Each column header shows the AI-suggested course pre-filled + a confidence indicator (🟢 ≥0.85, 🟡 0.50-0.85, 🔴 <0.50 or no suggestion).
- The coordinator confirms (one click) or overrides (dropdown re-selection or free-text add).
- A "Run AI column inference" button at the top runs the endpoint on-demand. The wizard also runs it automatically when the user first lands on the Matrix step if the suggestions aren't already populated.
- Each manual override is logged as a "correction" via the existing CR-024-precursor corrections-feedback loop ([[change-requests/cr-024-matrix-spec-bidirectional-link]] discussion of corrections store) — so the next import for this institution gets it right automatically.

## Acceptance

### ai-service

- [ ] `POST /ai/matrix/infer-columns` endpoint with full unit + integration tests
- [ ] `cshse_matrix_columns_{env}` Qdrant collection bootstrapped + per-institution payload filter verified
- [ ] `cshse_matrix_context_{env}` collection bootstrapped with curriculum-matrix surrounding narrative
- [ ] Inference returns at least 8/13 columns at >0.85 confidence on the Stevenson Baccalaureate matrix (manual ground-truth verified)
- [ ] Inference returns the empty Kennesaw State case gracefully (no false positives)
- [ ] Corrections feedback: confirmed mappings stored back into `cshse_matrix_columns_{env}` keyed by institution; a second import for the same institution returns those mappings at >0.95 confidence

### client

- [ ] Free-text course-code inputs replaced by dropdown with free-text fallback
- [ ] AI-suggested values pre-fill each dropdown on first render
- [ ] Confidence indicator visible per column
- [ ] "Run AI column inference" button re-triggers the endpoint
- [ ] Coordinator override is recorded as a correction event
- [ ] No regression: existing "Skip this matrix" toggle still works, Sticky matrix-name banner still works, original-source-document collapsible still works

### Test plan

- ai-service unit: prompt builder structure with + without RAG hits, with + without `knownCourses`
- ai-service integration: against Stevenson DOCX, expect specific column→course mappings
- ai-service integration: against Kennesaw State template (no matrix data) → returns 0 suggestions, no error
- Client E2E: wizard reaches Matrix step → AI inference runs → 13/13 columns pre-filled → coordinator confirms 11, overrides 2 → applies → next dry-run import for same institution returns all 13 at >0.95

## Files affected

### ai-service

- `ai-service/app/matrix/column_inference.py` (new)
- `ai-service/app/main.py` — new endpoint
- `ai-service/app/import_jobs.py` — ingest curriculum-matrix context paragraphs into Qdrant
- `ai-service/tests/test_matrix_column_inference.py` (new)

### server

- `server/src/services/cshseAiClient.ts` — `inferMatrixColumns(importId, matrixSlug)`
- `server/src/controllers/aiImportController.ts` — pass institutionId + matrix raw HTML to ai-service; persist confirmed mappings

### client

- `client/src/features/selfStudy/Editor/AIImport/steps/MatrixStep.tsx` — replace free-text inputs with dropdown + AI suggestions + confidence indicators + "Run AI column inference" button
- `client/src/features/selfStudy/Editor/AIImport/steps/MatrixColumnDropdown.tsx` (new)
- `client/src/store/aiImportStore.ts` — `setColumnSuggestions(matrixSlug, suggestions[])`, `confirmColumnMapping`, `overrideColumnMapping` actions

## Dependencies

- Existing matrix extraction pipeline (shipped Sprint 1)
- Existing Qdrant per-env collections + HMAC auth (shipped Sprint 1)
- Existing corrections store ([[change-requests/cr-024-matrix-spec-bidirectional-link]] doesn't depend on this, but the underlying corrections infrastructure shipped in commit `af81f7f` does)

## Open questions

- Should the program catalog be a first-class entity (institution-owned, editable by PC) — answer: **defer to a separate CR.** For now, the catalog is implicit (assembled from AI suggestions + coordinator overrides + history). When a PC explicitly wants to manage their catalog, that's CR-026.
- What if mammoth has lost the merged-cell headers entirely and the surrounding narrative also lacks course mentions — answer: **the endpoint returns 0 suggestions with a clear "no signal" rationale.** The coordinator falls back to free-text entry; the system still records their entry for next time.
- Should the AI also try to infer matrix rows that were dropped (matrix completeness check) — answer: **defer to CR-027.** This CR is scoped to columns only.
