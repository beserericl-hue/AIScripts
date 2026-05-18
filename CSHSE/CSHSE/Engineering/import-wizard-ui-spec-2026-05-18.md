---
name: AI Import Wizard — UI Spec (Sprint 1, complete)
description: Code-ready UI specification for the AI-Assisted Import Wizard. Supersedes the 2026-05-17 sketch. Covers both input formats (free-form self-study + spec-as-outline template), format auto-detection, re-import flow, store shape, exact API contracts, component prop signatures, loading / error / empty states, accessibility, telemetry, performance budgets, and a phased implementation plan.
type: concept
tags: [import, ai-tagging, wizard, sprint-1, ui-spec, ready-to-code]
last_reviewed: 2026-05-18
---

# AI Import Wizard — UI Spec (Sprint 1, complete)

> **Supersedes:** [[import-wizard-ui-spec-2026-05-17]] (sketch). All decisions in this page take precedence.

This is the **complete UI specification** for the AI Import Wizard. A React engineer with access to the codebase should be able to build the wizard end-to-end from this document without further design questions. Changes after sign-off land as edits to this page with a `last_reviewed` bump; no superseding dated version unless the underlying behaviour changes materially.

---

## 0. Reading guide

The spec is long because the wizard touches a lot of surface area. Read sections **1, 2, 3, 11 (open questions)** first to get the shape. Sections **4–10** are step-by-step UI detail. Sections **11–16** are the contracts (API, store, components, errors, accessibility, telemetry). Section **17** is the phased build plan.

If you only have ten minutes, sections **1 / 2 / 17** plus the diagrams in **5 / 6 / 7** give you the whole picture.

---

## 1. Goals

The wizard replaces the days-of-manual-tagging legacy flow described in [[legacy-self-study-import]]. Its goals:

1. **Auto-place close to 100 %** of a self-study's content into `Submission.narratives[std][spec]`, `supportingEvidenceText`, `SupportingEvidence` rows, and `CurriculumMatrix.cells[]`.
2. **Surface only the genuinely ambiguous items** as tag-list rows the Program Coordinator triages.
3. **Support two input formats** with one entry point — finished free-form self-studies (Stevenson-shape) and partially-filled template documents (Kennesaw-shape), each routed through the right parser.
4. **Be re-import-friendly** — institutions writing against the template format will upload the same document repeatedly and expect additive, predictable behaviour.
5. **Keep the user in control** — every auto-applied decision is undoable in the Review step before the one-shot Apply call.

Non-goals (explicitly **not** in v1):

- Cross-institution semantic search (deferred behind a feature flag — see §11).
- Multi-file imports (one DOCX at a time; subsequent imports are re-imports of the same Submission).
- Spec-text editing inside the wizard (use the Standards tab as today).
- AI-driven matrix course-name detection (Step 4 keeps the manual confirmation UX).

---

## 2. Two input formats

The dispatcher in `ai-service/scripts/build_preview.py` already supports both formats by auto-detecting from the uploaded DOCX. The wizard UX adapts per format:

| | **Free-form self-study** | **Self-study template** |
|---|---|---|
| Example | Stevenson 2024 self-study (353 MB HTML, 568 sections, full appendix) | KSU "Sample to Council" (407 KB DOCX, 27 sections, partial fill) |
| Parser | TOC anchor + deep table + appendix walkers (`app/splitter/{toc_anchor,deep,appendix}_walker.py`) | Template walker (`app/splitter/template_walker.py`) |
| Typical state | Finished or near-finished | Partially written, iterated weekly |
| Has appendix | Yes — gap-fill runs on it | No — gap-fill auto-skipped |
| Has curriculum matrix in-doc | Sometimes (Stevenson does) | No (matrix is a sibling DOCX) |
| Re-import expected | Rare | **Frequent** (every time a section is written) |
| Step 4 (Matrix) shown? | Yes | Skipped if no `curriculum_matrix` sections detected |
| Step 5 (Apply) default | Replace existing narratives | Merge (additive, preserves prior writes) |

Format detection is fast (sniff on first 20 paragraphs) and conservative — when in doubt the dispatcher returns `self_study` with confidence < 0.80, and the wizard shows the verdict to the Coordinator with an explicit override.

---

## 3. Where the wizard lives

The wizard is a **new tab in the Self-Study Editor**, alongside the existing tabs:

```
┌──────────────────────────────────────────────────────────────────────┐
│ Self-Study Editor — <Institution> — <Program> (<Level>)              │
├──────────────────────────────────────────────────────────────────────┤
│ [ Standards ] [ Curriculum Matrix ] [ Supporting File Library ]      │
│ [ AI Import ]   ← NEW                                                │
└──────────────────────────────────────────────────────────────────────┘
```

Entry point: the existing `[ Import Document ]` button in the SelfStudyEditor top bar (today triggers the legacy modal at `client/src/features/selfStudy/Editor/SelfStudyEditor.tsx:1923-1935`) becomes the **only** entry point. Clicking it activates the AI Import tab and starts at Step 1. The legacy `SectionTagger.tsx` modal and `DocumentViewer.tsx` placeholder mechanism stay in the tree as a fallback path; we do not delete them in this sprint.

**Tab visibility:**
- Visible only to **Program Coordinators** (same gating as the current Import button — `useAuthStore().role === 'program_coordinator'`).
- Tab badge:
  - hidden when no import exists for this Submission
  - `(queued: 3rd in line)` when an upload is waiting for a worker (live position, updates via SSE)
  - `(parsing)` while a job is actively running on the server
  - `(ready to review)` when status is `parsed` and the Coordinator hasn't opened Step 3 yet
  - `(N tags)` when an import has finished with `N` unresolved `importTags`
  - `(M unwritten)` for template-format imports with `M` placeholder sections still empty across re-imports (only after the first Apply, until all placeholders are addressed)

**URL routing** (under `react-router-dom`, mounted under the existing editor route):

```
/submissions/:submissionId/editor                           — Standards tab (default)
/submissions/:submissionId/editor/matrix
/submissions/:submissionId/editor/files
/submissions/:submissionId/editor/ai-import                 — wizard, lands on furthest reached step
/submissions/:submissionId/editor/ai-import/upload          — Step 1
/submissions/:submissionId/editor/ai-import/parse           — Step 2
/submissions/:submissionId/editor/ai-import/review          — Step 3
/submissions/:submissionId/editor/ai-import/review/:std/:spec  — Step 3 with a spec preselected (deep-linkable)
/submissions/:submissionId/editor/ai-import/matrix          — Step 4 (skipped for template format)
/submissions/:submissionId/editor/ai-import/apply           — Step 5
/submissions/:submissionId/editor/ai-import/tags            — Tag list (post-finish view)
/submissions/:submissionId/editor/ai-import/tags/:tagId     — Tag-list with one tag's popup open (deep-linkable)
```

Direct navigation to a step the user hasn't reached redirects to the furthest reached step (server-side `SelfStudyImport.status` is the source of truth).

---

## 4. End-state contract

When the Coordinator clicks **Finish** at Step 5, the system guarantees these writes — atomic within a single Mongo session:

| Destination | What lands there |
|---|---|
| `Submission.narratives[std][spec].content` (HTML) | All auto-accepted prose < 1000 words classified as `narrative_response` for that (std, spec). Multiple items concatenated, separated by `<hr/>`. Merge behaviour per Step 5 controls. |
| `Submission.narratives[std][spec].supportingEvidenceText` | All auto-accepted prose ≥ 1000 words OR classified as `supporting_evidence` text-shape. Multiple items concatenated, separated by `<hr/>`. |
| `SupportingEvidence` rows (Mongo) + S3 DOCX | One row per `supporting_evidence` file-shape item (CV / syllabus / minutes / brochure / handbook). Body rendered as standalone DOCX per [[evidence-document-review-pipeline]], uploaded to S3 key `{institutionId}/{versionId}/{slug}.docx`, linked from `narratives[std][spec].linkedDocuments`. |
| `CurriculumMatrix.cells[]` | One cell per `curriculum_matrix` item the matrix data extractor decoded. Tagged with `(standardCode, specCode, columnIndex, codeRaw, contentTypes, depth)`. |
| `DocumentVersion` row | Pristine original DOCX, S3-stored, hashed, versioned via `documentVersionService.recordVersion()`. |
| `SelfStudyImport.importTags[]` | One tag per `tag` row the Coordinator left unresolved at Apply. Each tag = `{ id, summary, fullText, suggestedStd, suggestedSpec, confidence, sourceAnchor, accept_state, rationale }`. Survives finish; visible in the Tag List view. |
| `SelfStudyImport.placeholderSections[]` (NEW; **template format only**) | One entry per detected template heading the institution hasn't yet authored a response to. Shape: `{ paragraphIndex, heading, standardHint, specHint }`. Lets the wizard show "still unwritten" prompts after Finish. |

On Finish, the server fires a side-effect: re-validates `Submission.completionStatus` and emits the standard `Submission.save()` + `markModified('narratives')` per [[narrative-storage]].

