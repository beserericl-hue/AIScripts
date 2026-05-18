---
name: AI Import Wizard — UI Spec (Sprint 1, sketch — SUPERSEDED)
description: SUPERSEDED by [[import-wizard-ui-spec-2026-05-18]] — the complete, code-ready version. This page is kept as the original sketch for historical reference. Do not build against this version.
type: concept
tags: [import, ai-tagging, wizard, sprint-1, ui-spec, superseded]
last_reviewed: 2026-05-17
superseded_by: import-wizard-ui-spec-2026-05-18
---

# AI Import Wizard — UI Spec (Sprint 1, sketch — SUPERSEDED)

> ⚠️ **This page is the original sketch and is superseded.** The complete, code-ready specification is at [[import-wizard-ui-spec-2026-05-18]]. Build against that page, not this one. This file remains in the vault for historical reference only.

This page is the **complete UI specification** for the AI Import Wizard. It is what we will build in the developer UI after sign-off. No React code lands until this spec is approved.

The wizard replaces the days-of-manual-tagging legacy flow described in [[legacy-self-study-import]] with an AI pipeline that aims to **auto-place close to 100 % of the document** and reduce the manual tag list to a small triage pile.

The AI side is already built — see [[ai-import-stevenson-2026-05-17]] for the by-section dump, [[ai-import-stevenson-by-spec-2026-05-17]] for the by-spec dump, and [[ai-import-stevenson-coverage-2026-05-17]] for the per-spec coverage review. The matrix data extractor (final piece) is committed at `ai-service/app/matrix/data_extractor.py` and produces 370 matrix cells across 150 matched rows on Stevenson.

---

## 1. Where the wizard lives

The wizard is a **new tab in the Self-Study Editor**, alongside the existing tabs:

```
┌──────────────────────────────────────────────────────────────────────┐
│ Self-Study Editor — Stevenson University — Family Studies B.A.       │
├──────────────────────────────────────────────────────────────────────┤
│ [ Standards ] [ Curriculum Matrix ] [ Supporting File Library ]      │
│ [ AI Import ]   ← NEW                                                │
└──────────────────────────────────────────────────────────────────────┘
```

The `[ Import Document ]` button in the top bar (today triggers the legacy modal at `client/src/features/selfStudy/Editor/SelfStudyEditor.tsx:1923-1935`) becomes the entry point that **activates the AI Import tab** and starts at Step 1. The legacy tagging modal (`SectionTagger.tsx`) and `DocumentViewer.tsx` placeholder mechanism are kept untouched as a fallback path for now.

**Tab visibility:**

- Visible only to **Program Coordinators** (same gating as the current Import button).
- The tab badge shows the wizard state: hidden when no import is in progress; `(in progress)` while running; `(N tags)` when an import has finished with `N` unresolved tags.

---

## 2. End-state contract — what "done" looks like

When the user clicks **Finish** at the end of the wizard, the system guarantees:

| Destination | What lands there |
|---|---|
| `Submission.narratives[std][spec].content` (HTML) | All auto-accepted text < 1000 words that the AI classified as a spec narrative for that (std, spec) — concatenated, separated by `<hr/>` per source paragraph if multiple. |
| `Submission.narratives[std][spec].supportingEvidenceText` | All auto-accepted text ≥ 1000 words OR text the AI classified as "evidence prose" (appendix prose, course descriptions, syllabi excerpts pulled in by anchor) for that (std, spec). |
| `SupportingEvidence` rows (Mongo) + S3 DOCX | One row per auto-accepted **file-shaped** evidence item (faculty CV, course syllabus, advisory-board meeting minutes…). Body content rendered as a standalone DOCX via [[evidence-document-review-pipeline]], uploaded to S3 with key `{institutionId}/{versionId}/{slug}.docx`, and linked from `narratives[std][spec].linkedDocuments`. |
| `CurriculumMatrix.cells[]` | One cell per matrix value extracted from `#MatrixHSR` / `#Matrix2`, tagged with `(standardCode, specCode, columnIndex, codeRaw, contentTypes, depth)`. The course-name-per-column list is something the user confirms in Step 4 (matrix review). |
| `DocumentVersion` row | The pristine original DOCX, S3-stored, hashed, versioned. Already wired today via `documentVersionService.recordVersion()`; the wizard simply re-uses this on upload. |
| `SelfStudyImport.importTags[]` | One tag per **questionable** item the AI could not place with confidence. Each tag = `{ id, summary, fullText, suggestedStd, suggestedSpec, confidence, sourceAnchor }`. These show in the wizard's **Tag List** and remain accessible after finish for incremental cleanup. |

