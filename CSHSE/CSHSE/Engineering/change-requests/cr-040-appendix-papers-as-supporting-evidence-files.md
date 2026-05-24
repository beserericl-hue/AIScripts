---
name: CR-040 — Appendix research papers, student work samples, and syllabi become standalone supporting-evidence files (with image capture + post-parse coverage verification)
description: Self-study documents typically include an appendix with student work samples (research papers, country reports, immigrant interview papers) AND course syllabi documents. Today these blocks land in the importer as long, flattened narrative cards that lose their structure, lose their images, and don't attach to the standard the way readers expect (one file = one piece of supporting evidence). This CR teaches the parser to detect appendix-paper AND syllabus blocks, extract each as a standalone file (.docx with embedded images), store them in S3, and represent them in the wizard as supporting-evidence file cards. A post-parse VERIFICATION stage proves every source byte is accounted for — bucket, intro, paper, syllabus, CV, unplaced, or explicit skip — and surfaces any missing fragments to the coordinator as a new "Missing from import" section on the Review screen. No wizard UI redesign — just a new card kind + a coverage stat + the missing-fragments section.
type: change-request
cr_id: CR-040
status: in-progress
priority: P0
source: User observation 2026-05-23 on Stevenson "Sample Country Report" (South Korea) + "Immigrant Interview Paper" embedded in the source-doc appendix. Quote — "The AI importer must see that this is a research paper as the text ahead of the paper flags it as such... NOTE there are images in this paper and these images must be captured. The best option is to create a file during the parsing, store the file in S3 and create a link in supporting evidence tile that there is a file stored. In that way we don't have to change the UI of the import wizard except to show the summary in the tile and allow viewing of that file." Addendum 2026-05-23 — "Additional files imported and shown in the document are Syllabi documents. These documents should be treated just like the research papers and stored as files with images and listed in tiles with summary and link to the file. In generation of Supporting evidence files, Syllabi could be imported as standalone documents."
sprint_target: Sprint 4 — coordinator-blocking; pairs with CR-033 (CVs) and CR-039 (Introductions) as the four "new content kinds" PCs need before next round of imports (papers, syllabi, CVs, intros).
tags: [wizard, parse, ai-service, server, s3, supporting-evidence, images, p0, appendix, research-paper, syllabus]
last_reviewed: 2026-05-24
---

# CR-040 — Appendix papers as standalone evidence files

## Phase 1 shipped 2026-05-24 — data shape + apply skeleton

Only the data shape landed today so Phase 2/3 (ai-service detection, image capture, .docx generation, S3 upload, UI cards) can land in follow-on sessions without schema churn.

What landed:
- **Client store**: `'evidenceDoc'` added to `ItemKind`. New `EvidenceDocItem` type with the per-paper/syllabus metadata shape from the spec (title/author/date/courseCode/subject/points/pageCountEstimate/imageCount/summary/byteOffsetStart + S3 fields populated only post-Phase-2). `evidenceDocs: EvidenceDocItem[]` field defaults to `[]`. `setEvidenceDocs` action. Persisted via partialize.
- **Client apply()**: sends `evidenceDocs` array (empty until Phase 2 fills it).
- **Server schema**: `SelfStudyImport.aiEvidenceDocs: Mixed[]` (defaults to `[]`).
- **Server apply path**: receives and persists `payload.evidenceDocs` so a hard refresh post-apply still surfaces them.

What remains for Phase 2 (per the body below):
- ai-service `appendix_paper_detector.py` + syllabus rules
- ai-service image capture (fix `contains_image=False` constant) + per-section image list
- ai-service `.docx` generation via python-docx
- Server: S3 upload pipeline (mirror to import-scoped + submission-scoped keys) + DocumentRef linkage on Apply
- Client: card variant with "View file" button + metadata block + standalone-upload entry point on Upload step
- Post-parse coverage verification stage (full spec at the bottom of this CR)

CR stays `in-progress` until Phase 2/3 ship.



## Source quote

User, 2026-05-23 (after viewing the Stevenson "Sample Country Report — South Korea" landing as a single 88-word card in a spec on Standard 21):

> "As supporting evidence of a standard, the PC imported a paper in the original document. This paper was in the appendix of the document and supports the narrative of the standard. This is probably going to be imported in the wizard as a stand alone document to be imported into the spec as a supporting evidence file or will already be in the document as this paper is. There are two issues. The AI importer must see that this is a research paper as the text ahead of the paper flags it as such. There are two markers noted in the image Table of Contents. The marker in the original document means that the table of contents lists the paper in the appendix. NOTE there are images in this paper and these images must be captured. The best option is to create a file during the parsing, store the file in S3 and create a link in supporting evidence tile that there is a file stored. In that way we don't have to change the UI of the import wizard except to show the summary in the tile and allow viewing of that file."

