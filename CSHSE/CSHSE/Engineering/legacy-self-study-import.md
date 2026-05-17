---
name: Legacy Self-Study Import — Complete Flow + AI-Tagging Redesign
description: End-to-end documentation of how older self-studies are read into CSHSE, every bug surfaced today, and a Sprint-2 redesign that uses LLM-assisted section splitting + spec matching to reduce days of manual tagging to ~1 hour.
type: concept
tags: [import, ai-tagging, redesign, sprint-2, embeddings, llm]
last_reviewed: 2026-05-16
---

# Legacy Self-Study Import — Complete Flow + AI-Tagging Redesign

This is the consolidated user-facing + technical document for the **legacy self-study import** feature: how a coordinator brings an older DOCX/PDF self-study into the CSHSE portal, how the system parses it, displays the original, lets the user tag sections, applies tags to the [[narrative-storage|narrative model]], and preserves the original on disk for reference.

It also catalogues every bug surfaced in the current implementation (with file:line refs) and proposes a **Sprint 2 redesign** that uses LLM-assisted section splitting + standards matching to make tagging mostly automatic.

This page is the **comprehensive companion** to two deeper technical pages — read those for the mechanics:

- [[import-pipeline]] — user-facing state machine, upload → finish-tagging flow, known gaps.
- [[import-marker-mechanism]] — the exact byte-level marker insert/restore round-trip, table-fragment wrappers, three-tier repair flow.

---

## Part 1 — The complete current flow

### What the user does (UX summary)