The **goal** is to maximise auto-accepted items and minimise the tag list. Stevenson's current run produces:

- 60 anchor-driven sections → mostly auto-accept candidates after confidence filtering.
- 890 appendix items → mostly evidence files; chunked per CV / per supporting document.
- 370 matrix cells → 100 % auto-apply if the user confirms the column→course mapping.
- Tag-list expected size on Stevenson: target **< 50 tags** (down from ~thousands manual).

---

## 3. The five wizard steps

The wizard is a **linear five-step flow** with a persistent left-side stepper. The user can navigate back to any completed step but cannot skip forward.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ AI Import Wizard                                                        │
├────────────┬────────────────────────────────────────────────────────────┤
│            │                                                            │
│ ① Upload   │   <step content here>                                      │
│ ② Parse    │                                                            │
│ ③ Review   │                                                            │
│ ④ Matrix   │                                                            │
│ ⑤ Apply    │                                                            │
│            │                                                            │
└────────────┴────────────────────────────────────────────────────────────┘
```

### Step 1 — Upload

**Purpose**: bring the source document into S3 + start the AI pipeline.

UI:

- Drag-drop area for `.docx` (primary) or `.pdf` (fallback).
- File-size limit raised to **100 MB** (today's 50 MB cap in `multer` truncates legacy files — see [[legacy-self-study-import#issue-1-50mb-multer-limit-truncates-large-imports|Issue 1]]).
- Program-level dropdown: **Associate / Baccalaureate / Master's** (auto-detected from the Submission's program type; user can override).
- Optional checkbox: "This is a re-import of an existing self-study" (loads existing `narratives` into the diff view at Step 5).

On submit:

1. File uploaded to server → S3 via `documentVersionService.recordVersion()` (already wired). Returns `{ documentVersionId, s3Key, sha256 }`.
2. POST to `cshse-ai` (Python service) with `{ s3Key, programLevel, submissionId }`. Service responds `202` with `{ jobId }`.
3. UI advances to Step 2.

### Step 2 — Parse

**Purpose**: show the AI working. No user input required.

UI is a live progress strip:

```
Parsing document…
  ✓ Downloaded from S3 (12.4 MB)
  ✓ Converted to HTML (mammoth)
  ✓ TOC anchor walk     60 sections found
  ✓ Deep table walk     605 table-level segments found
  ✓ Appendix walk       890 evidence items found
  ⟳ Matrix extraction   running…
  ⟳ Coverage review     queued
```

Pipeline stages (these match the AI components we already have):

| Stage | Component | Output |
|---|---|---|
| TOC anchor walk | `ai-service/app/splitter/toc_anchor_walker.py` | one segment per (std, spec) anchor, prose body |
| Deep table walk | `ai-service/app/splitter/deep_walker.py` | rowspan-aware table segments — picks up matrix candidates and course tables |
| Appendix walk | `ai-service/app/splitter/appendix_walker.py` | one item per appendix sub-section, suitable for splitting into evidence DOCX files |
| Matrix template alignment | `ai-service/app/matrix/template_loader.py` | template-row spec prompts (66/78/54 rows by level) |
| Matrix data extraction | `ai-service/app/matrix/data_extractor.py` | `MatrixCellData[]` — one per filled cell, decoded to `(content_types, depth)` |
| Coverage review (per spec) | `ai-service/app/coverage/spec_coverage.py` | Claude Haiku verdict: covered? score? gaps? strengths? |

When all stages finish, the **Next** button enables.

### Step 3 — Review recommendations

**Purpose**: the core triage workspace. User sees what the AI decided, edits where needed, and chooses what to auto-apply vs. defer to the tag list.

Layout — three columns:

```
┌──────────────┬─────────────────────────────────┬─────────────────────┐
│ Specs        │ Items recommended for this spec │ Selected item       │
│ (left rail)  │ (middle table)                  │ (right preview)     │
├──────────────┼─────────────────────────────────┼─────────────────────┤
│ Std 1   ✓3   │ # | Source         | Conf | Kind │ ┌─────────────────┐│
│  └ 1.a  ✓1   │ 1 | TOC §1.a       | 0.98 | text │ │ Source: §1.a    ││
│  └ 1.b  ✓1   │ 2 | Appendix CV-1  | 0.92 | file │ │ Conf: 0.98 ✓    ││
│  └ 1.c       │ 3 | Deep table p43 | 0.45 | tag  │ │                 ││
│ Std 2   …    │   …                              │ │ <body excerpt…> ││
│ …            │                                  │ │                 ││
│ Std 21  ✓1   │ [Apply selected] [Send to tags]  │ │ Apply ▾  Defer ▾││
│              │                                  │ └─────────────────┘│
│ ⚠ Unplaced 47│                                  │                     │
└──────────────┴─────────────────────────────────┴─────────────────────┘
```

**Left rail — Specs**: every spec from the Handbook for the chosen program level (99 rows for Baccalaureate). Each row shows:

- `(std).(letter)` and a one-line truncation of the spec title.
- A green checkmark + count when the AI has placed ≥ 1 item there.
- A red `⚠` for specs with zero placements (potential gap — matches the coverage-review output).
- A special bucket at the bottom: **⚠ Unplaced** — items the AI could not assign to any spec at all.

**Middle table — Items for the selected spec**: shows everything the AI is recommending for the spec selected in the left rail. Columns:

- `#` — local index.
- `Source` — TOC anchor, appendix anchor, table row, or `(unplaced)`.
- `Conf` — 0–1 confidence from `_best_template_match` for matrix items, embedding+Haiku score for prose. Three colour bands: green ≥ 0.85, yellow 0.50–0.84, red < 0.50.
- `Kind` — `text` (< 1000 words → narrative), `evidenceText` (≥ 1000 words → `supportingEvidenceText`), `file` (separable evidence → DOCX upload), `matrix` (cell), `tag` (questionable → tag list).