## What's broken today

Three independent failure modes, all visible in the Stevenson screenshot:

### Failure 1 — Appendix papers land as narrative text

The Stevenson appendix contains multiple student work samples: "Sample Country Report" (South Korea, 7/19/2019), "Immigrant Interview Paper" (CHS 220 Spring 2019, 200 points), etc. Each paper has its own internal structure — title, course code, points, narrative body, citations, figures. Today the parser walks them as ordinary paragraphs. They get bucketed as long, flattened narrative cards under whichever spec the matcher thinks is closest. Readers can't open them as files; they're just walls of text inside a wizard tile.

### Failure 2 — Images are silently stripped

Confirmed by code audit: `ai-service/app/splitter/deep_walker.py` sets `contains_image=False` on every section it emits (lines 295, 376, 546 — literal constant, never updated). The pipeline has no image-capture path. The South Korea report's map of Korea, the Seoul skyline photo, every figure across every appendix paper — all gone after parse. A coordinator who reviews the wizard cards has no idea their document contained images at all. After Apply, those images are not in the self-study.

### Failure 3 — Standalone re-upload doesn't route automatically

If the coordinator notices that a paper is missing and uploads it separately (`Sample-Country-Report-South-Korea.docx`), today's wizard treats it as a generic file upload. There's no routing — the file just lands and the coordinator has to manually pick a spec for it. The standalone path needs to mirror the embedded path: detect → route → file card.

## Decision (summary)

A new card kind — `'evidenceDoc'` (or extend the existing `'file'` kind with a `subKind: 'paper'`) — represents a multi-page appendix document that has been extracted from the source, packaged as a `.docx` (or `.pdf`), uploaded to S3, and attached to its target spec. The wizard tile shows a compact summary (title, author/student, date, page count, image count, "View file" button). No new edit modes — coordinators view the file in a new tab, click Discard if the AI got it wrong, or click Reassign to move it to a different spec. Same Edit / Discard / Approve buttons as other text cards, except Edit opens the file viewer instead of a textarea.

