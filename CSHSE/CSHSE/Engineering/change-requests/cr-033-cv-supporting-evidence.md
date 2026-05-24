---
name: CR-033 — CV (faculty resume) supporting evidence detection & routing
description: Detect curriculum vitae blocks inside the uploaded self-study, group the entire CV as one supporting-evidence unit per faculty member, route it to the spec/subspec it belongs to, and let coordinators upload a CV standalone too. Each CV lands as a discrete "CV Supporting Evidence" card on the Review step and is written out as a supporting-evidence file at Apply.
type: change-request
cr_id: CR-033
status: in-progress
priority: P1
source: User observation 2026-05-22 — coordinator screenshot shows Barry W. Thomas's full CV being rendered as a generic "Evidence" card under Standard 7.b instead of as a discrete CV supporting-evidence file. Coordinator wants CVs handled as a first-class kind.
sprint_target: Sprint 4 (post-demo)
tags: [wizard, parse, matcher, review, apply, supporting-evidence, cv, faculty]
last_reviewed: 2026-05-24
---

# CR-033 — CV supporting evidence detection & routing

## Phase 2 shipped 2026-05-24 — cv_detector module

`ai-service/app/splitter/cv_detector.py` ships the detector heuristic
from the spec (anchor line + ≥2 CV section markers + CSHSE-boundary
rejection). Public API:

- `detect_cvs(sections)` → `(list[CVDetection], residual_sections)`.
  Returns each detected CV plus the section stream with CV-classified
  entries removed so they never compete with regular specs for matcher
  routing.
- `CVDetection` dataclass mirrors the client-side `CVItem` shape.
- `cv_to_dict(cv)` returns the wire format.

`tests/test_cv_detector.py` (16 tests) covers:
- Anchor recognition: honorifics stripped, middle initials and
  particles ("Maria del Carmen"), token-count caps, lowercase rejection,
  Standard-N rejection.