Auto-apply rules (defaults the AI assigns before the user sees the screen):

| Item shape | Default kind | Default action |
|---|---|---|
| Prose body < 1000 words, conf ≥ 0.85, matches one spec | `text` | auto-apply → `narratives[std][spec].content` |
| Prose body ≥ 1000 words, conf ≥ 0.85 | `evidenceText` | auto-apply → `narratives[std][spec].supportingEvidenceText` |
| Appendix item with a header (CV, syllabus, minutes…), conf ≥ 0.70 | `file` | auto-apply → DOCX + S3 + `SupportingEvidence` row |
| Matrix cell with template-matched row | `matrix` | auto-apply → `CurriculumMatrix.cells[]` (subject to course-column confirmation in Step 4) |
| Anything else with conf < 0.50 | `tag` | defer → import tag list |
| Conf 0.50–0.84 | `text`/`evidenceText`/`file` | **flagged** but auto-applied; user can demote to `tag` |

**Bulk actions** in the middle table:

- Select-all checkbox.
- "Send selected to tags" — demote auto-applied items to the tag list (e.g., when the user disagrees with the AI's spec choice but doesn't want to immediately fix it).
- "Apply selected as evidence file" — promote prose to a file (split-out DOCX upload).
- "Reassign to spec…" — opens the same popup as the tag list (see Step 5).

**Right column — Selected item preview**:

- Full body text rendered (markdown-formatted).
- Source: the document anchor or table location.
- AI's reasoning: a one-paragraph Claude-generated rationale ("This paragraph cites the 1973 founding of NOHS and describes the curriculum's grounding in human services history, matching Std 11.a's prompt verbatim.").
- **Action chooser** at the bottom: dropdown of all four kinds + a "Skip — leave in tag list" radio.
- "Show in source document" button — opens a modal scrolled to the anchor in the original DOCX-rendered HTML.

The user can blow through this screen in a few minutes for the auto-applied items if they trust the AI, and zoom in on the yellow/red rows.

### Step 4 — Matrix review

**Purpose**: confirm the **course-name-per-column** mapping for the curriculum matrices. The AI cannot infer this from the template alone — column headers in real self-studies are inconsistent (sometimes course codes, sometimes names, sometimes neither).

UI:

```
Matrix: Required Human Services Courses (#MatrixHSR)         Cells: 250

       Col 1     Col 2     Col 3      Col 4      Col 5      Col 6
Spec   ┌───────┬─────────┬──────────┬──────────┬──────────┬──────────┐
       │ ⟨ ▼ ⟩ │ ⟨ ▼ ⟩  │ ⟨ ▼ ⟩   │ ⟨ ▼ ⟩   │ ⟨ ▼ ⟩   │ ⟨ ▼ ⟩   │
       │ FMST  │ FMST    │ FMST     │ FMST     │ FMST     │ FMST    │
       │  205  │  210    │  240     │  301     │  315     │  330    │
       ├───────┼─────────┼──────────┼──────────┼──────────┼──────────┤
11.a   │  KM   │         │  ITKSH   │          │  IL      │          │
11.b   │       │  ITM    │          │  KSH     │          │          │
…      │       │         │          │          │          │          │
       └───────┴─────────┴──────────┴──────────┴──────────┴──────────┘

Matrix: Non-HS Courses (#Matrix2)                            Cells: 120
…
```