Detection runs in the ai-service splitter, deliberately conservative: false negatives (a paper that wasn't detected and stays as a narrative card) are recoverable; false positives (an arbitrary paragraph being turned into a "file") are confusing. Bias toward conservative detection.

## Design

### Detection (ai-service)

A new module `ai-service/app/splitter/appendix_paper_detector.py`. Runs after `deep_walker` produces the section stream, before the matcher routes them.

A section is an **appendix-paper candidate** when ALL three signals are present within a short window:

1. **Header marker** — one of (case-insensitive, line-anchored):
   - Line ending in `(NN points)` — e.g. `"RESEARCH PAPER (Individual Work) (125 points)"`
   - Line matching `^(Sample\s+)?[A-Z][a-z]+\s+(Report|Paper|Project|Essay|Reflection|Interview)$` — e.g. `"Sample Country Report"`, `"Immigrant Interview Paper"`
   - Course-code line `^[A-Z]{2,5}\s+\d{2,4}` near the header — e.g. `"CHS 220 Spring 2019"`

2. **Position context** — the candidate sits AFTER the appendix marker (a line `^Appendix\s*[A-Z]?\s*$`, or after the document's main TOC has been seen, or the section's `byte_offset_start` is in the last 25% of the document).

3. **Body length** — at least 200 words OR contains at least one image (once Failure 2's fix lands).

Boundary detection: the paper ends at the next appendix-paper candidate, the next "Table of Contents" marker within the appendix (which the user pointed out lists multiple papers), end of document, or a CSHSE-template marker like `Standard \d` (which shouldn't appear inside an appendix but bounds defensively).

**Extracted metadata per paper:**

```python
{
  "kind": "evidenceDoc",
  "title": "Sample Country Report",
  "author": "Susan",                 # detected from header block, optional
  "date": "2019-07-19",               # detected from header block, optional
  "course_code": "CHS 220",           # detected from header block, optional
  "subject": "South Korea",           # detected from header block, optional
  "points": 125,                       # detected from header block, optional
  "page_count_estimate": 12,           # word_count / ~300 + figure count
  "image_count": 2,
  "byte_offset_start": 1834200,
  "summary": "First ~200 chars of body, plain text",
}
```

### Image capture — fixing Failure 2

Today's `deep_walker.contains_image=False` hardcoded constant must go. Two layers of work:

1. **Walker change.** When the walker encounters an `<img>` tag (mammoth converts `.docx` images to inline `<img src="data:image/...;base64,...">`), capture each image into a per-section list:

   ```python
   section.images = [
     ImageRef(
       mime="image/png",
       byte_offset=N,                # position within the section
       data_base64="...",            # the actual bytes
       alt_text=img.get('alt', '')
     ),
     ...
   ]
   section.contains_image = bool(section.images)
   ```

   Cap per-image size at 5 MB (real-world coordinator docs have screenshots, not raw camera images). Sections with >10 MB total of images get logged + truncated so a runaway image doesn't OOM the matcher.

2. **Wire-format change.** Sections are serialized to the cshse-server callback. Add `images: List[ImageRef]` to the section payload. Server-side, route images through the existing `s3Service.ts` upload path — one S3 object per image, key pattern `imports/<importId>/section-<sectionId>/img-<n>.<ext>`.

### File generation — the .docx packaging

When a section is detected as `evidenceDoc`, the ai-service produces a fresh `.docx` containing:

- The paper's body text (preserving headings + paragraphs + lists)
- Inline images at their original positions
- A footer line: `Extracted from <original-self-study-filename> on <timestamp> via AI Import`

Python's `python-docx` library handles this; we're already converting from docx to html and back is a 1:1 round-trip for body content + inline images.

The generated `.docx` is uploaded to S3 with key `imports/<importId>/papers/<slugified-title>.docx`. The S3 URL + size + content-hash go into the section payload alongside the metadata above.

**Why .docx and not .pdf:** the docx round-trip preserves edit-ability (a reviewer could open in Word and add comments) and matches the format the coordinator uploaded. PDF could be a follow-on (Word → PDF is a one-liner using the existing LibreOffice path).

### Server wire-up

`server/src/controllers/aiImportController.ts` learns about `evidenceDoc` sections. They flow into a new bucket field:

```ts
aiEvidenceDocs?: Array<{
  sectionId: string;
  title: string;
  author?: string;
  date?: string;
  courseCode?: string;
  subject?: string;
  points?: number;
  pageCountEstimate: number;
  imageCount: number;
  summary: string;
  byteOffsetStart: number;
  s3Key: string;              // for download
  s3SignedUrlExpiry: Date;    // server refreshes signed URL on demand
  fileSize: number;
  resolvedStd?: string;       // matcher's spec routing (same logic as narratives)
  resolvedSpec?: string;
}>;
```

Routing: the same matcher that places narratives places `evidenceDoc` items. The matcher's prompt receives the title + summary + metadata; it returns spec routing exactly like for narratives. Confidence < threshold → goes to Unplaced.

### Apply

At Apply time, for each approved `evidenceDoc`:

1. Copy the S3 object from the import-scoped key to a submission-scoped key: `submissions/<submissionId>/supporting-evidence/<paper-title>.docx`.
2. Create a `DocumentRef` on the Submission's `documents` array OR append to the resolved spec's supporting-evidence list (whichever existing schema is more natural — `Submission.documents` looks right per the model audit).
3. Link the doc to the resolved spec via the existing supporting-evidence join mechanism (the legacy importer already does this for uploaded files; reuse).

### UI changes — minimal, per user direction

The user's explicit ask: don't redesign the wizard UI.

**SpecRail:** no change. EvidenceDoc items count toward the bucket's `count` badge.

**ItemCardList:** new compact card variant for `evidenceDoc`. Layout:

```
┌──────────────────────────────────────────────────────────────┐
│ 📄 Sample Country Report               [Edit] [Discard] [Appr]│
│    Susan · 7/19/2019 · CHS 220 · 125 points                  │
│    South Korea · 12 pp · 2 images                            │
│                                                               │
│    "South Korea, also named Republic of Korea, is located    │
│    in East Asia on the Southern half of the Korean Peninsula │
│    'jutting out from the far east of the Asian land mass     │
│    into the Yellow Sea'..."                                  │
│                                                               │
│    [📂 View file (Sample-Country-Report.docx, 487 KB)]       │
└──────────────────────────────────────────────────────────────┘
```

- The "View file" button opens a signed S3 URL in a new tab.
- Edit on `evidenceDoc` cards is disabled (or repurposed to "Replace file" — drag-drop a new `.docx` to swap the AI-detected one with a hand-curated version).
- Discard removes the card AND deletes the S3 object (uses the existing CR-033 confirm dialog pattern).
- Approve, Reassign, Show in source all work the same as for narratives.

**ItemPreview (right pane):** when an `evidenceDoc` card is selected, the preview shows the same compact summary in a slightly larger format, plus the routing badge (matrix / heading / matcher), plus the "View file" button.

### Standalone upload — fixing Failure 3

A new entry point on the wizard's Upload step: drag-drop a `.docx` that's clearly a paper (not a self-study). The detector runs on the standalone file using the same heuristic; if confirmed, the wizard skips Parse / Match / Matrix and lands on a one-card review screen with a spec dropdown. Same shape as CR-033's standalone-CV path.

The user wrote: "This is probably going to be imported in the wizard as a stand alone document to be imported into the spec as a supporting evidence file or will already be in the document as this paper is." — both paths supported.

## Data model summary (additions only)

**Client (`aiImportStore.ts`):**

```ts
export type ItemKind =
  | 'text'
  | 'evidenceText'
  | 'file'
  | 'matrix'
  | 'tag'
  | 'introduction'      // CR-039
  | 'cv'                // CR-033
  | 'evidenceDoc';      // CR-040 — NEW
```

**Server (`SelfStudyImport.ts`):**

```ts
aiEvidenceDocs?: IAIEvidenceDoc[];    // new — see shape above
```

No migration. Existing fields untouched.

## Telemetry

- `evidence_doc_detected_count` per import — number of appendix papers extracted.
- `evidence_doc_image_count` — total images preserved.
- `evidence_doc_image_dropped_count` — images that exceeded the 5 MB / 10 MB caps and were truncated; surface in the Parse step's stats line so coordinators know.
- `evidence_doc_routing_breakdown` — how many were placed by matrix / heading / matcher / unplaced.

## Acceptance criteria

1. A Stevenson reimport produces at least 1 `evidenceDoc` card for the "Sample Country Report" and 1 for the "Immigrant Interview Paper" — each titled, dated, authored where detectable.
2. Each `evidenceDoc` card shows a "View file" affordance that opens the generated `.docx` in a new tab. Opening the file shows the paper's text AND the embedded images (map of Korea, Seoul photo).
3. The wizard tile is compact — does NOT show the full paper body as a wall of text inside the card.
4. `contains_image` is true on every section that had images in the source; the section payload from ai-service carries the image bytes; the server uploads them to S3; the URLs are reachable.
5. A self-study with ZERO appendix papers (a one-section wizard test) produces zero `evidenceDoc` cards — no false positives from random body paragraphs.
6. A standalone `.docx` upload that's clearly a research paper skips Parse / Match / Matrix and goes straight to a one-card review screen with a spec dropdown defaulting to the matcher's best guess.
7. After Apply, each approved `evidenceDoc` appears in the Submission's `documents` array AND links to its target spec via the existing supporting-evidence mechanism. Files visible in the Supporting File Library tab.
8. Discarding an `evidenceDoc` removes the card AND deletes the S3 object — no orphan files left behind.
9. Image-cap telemetry surfaces in the Parse step when any image was truncated or dropped, so the coordinator knows.

## Out of scope

- PDF generation (defer; .docx is fine for v1, PDF is a one-liner via LibreOffice if needed later).
- Re-OCR / re-recognition of image text (if the image contains diagrams with key data, that data stays as image only — coordinator can re-upload a transcribed version).
- Splitting one long paper into multiple files (each detected paper = one file).
- Cross-paper de-duplication if the same paper appears in two self-studies.
- Inline image editing / cropping.
- Image alt-text generation (preserved if present in source; not auto-generated).

## Risk

- **False positives.** A long narrative paragraph could match the title/length heuristic. Mitigated by the 3-signal AND requirement + the appendix-position requirement.
- **Image-bytes payload bloat.** A 50-page paper with 20 photos could push the ai-service → cshse-server callback payload past Express's default 100 MB limit. Mitigation: stream images directly from ai-service to S3 (skip the round-trip through cshse-server), then send only S3 keys in the callback. Adds AWS credentials to ai-service config but the existing s3Service.ts pattern is portable.
- **Word `.docx` regeneration fidelity.** python-docx preserves text + simple formatting + inline images cleanly but loses fancy elements (Smart Art, complex tables, comments). Acceptable for v1 — coordinators can re-upload a hand-curated version if fidelity matters.
- **Cap-and-drop image silently.** Caps protect the pipeline but coordinators won't know an image was dropped unless we surface it. Telemetry + Parse-step banner addresses this.
- **Spec routing ambiguity.** Appendix papers often relate to multiple standards. Matcher picks one; coordinator reassigns if wrong (existing flow).

## Engineering size

M-L. Estimated:

- ai-service appendix-paper detector: ~1 day
- ai-service image-capture (walker changes + section payload): ~1 day
- ai-service `.docx` packaging (python-docx integration): ~0.5 day
- ai-service direct-to-S3 upload (avoid payload bloat): ~0.5 day
- Server-side `aiEvidenceDocs` + Apply path: ~0.5 day
- Client store + ItemCardList card variant + ItemPreview file viewer: ~1 day
- Standalone upload path (mirror CR-033 pattern): ~0.5 day
- E2E test (`24_evidence_doc.spec.ts`): ~0.5 day

**Total: ~5.5 days.**

## Sequencing

1. Walker + image capture (silent change; images start flowing but no UI yet).
2. ai-service detector + S3 packaging + server `aiEvidenceDocs` field.
3. Client card variant.
4. Apply path + post-Apply Supporting File Library wire-up.
5. Standalone upload path.
6. E2E coverage.

Each step ships independently. Image capture alone (step 1) is valuable even without the detector — coordinators stop losing their images entirely.

## Addendum 2026-05-23 — Syllabi as the same kind

User addendum:

> "Additional files imported and shown in the document are Syllabi documents. These documents should be treated just like the research papers and stored as files with images and listed in tiles with summary and link to the file. In generation of Supporting evidence files, Syllabi could be imported as standalone documents."

### Why syllabi belong here

Syllabi sit alongside research papers in the same appendix region of every CSHSE self-study (visible in the screenshots: the "Table of Contents" → "Syllabi" → "Sample Country Report" / "Immigrant Interview Paper" chain). Coordinators bundle 20-50 syllabi per program into the back of their self-study to evidence Standard 19 (knowledge / theory / skills coverage), Standard 21 (field experience preparation), and others. They have the same characteristics as research papers — multi-page, often with embedded course-schedule tables and images, attached as evidence under specific standards.

Treating them as a separate detection / packaging path would duplicate every layer of this CR for no benefit. The fix: **the same `evidenceDoc` kind covers both**, with an additional `docSubKind: 'paper' | 'syllabus'` field on the section payload for telemetry and minor UI differentiation (icon choice).

### Detection — extending the existing heuristic

Add a fourth signal-set to `appendix_paper_detector.py` for syllabus candidates. A section is a **syllabus candidate** when ALL of these are present:

1. **Header marker** — one of (case-insensitive, line-anchored):
   - A course code line `^[A-Z]{2,5}\s+\d{2,4}[A-Z]?\s*[—–-]?\s*.{0,80}$` — e.g. `"HUSR 101 – Introduction to Human Services"`
   - Title line containing the word `Syllabus` (any case) — e.g. `"COURSE SYLLABUS: HUSR 220"`
   - A heading inside an explicit "Syllabi" appendix region (the user's noted appendix marker)

2. **Syllabus-shape markers** — within 30 lines after the header, at least TWO of: `Course Description`, `Learning Outcomes`, `Required Text`, `Grading`, `Assignments`, `Office Hours`, `Course Schedule`, `Prerequisites`, `Attendance Policy`, `Course Calendar`, `Week 1`/`Week 2`/... pattern.

3. **Position context** — same as papers (after appendix marker, or after main TOC, or in the last 25% of the document by byte offset).

4. **Length / structure** — at least 150 words OR contains a course-schedule table (detected by presence of a `<table>` with a week-number column).

Boundary: closes at the next syllabus candidate, next paper candidate, end of "Syllabi" appendix region, end of document.

### Metadata captured per syllabus

```python
{
  "kind": "evidenceDoc",
  "docSubKind": "syllabus",
  "title": "HUSR 220 — Introduction to Counseling",
  "course_code": "HUSR 220",
  "course_title": "Introduction to Counseling",
  "term": "Spring 2024",          # detected from header, optional
  "instructor": "Dr. Jane Smith", # detected from header, optional
  "credits": 3,                    # detected from header, optional
  "page_count_estimate": 8,
  "image_count": 0,
  "byte_offset_start": ...,
  "summary": "First ~200 chars of body",
}
```

### Routing

Syllabi most often evidence Standards 12-19 (curriculum, knowledge, theory, skills). The matcher receives `docSubKind: 'syllabus'` as a soft hint to bias toward those standards but stays free to route elsewhere when the course code clearly maps to a different specialization (e.g., a "Research Methods" syllabus may belong to Standard 17). Same confidence threshold + fallback to Unplaced as for papers.

### UI

The compact card variant gets a different icon for syllabi — `BookOpen` from Lucide vs `FileText` for papers. Otherwise identical:

```
┌──────────────────────────────────────────────────────────────┐
│ 📚 HUSR 220 — Introduction to Counseling   [Edit][Discard][Approve]│
│    Dr. Jane Smith · Spring 2024 · 3 credits                  │
│    8 pp · 0 images                                            │
│                                                               │
│    "This course introduces students to foundational          │
│    counseling theories, the helping relationship, and        │
│    ethical practice in human services settings..."           │
│                                                               │
│    [📂 View file (HUSR-220-syllabus.docx, 142 KB)]           │
└──────────────────────────────────────────────────────────────┘
```

If the wizard ends up with 30+ syllabi (realistic for a large program), the ItemCardList stays usable because the cards are compact. A future optional grouping ("Show 30 syllabi as a collapsible list") can land as a small follow-on if coordinators request it.

### Standalone syllabus upload

Same path as standalone CV (CR-033) and standalone paper. A `.docx` upload that the detector classifies as a syllabus skips Parse / Match / Matrix, opens a one-card review screen with a spec dropdown, and confirms into the wizard's Review state. Coordinators routinely receive late-add syllabi from instructors and need a quick path to attach them — this covers it.

### Telemetry additions

- `syllabus_detected_count` per import.
- `evidence_doc_subkind_breakdown = {paper: N, syllabus: N}`.
- Routing breakdown for syllabi separately so we can tune the standard-bias hint.

### Acceptance criteria additions

10. A Stevenson reimport produces an `evidenceDoc` card with `docSubKind: 'syllabus'` for each course syllabus found in the appendix — each titled with course code + course title, attributed to instructor + term where detectable.
11. Syllabus cards use a distinct icon (BookOpen) so they are visually distinguishable from paper cards in the same SpecRail bucket.
12. A standalone syllabus `.docx` upload classifies correctly and routes through the one-card review path.
13. A self-study with both papers AND syllabi correctly emits both kinds — no cross-classification (papers detected as syllabi or vice versa) when the header markers are clearly present.
14. Coordinator can Discard a misclassified syllabus, or Reassign to a different spec, using the existing controls — no new UI.

### Engineering size adjustment

Syllabus support adds ~0.5 day on top of the original ~5.5-day estimate (the detector module gains a parallel rule-set; everything else is shared). **Revised total: ~6 days.**

### Out of scope (syllabi specifically)

- Auto-extraction of structured fields (learning outcomes, grading rubric) — syllabi land as opaque files; coordinators don't need them parsed.
- Cross-syllabus coverage analysis ("are all standards covered by the curriculum?") — separate feature, separate CR.
- Per-week schedule visualization — out of scope for v1.

## Addendum 2026-05-23 — Post-parse coverage verification

User direction:

> "Can you design a correction step after parsing to make sure that all of the text from the original doc was imported into the bucket? This should be a check against the entire document and the paper boundaries."

### Why this addendum lives in CR-040 (and not a standalone CR)

CR-040 introduces the highest-risk boundary detector in the whole pipeline — papers + syllabi extracted from an appendix have to be cleanly bounded against (a) surrounding narrative material, (b) each other, and (c) the document tail. A wrong boundary by even one paragraph means either the paper is missing its last page OR the next paper / a chunk of narrative got pulled in by mistake. The verification step described here is the natural counterpart: extract aggressively, then prove the extraction was complete and didn't drop or duplicate any source bytes.

The same check incidentally covers CR-033 (CVs), CR-039 (Introductions), and the existing narrative / evidence / tag pipeline — but those code paths are mature enough that they would not justify the work on their own. CR-040's boundary risk is what makes the verification mandatory; everyone else benefits as a side effect.

If the team later decides this verification is too coupled to CR-040 conceptually, lift it to a standalone CR-043 in the next revision. For now it ships as part of CR-040 so the new detector and the new safety net land together.

### The verification rule, in one sentence

**Every byte of the source document must be accounted for in exactly one destination: a bucket item, an Introduction, an evidenceDoc (paper / syllabus), a CV, an Unplaced item, or an explicit "skip" category (page numbers, footers, TOC entries, blank lines, image-only paragraphs already represented elsewhere).** Unaccounted byte ranges = a coverage gap to surface.

### Design — a new "Verification" stage

Insert a stage after `matcher` in the ai-service pipeline:

```
Document Reader → Reading structure → Building chunks → Embedding → Indexing →
Matcher → Verification    ← NEW
```

The Verification stage runs in three passes:

#### Pass 1 — Byte-range assignment census

After matcher completes, the ai-service has, for every section it emitted, a `byte_offset_start` (already exists per CR-031) and the destination it was routed to (bucket key, kind, sectionId).

Build an interval map covering [0, document_byte_length):

```python
assignments = {
  "bucket:1.a:narrative":     [(1000, 1437), (2200, 2890), ...],
  "bucket:7.b:evidenceText":  [(7100, 7400), ...],
  "introduction:standard-1":  [(450, 990), ...],
  "introduction:document":    [(0, 450), ...],
  "evidenceDoc:paper:abc":    [(50000, 78000)],
  "evidenceDoc:syllabus:def": [(78001, 92000)],
  "cv:thomas-barry":          [(45000, 49500)],
  "tag:abc123":               [(15000, 15280)],
  "unplaced:xyz":             [(15500, 16000)],
  "skip:page-numbers":        [(7400, 7410), (15280, 15290), ...],
  "skip:tot-entries":         [(60, 450)],  # main document Table of Contents
  "skip:image-only-para":     [(50000, 50050)],
}
```

The skip categories are intentionally explicit — we don't silently discard anything; we explicitly classify each discard so the audit log is complete.

#### Pass 2 — Gap detection

Walk the byte axis [0, document_byte_length) and find any range not covered by Pass 1's assignments. Each gap becomes a `MissingFragment` record:

```python
MissingFragment(
  byte_offset_start=15290,
  byte_offset_end=15510,
  text="During the fourth republic, Park developed Saemaul Undong...",
  word_count=42,
  preceding_context_summary="Tag #3 about Korean economic policy",  # whichever assignment ends at 15290
  following_context_summary="Unplaced fragment xyz",                  # whichever assignment starts at 15510
)
```

Gaps below a threshold (e.g. < 20 words AND not adjacent to a boundary-sensitive assignment like an evidenceDoc) are auto-classified as `skip:whitespace-or-noise` and not surfaced. This keeps the coordinator-facing list focused on real misses.

#### Pass 3 — Boundary validation (CR-040-specific)

For each `evidenceDoc` (paper or syllabus) assignment, run a boundary sanity check:

- **Sentence-edge check.** The byte at `byte_offset_start` should be the start of a sentence (not mid-word, not mid-sentence). Same for `byte_offset_end` (should be sentence-end). Detect by looking at the surrounding 100 bytes for `^[A-Z]` / `[.!?]$` patterns. If violated, log a `BoundaryWarning`.
- **Header-line check.** The first line at `byte_offset_start` should match the paper/syllabus header signal that triggered detection in the first place. If the bytes there don't match the recorded header, the boundary drifted — log a `BoundaryWarning`.
- **No-orphan-paragraph check.** The byte BEFORE `byte_offset_start` should belong to a different assignment (not just whitespace). If it's an orphan unassigned paragraph, that paragraph likely belonged INSIDE the paper but the boundary detector cut it off. Log a `BoundaryWarning`.

BoundaryWarnings are surfaced on the Parse step as a yellow advisory (not a red error) — they're informational. The coordinator can choose to re-cut the boundary via the Review-step controls.

### Surfacing missing fragments to the coordinator

A new section on the Review screen, sitting alongside Unplaced:

```
SpecRail (left):
  ...
  Unplaced              (12)
  Missing from import   (3)    ← NEW (only shown if count > 0)
```

Cards in "Missing from import" look like Unplaced cards but with:

- A distinct icon (warning triangle) so they stand out as "something the system thought was missing" vs. Unplaced ("something the AI didn't know how to place").
- A `Why is this here?` tooltip explaining the gap (e.g., "Found between an Unplaced tag and the start of the Sample Country Report paper, but not assigned to any destination.").
- The same controls as Unplaced cards: Reassign to a spec / Append to spec X.Y / Discard explicitly (which adds it to the audit log as `skip:coordinator-discarded`).

Once the coordinator has placed (or explicitly discarded) every Missing fragment, the count drops to zero and the section collapses.

### Telemetry surfaced on the Parse step

The Parse step's stats line (today "212 narratives · 64 evidence text · 9 evidence files · 412 matrix cells") gains coverage metrics:

```
212 narratives · 64 evidence text · 9 evidence files · 412 matrix cells ·
4 papers · 12 syllabi · 5 introductions · 2 CVs ·
COVERAGE: 99.2% (3 fragments missing, 1.4 KB)  [Review →]
```

Color cues:
- **Green** ≥ 99.5% — virtually complete; missing fragments are likely noise.
- **Amber** 95.0% – 99.5% — typical; a handful of fragments to triage.
- **Red** < 95.0% — investigate; the parser may have lost a section.

Below 90% coverage, the wizard refuses to advance to Review at all — that's a parser failure, not a coordinator-review problem; force a re-run.

### Data model additions

**ai-service section payload** gains the verification output:

```python
{
  "coverage_percentage": 99.2,
  "assigned_bytes": 487_240,
  "total_bytes": 491_184,
  "missing_fragments": [MissingFragment(...), ...],
  "boundary_warnings": [BoundaryWarning(...), ...],
  "skip_categories": {
    "page-numbers": 234,
    "tot-entries": 1820,
    "image-only-para": 850,
    "whitespace-or-noise": 540,
  }
}
```

**Server `SelfStudyImport.ts`** gains:

```ts
aiCoverageReport?: {
  coveragePercent: number;
  totalBytes: number;
  assignedBytes: number;
  missingFragments: IAIMissingFragment[];
  boundaryWarnings: IAIBoundaryWarning[];
  skipBreakdown: Record<string, number>;
};
```

**Client store** gains a `missingFragments` array merged into the Review step similarly to how Unplaced is handled today.

### What happens at Apply

Missing fragments must be resolved (placed somewhere or explicitly discarded) before Apply enables — same gate pattern as today's "approve everything" rule. The Apply payload includes the coordinator's resolution of each fragment so the audit log shows what happened to every byte.

### Failure modes the verification catches

| Today's silent failure | Verification catches it as |
|---|---|
| deep_walker drops a paragraph between two sections | MissingFragment in Pass 2 |
| Paper-boundary detector cuts off the last page of a syllabus | BoundaryWarning in Pass 3 (sentence-edge check) + MissingFragment for the cut-off page |
| Two adjacent papers run together and only one is detected | BoundaryWarning + MissingFragment for the second paper's bytes (which fall outside the first paper's range) |
| Intro detector misses a glossary section that lives between two standards | MissingFragment in Pass 2 (won't be in any standard's intro bucket) |
| Mammoth fails to extract a text run from a complex docx element | MissingFragment for the source bytes that contained the text |
| Image-only paragraph whose alt text was actually critical (e.g., a complex diagram label) | Classified as `skip:image-only-para` BUT a future enhancement could prompt "this was image-only — review the source if alt text matters" |

### Acceptance criteria additions

15. After parsing, the Parse step shows a coverage percentage. Green ≥ 99.5%, amber 95–99.5%, red < 95%.
16. A Stevenson reimport with the appendix detector running shows coverage > 95% (with the 5% allowance covering legitimate skip categories: page numbers, main TOC, image-only paragraphs).
17. Manually deleting the boundary-end of a detected paper (forcing it to truncate at, say, byte 70000 instead of 78000) results in: (a) a MissingFragment for bytes 70000-78000, (b) a BoundaryWarning on the paper, (c) the coverage % drops to reflect the lost bytes.
18. The "Missing from import" section appears on the Review screen iff there are missing fragments to resolve.
19. Apply is gated until every missing fragment is resolved (placed or explicitly discarded).
20. Coverage < 90% blocks Review entirely with an actionable error ("Parser produced insufficient coverage; retry or contact support with import id ABC").
21. Resolution of every fragment is recorded in the import's audit trail with: original byte range, coordinator's decision, timestamp.

### Engineering size

Adds ~2 days to the original CR-040 estimate:

- Verification stage (Pass 1 byte-range census + Pass 2 gap detection + Pass 3 boundary validation): ~1 day
- Server `aiCoverageReport` schema + Apply gate: ~0.25 day
- Client `MissingFragments` SpecRail section + card variant + coverage stat on Parse: ~0.75 day

**Revised total for CR-040: ~6 d (original) + ~0.5 d (syllabi) + ~2 d (verification) = ~8.5 days.**

### Out of scope (verification specifically)

- Automatic re-cutting of bad paper boundaries — the verification surfaces problems but doesn't auto-fix them; the coordinator decides via the existing Reassign / Discard controls.
- Cross-document de-duplication of fragments (if a fragment looks identical to a placed item in another bucket).
- Predictive coverage modeling ("based on past imports, expect ~96% coverage").
- OCR of image regions that the verification flagged as `skip:image-only-para`.
- Editing the source document mid-import to fix something the verification surfaced (the source is treated as immutable; coordinator re-uploads if they need to change it).

### Sequencing within CR-040

Insert two new steps into the original 6-step sequence:

1. Walker + image capture
2. ai-service detector + S3 packaging + server `aiEvidenceDocs` field
3. **Verification stage (Pass 1 + Pass 2)** — NEW; produces coverage report + missing fragments
4. Client card variant
5. Apply path + post-Apply Supporting File Library wire-up
6. **Verification UI — coverage stat on Parse + Missing-from-import section on Review** — NEW
7. **Boundary validation (Pass 3)** — NEW; surfaces BoundaryWarnings
8. Standalone upload path
9. E2E coverage (extend `24_evidence_doc.spec.ts` with verification assertions)

Pass 3 ships last because it depends on the boundary metadata that the detector emits — but Pass 1 + 2 are valuable on their own even before boundary validation lands.

## Related

- [[cr-033-cv-supporting-evidence]] — sibling detector; same s3 + file-card pattern. Code can share infrastructure.
- [[cr-039-standard-introduction-buckets]] — sibling new-kind CR; same data-model pattern.
- [[cr-037-empty-buckets-guard]] — `evidenceDoc` items must count toward the "any data?" check.
- [[../critical-error-processing-review-2026-05-22]] — Failure 2 (silent image strip) is a new Finding to add to that review under the same Theme A "silent successes are worse than loud failures."
- [[../ai-import-wizard-e2e-coverage-review-2026-05-22]] — add `24_evidence_doc.spec.ts` (covers both papers + syllabi) to Tier 1.