- Section-marker counting (unique only — repeated "Education" lines
  don't double-count).
- Full-CV detection on a realistic Stevenson-style body.
- Rejection when section straddles a Standard-N marker (would swallow
  spec content).
- Multiple CVs in a single stream.
- Wire-format serializer.

Phase 2 remaining: integrate `detect_cvs` into `import_jobs` (run
after `deep_walker`, feed residual to matcher, attach detected CVs to
the callback payload), client UI card variant, standalone-CV upload
flow.

## Phase 1 shipped 2026-05-24 — data shape + apply pass-through

Same pattern as CR-040 Phase 1: lands the contract so Phase 2 (ai-service `cv_detector.py` + standalone-CV upload + UI card variant) can ship in a follow-on without schema churn.

What landed:
- **Client store**: `'cv'` added to `ItemKind`. `CVItem` type with the per-faculty metadata shape from the spec (facultyName, htmlSnippet, routing.source = matrix/heading/matcher/unplaced, resolvedStd/resolvedSpec, fileId/fileName populated post-Phase-2). `cvs: CVItem[]` field defaults to `[]`. `setCVs` action. Persisted via partialize.
- **Client apply()**: sends `cvs` array (empty until Phase 2 fills it).
- **Server schema**: `SelfStudyImport.aiCVs: Mixed[]` (defaults to `[]`).
- **Server apply path**: receives and persists `payload.cvs` through.

What remains for Phase 2 (per the body below):
- ai-service `cv_detector.py` — anchor + section-marker + end-boundary regex per the spec, runs after deep_walker before matcher
- ai-service routing: matrix-row → heading → matcher → unplaced precedence
- Server: spec content-schema `cvs[]` array on Submission; Apply renders each CV to a `.docx`, uploads to GridFS, attaches to spec's `supportingFiles[]` with `kind: 'cv'`
- Client: new card variant in the kind sections (User icon, faculty-name title, routing badge)
- Client: ItemPreview right pane for CV cards (no "Place this item as" dropdown)
- Client: standalone-CV upload flow on Upload step (detect → one-card review → Apply)

CR stays `in-progress` until Phase 2 ships.



## Source quote

User, 2026-05-22 (after sighting a Barry W. Thomas CV under spec 7.b):

> "Standards have supporting evidence that are CV (resumes) of the faculty. We need to parse those separately and if they are included in the document, we need to read them as supporting evidence (to be written as a file) for the spec in which they appear. I don't think we have this covered in the AI importer. Please write a comprehensive CR that fixes this problem. Keep it simple (read the document contents, searching for CVs of faculty and add it to a separate element in the spec (like curriculum matrix). You want to include the entire individual CV and be able to be listed as CV Supporting Evidence. Users may import the CV only so it should be stored in the system for the correct spec and subspec."

## What's broken today

A self-study report typically embeds faculty CVs verbatim under the personnel / faculty-credentials standards (typically Standards 6 and 7). The AI importer currently treats CV text as a regular narrative or evidence-text item — see the screenshot dated 2026-05-22 where Barry W. Thomas's full CV (education, dissertation, academic employment, teaching experiences) lands as one big Evidence card under spec 7.b. That's wrong for three reasons:

1. **It's not narrative content.** The CV is a structured artifact (degrees, dates, institutions). Stuffing it into a narrative field forces the coordinator to either delete it or hand-format it later.
2. **It belongs in a separate "supporting evidence" file.** CSHSE readers expect to see CVs as discrete uploads, not paragraphs inside the self-study prose.
3. **Standalone CV uploads are unsupported.** Today the wizard expects a full self-study .docx. If a coordinator wants to add a single missing CV later, there's no path — they have to re-edit the self-study and re-import.

## Goal

A coordinator finishing the wizard should end up with one **CV Supporting Evidence** file per faculty member, attached to the spec the faculty member belongs to (typically driven by the matrix row that names them). The CV cards live in their own kind-section on the Review screen alongside Narratives / Evidence / Tags / Matrix rows. Standalone CV uploads route to the right spec without forcing a full self-study reimport.

## Decision

Add **`'cv'`** as a first-class `ItemKind` alongside `text`, `evidenceText`, `file`, `matrix`, `tag`. Detect CV blocks in the parsed document with a deliberately simple heuristic. Group each detected CV as a single item. Route via faculty-name match against matrix rows. At Apply, render each CV to a `.docx` (or `.pdf` if simpler) file and attach as supporting evidence under the resolved spec.

**Keep it simple — non-goals:**

- No NLP entity extraction or LLM call per CV. The heuristic below is good enough.
- No editing the CV's internal structure (degrees, dates) — the file is opaque after detection.
- No auto-cropping headshots, no OCR, no PDF-table parsing.
- No de-duplication across imports (if you import twice, you get two CV files — coordinator deletes one).

## Detection heuristic

A CV block is detected when **all three** signals are present within a short window of text:

1. **Anchor line** — a single short line (< 60 chars) that looks like a person's name. Detected by: 2–4 title-case words, no verbs, no Standard-X reference, optionally followed within 3 lines by an email or phone.
2. **Section markers** — within 30 lines after the anchor, at least TWO of: `EDUCATION`, `ACADEMIC EMPLOYMENT`, `TEACHING EXPERIENCES`, `PROFESSIONAL EXPERIENCE`, `PUBLICATIONS`, `LICENSES`, `CERTIFICATIONS`, `CURRICULUM VITAE`. Match is case-insensitive, line-anchored.
3. **End boundary** — closes when we hit either the next anchor line that ALSO has section markers, or a CSHSE-style heading (`Standard X`, `X.a`, `Specification`, `Table of Contents`), or end-of-document.

Notes:

- The anchor and end conditions intentionally use cheap regex. No ML.
- A CV block whose section-marker count is exactly two still counts. We optimise for recall over precision — false positives become editable cards the coordinator can discard with the CR-032 Discard button.
- The faculty name extracted from the anchor line is normalised (strip titles like "Dr.", "Mr.", trailing punctuation) and stored on the item.

Implementation lives in a new module: `ai-service/app/splitter/cv_detector.py`. It runs **after** `deep_walker` has produced the linear paragraph stream but **before** the matcher, so CV-detected ranges are pulled out of the matcher's input (and don't compete for spec placement).

## Routing — which spec does this CV belong to?

Order of precedence:

1. **Matrix row match.** The faculty name appears in a Matrix row (Standard 6 / 7 tables that name faculty against subspecs). The CV inherits that row's resolved subspec.
2. **Surrounding text match.** The CV sits inside a section whose heading already maps to a spec (e.g. CVs appearing right after a "Personnel — Faculty Credentials" header). Inherit that spec.
3. **AI matcher fallback.** If neither (1) nor (2) resolves, run the existing matcher against the faculty name + first paragraph of the CV and use its top spec. Confidence < 0.4 → Unplaced.

The routing decision and its source (`matrix`, `heading`, `matcher`, `unplaced`) is stored on the CV item so the right-pane preview can surface it ("Routed via Matrix row: Stevenson / Spec 7.b / Faculty: Barry W. Thomas").

## Standalone CV upload

A new upload mode triggered when the parser's initial scan finds **CV signals but no Standards/Specs structure**. The wizard skips Parse → Match → Matrix steps and jumps to a tiny dedicated screen:

> "We detected a CV for **Barry W. Thomas**. Which spec should this CV attach to?"
>
> [dropdown: choose spec, defaulted to 7.b based on matrix lookup if a prior self-study exists]
>
> [Confirm] [Cancel]

After confirm, the CV becomes a single CV-kind item under the chosen spec and the wizard goes straight to a one-spec Review screen for approval, then Apply. No matrix step, no parse step beyond the CV detector. End-to-end in under 30 seconds.

## Data model changes

### Client (`aiImportStore.ts`)

- Extend `ItemKind` union: `'text' | 'evidenceText' | 'file' | 'matrix' | 'tag' | 'cv'`.
- Extend `BucketItem`:
  - `facultyName?: string` — extracted from CV anchor line, displayed as the card's `displayLabel`.
  - `cvRouting?: { source: 'matrix' | 'heading' | 'matcher' | 'unplaced'; matrixRowAnchor?: string }` — for the routing badge in the preview pane.