For each column the user picks a course from the program's **course catalog dropdown**. The dropdown is pre-seeded with any course-code-shaped strings the deep walker pulled from the document (regex `^[A-Z]{2,5}\s*\d{2,4}`). The user can also type a new course and create it on the fly.

The cells themselves are read-only at this stage — the user has already accepted them in Step 3. This screen only resolves the column→course mapping.

### Step 5 — Apply & finish

**Purpose**: review the full set of writes before committing, then commit.

UI is a summary screen:

```
Ready to apply

  Narratives (text < 1000 words)             142 items, 87 specs touched
  Supporting evidence text (≥ 1000 words)     38 items, 31 specs touched
  Supporting evidence files                   54 files, 12.8 MB total
  Curriculum matrix cells                    370 cells, 2 matrices
  Document version recorded                    1 (Stevenson FS B.A. 2018)

  Tag list (deferred)                         47 items needing manual review

[ ← Back ] [ ⓘ Show diff ] [ Apply & finish ]
```

**Show diff** opens a per-spec diff modal: for each spec the wizard is touching, show before/after of `narratives[std][spec].content`, current vs. proposed. If the self-study is empty (fresh import), this is a no-op. If it's a re-import (Step 1 checkbox), this is critical — the user must opt-in to overwriting existing narratives, or merge.

**Apply & finish** issues a single `POST /api/imports/:id/apply` with the full payload:

```jsonc
{
  "narratives": { "11": { "a": "<html>…</html>", "b": "<html>…</html>" } },
  "supportingEvidenceText": { "11": { "a": "<long text>" } },
  "supportingEvidenceFiles": [{ "std": "11", "spec": "a", "s3Key": "…", "slug": "rosicky-cv" }],
  "matrixCells": [{ "matrix": "MatrixHSR", "std": "11", "spec": "a", "col": 3, "course": "FMST 240", "codeRaw": "ITKSH" }],
  "importTags": [{ "id": "…", "summary": "…", "fullText": "…", "suggestedStd": "12", "suggestedSpec": "c", "confidence": 0.41 }]
}
```

The server applies the writes inside a Mongo session for atomicity and emits the standard `Submission` save + `markModified('narratives')` (see [[narrative-storage]]).

On success:

- Wizard tab badge becomes `(N tags)` if `importTags.length > 0`, else hidden.
- User is dropped back into the **Standards** tab, scrolled to the first spec the wizard touched.
- A toast: "Imported 142 narratives, 54 files, 370 matrix cells. 47 items need review — see the AI Import tab."

---

## 4. The tag list — what happens to questionable items

When the wizard finishes with non-empty `importTags`, the AI Import tab stays visible. Reopening it skips the wizard steps and lands on the **Tag List** view:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ AI Import — 47 tags to review                                           │
├─────────────────────────────────────────────────────────────────────────┤
│ Filter: [ All ▾ ] [ Std ▾ ] [ Conf ▾ ]   Sort: [ Conf ↑ ]   [Search …]  │
├─────────────────────────────────────────────────────────────────────────┤
│ ID   Summary                              Suggested  Conf  Source       │
│ ─────────────────────────────────────────────────────────────────────── │
│ 23   "The Family Studies Program was…"   12.c       0.41  TOC §1.d     │
│ 41   "Faculty are evaluated annually…"   18.b       0.38  Appendix p82 │
│ 19   "Field supervisors meet quarterly"  21.a       0.36  Deep table   │
│ …                                                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

Each row is **clickable**. Clicking opens a popup:

```
┌──────────────────────────────────────────────────────────────┐
│ Tag #23 — "The Family Studies Program was …"           [ × ] │
├──────────────────────────────────────────────────────────────┤
│ Source: TOC anchor §1.d        Confidence: 0.41              │
│ AI suggestion: Std 12 · Spec c                               │
│ AI reasoning: Mentions "family systems theory" and "social   │
│  ecology" which overlap Std 12.c's prompt about theoretical  │
│  frameworks, but the paragraph is mostly about program       │
│  history (Std 11.a) so confidence is split.                  │
│                                                              │
│ ─── Full text ──────────────────────────────────────────     │
│ The Family Studies Program was founded in 1986 to address    │
│ the growing need for human-services professionals trained    │
│ in family systems theory, social ecology, and evidence-      │
│ based intervention. … (1,247 chars)                           │
│ ─────────────────────────────────────────────────────────    │
│                                                              │
│ Place this content as:                                       │
│   ◉ Narrative (< 1000 words)                                 │
│   ○ Supporting evidence text                                 │
│   ○ Supporting evidence file (split out as DOCX)             │
│   ○ Matrix cell — only available if shape matches            │
│   ○ Discard                                                  │
│                                                              │
│ Standard: [ 11 ▾ ]    Spec: [ a ▾ ]                          │
│                                                              │
│ [ ← Previous ]                            [ Skip ] [ Apply ] │
└──────────────────────────────────────────────────────────────┘
```