1. **Upload.** Program Coordinator clicks "Import existing self-study" in [SelfStudyEditor](../../../../client/src/features/selfStudy/Editor/SelfStudyEditor.tsx). Picks a `.docx`, `.pdf`, or `.pptx` file. Multer hits a 50 MB request limit (large legacy files can exceed this — see [[#issue-1-50mb-multer-limit-truncates-large-imports|Issue 1]]).
2. **Wait for parse.** Server returns `202 Accepted` with an `importId`. A background worker parses the file (Mammoth for DOCX, pdf-parse for PDF), extracts inline images to GridFS, stores the resulting HTML in the GridFS `htmlContent` bucket. Status transitions `pending → processing → awaiting_selection`. UI polls for status.
3. **Tag sections.** The full document HTML is rendered in `DocumentViewer` ([client/src/features/selfStudy/Editor/components/DocumentViewer.tsx](../../../../client/src/features/selfStudy/Editor/components/DocumentViewer.tsx)) via `dangerouslySetInnerHTML`. User drag-selects a region of the displayed document, clicks "Capture Selection," fills the `SectionTagger` modal:
   - **Section type**: Standard / Curriculum Matrix / Appendix / Skip
   - **Standard code** (1–21) and **spec letter** (a–h) — required for Standard
   - **Title** (free text)
   - "Apply Directly" — if true, write straight into `Submission.narratives` and skip the staging area.
4. **The original document shortens.** After tag save, the selected text is replaced in two places:
   - **In the DOM** (immediately, in the browser): the captured `Range` is replaced with a styled `<div class="extracted-section-placeholder">✓ Extracted: {title}</div>`.
   - **In GridFS** (asynchronously, server-side): an HTML comment marker `<!-- EXTRACTED:{sectionId}:{type}:{title}:{contentLength} -->` replaces the selected HTML range. The GridFS file gets physically smaller.

   See [[import-marker-mechanism#the-two-step-extract-operation|the two-step extract operation]] for byte-level mechanics.
5. **Resume later** (different session, browser refresh, different device). Server streams the now-shorter HTML back to the client. Client walks the rendered DOM for marker comments and reconstructs visible placeholders in their place. Tagged-Sections sidebar lists what's been captured.
6. **Apply tags** (per section or in bulk). The captured HTML is written into `Submission.narratives` — a nested `Map<standardCode, Map<specCode, INarrativeContent>>` ([server/src/controllers/submissionController.ts:228](../../../../server/src/controllers/submissionController.ts)).
7. **Finish tagging.** `POST /api/imports/:id/finish-tagging`. Status → `completed`. `/tmp/imports/{importId}/` is deleted. GridFS HTML may be deleted depending on retention rules.

### What's preserved vs. transformed

| Artefact | Form on upload | Form after parse | Form after tagging | Retention |
|---|---|---|---|---|
| Original DOCX/PDF | the user's file | parsed via Mammoth/pdf-parse | not retained | discarded after parse (see [[#issue-2-original-file-not-retained|Issue 2]]) |
| HTML representation | — | `htmlContent.{importId}.html` in GridFS (streamed in via `storeHtmlContentFromFile`) | progressively shortened as tags accumulate (marker comments replace ranges) | deleted on finish-tagging; survives across sessions |
| Extracted images | inline images in DOCX | written to GridFS `images.{importId}/{filename}` | unchanged | survives across sessions; deleted with parent import |
| Plain text | — | `SelfStudyImport.extractedContent.rawText` | unchanged | persists as long as `SelfStudyImport` row exists |
| Per-section metadata | — | — | `SelfStudyImport.detectedSections[]` (each: `id, headerText, removedHtml, htmlContextBefore/After, textStartOffset, textLength, standardCode, specCode, wasTableExpanded`) | persists with `SelfStudyImport` |
| Narrative content | — | — | `Submission.narratives[std][spec].content` (HTML) | persists; the canonical post-tagging form |
| Original DOCX bytes | the user's file | discarded | — | **NOT preserved** (gap) |

### How the original "looks the same minus the tagged regions"

This is the most asked-about UX behaviour. The mechanism:

1. **HTML lives in GridFS.** Each `insertHtmlMarker` rewrites the entire file with a marker comment in place of the extracted range. The non-tagged surrounding HTML stays exactly as parsed.
2. **On client mount**, `DocumentViewer` injects the HTML via `dangerouslySetInnerHTML` ([DocumentViewer.tsx:201-324](../../../../client/src/features/selfStudy/Editor/components/DocumentViewer.tsx)).
3. **A `TreeWalker` scans comment nodes**, finds every `<!-- EXTRACTED:... -->`, and replaces each comment with a styled placeholder div ([DocumentViewer.tsx:225-250](../../../../client/src/features/selfStudy/Editor/components/DocumentViewer.tsx)).
4. **Cross-reference against `taggedSections`** prop (the `SelfStudyImport.detectedSections[]` list): if a marker's `sectionId` is in the active list, render a green "✓ Extracted: {title}" placeholder; otherwise render a red "Content not restored" warning ([DocumentViewer.tsx:281-309](../../../../client/src/features/selfStudy/Editor/components/DocumentViewer.tsx)).
5. **Tables get special handling.** A marker inside a `<table>` is wrapped in `<!-- TABLE_FRAG_START -->` / `<!-- TABLE_FRAG_END -->` plus synthesized `splitBefore` / `splitAfter` `<table>` fragments that keep the non-tagged rows visible above and below the placeholder. See [[import-marker-mechanism#tables-get-special-treatment]].

The net effect: the user sees the **original document, minus the tagged regions, plus inline placeholders** where extractions have happened. Scrolling, search, page layout — all preserved because the surrounding HTML is byte-for-byte the parser's output.

### Where the code lives — quick map

| Concern | File | Key lines |
|---|---|---|
| Document viewer + placeholder reconstruction | [client/src/features/selfStudy/Editor/components/DocumentViewer.tsx](../../../../client/src/features/selfStudy/Editor/components/DocumentViewer.tsx) | 201-324 (resume), 116-195 (live swap), 130-174 (table-aware row removal) |
| Tagging modal | [client/src/features/selfStudy/Editor/components/SectionTagger.tsx](../../../../client/src/features/selfStudy/Editor/components/SectionTagger.tsx) | 73-127 (form), 206-271 (standard UI), 248-270 (Apply Directly) |
| Tagged-sections sidebar | [client/src/features/selfStudy/Editor/components/TaggedSectionsList.tsx](../../../../client/src/features/selfStudy/Editor/components/TaggedSectionsList.tsx) | 29-43 (model), 69-133 (grouping), 338-433 (apply forms) |
| Apply tag → narrative | [client/src/features/selfStudy/Editor/SelfStudyEditor.tsx](../../../../client/src/features/selfStudy/Editor/SelfStudyEditor.tsx) | 1080-1199 |
| Upload + parse trigger | [server/src/controllers/importController.ts](../../../../server/src/controllers/importController.ts) | 232 (`POST /upload`) |
| Extract-section (step 1) | [server/src/controllers/importController.ts](../../../../server/src/controllers/importController.ts) | 2420-2512 |
| Insert-marker (step 2) | [server/src/controllers/importController.ts](../../../../server/src/controllers/importController.ts) | 2520-2574 |
| Marker insertion (GridFS) | [server/src/services/gridFsService.ts](../../../../server/src/services/gridFsService.ts) | 683-917 |
| Marker restoration | [server/src/services/gridFsService.ts](../../../../server/src/services/gridFsService.ts) | 1187-1400 |
| Repair (re-upload + re-find) | [server/src/controllers/importController.ts](../../../../server/src/controllers/importController.ts) | search "repairDocument" |
| n8n parsing workflow | [n8n-workflows/cshse-document-matcher.json](../../../../n8n-workflows/cshse-document-matcher.json) | (designed but unused per [[import-pipeline#known-gaps]]) |

---

## Part 2 — Current issues

The user has flagged six categories. Mapping to code locations and root causes:

### Issue 1 — 50MB Multer limit truncates large imports

Real legacy self-studies often exceed 50 MB (370 MB documents are the design driver per [[storage-layer]]). The Multer middleware in [server/src/middleware](../../../../server/src/middleware) caps request body size. Large uploads silently fail.

**Root cause:** Multer `limits.fileSize` not aligned with the actual document scale this system is built for.

**Fix scope:** raise to 500 MB, switch to streaming Multer (already supported, just config). Already partially mitigated by the streaming GridFS write path (`storeHtmlContentFromFile`).

### Issue 2 — Original file not retained

After parsing, the original `.docx` bytes are discarded. The HTML representation in GridFS becomes the system's only source of truth. If the parser misinterpreted something, there's no way to re-parse without re-uploading.

**Root cause:** by design — the parser writes HTML and discards the source.

**Implication:** repair flow ([[import-marker-mechanism#repair-flow-three-tier-matching]]) requires the user to re-upload the SAME original file. Lossy.

**Fix scope:** store the original file in S3 alongside the HTML — `submissions/{submissionId}/imports/{importId}/original.{ext}`. Cheap, durable, enables future re-parsing without user friction.

### Issue 3 — Missing tags (data loss)

Three documented failure modes that can leave a tag in inconsistent state:

#### 3a. Step 1 succeeds, step 2 fails

The tag is two API calls ([[import-marker-mechanism#the-two-step-extract-operation]]):
1. `POST /extract-section` writes the section to `SelfStudyImport.detectedSections[]`.
2. `POST /insert-marker` inserts the marker comment in GridFS.

If step 2 fails (server crash, network drop, OOM during the rewrite), the section is recorded in MongoDB but **the GridFS HTML is unchanged**. On reload, the placeholder is gone because no marker exists in the HTML. The user has to re-tag.

**Code:** [importController.ts:2520-2574](../../../../server/src/controllers/importController.ts) catches errors and returns 422 but does NOT roll back the step-1 write.

#### 3b. TABLE_FRAG pair mismatch on restore

If a table extraction's `TABLE_FRAG_START` is found but `TABLE_FRAG_END` is missing (or vice-versa), restore returns false silently. The marker stays in HTML, the section persists in `detectedSections[]`, but the user can't recover the original content.

**Code:** [gridFsService.ts:1303-1305](../../../../server/src/services/gridFsService.ts).

#### 3c. `insertHtmlMarker` text-offset lookup fails

If the walker can't resolve the requested `textStartOffset` (HTML shifted under it, e.g., after a partial repair), [gridFsService.ts:756](../../../../server/src/services/gridFsService.ts) returns `success: false`. The controller returns 422 but the step-1 metadata is left in `detectedSections[]`, orphaned.

**Root cause for all three:** no transactional boundary across the two-step tag. No compensating rollback when step 2 fails. Restore failure paths don't bubble up clearly.

### Issue 4 — Click on tag should navigate to text in viewer

**Currently broken.** Placeholders render with `data-section-id` and `data-section-type` attributes but **no click handler** ([DocumentViewer.tsx:84-112](../../../../client/src/features/selfStudy/Editor/components/DocumentViewer.tsx)). Clicking a tag in `TaggedSectionsList` does not scroll `DocumentViewer` to that section. There's no anchor + smooth-scroll wired.

**Symmetric gap:** clicking inside `DocumentViewer` on a placeholder doesn't select the corresponding narrative in the editor.

**Fix scope:** add bidirectional `onClick` + scroll-into-view. Trivial code change.

### Issue 5 — Standards drift (old self-studies tagged against outdated specs)

The user names this directly: "the standard has been modified, and what is marked as a spec and sub spec may not be the spec and sub spec of the standard any more."

If a coordinator imports a 2020 self-study tagged with the 2020 spec text, but the 2024 spec text has been revised, the tags are **mechanically valid** (still standardCode=11, specCode=a) but **semantically wrong** (specCode 'a' may now cover different content).

**Root cause:** specs are versioned ([Spec model](../../../../server/src/models/Spec.ts) has `version` field) but the import flow doesn't track which version a tag was made against.

**Fix scope:**
1. Stamp each `IDetectedSection` with `specVersion` (current at tag time).
2. On import of a legacy self-study, prompt: "Do these tags refer to spec version X or current Y?"
3. If older: run a drift detector that compares the tagged content's semantics against the current spec definitions and flags mismatches.

### Issue 6 — Manual tagging is too slow

This is the headline pain point. Coordinators report "days" of manual copy-select-tag work for one self-study, because:
- The doc is large (370 MB, hundreds of sections).
- Standard/spec assignment is judgmental — they have to read each section and decide which of 21 standards × ~10 sub-specs it satisfies.
- Supporting evidence (resumes, CVs, syllabi) is interspersed throughout and has to be identified by hand.
- No automation today. The n8n Document Matcher workflow was designed but never wired up ([[import-pipeline#known-gaps]]).

**Fix scope: a Sprint-2 redesign** that uses LLM-assisted splitting + matching to produce ranked tag recommendations the coordinator just reviews and accepts. See Part 3.

### Issue 7 (additional, surfaced during analysis) — n8n auto-matching is a no-op

`processWithAI: true` was meant to send sections to n8n's Document Matcher webhook for AI-assisted standard mapping. The TODO at [importController.ts:3176](../../../../server/src/controllers/importController.ts) was marked done but never implemented. The workflow JSON exists at [n8n-workflows/cshse-document-matcher.json](../../../../n8n-workflows/cshse-document-matcher.json). See [[incomplete-features-2026-05-10]].

**The redesign supersedes this** — we move auto-matching into the server (with embeddings + Claude), rather than rebuilding on n8n. Simpler to test, deploy, and reason about.

---

## Part 3 — The redesign: AI-augmented import + tagging

### Architecture overview

```
┌────────────────────────────────────────────────────────────────────────┐
│  UPLOAD                                                                │
│  user → /api/imports/upload → SelfStudyImport(status=pending)          │
│  ──┐                                                                   │
│    │                                                                   │
│    ▼                                                                   │
│  BACKGROUND WORKER                                                     │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ 1. PARSE (HTML for viewer + Markdown for LLM)                    │  │
│  │    DOCX → mammoth (HTML + MD)                                    │  │
│  │    PDF  → marker / pdf-parse (HTML + MD)                         │  │
│  │    Store HTML in GridFS htmlContent bucket (unchanged from today)│  │
│  │    Store MD in GridFS markdownContent bucket (NEW)               │  │
│  │    Store ORIGINAL FILE in S3 (NEW — Issue 2 fix)                 │  │
│  │ 2. SPLIT into sections                                           │  │
│  │    Tier A: TOC-based (if Table-of-Contents detected)             │  │
│  │    Tier B: heading-based (h1/h2/h3 or DOCX style markers)        │  │
│  │    Tier C: semantic sliding-window (last resort)                 │  │
│  │    Output: Section[] = { id, heading, markdown, byteOffsets,     │  │
│  │                          isTable, hasImages, wordCount }         │  │
│  │ 3. EMBED each section (text-embedding-3-small or Voyage)         │  │
│  │ 4. EMBED current standards + specs ONCE (cached at boot)         │  │
│  │ 5. MATCH                                                         │  │
│  │    For each section:                                             │  │
│  │      a. Cosine similarity vs. all (standard, spec) embeddings    │  │
│  │      b. Top-5 candidates                                         │  │
│  │      c. Claude Haiku adjudication with section + candidates      │  │
│  │         → primary tag with confidence 0.0-1.0                    │  │
│  │         → secondary candidates                                   │  │
│  │         → "supporting evidence" classification (resume/CV/syllabus/etc.)│  │
│  │         → rationale                                              │  │
│  │ 6. WRITE recommendations to SelfStudyImport.recommendations[]    │  │
│  │ 7. status → awaiting_review                                      │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  REVIEW UI                                                             │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Left: DocumentViewer (current implementation, with markers)     │  │
│  │  Right: per-section recommendation cards                         │  │
│  │    [Section "Curriculum Design"]                                 │  │
│  │    Primary: Standard 11.a (97% conf.)  [✓ Accept] [Change]       │  │
│  │    Other candidates: 11.b (62%), 4.a (41%)                       │  │
│  │    Rationale: "Section discusses required core courses..."       │  │
│  │                                                                  │  │
│  │  Click section header → DocumentViewer scrolls to that range     │  │
│  │  Bulk-accept "confidence > 0.85" button                          │  │
│  │  Manual override always available                                │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  After review: tags are applied through the existing two-step          │
│  extract-section + insert-marker flow (no change to GridFS marker      │
│  mechanism). Manual fine-tuning is the same as today.                  │
└────────────────────────────────────────────────────────────────────────┘
```

### Why this architecture

- **Splitting is deterministic** (TOC → heading → semantic chunking), not LLM-based, so it's reproducible and debuggable. AI is only used where AI is necessary — semantic matching against the standards.
- **Embeddings give us cheap top-K filtering** before the expensive LLM call. Hundreds of sections × 200 spec embeddings is matrix math, ~50ms.
- **Claude Haiku is the right tier** for adjudication: cheaper than Sonnet, fast, accurate enough for "given these 5 candidates, pick one with confidence." For ambiguous sections, the model can lower its confidence and the UI surfaces them for human review.
- **Standards-drift handling is intrinsic**: the AI compares each section's content against the CURRENT spec text. If the user-supplied legacy tags are wrong, the recommendations expose the drift.
- **Supporting evidence is a separate classification** (resume / CV / syllabus / faculty handbook / etc.) layered alongside the (standard, spec) recommendation. Detected via heuristics + LLM ("is this section a CV?"). Maps to `Submission.narratives[std][spec].supportingEvidenceText` automatically.
- **Backwards-compatible**: the existing tag pipeline (extract-section → insert-marker → finish-tagging) is untouched. The redesign adds a `pending_review` state before tagging, populated with recommendations. Coordinators can still fully manually tag any section.
- **AI never writes directly to GridFS or narratives.** Every recommendation requires explicit user accept/reject. AI is a workflow accelerator, not an authority.

### Wizard data destinations (locked in 2026-05-17)

The end state after the wizard finishes:

| Destination | What lands here | When |
|---|---|---|
| `DocumentVersion` (S3, kind=`original_import`) | The original DOCX **bytes**, untouched, immutable reference | At upload, before any parse |
| `SelfStudyImport.extractedContent.htmlGridFSKey` + GridFS | The fresh mammoth-parsed HTML (re-derivable from S3) | After parse |
| **`Submission.narratives[std][spec].content`** | **Narrative text the user ACCEPTED** in the wizard | On wizard finish |
| **`Submission.narratives[std][spec].supportingEvidenceText`** | **Supporting-evidence text the user ACCEPTED** | On wizard finish |
| **`SupportingEvidence` (S3 file + Mongo row)** | Each appendix item the user accepted as a discrete supporting file (CV, syllabus, etc.). May be a per-item split of the master DOCX. | On wizard finish |
| **`SelfStudyImport.detectedSections[]` with `status='unmatched'`** | Sections the AI couldn't place + user skipped or marked "no spec" | On wizard finish |
| **`SelfStudyImport.detectedSections[]` with `status='needs_review'`** | Sections the user explicitly punted to review later | On wizard finish |

`detectedSections[]` doubles as the import workspace — anything not committed to `narratives` lives there with a status tag so the coordinator can return to triage later.

### Locked-in architecture (2026-05-16)

| Component | Choice | Where it runs |
|---|---|---|
| AI service | Python FastAPI in Docker | new Railway service `cshse-ai` (one instance per env) |
| Vector DB | Qdrant — **single shared instance** | Railway service `Qdrant` in production env; dev env's instance sleeping |
| LLM (adjudication) | Anthropic Claude Haiku 4.5 | Anthropic API |
| Embeddings | OpenAI `text-embedding-3-small` (1536-dim) | OpenAI API |
| Parser (DOCX) | mammoth (already in use) → HTML + Markdown | Node side |
| Parser (PDF) | marker-pdf | Python AI service |
| Service-to-service auth | HMAC-SHA256 with shared secret | server-side middleware |
| Wizard UX | Linear 5-step wizard | React; new `ImportWizard/` feature |
| Cross-institution search | Wired but **feature-flagged OFF** pending CSHSE board approval | admin toggle in Settings |
| Document versioning | S3-backed `DocumentVersion` model, kind enum for `original_import` / `parsed_html` / `reader_report` / etc. | server-side |

### Qdrant namespace isolation (single instance, multi-env)

Since the same Qdrant powers both prod and dev, isolation is at the **collection name** level:

| Collection | Read | Write | Notes |
|---|---|---|---|
| `cshse_specs` | both envs | admin only | shared read-only; spec text is the same in both envs by definition |
| `cshse_sections_prod` | prod | prod | per-import section embeddings from production AI service |
| `cshse_sections_dev` | dev | dev | per-import section embeddings from develop AI service |
| `cshse_narratives_xinst_prod` | prod (when flag on) | prod (on finish-tagging) | board-gated cross-institution search index for prod |
| `cshse_narratives_xinst_dev` | dev (when flag on) | dev | dev's mirror; never aggregated with prod |

The Python AI service reads `CSHSE_ENV={prod|dev}` at boot and prefixes/suffixes collection names. No cross-env data leakage by construction.

### Cost model

Typical 370 MB legacy self-study:
- Estimated 100–200 sections after splitting (TOC + heading detection)
- 1 embedding call per section (~$0.00002 / 1K tokens, ~1K tokens each) → **~$0.004**
- 1 Claude Haiku call per section (~$0.25/M input, $1.25/M output, ~2K input + 200 output) → **~$0.10**
- Spec embeddings cached at boot (one-time ~$0.004 per server restart)
- **Total per import: ~$0.10**

At 100 imports/year for the entire system: ~$10/year of AI cost. Versus days of coordinator time per import — call it 40 hours × $40/hr = $1,600 saved per import. Net ROI > 16,000×.

### Migration path for existing imports

- New schema fields are additive (`SelfStudyImport.markdownGridFSKey`, `originalFileS3Key`, `recommendations[]`, `specVersion`) — no data loss.
- Old imports without `recommendations` show the existing manual UI; new ones get the recommendation panel.
- A backfill migration is **not required** — old imports already completed manual tagging; re-running them through AI would be no value.

---

## Part 4 — Sprint 1 stories (the implementation)

**Updated 2026-05-16:** user direction promoted this work from Sprint 2 to **Sprint 1**. Original 7-sprint plan ([[sprint-plan-2026-05-11]]) shifts to Sprints 2–8 in the new dated plan [[sprint-plan-2026-05-16]]. **The full per-story specs (files, steps, acceptance, test plan, estimates) live in [[sprint-plan-2026-05-16#sprint-1--ai-assisted-import-wizard-2-weeks-priority]]** — refer there for execution detail. Summary table below.

Thirteen stories now in Sprint 1:

| # | Story | Estimate | Track |
|---|---|---|---|
| S1.1 | Python AI service scaffolding + Railway deploy | 1.5d | Python |
| S1.2 | Document storage with versioning (S3 + DocumentVersion model) | 2d | Node |
| S1.3 | HTML + Markdown parser improvements (raise Multer, MD output, PDF→Python) | 2d | Node + Python |
| S1.4 | TOC + heading-based section splitter | 2.5d | Python |
| S1.5 | Standards + specs embedding service (Qdrant `cshse_specs`) | 1.5d | Python |
| S1.6 | Section → spec matcher (embeddings + Claude Haiku adjudication) | 3d | Python |
| S1.7 | Supporting-evidence classifier | 1d | Python |
| S1.8 | Standards-drift detector | 1.5d | Python |
| S1.9 | Cross-institution search (FEATURE-FLAGGED, board-approval gated) | 2d | Python + Node |
| S1.10 | Linear wizard UI (5-step React flow) | 4d | Node UI |
| S1.11 | Bidirectional click-to-navigate | 0.5d | Node UI |
| S1.12 | Marker bug fixes (TABLE_FRAG + step rollback) | 1d | Node |
| S1.13 | Stevenson E2E + recommendation audit trail | 2d | Node + Python |

**Total: ~24.5 days.** Sprint horizon is 7 working days × 2 engineers = 14 days. **Plan:** two engineers (Python/AI track + Node/UI track). S1.7 (1d) or S1.9 (board-gated) can spill into Sprint 2 if needed without affecting the wizard launch.

### Dependencies and ordering

```
S1.1 (scaffold) ─┬─► S1.3 (parsers) ─► S1.4 (splitter) ─► S1.5 (embeddings)
                 │                                        │
                 │                                        ├─► S1.6 (matcher) ─┬─► S1.7 (evidence)
                 │                                        │                    │
                 │                                        │                    ├─► S1.8 (drift)
                 │                                        │                    │
                 │                                        └────────────────────┴─► S1.9 (xinst, flagged)
                 │                                                                  │
S1.2 (versioning) ──────────────────────────────────────────────────────────────────┤
S1.11 (click-nav) ─┬─────► S1.10 (wizard UI) ◄────────────────────────────────────┘
S1.12 (marker fix) ┘              │
                                   └─► S1.13 (Stevenson E2E + audit)
```

**Parallelisation:** Engineer A (Node/UI): S1.2 → S1.3 Node-side → S1.11 → S1.12 → S1.10. Engineer B (Python): S1.1 → S1.3 Python-side → S1.4 → S1.5 → S1.6 → S1.7 → S1.8 → S1.9. Both converge on S1.13.

---

## Part 5 — Open questions for product / user

1. **Where do "supporting evidence" classifications land?** Today, [Comment](../../../../server/src/models/Comment.ts) and [SupportingEvidence](../../../../server/src/models/SupportingEvidence.ts) are separate models. The redesign generates "this section is a CV" classifications — should they auto-create `SupportingEvidence` records, or stay as `Submission.narratives[std][spec].supportingEvidenceText` rich text? (Current code supports both paths.)
2. **Confidence threshold for auto-accept** — propose 0.85 default, configurable by admin in the [Settings page](../../../../client/src/features/admin/Settings/SettingsPage.tsx). Bulk-accept above threshold; below threshold always requires review.
3. **Cost guardrails** — should the system have a per-import cost cap (e.g., abort if estimated AI cost > $1 for an unusually large doc)? Probably not needed given the $0.10 ballpark, but worth deciding.
4. **Choose embedding provider** — recommend OpenAI `text-embedding-3-small` (cheap, fast, well-supported) but Voyage AI's `voyage-3-lite` is comparable. Decide based on what's already in the org's auth surface.
5. **Choose LLM for adjudication** — Claude Haiku 4.5 is the right tier for cost+quality. Already aligned with the rest of the stack (Anthropic SDK).
6. **Versioning the Spec text for drift detection** — `Spec.version` exists. Confirm the workflow that updates spec text bumps the version so drift detection has a clear "this tag was made against version X" stamp.

---

## Related

- [[import-pipeline]] — user-facing state machine, upload → finish-tagging flow
- [[import-marker-mechanism]] — byte-level mechanics of the marker + restore round-trip
- [[storage-layer]] — three-backend (Mongo / GridFS / S3) split
- [[narrative-storage]] — `Submission.narratives` Map shape that tags ultimately write into
- [[sprint-plan-2026-05-11]] — the active sprint plan (Sprint 2 stories will land here)
- [[db-migration-strategy]] — additive schema changes (new fields on `SelfStudyImport`) shipped via the migration runner
- [[security-audit-2026-05-10]] — XSS via `dangerouslySetInnerHTML` (relevant to placeholder rendering of AI-suggested HTML)
- [[incomplete-features-2026-05-11]] — manual-tagging UX gap is a Tier-1 item