### Server (`importController.ts` + spec content schema)

- Extend each spec's content schema with a new array:
  ```ts
  cvs: Array<{
    faculty_name: string;
    content_html: string;
    source_byte_offset: number;
    routing_source: 'matrix' | 'heading' | 'matcher' | 'unplaced';
    file_id?: string;        // populated at Apply time once a file is generated
    file_name?: string;      // e.g. "thomas_barry_cv.docx"
  }>;
  ```
- CV items round-trip through the existing import job → MongoDB → store pipeline. No new collection.

### ai-service (`import_jobs.py`)

- `_section_to_item` learns one new branch for `kind == 'cv'` — emits `facultyName`, `cvRouting` source, and the full CV body as `htmlSnippet` (with the existing `tableizeIfBareRows` defense).

## UI changes

### Review step — new kind section

`ItemCardList.tsx` already iterates a fixed set of kind sections. Add a new section between **Evidence** and **Matrices**:

```
Narratives          (existing)
Evidence Text       (existing)
Tags                (existing)
CV Supporting Evidence   (NEW)
Files               (existing)
Matrices            (existing)
```

Header reads `CV Supporting Evidence` with a `User`-shaped Lucide icon and the existing count badge. Each card:

- **Title:** faculty name (`item.facultyName`).
- **Body:** the first ~6 lines of the CV (preview only — the full body is in the right pane).
- **Routing badge:** small chip showing the routing source (e.g. "via Matrix row" with a tooltip).
- **Same action buttons** as text cards: Edit, Discard, Approve. Edit uses the same CR-032 textarea (coordinator can fix a typo in a degree title).

### Right preview pane

When a CV card is selected, the preview pane shows:

- Faculty name (large).
- Routing decision (which spec, why).
- The full CV content (same render path as evidence text — html-safe).
- "Place this item as:" dropdown is hidden for CV items (the kind is structural — you don't reclassify a CV as a Narrative).
- "Show in source" still works.

### Standalone-CV upload UI

New tiny step rendered when the parser detects "CV-only upload":

- Title: "We detected a CV"
- Faculty name field (pre-filled from CV header, editable).
- Spec dropdown (defaults to matrix lookup or last-used).
- Confirm → wizard skips ahead to Review with one card.

## Apply step

For every approved CV item under each spec, generate one `.docx` file:

- **Filename:** `{slugified_faculty_name}_CV.docx` (e.g. `thomas_barry_w_cv.docx`).
- **Content:** the CV html-snippet rendered to `.docx` via the existing `docx` library already used on the server.
- **Storage:** GridFS, same as other supporting-evidence uploads.
- **Spec attachment:** appended to the spec's `supportingFiles` array with `kind: 'cv'` and `faculty_name` metadata.

The generated files are visible to readers in the Supporting File Library under each spec.

## Telemetry

- `cv_detected_count` per import job — surfaced on the Parse step's stats line ("3 CVs detected").
- `cv_routing_breakdown` — counts by source so we can see how often the matrix-lookup path is winning.

## Acceptance criteria

1. A self-study with three faculty CVs embedded under Standard 7 results in **three** CV cards on the Review screen, each titled with the faculty name and each routed to a spec (typically 7.a/7.b/7.c).
2. CV cards never appear in the **Narratives** or **Evidence Text** kind sections.
3. The same coordinator who imported the document can Edit a CV card (typo fix), Discard a CV card (false positive), and Approve a CV card — all using the existing CR-032 controls.
4. A standalone CV `.docx` upload skips Parse / Match / Matrix and goes straight to a one-card Review screen with the spec dropdown defaulting to the best match.
5. After Apply, each approved CV is downloadable as a `.docx` from the Supporting File Library under its spec.
6. A self-study with **no** CVs produces zero CV cards (no false positives bleeding from regular narrative text).

## Out of scope

- Cross-document CV de-duplication (same faculty across two imports).
- Editing CV structure (degree-level fields).
- Converting an existing narrative card into a CV card via UI.
- Headshot/photo extraction.

## Engineering size

S-M. The detector is ~150 LOC of Python regex. The data-model + Apply changes are additive (no migrations). UI follows the existing kind-section pattern — copy/paste of the Narratives section with a different filter + icon. Total estimate: 2–3 days.

## Related

- [[cr-024-matrix-spec-bidirectional-link]] — routing precedence depends on matrix-row→spec resolution working.
- [[cr-025-ai-matrix-column-inference]] — knowing which matrix cell names a faculty member helps detect anchor lines.
- [[cr-032-inline-edit-review-cards]] — CV cards reuse the textarea editor.
- [[ai-import-wizard-e2e-regression-plan-2026-05-22]] — see "CV detection coverage" section for test plan.
- [[cr-034-e2e-seed-endpoint]] — required to write E2E tests that land on the Review screen with seeded CV items.