---

## 5. State machine

`SelfStudyImport.status` (server-side, source of truth):

```
        upload accepted, documentVersion recorded; worker slot busy
   new ──────────────────────────────────────────► queued

        worker slot available
   queued ────────────────────────────────────────► parsing

        cshse-ai job streams events over SSE
   parsing ───────────────────────────────────────► parsed

        Coordinator at Step 3
   parsed                       (back-nav only; no state change)

        Coordinator commits Step 5
   parsed ────────────────────────────────────────► applying

        Mongo session commits successfully
   applying ──────────────────────────────────────► applied

        Coordinator clears all importTags via Tag List view
   applied ───────────────────────────────────────► finished

        Coordinator clicks Cancel at any step before applying
   <any pre-applying> ────────────────────────────► canceled
```

When a worker is immediately available, `new` skips straight to `parsing` (the wizard never shows the queued UI). When the AI service is busy, multiple imports stack in FIFO order in `queued`; their place updates flow as SSE `queuePosition` events.

Recoverable: if the Coordinator closes the tab during `queued` / `parsing` / `parsed` / `applying`, reopening lands at the furthest reached step (or the queued screen if still waiting). `applying` is one-shot — failure mid-write rolls back the Mongo session, status flips back to `parsed`, and the user sees the failure at Step 5 with retry. **Cancelling from `queued`** releases the slot immediately so the next job advances.

---

## 6. The five wizard steps

Persistent **left stepper** on every step:

```
┌──────────────┐
│ ① Upload     │  ← clickable if reached
│ ② Parse      │  ← clickable if reached
│ ③ Review     │  ← always clickable once parsed
│ ④ Matrix     │  ← only shown if matrix sections detected
│ ⑤ Apply      │  ← clickable only when Review is "ready"
└──────────────┘
```

Forward navigation requires the current step to be in a "ready" state (see per-step Ready conditions). Backwards navigation is always allowed and never destroys state.

### 6.1 Step 1 — Upload

**Purpose:** bring the DOCX into S3 + start the AI pipeline + auto-detect the format.

UI:

```
┌───────────────────────────────────────────────────────────────────────┐
│  Upload your self-study document                                      │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│   ┌─────────────────────────────────────────────────────────────────┐ │
│   │                                                                 │ │
│   │             [ Drop a .docx file here, or click to browse ]      │ │
│   │                                                                 │ │
│   │              Max 100 MB. PDF accepted as a fallback.            │ │
│   └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  Program level:  ⦿ Baccalaureate    ◯ Associate    ◯ Master's          │
│                  (auto-detected from this Submission; can override)   │
│                                                                       │
│  ☐ This is a re-import of an existing self-study                      │
│  ☐ Treat this upload as template format (skip auto-detect)            │
│                                                                       │
│                                                  [ Cancel ] [ Next ▸ ]│
└───────────────────────────────────────────────────────────────────────┘
```