**Apply** writes the content into the chosen destination using the same code path as the Step 5 batch apply (single-item version), then advances to the next tag in the filtered list. **Skip** leaves the tag in place.

When the list is empty the badge disappears and the AI Import tab can be re-entered to start a fresh import (which records a new `DocumentVersion`).

---

## 5. State machine

The wizard's persistent state lives on `SelfStudyImport`:

```
new      → upload accepted, documentVersion recorded
parsing  → cshse-ai job started, polling
parsed   → AI returned full result, user at Step 3
applied  → Step 5 committed; importTags may be non-empty
finished → tag list emptied (or explicitly dismissed)
```

Steps 1–4 are recoverable: if the user closes the tab, reopening it re-enters at the furthest step reached. Step 5 (apply) is one-shot; if it fails partway the server rolls back the Mongo session and the user is shown the error at Step 5.

---

## 6. Open questions before we code

1. **Re-import diff merge UX** — when the Submission already has narratives (re-import case), do we offer per-spec "keep mine / take new / merge" granular choices, or just an all-or-nothing checkbox? The mock above assumes the latter; the former is much more work.
2. **Tag list lifetime** — is the tag list pruned automatically when the underlying spec gets manually filled in the Standards tab, or only when the user explicitly applies/dismisses from the AI Import tab? Recommendation: explicit only, to avoid surprise data loss.
3. **Cross-institution semantic search** — wired but feature-flagged. Do we surface a "similar text from other institutions" hint in the popup, or hide it until CSHSE board approval lands? Recommendation: hide for v1, ship as an experimental toggle later.
4. **Matrix course catalog** — does the program's course catalog already exist as a structured Mongo collection (per institution) that we can populate from the deep walker's regex hits, or do we just keep them as free-text strings on `CurriculumMatrix.columns[]`? This affects how reusable the Step 4 mapping is across future imports.
5. **Confidence thresholds** — the 0.85 / 0.70 / 0.50 numbers above are starting points based on Stevenson. We'll likely calibrate after one full end-to-end run.

---

## 7. What's already built vs. what's left

**Built (AI service)**:

- `app/splitter/toc_anchor_walker.py` — TOC anchor walk
- `app/splitter/deep_walker.py` — rowspan-aware table walk
- `app/splitter/appendix_walker.py` — appendix splitter
- `app/matrix/template_loader.py` — all 3 matrix templates, legend, align-to-handbook
- `app/matrix/data_extractor.py` — matrix cell decoder (370 cells on Stevenson)
- `app/coverage/spec_coverage.py` — per-spec Claude Haiku review
- `app/export/docx_writer.py` + `app/export/s3_writer.py` — evidence DOCX generation + S3 upload
- `app/standards/handbook_parser.py` — 99 specs across all 21 Standards
- `server/src/models/DocumentVersion.ts` + `documentVersionService.ts` — versioning wired into upload

**Left to build (this spec)**:

- The Wizard tab React component (`client/src/features/selfStudy/Editor/AIImport/Wizard.tsx`)
- The 5 step components (`UploadStep`, `ParseStep`, `ReviewStep`, `MatrixStep`, `ApplyStep`)
- The Tag List view + popup (`TagList.tsx`, `TagPopup.tsx`)
- The orchestrator API route (`POST /api/imports/:id/start-ai`, `POST /api/imports/:id/apply`)
- The cshse-ai endpoint (`POST /ai/import/start`, `GET /ai/import/:jobId`)
- E2E test on Stevenson hitting `apply` and verifying the resulting Submission state

---

## 8. Sign-off

Approve this spec → we code Sprint 1 against it end-to-end. Changes after sign-off should land as edits to this page with a `last_reviewed` bump.

Related: [[legacy-self-study-import]] · [[ai-import-stevenson-2026-05-17]] · [[ai-import-stevenson-coverage-2026-05-17]] · [[narrative-storage]] · [[evidence-document-review-pipeline]] · [[evidence-file-storage]]
