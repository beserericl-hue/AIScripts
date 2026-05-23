---
name: CR-040 — Appendix research papers / student work samples become standalone supporting-evidence files (with image capture)
description: Self-study documents typically include an appendix with student work samples (research papers, country reports, immigrant interview papers, syllabi). Today these blocks land in the importer as long, flattened narrative cards that lose their structure, lose their images, and don't attach to the standard the way readers expect (one file = one piece of supporting evidence). This CR teaches the parser to detect appendix-paper blocks, extract them as standalone files (.docx with embedded images), store them in S3, and represent them in the wizard as supporting-evidence file cards — same shape as if the coordinator had uploaded the paper separately. No wizard UI redesign — just a new card kind that shows a summary + view-file affordance.
type: change-request
cr_id: CR-040
status: proposed
priority: P0
source: User observation 2026-05-23 on Stevenson "Sample Country Report" (South Korea) + "Immigrant Interview Paper" embedded in the source-doc appendix. Quote — "The AI importer must see that this is a research paper as the text ahead of the paper flags it as such... NOTE there are images in this paper and these images must be captured. The best option is to create a file during the parsing, store the file in S3 and create a link in supporting evidence tile that there is a file stored. In that way we don't have to change the UI of the import wizard except to show the summary in the tile and allow viewing of that file."
sprint_target: Sprint 4 — coordinator-blocking; pairs with CR-033 (CVs) and CR-039 (Introductions) as the three "new content kinds" PCs need before next round of imports.
tags: [wizard, parse, ai-service, server, s3, supporting-evidence, images, p0, appendix, research-paper]
last_reviewed: 2026-05-23
---

# CR-040 — Appendix papers as standalone evidence files

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

## Related

- [[cr-033-cv-supporting-evidence]] — sibling detector; same s3 + file-card pattern. Code can share infrastructure.
- [[cr-039-standard-introduction-buckets]] — sibling new-kind CR; same data-model pattern.
- [[cr-037-empty-buckets-guard]] — `evidenceDoc` items must count toward the "any data?" check.
- [[../critical-error-processing-review-2026-05-22]] — Failure 2 (silent image strip) is a new Finding to add to that review under the same Theme A "silent successes are worse than loud failures."
- [[../ai-import-wizard-e2e-coverage-review-2026-05-22]] — add `24_evidence_doc.spec.ts` to Tier 1.