**Field rules:**
- File: `.docx` (primary) or `.pdf` (fallback, mammoth conversion). Max 100 MB (raise from today's 50 MB multer cap — see [[legacy-self-study-import#issue-1-50mb-multer-limit-truncates-large-imports|Issue 1]]).
- Program level: defaults to `Submission.programLevel`. Override is a one-time confirm — the server pins to the dropdown value, not the Submission's.
- "Re-import" checkbox: when checked, Step 5 defaults to merge mode and shows the diff modal; when unchecked, Step 5 defaults to replace.
- "Treat as template" checkbox: bypasses the format detector (sets `--format template` on the cshse-ai job). Show a small `ⓘ` tooltip explaining when to use this ("If your document is a CSHSE Self-Study Template you're still writing against, check this to skip auto-detect.").

**On Next:**

1. Client uploads the file → server `POST /api/imports/upload` (existing endpoint, already records `DocumentVersion`). Returns `{ importId, documentVersionId, s3Key, sha256 }`.
2. Client `POST /api/imports/:importId/start-ai` with `{ programLevel, forceFormat?: "template" | "self_study", isReimport: boolean }`. Server enqueues a cshse-ai job and flips `status` to either `queued` (if other jobs are ahead) or `parsing` (if a worker slot is immediately available). Returns `{ jobId, initialStatus, queuePosition?, queueDepth? }`.
3. Client navigates to `/ai-import/parse` and opens the SSE stream (§6.2).

**Ready condition:** file selected, programLevel chosen, file size under 100 MB.

**Loading state:** Upload progress bar (chunked upload, % complete + bytes). Cancel button cancels the upload mid-stream.

**Error states:**
- File too large → red banner under the dropzone with the limit and the actual size.
- Wrong MIME type → red banner: "We accept .docx (preferred) or .pdf. PNG / JPG files are uploaded to the file library, not parsed here."
- Upload failure (network) → retry button; preserve the selected file in component state.
- Server 503 → "AI Import service is unavailable. Try again in a few minutes."

### 6.2 Step 2 — Parse

**Purpose:** show the AI working; surface the format-detection verdict; no user input required.

UI has two states. **Queued state** appears when the AI service is busy with another import:

```
┌───────────────────────────────────────────────────────────────────────┐
│  Waiting for a worker…                                                │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  📄 2024 CSHSE Self-Study Stevenson University.docx  (12.4 MB)         │
│                                                                       │
│  ⏳ Your import is 3rd in line                                         │
│     ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░  position 3 of 3         │
│     Estimated start: ~8 minutes                                       │
│                                                                       │
│     • You can leave this tab open or come back later — the AI Import  │
│       tab badge will update.                                          │
│     • Cancel keeps the document in S3 but releases the queue slot.    │
│                                                                       │
│                                                          [ Cancel ]   │
└───────────────────────────────────────────────────────────────────────┘
```

As other jobs finish, the SSE stream pushes `queuePosition` updates and the strip animates `3rd in line → 2nd in line → starting now…`. ETA is recomputed on each position change from a rolling average of the last 10 completed jobs' stage durations (best-effort; null when the worker is cold). The progress bar fills proportionally to `1 - queuePosition / queueDepth`.

**Running state** (the worker has picked up the job):

```
┌───────────────────────────────────────────────────────────────────────┐
│  Parsing your document…                                               │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  📄 Sample to Council from KSU.docx  (407 KB)                          │
│                                                                       │
│  🧭 Format detection                                                   │
│     ▸ template     (confidence 0.95)                                  │
│     ▸ Template title matched in the first 20 paragraphs               │
│     [ Override → use free-form self-study pipeline instead ]          │
│                                                                       │
│  ⏳ Pipeline                                                           │
│     ✓ Downloaded from S3                              0.5 MB           │
│     ✓ Converted to HTML (mammoth)                     0.50 MB          │
│     ✓ Template walker — 27 sections (14 authored)     0.2 s            │
│     ⟳ Matcher (live)                                  9 / 14   ~5s     │
│     ⟳ Coverage review (per spec)                      queued           │
│     ⏸ Matrix extraction                               n/a (template)   │
│     ⏸ Appendix gap-fill                               skipped (no app.)│
│                                                                       │
│                                                  [ Cancel ] [ Next ▸ ]│
└───────────────────────────────────────────────────────────────────────┘
```

Each pipeline row updates live from SSE events. The `~5s` tail on the active row is the rolling-window ETA for that specific stage (also best-effort). Stage progress milestones fire at 25 / 50 / 75 % so the row counter and any inline percentage updates feel responsive without flooding the wire.

For free-form self-study format, the pipeline strip becomes:

```
     ✓ Downloaded from S3                              352.9 MB          
     ✓ Converted to HTML (mammoth)                     14.8 s            
     ✓ TOC anchor walk + deep walk                     568 sections      
     ✓ Appendix walk                                   890 items         
     ⟳ Matcher (live)                                  142 / 568         
     ⏸ Matrix extraction                               queued            
     ⏸ Coverage review                                 queued            
     ⏸ Appendix gap-fill                               queued            
```

**Live progress via Server-Sent Events (primary in v1):**

The Parse step must communicate accurate progress to the Coordinator throughout the entire pipeline — on a finished Stevenson-sized DOCX the run takes ~10–12 minutes and a Coordinator staring at a static screen would reasonably think the UI is hung. SSE solves both the perception problem and the queue-position display from §6.1.5.

- Client opens `EventSource("/api/imports/:importId/ai-events")` as soon as the Upload step's `POST /start-ai` returns. The connection stays open until `status` transitions into a terminal state (`parsed`, `failed`, `canceled`).
- Server pushes a `status` event on every state transition (queue position update, stage start, stage progress milestone, stage completion, error). Payload mirrors the §11.3 `/ai-status` body so the same client renderer handles both transports.
- **Queue events** (new in v1): when the import is waiting for an AI service slot, the server emits `{ status: "queued", queuePosition: N, queueDepth: M, etaSeconds: <number-or-null> }` — the UI shows "4th in line… 3rd in line… starting now" with no flicker (see §6.2 queueing UI below). ETA is computed from rolling-window stage durations and is best-effort; when unavailable the UI falls back to position-only text.
- **Reconnect:** if the EventSource drops, the client retries with exponential backoff (1s → 2s → 4s, max 30s). On reconnect the server replays the last-known status and any events the client missed.
- **Fallback to polling:** if the SSE connection fails three times in a row (corp firewall, Railway proxy buffering edge case, etc.), the client falls back to polling `GET /api/imports/:importId/ai-status` every 2s and surfaces a small banner: "Live updates unavailable — refreshing every 2 seconds." Same response shape, same renderer, no functional difference besides update latency.
- **Tab blur:** the client closes the EventSource on `visibilitychange` → `hidden` (lets the browser sleep the tab) and reopens on `visible`, immediately fetching the current status snapshot to catch up.

Why SSE not WebSockets: SSE is unidirectional (server → client), which matches the pipeline (the client doesn't push anything during parse). It's HTTP-based so it passes existing auth middleware without socket-specific handling, and it survives Railway's proxy when configured with `X-Accel-Buffering: no` + chunked encoding (verified in sub-sprint 1.a).

**On Next:** enabled when `status === "parsed"` (every active stage `done` or `skipped`). Navigates to `/ai-import/review`.

**Override flow:** "Override → use free-form" button posts `POST /api/imports/:importId/restart-ai` with `{ forceFormat: "self_study" }`. Server resets status to `parsing`, re-runs from the appropriate point. Confirms with a toast: "Re-parsing as free-form self-study. Earlier work on this import is discarded." Same UX in reverse if currently self_study and user picks Template.

**Cancel:** `POST /api/imports/:importId/cancel`. Server terminates the cshse-ai job, status flips to `canceled`. Toast confirms; wizard tab returns to its empty state.

**Error states:**
- AI service unreachable → red banner: "Connection to AI service lost (attempt 3 of 5). Retrying…" Server retries automatically.
- A pipeline stage fails → show ✗ next to the stage with the error message inline. Allow Coordinator to either (a) cancel and re-upload or (b) skip the failing stage if it's `appendix gap-fill` or `coverage review` (both are advisory, not blocking).

**Ready condition:** all required stages `done` (matcher + coverage_review must complete; gap-fill and matrix are optional).

### 6.3 Step 3 — Review recommendations

**Purpose:** the core triage workspace. Coordinator sees what the AI decided, edits where needed, chooses what to auto-apply vs. defer.

Layout — three columns, **left rail + middle list + right preview**:

```
┌────────────────┬──────────────────────────────────┬─────────────────────┐
│ Specs          │ Items for selected spec          │ Selected item       │
│ (left rail)    │ (middle table)                   │ (right preview)     │
├────────────────┼──────────────────────────────────┼─────────────────────┤
│ Std 1   ✓ 4    │ # | Source     | Conf | Kind     │ Source: TOC §1.a    │
│  ├ 1.a  ✓ 1 🟢 │ 1 | TOC §1.a   | 0.98 | text ●   │ Confidence: 0.98 🟢 │
│  ├ 1.b  ✓ 1 🟡 │ 2 | App. CV-1  | 0.92 | file ●   │ Kind: narrative     │
│  ├ 1.c  ✓ 1 🟢 │ 3 | Deep p43   | 0.45 | tag ●   │                     │
│  └ 1.d  ⚠   🔴 │   ...                            │ <body excerpt…>     │
│ Std 2   ✓ 2 …  │ [+ Apply selected as evidence]   │                     │
│ Std 3   ✓ 0    │ [↻ Send selected to tags]        │ Apply ▾  Defer ▾    │
│ ...            │ [≡ Reassign to spec ▾]           │ [Show in source ▸]  │
│ Std 21  ✓ 1    │                                  │                     │
│                │                                  │                     │
│ ⚠ Unplaced (47)│                                  │                     │
│ 🧩 Unwritten   │  (template format only — list of │                     │
│   (13 prompts) │   placeholder sections, no items)│                     │
└────────────────┴──────────────────────────────────┴─────────────────────┘
```

**Left rail rows** (one per Handbook spec for the chosen program level — 99 for Baccalaureate after the Std 16 fix):

- Format: `<std>.<letter>` + truncated title (max 36 chars).
- Counts: `✓ N` = total items placed. Counts include all auto-applied items regardless of confidence band.
- Coverage badge: 🟢 covered, 🟡 partial (`coverage_score >= 0.5`), 🔴 gaps remain. Shown only after coverage review completes (Step 2 stage). Mirrors the preview pages' icons.
- Two synthetic rows at the bottom:
  - **⚠ Unplaced (N)** — items the matcher couldn't assign to any spec (section_type `unknown` or below `TAG_LIST_CONF`). N is total count.
  - **🧩 Unwritten (M)** (template format only) — placeholder sections from the template walker. Each row in the middle table is a heading + "Open in source" link; no Apply/Defer actions because there's no content.

**Middle table columns** (when a spec is selected):

| Col | Width | Content | Sort |
|---|---|---|---|
| `#` | 4ch | local index within this spec | none |
| Source | flex | TOC anchor / appendix anchor / `Deep p<n>` / `Tmpl §2a` | alphabetical |
| Conf | 6ch | float 0.00–1.00 with colour band | numeric (default desc) |
| Kind | 10ch | `text` / `evidenceText` / `file` / `matrix` / `tag` | category |
| Words | 6ch | word count | numeric |

Confidence colour bands (CSS variable names so tokens stay system-aligned):

```
🟢 conf >= 0.85   text-cshse-600 / bg-cshse-50
🟡 0.50 <= conf < 0.85   text-amber-700 / bg-amber-50
🔵 conf < 0.50   text-slate-500 / bg-slate-50  (only used in popovers; auto-routed to tag list)
```

**Bulk-action toolbar** (above the middle table when ≥ 1 row is selected):
- "Apply selected as evidence file" — promote prose to file shape, splits a fresh DOCX, uploads to S3 on Apply.
- "Send selected to tags" — demote auto-apply to tag list.
- "Reassign to spec…" — opens the same spec/letter dropdown popup the Tag List view uses (§7).

**Right preview** (when one row is selected):
- Heading at top: `Source · Confidence · Kind`.
- Body rendered as markdown (the matcher's `snippet` field, rendered through the existing `MarkdownPreview` component).
- `AI rationale:` paragraph from `Recommendation.rationale`.
- Action chooser dropdown: `Narrative` | `Supporting evidence text` | `Supporting evidence file (DOCX)` | `Matrix cell` (greyed out unless `section_type === "curriculum_matrix"`) | `Defer to tag list`.
- **Show in source** button — opens a side modal scrolled to the anchor in the DOCX-rendered HTML (re-use `DocumentViewer.tsx`). Modal width 60vw, closable with Esc.

**Auto-apply defaults** (computed server-side by the bucket allocator, sent in the API payload — see §11):

| Item shape (matcher output) | Default kind | Default action | Threshold |
|---|---|---|---|
| `narrative_response`, words < 1000, conf ≥ 0.85, one spec match | `text` | auto-apply | `TEXT_AUTO_APPLY_CONF = 0.85` |
| `narrative_response`, words ≥ 1000, conf ≥ 0.85 | `evidenceText` | auto-apply | same |
| `supporting_evidence`, file-shape header keywords OR words ≥ 250, conf ≥ 0.70 | `file` | auto-apply | `FILE_AUTO_APPLY_CONF = 0.70` |
| `curriculum_matrix` with template-matched row | `matrix` | auto-apply (subject to Step 4 confirm) | n/a |
| Any item, 0.50 ≤ conf < 0.85 | inferred from section_type | **flagged** (yellow band) auto-apply | `TAG_LIST_CONF = 0.50` |
| Any item, conf < 0.50 | n/a | deferred → tag list | same |
| `context` or `unknown` | n/a | deferred → tag list | always |

These thresholds are **the calibrated values** from the 2026-05-18 gap-fill tuning. The verifier confidence floor (separate) is `0.50` per [[ai-import-wizard-preview-stevenson-2026-05-18#calibration-win]].

**Ready condition (Step 3 → Step 4 or 5):** the user has either reviewed every yellow-band item OR explicitly clicked **"Skip review, apply as is"** (logs telemetry; sets `reviewSkipped = true` on the import). Red-band items are always already in the tag list and don't block Apply.

**Empty state for the spec list:**
- No specs hit by the matcher → message "The matcher couldn't place any of this document into the Handbook's specs. Check format detection in Step 2, or review the Unplaced list below."
- This is rare; only happens when the upload is a non-self-study DOCX.

**Loading state:** in the (uncommon) case the user lands on Review before Step 2 finishes (e.g., re-import where parsing is async), show a centered spinner with "Waiting for AI parse to complete — see Step 2 for progress."

**Error states:**
- A spec's matcher recommendation came back with `accept_state === "review_unknown"` and no rationale → the row still appears under "⚠ Unplaced"; preview pane shows "The matcher returned no recommendation. Original section text below; reassign manually."
- Any per-row action returns a 4xx → toast "Couldn't <action>. <error message>." Row state remains unchanged.

### 6.4 Step 4 — Matrix review

**Purpose:** confirm the **course-name-per-column** mapping for any detected curriculum matrices.

**Skipped entirely when:** `matrix.cells.length === 0` after Step 2 (template-format imports virtually always skip this step; Stevenson does not).

UI (one block per detected matrix, e.g., `#MatrixHSR`, `#Matrix2`):

```
┌───────────────────────────────────────────────────────────────────────┐
│  Curriculum matrix: Required Human Services Courses (#MatrixHSR)     │
│                                                       250 cells       │
├───────────────────────────────────────────────────────────────────────┤
│             Col 1     Col 2     Col 3     Col 4     Col 5     Col 6   │
│   Course   ┌───────┬─────────┬─────────┬─────────┬─────────┬────────┐ │
│            │ ⟨ ▼ ⟩ │ ⟨ ▼ ⟩  │ ⟨ ▼ ⟩  │ ⟨ ▼ ⟩  │ ⟨ ▼ ⟩  │ ⟨ ▼ ⟩ │ │
│            │ FMST  │ FMST    │ FMST    │ FMST    │ FMST    │ FMST   │ │
│            │  205  │  210    │  240    │  301    │  315    │  330   │ │
│            ├───────┼─────────┼─────────┼─────────┼─────────┼────────┤ │
│   11.a     │  KM   │         │  ITKSH  │         │  IL     │        │ │
│   11.b     │       │  ITM    │         │  KSH    │         │        │ │
│   …                                                                  │ │
│            └───────┴─────────┴─────────┴─────────┴─────────┴────────┘ │
│                                                                       │
│  ⓘ Cells are read-only — you accepted them in Step 3. Set each        │
│    column's course below.                                             │
│                                                                       │
│                                                  [ ◂ Back ] [ Next ▸ ]│
└───────────────────────────────────────────────────────────────────────┘
```

- Each column header has a dropdown seeded with course-code-shaped strings the deep walker pulled from the doc (regex `^[A-Z]{2,5}\s*\d{2,4}` — already in the codebase). Coordinator can type-to-search.
- Below the table, a textarea-style hint shows the source rows the matcher found for this matrix (for debugging context).
- "Create new course" option at the bottom of every dropdown — opens an inline modal `Course code` + `Course name` and adds to the program's catalog (resolves §11 Q4 — yes, structured Mongo per institution).

**Ready condition:** every column dropdown has a value (or "Skip this matrix" checkbox is ticked).

**Empty state:** "No curriculum matrices were detected in this document. If your program uses a matrix, upload it via the [Curriculum Matrix tab](../matrix) instead."

**Error states:** Course catalog API failure → fall back to free-text input; show a yellow banner "Course catalog unavailable; entries below will be saved as plain text and you can convert them later."

### 6.5 Step 5 — Apply & finish

**Purpose:** review the full set of writes, then commit atomically.

UI:

```
┌───────────────────────────────────────────────────────────────────────┐
│  Ready to apply                                                       │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  Narratives (text < 1000 words)              142 items, 87 specs      │
│  Supporting evidence text (≥ 1000 words)      38 items, 31 specs      │
│  Supporting evidence files                    54 files, 12.8 MB        │
│  Curriculum matrix cells                     370 cells, 2 matrices     │
│  Document version recorded                     1                       │
│                                                                       │
│  Tag list (deferred for manual review)        47 items                 │
│  Unwritten template prompts (no content yet)  13 sections  (template only) │
│                                                                       │
│  Merge behaviour for narratives:                                      │
│     ⦿ Merge (default for re-imports — keeps existing content)         │
│     ◯ Replace (overwrites existing — use sparingly)                   │
│     ◯ Per-spec choice (opens diff modal)                              │
│                                                                       │
│  [ ◂ Back ]    [ ⓘ Show diff ]    [ Apply & finish ]                  │
└───────────────────────────────────────────────────────────────────────┘
```

**Merge behaviour** (resolves §11 Q1 — fresh import: replace; re-import: merge with diff option):
- **Merge** — for each `(std, spec)`, if existing `narratives[std][spec].content` is non-empty, prepend a `<hr/>` and append the new content. `supportingEvidenceText`: same. `linkedDocuments`: append. Matrix cells: replace (matrix is recomputed each import).
- **Replace** — overwrite everything for the touched (std, spec) pairs. Confirmation modal required before Apply.
- **Per-spec choice** — opens a diff modal that lists every touched spec with before/after and a per-row radio (`Keep mine | Take new | Merge both`). Saves resolved state into the request payload.

**Show diff modal** — re-uses the existing `MarkdownDiff` component to render before/after per spec. Only specs the wizard would touch are listed.

**On Apply:**
1. Client `POST /api/imports/:importId/apply-ai` with the full payload (§11.4).
2. Server starts a Mongo session, performs all writes inside it, commits. Returns `{ ok: true, status: "applied", appliedCounts: {...}, tagsRemaining: N }`.
3. Toast: "Imported 142 narratives, 54 files, 370 matrix cells. 47 items need review — see the AI Import tab."
4. Client navigates to `/standards` (Standards tab), scrolled to the first spec the wizard touched.
5. The AI Import tab badge updates to `(N tags)`.

**Error state on Apply:**
- Server returns 4xx with `{ ok: false, error: "...", attemptedWrites: { narratives: N, files: M, ... } }` — modal shows the error, no partial writes happened.
- Network failure mid-Apply: the client retries idempotently using a request ID stored in localStorage; subsequent retries hit a deduped endpoint.

**Ready condition:** at least one item is going to be applied. If every row was sent to tags, show "Nothing to apply — every item is in the tag list" with `[ Skip apply → go to tags ]`.

---

## 7. Tag list view

The Tag List is a permanent tab view (under `/ai-import/tags`) that appears whenever `importTags.length > 0`. It's the **post-Finish** companion to Steps 1–5 — the wizard's persistent triage surface.

UI:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ AI Import — 47 tags to review                          [ Start new ▾ ]  │
├─────────────────────────────────────────────────────────────────────────┤
│ Filter: [ All ▾ ] [ Std ▾ ] [ Conf ▾ ]   Sort: [ Conf ↑ ]   [Search …]  │
├─────────────────────────────────────────────────────────────────────────┤
│ ID    Suggested  Conf  Source heading                  Excerpt          │
│ ────────────────────────────────────────────────────────────────────── │
│ #23   12.c       0.41  TOC §1.d                        "The Family…"    │
│ #41   18.b       0.38  Appendix p82                    "Faculty are…"   │
│ #19   21.a       0.36  Deep table p87                  "Field supers…"  │
│ …                                                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

Each row is clickable → opens the **Tag popup** (modal, centered, 720 px wide):

```
┌──────────────────────────────────────────────────────────────────┐
│ Tag #23 — "The Family Studies Program was …"               [×]  │
├──────────────────────────────────────────────────────────────────┤
│ Source: TOC anchor §1.d              Confidence: 0.41            │
│ AI suggestion: Std 12 · Spec c                                   │
│ AI reasoning:                                                    │
│   Mentions "family systems theory" and "social ecology" which    │
│   overlap Std 12.c, but is mostly about program history (Std     │
│   11.a) so confidence is split.                                  │
│                                                                  │
│ ─── Full text ─────────────────────────────────────────────────  │
│ The Family Studies Program was founded in 1986 to address the    │
│ growing need for human-services professionals trained in family  │
│ systems theory, social ecology, and evidence-based intervention. │
│ … (1,247 chars)                                                  │
│ ────────────────────────────────────────────────────────────────  │
│                                                                  │
│ Place this content as:                                           │
│   ⦿ Narrative                                                    │
│   ◯ Supporting evidence text                                     │
│   ◯ Supporting evidence file                                     │
│   ◯ Matrix cell  (disabled unless shape matches)                 │
│   ◯ Discard                                                      │
│                                                                  │
│ Standard: [ 11 ▾ ]    Spec: [ a ▾ ]                              │
│                                                                  │
│   [ ◂ Previous ]      [ Skip ]            [ Apply ▸ ]            │
└──────────────────────────────────────────────────────────────────┘
```

**Apply:** writes the content into the chosen destination using the same single-item code path as the Step 5 batch apply, then advances to the next tag in the filtered list. **Skip:** leaves the tag in place and moves on. **Discard:** soft-delete (sets `tag.discardedAt`); still queryable by admins; hidden from the list.

**Empty state (badge disappears):** "No tags left! Click [ Start new ▾ ] to start a fresh AI import." Start-new opens Step 1 in the same tab.

**Persistence (resolves §11 Q2):** **explicit only**. Tags do not auto-prune when their spec is manually filled in the Standards tab — the Coordinator must Apply / Skip / Discard each tag.

---

## 8. Re-import flow (template format)

The template-format workflow expects repeated re-imports. The wizard's UX adjusts:

1. **First import:** standard 5-step flow. Apply writes everything detected and stores `placeholderSections[]` on the SelfStudyImport (the heading + paragraph index of each unwritten template heading).
2. **Coordinator works on the document offline** — adds Responses under previously-blank prompts.
3. **Second import:** click [ Import Document ] again. The wizard opens at Step 1 with the **re-import checkbox auto-checked**.
4. **Step 2 (Parse):** new flag in the pipeline strip: `Δ since last import` showing diff counts (NEW: X authored sections, REMOVED: Y).
5. **Step 3 (Review):** the spec rail shows green-band markers for already-written-and-applied specs from the prior import; new items appear with the standard yellow/green confidence colours. The "🧩 Unwritten" rail count reflects the **current** state, not delta.
6. **Step 5 (Apply):** merge mode defaults to "Merge" (already covered in §6.5). The diff modal is automatically opened on Apply if the merge would overwrite ≥ 1 non-empty spec.

**Detecting a re-import (resolves the auto-check):** server-side, the import controller checks for an existing `SelfStudyImport` with `status === "applied"` or `"finished"` for the same `submissionId`. If found, sets `isReimport: true` in the start-ai response, client auto-checks the box.

---

## 9. Client state shape

Wizard state lives in a Zustand store at `client/src/store/aiImportStore.ts` (alongside the existing `authStore.ts` etc.). Server state is the source of truth for everything persistent; the store is a per-tab cache.

```ts
type WizardStep = "upload" | "parse" | "review" | "matrix" | "apply" | "tags";

type FormatVerdict = {
  format: "template" | "self_study";
  confidence: number;
  signals: Record<string, number | boolean>;
  reasoning: string;
};

type Recommendation = {
  sectionId: string;
  heading: string;
  snippet: string;
  primaryStandard: string | null;
  primarySpec: string | null;
  primaryConfidence: number;
  sectionType: "narrative_response" | "supporting_evidence" | "curriculum_matrix" | "context" | "unknown";
  acceptState: "auto_accept" | "review_letter_disagrees" | "review_low_confidence" | "review_unknown";
  rationale: string;
  alternates: Array<{ standardCode: string; specCode: string; confidence: number }>;
  docLetter: string | null;
  docStandardHint: string | null;
  wordCount: number;
};

type SpecBucket = {
  standardCode: string;
  specCode: string;
  narratives: Recommendation[];          // sectionType "narrative_response", text shape
  evidenceText: Recommendation[];        // narrative_response > 1000w OR supporting_evidence text shape
  evidenceFiles: Recommendation[];       // supporting_evidence file shape
  matrixCells: Array<MatrixCellData>;    // from matrix data_extractor
  coverageScore: number | null;          // null until Step 2 coverage stage completes
  coverageCovered: boolean | null;
  coverageGaps: string[];
  coverageStrengths: string[];
};

type Tag = {
  tagId: string;
  sectionId: string;
  summary: string;
  fullText: string;
  suggestedStd: string | null;
  suggestedSpec: string | null;
  confidence: number;
  sourceHeading: string;
  acceptState: string;
  rationale: string;
};

type PlaceholderSection = {
  paragraphIndex: number;
  heading: string;
  standardHint: string | null;
  specHint: string | null;
};

type AIImportState = {
  importId: string | null;
  jobId: string | null;
  step: WizardStep;
  status: "idle" | "uploading" | "queued" | "parsing" | "parsed" | "applying" | "applied" | "finished" | "canceled" | "failed";

  // Queue + SSE transport state
  queuePosition: number | null;            // null unless status === "queued"
  queueDepth: number | null;
  etaSeconds: number | null;
  eventsTransport: "sse" | "polling";      // current transport — sticky once we fall back
  eventsReconnectAttempt: number;          // for the backoff schedule

  // Per-step inputs
  uploadFile: File | null;
  uploadProgress: number;
  programLevel: "associate" | "bachelors" | "masters";
  isReimport: boolean;
  forceFormat: "template" | "self_study" | null;

  // From Parse stage
  format: FormatVerdict | null;
  pipelineStages: Array<{ name: string; state: string; detail: string }>;

  // From Review stage
  buckets: Record<string, SpecBucket>;   // keyed "std.spec" e.g. "1.a"
  unplaced: Recommendation[];
  tags: Tag[];
  placeholderSections: PlaceholderSection[];
  selectedSpecKey: string | null;
  selectedSectionId: string | null;

  // From Matrix stage
  matrices: Array<{ matrixId: string; cells: MatrixCellData[]; columnAssignments: Record<number, string | null> }>;

  // From Apply stage
  mergeMode: "merge" | "replace" | "per_spec";
  perSpecResolution: Record<string, "keep" | "take" | "merge">;
  applyError: string | null;
  appliedCounts: { narratives: number; evidenceText: number; evidenceFiles: number; matrixCells: number; tags: number } | null;

  // Actions
  setStep: (s: WizardStep) => void;
  setUploadFile: (f: File | null) => void;
  selectSpec: (key: string) => void;
  selectSection: (sectionId: string) => void;
  reassignSection: (sectionId: string, kind: SectionKind, std: string, spec: string) => void;
  sendToTags: (sectionIds: string[]) => void;
  applyAsEvidenceFile: (sectionIds: string[]) => void;
  startUpload: () => Promise<void>;
  openEventStream: () => void;             // opens SSE EventSource (primary)
  closeEventStream: () => void;            // called on tab blur / unmount
  pollAIStatus: () => Promise<void>;       // polling fallback when SSE drops 3×
  cancelImport: () => Promise<void>;
  apply: () => Promise<void>;
  loadExisting: (importId: string) => Promise<void>;
};
```

**Persistence:**
- `importId`, `jobId`, `step`, `status`, `selectedSpecKey`, `selectedSectionId` → localStorage (keyed by Submission). Survives tab close.
- Everything else → in-memory only; rehydrated from `GET /api/imports/:importId` on tab open.
- The store derives `selectedSpecKey` from the URL on mount (so `/review/11/a` opens the right spec).

---

## 10. Auto-apply rules (calibrated)

The thresholds locked in this spec (validated by the 2026-05-18 calibration):

| Constant | Value | Used by |
|---|---|---|
| `TEXT_NARRATIVE_WORD_LIMIT` | 1000 | bucket allocator (`narrative_response` < 1000w → narrative; ≥ 1000w → evidenceText) |
| `TEXT_AUTO_APPLY_CONF` | 0.85 | narrative & evidenceText green band |
| `FILE_AUTO_APPLY_CONF` | 0.70 | supporting-evidence file auto-apply |
| `TAG_LIST_CONF` | 0.50 | below this → tag list |
| `GAP_FILL_CONFIDENCE` | 0.50 | verifier acceptance threshold (separate from auto-apply) |
| `MIN_SECTION_WORDS` | 30 | deep-walker section filter (drops fragments) |

Server-side these live as a single source of truth in `ai-service/app/config.py` (already exists) — the wizard reads them via `GET /api/config/auto-apply-thresholds` so a future calibration tune doesn't require a client redeploy.

---

## 11. API contracts

All routes namespaced under the existing `/api/imports/*`. New routes added; existing routes (upload, get, cancel, discard) reused as-is.

### 11.1 `POST /api/imports/upload` (existing, unchanged)

Request: `multipart/form-data` with `file`, `submissionId`. Response:

```json
{ "importId": "65f...", "documentVersionId": "docver-cb917...", "s3Key": "65f.../docver-.../source.docx", "sha256": "..." }
```

### 11.2 `POST /api/imports/:importId/start-ai` (NEW)

```jsonc
// request
{
  "programLevel": "bachelors",
  "forceFormat": "template",                 // optional; omit for auto-detect
  "isReimport": false
}

// response 202 — running immediately
{
  "jobId": "wizard-preview-a8feecd7",
  "status": "parsing",
  "queuePosition": null,
  "queueDepth": null,
  "format": null                             // not detected yet — see ai-events
}

// response 202 — queued behind other jobs
{
  "jobId": "wizard-preview-b3019f72",
  "status": "queued",
  "queuePosition": 3,
  "queueDepth": 3,
  "etaSeconds": 480,                         // best-effort; null when cold
  "format": null
}
```

Server enqueues the job at the cshse-ai service. If a worker slot is free, the job transitions to `parsing` immediately; otherwise it waits in FIFO order. Position updates flow via the SSE stream (§11.4).

### 11.3 `GET /api/imports/:importId/ai-status` (NEW — polling fallback)

Used when SSE is unavailable. Returns the current snapshot:

```jsonc
// response
{
  "status": "queued" | "parsing" | "parsed" | "applying" | "applied" | "canceled" | "failed",
  "queuePosition": null | <int>,                        // non-null only when status === "queued"
  "queueDepth": null | <int>,
  "etaSeconds": null | <int>,
  "format": { "format": "template", "confidence": 0.95, "reasoning": "…", "signals": {…} },
  "stages": [
    { "name": "download_s3",     "state": "done",    "detail": "0.5 MB",        "completedAt": "..." },
    { "name": "mammoth",         "state": "done",    "detail": "0.50 MB",       "completedAt": "..." },
    { "name": "template_walker", "state": "done",    "detail": "27 sections (14 authored)" },
    { "name": "matcher",         "state": "running", "detail": "9 / 14", "etaSeconds": 5 },
    { "name": "matrix_extract",  "state": "n/a",     "detail": "template format" },
    { "name": "coverage_review", "state": "queued" },
    { "name": "gap_fill",        "state": "skipped", "detail": "no appendix" }
  ],
  "buckets": null,         // populated when status === "parsed"
  "tags": null,
  "matrices": null,
  "placeholderSections": null,
  "errors": []
}
```

When `status === "parsed"`, the response carries the full bucket payload so the client doesn't need a separate fetch.

### 11.4 `GET /api/imports/:importId/ai-events` (NEW — SSE, primary in v1)

`Content-Type: text/event-stream`. Server emits events of type `status` whose `data` field is the same JSON object as the §11.3 response. One event per state transition (queue position change, stage start, stage progress milestone at 25/50/75 %, stage completion, terminal state, error).

```
event: status
data: {"status":"queued","queuePosition":3,"queueDepth":3,"etaSeconds":480,"format":null,...}

event: status
data: {"status":"queued","queuePosition":2,"queueDepth":2,"etaSeconds":300,"format":null,...}

event: status
data: {"status":"parsing","queuePosition":null,"queueDepth":null,"format":{...},"stages":[...]}

...

event: status
data: {"status":"parsed","buckets":{...},"tags":[...],...}
```

Server config: `X-Accel-Buffering: no`, chunked transfer encoding, 30-second keepalive pings (`event: ping\ndata: {}\n\n`) so the proxy doesn't time out an idle stream during long coverage-review stages. The connection closes when a terminal-state event fires.

If the client's auth token expires mid-stream, the server emits a final `event: auth-expired` and closes the stream; the client refreshes the token and reconnects.

### 11.5 `POST /api/imports/:importId/apply-ai` (NEW)

```jsonc
// request
{
  "narratives": {
    "1": { "a": { "content": "<html>...", "mode": "merge" } },
    "1": { "b": { "content": "<html>...", "mode": "replace" } }
  },
  "supportingEvidenceText": {
    "11": { "a": { "text": "Long prose...", "mode": "merge" } }
  },
  "supportingEvidenceFiles": [
    { "std": "11", "spec": "a", "s3Key": "...", "slug": "rosicky-cv", "title": "Faculty CV — Rosicky" }
  ],
  "matrixCells": [
    { "matrix": "MatrixHSR", "std": "11", "spec": "a", "col": 3, "course": "FMST 240", "codeRaw": "ITKSH", "contentTypes": ["I","T","K","S","H"], "depth": null }
  ],
  "importTags": [
    { "id": "tag-...", "summary": "...", "fullText": "...", "suggestedStd": "12", "suggestedSpec": "c", "confidence": 0.41, "sourceAnchor": "TOC §1.d", "acceptState": "review_low_confidence", "rationale": "..." }
  ],
  "placeholderSections": [
    { "paragraphIndex": 178, "heading": "4. Interim Report — Reaccreditation only", "standardHint": "4", "specHint": null }
  ],
  "globalMergeMode": "merge",
  "perSpecResolution": { "11.a": "merge", "11.b": "take" },
  "idempotencyKey": "ai-apply-65f-1747560000"   // client generates; server dedupes for safe retry
}

// response 200
{
  "ok": true,
  "status": "applied",
  "appliedCounts": { "narratives": 142, "evidenceText": 38, "evidenceFiles": 54, "matrixCells": 370, "tags": 47, "placeholders": 13 },
  "tagsRemaining": 47
}

// response 4xx (no partial writes)
{
  "ok": false,
  "error": "Conflict on Submission.narratives[11][a]: a write occurred since the wizard last loaded this spec. Refresh and re-apply.",
  "status": "parsed"     // status rolled back
}
```

The server performs every write inside a single Mongo session (transaction). The DOCX-to-S3 uploads for `supportingEvidenceFiles` happen **before** the session opens (S3 is not transactional — files are uploaded first, then the Mongo session inserts the SupportingEvidence rows referencing them; on transaction abort, orphan S3 keys are GC'd by a daily janitor job).

### 11.6 `POST /api/imports/:importId/restart-ai` (NEW)

Used by Step 2's "Override format" button.

```jsonc
{ "forceFormat": "self_study" }
```

Server: cancels current cshse-ai job, flips status to `parsing`, queues a new job with the forced format. Returns the same shape as `start-ai`.

### 11.7 `POST /api/imports/:importId/cancel` (existing — reuse, no changes)

### 11.8 cshse-ai endpoints

`POST /ai/import/start` (existing in scripts as `build_preview.py`; needs a thin FastAPI wrapper):

```jsonc
{
  "s3Key": "65f.../docver-.../source.docx",
  "submissionId": "65f...",
  "programLevel": "bachelors",
  "forceFormat": "template",
  "callbackUrl": "https://cshse.up.railway.app/api/imports/65f.../ai-callback",
  "eventCallbackUrl": "https://cshse.up.railway.app/api/imports/65f.../ai-event"
}
```

`GET /ai/import/:jobId` — synchronous status snapshot (same payload shape as §11.3). The AI service uses an internal FIFO queue keyed on the cshse-ai service singleton; jobs serialize through one worker by default (v1). v2 adds horizontal scaling — see §21.

`POST /api/imports/:importId/ai-event` (NEW webhook) — the AI service POSTs incremental progress events here as the job advances. Each event mirrors a `status` payload from §11.4. The CSHSE server fans these out to connected SSE clients on `/ai-events`. Webhook payloads carry an HMAC signature header (`X-CSHSE-Signature`, shared secret) so the server can verify origin.

`POST /api/imports/:importId/ai-callback` — terminal-state webhook the AI service hits when the job reaches `parsed`, `failed`, or `canceled`. Server flips status, persists buckets / tags / placeholders on the SelfStudyImport doc, and emits the final SSE event before closing the stream.

### 11.9 `GET /api/imports/:importId` (existing) — extended response

Add to the existing import response shape:

```jsonc
{
  // ... existing fields ...
  "aiBuckets": { /* full SpecBucket map keyed "std.spec" */ },
  "aiTags": [ /* Tag[] */ ],
  "aiMatrices": [ /* matrix groupings */ ],
  "aiPlaceholderSections": [ /* PlaceholderSection[] */ ],
  "aiFormatVerdict": { /* FormatVerdict */ }
}
```

---

## 12. Component contracts

File paths under `client/src/features/selfStudy/Editor/AIImport/`. All components use TypeScript strict mode + functional + hooks; no class components.

```
AIImport/
├── Wizard.tsx                  -- router, lays out left stepper + active step
├── Stepper.tsx                 -- left-rail step nav
├── steps/
│   ├── UploadStep.tsx
│   ├── ParseStep.tsx
│   ├── ReviewStep.tsx
│   ├── MatrixStep.tsx          -- only mounted when matrices.length > 0
│   └── ApplyStep.tsx
├── review/
│   ├── SpecRail.tsx            -- left rail of specs + Unplaced + Unwritten
│   ├── ItemTable.tsx           -- middle column
│   ├── ItemRow.tsx             -- one row in the table
│   ├── ItemPreview.tsx         -- right column
│   ├── ActionChooser.tsx       -- the kind dropdown + chooser
│   └── ShowInSourceModal.tsx   -- side modal with DocumentViewer
├── tags/
│   ├── TagListView.tsx
│   └── TagPopup.tsx
├── matrix/
│   ├── MatrixGrid.tsx
│   └── CourseColumnHeader.tsx
├── apply/
│   ├── DiffModal.tsx
│   └── ApplySummary.tsx
└── hooks/
    ├── useAIStatusPoll.ts      -- 2s polling on parsing
    └── useWizardStore.ts       -- thin wrapper around aiImportStore
```

Key prop signatures:

```ts
// Wizard.tsx
type WizardProps = { submissionId: string };

// SpecRail.tsx
type SpecRailProps = {
  specs: SpecMeta[];                         // 99 baccalaureate, etc.
  buckets: Record<string, SpecBucket>;
  unplacedCount: number;
  placeholderCount: number;
  selectedKey: string | null;
  onSelect: (key: string) => void;           // key = "std.spec" or "_unplaced" / "_unwritten"
};

// ItemTable.tsx
type ItemTableProps = {
  bucket: SpecBucket | null;                 // null when "_unplaced" / "_unwritten"
  unplacedItems?: Recommendation[];          // when selectedKey === "_unplaced"
  placeholders?: PlaceholderSection[];       // when selectedKey === "_unwritten"
  selectedSectionId: string | null;
  onSelect: (sectionId: string) => void;
  onBulkAction: (action: "to-tags" | "to-file" | "reassign", sectionIds: string[], target?: { std: string; spec: string }) => void;
};

// ItemPreview.tsx
type ItemPreviewProps = {
  item: Recommendation | null;
  onChangeKind: (kind: "text" | "evidenceText" | "file" | "matrix" | "tag" | "discard") => void;
  onChangeSpec: (std: string, spec: string) => void;
  onShowInSource: () => void;
};

// TagPopup.tsx
type TagPopupProps = {
  tag: Tag;
  prevTag?: Tag;                             // for "Previous" button
  nextTag?: Tag;
  onApply: (kind: TagKind, std: string, spec: string) => Promise<void>;
  onSkip: () => void;
  onDiscard: () => void;
  onClose: () => void;
};

// DiffModal.tsx
type DiffModalProps = {
  touchedSpecs: Array<{ std: string; spec: string; before: string; after: string }>;
  resolution: Record<string, "keep" | "take" | "merge">;
  onResolve: (key: string, choice: "keep" | "take" | "merge") => void;
  onClose: () => void;
};
```

---

## 13. Loading, error, empty states

Every async surface has all three. Catalog:

| Component | Loading | Error | Empty |
|---|---|---|---|
| UploadStep | progress bar + cancel | inline red banner | (default state) |
| ParseStep | live stages strip | ✗ next to failed stage + retry / skip | "All stages complete — Next ▸" |
| SpecRail | shimmer placeholders | "Couldn't load buckets — [retry]" | "No specs detected for this program level" |
| ItemTable | shimmer rows | row-level "row failed to update" toast | "No items for this spec" |
| ItemPreview | none (instant) | "Section content unavailable" | "Select an item to preview" |
| TagListView | shimmer rows | "Couldn't load tags — [retry]" | "No tags — start a new import" |
| TagPopup | spinner on Apply | inline red text in popup; popup stays open | n/a |
| MatrixGrid | shimmer | banner above grid | "No matrices detected" |
| ApplyStep | spinner overlay during Apply | modal with error text + retry | "Nothing to apply — see tags" |

Conventions:
- All shimmer placeholders use `<Skeleton>` from `shadcn/ui` (already in client).
- Toasts via the existing toast system; success/error variants.
- Errors that block forward progress are surfaced inline; errors that don't are toasts.

---

## 14. Accessibility

The wizard must pass WCAG 2.1 AA. Specific requirements:

- **Keyboard:** every step navigable without mouse. Tab order: stepper → main content → footer (Back/Next/Apply).
- **Stepper:** ↑/↓ arrows move between reached steps; Enter activates. `role="tablist"` + `aria-current="step"` on active.
- **ItemTable:** arrow keys move between rows; Enter opens preview; Space toggles checkbox; `j` / `k` as Vim-style alternatives (the legacy editor uses these and Coordinators are trained on them).
- **ItemPreview:** focus moves into the preview when an item is selected; `Esc` returns focus to the table.
- **ActionChooser:** dropdown opens with Enter or Space; arrow keys navigate; Esc closes without committing.
- **TagPopup:** focus trapped inside the modal; Esc closes; `←` / `→` move to prev/next tag (when buttons exist).
- **MatrixGrid:** course-column dropdowns are searchable comboboxes (typeahead).
- **DocumentViewer modal:** Esc closes; focus restored to the "Show in source" button.
- **Colour contrast:** all confidence-band colours must meet 4.5:1 against their backgrounds. The CSHSE green tokens at `cshse-600` are pre-validated; amber-700 needs verification against amber-50.
- **Screen reader labels:**
  - Stepper step: `"Step 3 of 5, Review recommendations, ready"` (current and reached/locked state).
  - Confidence: `"Confidence 0.85, high"` (or medium / low).
  - Kind: explicit text, not just an icon (`"Narrative"`, `"Supporting evidence file"`, etc.).
- **Live regions:** Parse step uses `aria-live="polite"` on the stages list so screen readers announce stage transitions without interrupting.
- **Reduced motion:** respect `prefers-reduced-motion`; suppress step-transition animations.
- **Tested with:** macOS VoiceOver (Safari) + NVDA on Windows (Edge) at minimum, before sign-off as MVP-done.

---

## 15. Visual design

The wizard uses the existing CSHSE design system (Tailwind + shadcn/ui, tokens in `client/tailwind.config.js`):

- Primary brand: `cshse-600` (`#006B3F`) for active step, primary buttons.
- Accent: existing amber tokens for the yellow band.
- Backgrounds: `bg-background`, `bg-card` for the content area, `bg-muted` for the stepper rail.
- Typography: Inter (already loaded). Heading sizes: `text-2xl` for step title, `text-lg` for section title, `text-base` for body.
- Spacing: standard `gap-4` / `gap-6`; the three-column Review layout is `grid grid-cols-[280px,1fr,420px] gap-6`.
- Icons: Lucide (already in deps). Confidence band markers are filled circles in band colour, not emoji, to keep them accessible.
- The ASCII mockups throughout this spec are layout sketches; final polish uses shadcn/ui primitives.

No new design tokens introduced.

---

## 16. Telemetry

Fire to the existing analytics endpoint (PostHog, behind `usePosthogEvent` hook). Events:

| Event | When | Payload |
|---|---|---|
| `ai_import_started` | Step 1 Next | `{ programLevel, isReimport, forceFormat, fileSize, fileType }` |
| `ai_import_queued` | Status flips to `queued` | `{ initialPosition, queueDepth, etaSeconds }` |
| `ai_import_queue_advanced` | Queue position decreases | `{ fromPosition, toPosition, waitedMs }` |
| `ai_import_events_fallback` | SSE drops 3× → switch to polling | `{ failureReason, sseDurationMs }` |
| `ai_import_parsed` | Step 2 → Step 3 transition | `{ format, formatConfidence, sectionCount, durationMs, totalWaitMs, totalParseMs }` |
| `ai_import_format_overridden` | Step 2 "Override" clicked | `{ from, to, formatConfidence }` |
| `ai_import_step_navigated` | step changes | `{ from, to, direction }` |
| `ai_import_item_reassigned` | ItemPreview kind/spec change | `{ sectionId, fromKind, toKind, fromSpec, toSpec }` |
| `ai_import_bulk_action` | bulk-action button | `{ action, count }` |
| `ai_import_applied` | Step 5 Apply succeeds | `{ counts, durationMs, mergeMode, tagsRemaining }` |
| `ai_import_apply_failed` | Step 5 Apply errors | `{ errorMessage, attemptedWrites }` |
| `ai_import_tag_resolved` | TagPopup Apply / Skip / Discard | `{ tagId, action, finalKind, finalSpec }` |
| `ai_import_cancelled` | Cancel at any step | `{ atStep, status }` |

No PII in payloads. SubmissionId and ImportId are pseudonymised UUIDs.

---

## 17. Performance budgets

- **Initial render** (Wizard mount): < 200 ms on the median Coordinator's laptop. Lazy-load step components.
- **Spec rail render** with 99 specs: < 50 ms; use `react-window` if the count ever exceeds 100.
- **Item table** with 500+ items in one spec: virtualize via `react-window` automatically when `bucket.totalItems > 100`.
- **AI-status transport**: SSE (`/ai-events`) is primary. Connection stays open through parsing + queue waits; server pings every 30 s to keep proxies from idling out. On the client, close on `visibilitychange → hidden` and reopen on `visible` (catches up via a one-shot `/ai-status` snapshot). Three consecutive reconnect failures → fall back to 2 s polling for the rest of this import.
- **DocumentViewer modal**: only mount on demand; unmount on close.
- **Bundle**: AI Import code-split chunk should be ≤ 80 KB gzipped on its own.

---

## 18. Test plan (Playwright E2E)

Add to `e2e/ai-import.spec.ts`:

1. **Happy path — template format** (KSU fixture)
   - Upload → format auto-detected as template → Parse → Review (≥ 1 spec hit) → Skip Matrix → Apply (merge mode) → assert Submission.narratives has expected content.
2. **Happy path — free-form self-study** (Stevenson fixture, small subset)
   - Upload → format auto-detected as self_study → Parse with gap-fill → Review → Matrix → Apply (replace mode for fresh import) → assert writes.
3. **Re-import flow** (template format twice)
   - First import as above. Manually edit one spec in the Standards tab. Second import → assert merge mode auto-selected, diff modal opens on Apply.
4. **Override format** at Step 2 → assert restart-ai called → assert pipeline strip re-runs.
5. **Cancel mid-parse** → status flips to canceled; AI Import tab badge clears.
6. **Apply failure (server returns 409)** → modal shows error, no partial writes, retry succeeds.
7. **Tag resolution** — open TagPopup, apply with reassigned spec, assert Submission write + tag removed.
8. **Accessibility smoke** — `axe-playwright` scan on every step; assert 0 violations.

Existing server tests (`server/tests/*.test.ts`) cover the API contracts; add:

9. `imports.test.ts`: `apply-ai` is idempotent under retry with the same `idempotencyKey`.
10. `imports.test.ts`: `apply-ai` rolls back atomically on a mid-transaction failure.

---

## 19. Phased implementation plan

**Sub-sprint 1.a — Plumbing (≈ 2 days)**

- `aiImportStore.ts` (Zustand) skeleton.
- New routes mounted under `/ai-import/*` (UploadStep + ParseStep stubs).
- Server: `POST /api/imports/:importId/start-ai`, `GET /api/imports/:importId/ai-status`, `POST /api/imports/:importId/cancel` (existing — verify), `POST /api/imports/:importId/apply-ai` (stub returning OK without writing).
- cshse-ai: thin FastAPI wrapper around `scripts/build_preview.py` exposing `/ai/import/start` and `/ai/import/:jobId`.
- E2E test 1 (template happy path) passes against stubbed Apply.

**Sub-sprint 1.b — Review surface (≈ 3 days)**

- `ReviewStep.tsx` with SpecRail / ItemTable / ItemPreview wired to live data.
- Bulk actions (to-tags, to-file, reassign).
- ShowInSourceModal with DocumentViewer.
- E2E tests 1 + 2 pass end-to-end (Apply still stubbed).

**Sub-sprint 1.c — Apply pipeline (≈ 2 days)**

- Real `apply-ai` server implementation (Mongo session, S3 uploads, idempotency key dedup).
- ApplyStep + DiffModal + merge/replace/per-spec modes.
- E2E tests 1, 2, 3, 6 pass; server unit tests 9, 10 added.

**Sub-sprint 1.d — Matrix + Tags + a11y polish (≈ 3 days)**

- MatrixStep with course-column dropdowns + create-course modal.
- TagListView + TagPopup + persistence.
- Accessibility audit + fixes; reduced-motion handling; keyboard nav.
- E2E tests 4, 5, 7, 8 pass.

**Sub-sprint 1.e — Develop deploy + smoke (≈ 1 day)**

- Promote to `develop` env via the standard Railway flow (see [[railway-deployment-topology]]).
- Run the full Stevenson re-preview through the deployed wizard end-to-end as a smoke test.
- Hand over to the Coordinator team for UAT.

Total estimate: **~11 working days** from sign-off to develop-deployed.

---

## 20. Resolved decisions

(From §6 of the 2026-05-17 sketch + the five §21 follow-ups resolved 2026-05-18.)

**From the original sketch:**

1. **Re-import diff merge UX** — three modes: Merge (default for re-import), Replace (default for fresh), and Per-spec (opens diff modal). Per-spec is the higher-effort path but unblocks the partial-fill workflow where Coordinators want to keep some hand-written prose and take some new AI-extracted prose. Built as a single radio group in Step 5.
2. **Tag list lifetime** — **explicit only**. The Coordinator applies / skips / discards each tag; no auto-prune when the underlying spec gets manually filled. Auto-prune was rejected to avoid surprise data loss.
3. **Cross-institution semantic search** — **hidden in v1**. Feature flag `crossInstitutionSimilarity` defaults to off. Re-evaluate after CSHSE board approval.
4. **Matrix course catalog** — **structured Mongo collection per institution**. New collection `programCourses` with `{ institutionId, programId, courseCode, courseName, lastUsedAt }`. Step 4 dropdowns populate from this; "Create new course" inserts a row. The deep-walker's regex hits seed the collection on first use of a new institution.
5. **Confidence thresholds** — locked in §10 above based on the 2026-05-18 calibration validation. The verifier confidence floor `0.50` is independent and applies only to the gap-fill verifier.

**From the five 2026-05-18 follow-ups (Coordinator-resolved):**

6. **AI-status transport — SSE in v1, polling fallback only.** Server pushes incremental events on `GET /api/imports/:importId/ai-events` (§11.4); the client opens an `EventSource` immediately after Upload. The same channel carries queue-position events, format-detection verdicts, per-stage progress milestones, and the terminal `parsed` payload. Polling on `/ai-status` is the fallback path when SSE reconnect fails three consecutive times. Resolves the "is the UI hung?" perception risk for the long Stevenson-sized parse.
7. **Long-wall-clock self-study acceptable** — the ~10–12 min Stevenson-sized parse is acceptable in v1 because §6.2's SSE-driven progress strip reports stage-by-stage updates with per-stage ETAs. No background-email mode in v1. Revisit only if Coordinator feedback shows the perception fix isn't enough.
8. **TagPopup deep-linking — in v1.** `/ai-import/tags/:tagId` opens the Tag List view with the specified tag's popup pre-opened. Sharable URL for reviewers. Routing change is minimal; the `tagId` is already a stable field.
9. **Show-in-source uses the CURRENT document version.** When the Coordinator clicks "Show in source" on a tag or item, the modal opens the latest `DocumentVersion` of this Submission's source, not the version the tag was created against. If the tag's `sourceAnchor` still exists in the current HTML, scroll to it. If not, fall back to fuzzy text search on `tag.fullText[:200]` (case-insensitive, whitespace-collapsed); on a hit, scroll there and show a small amber banner: "This document has changed since the tag was created — best-effort match below." On a miss, show: "This content is no longer in the current document version. View the original DOCX from the import history." The tag still stores `originalDocumentVersionId` for audit; it just isn't the default view.
10. **Multi-Coordinator concurrency — FIFO queue with live position display.** When the AI service worker is busy, additional imports stack in `queued` status. Each waiting Coordinator's wizard sits on the Step 2 queued screen (§6.2) and watches their position decrement via SSE: `4th in line… 3rd in line… 2nd in line… starting now…`. Cancelling from the queued state releases the slot immediately. v2 adds horizontal scaling — multiple cshse-ai service instances + a queue router — but v1 ships with a single worker because actual concurrency is expected to be low and the SSE-driven queue UI gives Coordinators clear feedback regardless. **Apply still uses 409 for same-Submission Mongo races** (the queue serializes parsing, not Mongo writes) — these are independent: the queue is service-level, the 409 is data-level.

---

## 21. Remaining follow-ups (non-blocking)

None of the original five open questions remain — all are resolved in §20. New items surface from those decisions; none gate sub-sprint 1.a:

1. **SSE through Railway's proxy — verify in sub-sprint 1.a.** Configure `X-Accel-Buffering: no`, chunked encoding, 30 s keepalive pings. If the proxy still buffers events in a way that breaks "4th in line → 3rd in line" liveness, fall back to short-poll-with-server-push (a hybrid: client polls a long-lived endpoint that blocks up to 25 s waiting for the next event). Confirm before sub-sprint 1.b.
2. **Queue starvation handling.** If a single Coordinator uploads back-to-back-to-back, queue could grow indefinitely. v1 has no per-Coordinator throttle — relying on the soft fact that one human uploads at most a few imports/day. Add a `recentImportsByUser` throttle if observed in production.
3. **Stalled-stage detection.** If a stage stays `running` past 3 × its rolling-window p95 duration, surface "This stage is taking longer than usual. [ Cancel ] [ Keep waiting ]" in the pipeline strip. Heuristic-only; doesn't auto-kill the job.
4. **Queue-position decrement caching.** If the SSE stream churns rapidly (e.g., 10 imports in 5 minutes), the queue-position decrements could fire many times per second to the UI. Debounce to once per 500 ms in the client; the wire protocol is unaffected.
5. **Apply race banner copy.** When a 409 fires because the second Coordinator's data is stale, the message in §11.5 says "a write occurred since the wizard last loaded this spec. Refresh and re-apply." UX team should confirm wording in their next pass.

---

## 22. Glossary (wizard-specific terms)

- **Bucket** — the (std, spec) container; one per Handbook specification. The wizard's primary data unit.
- **Format** — `template` (spec-as-outline) or `self_study` (free-form). Set by the detector.
- **Kind** — the section's destination after Apply: `text` / `evidenceText` / `file` / `matrix` / `tag` / `discard`.
- **Placeholder section** — a template heading with no authored body. Template-format only.
- **Tag** — an item the wizard deferred for human review. Persists past Finish until explicitly applied / skipped / discarded.
- **Verdict** — coverage reviewer's per-spec output: covered / partial / gaps remain, with score 0.0–1.0.

---

## 23. Sign-off

Coordinator sign-off here gates sub-sprint 1.a. After this point, changes land as edits to this page with a `last_reviewed` bump, and sub-sprint estimates are pinned. The five §21 follow-ups are technical-implementation details that don't block start — pick them up during sub-sprint 1.a or hand them off.

Related: [[legacy-self-study-import]] · [[ai-import-wizard-preview-stevenson-2026-05-18]] · [[ai-import-wizard-preview-kennesaw-state-2026-05-18]] · [[narrative-storage]] · [[evidence-document-review-pipeline]] · [[evidence-file-storage]] · [[railway-deployment-topology]]
