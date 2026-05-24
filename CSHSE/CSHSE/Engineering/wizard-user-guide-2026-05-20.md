---
name: AI Import Wizard — User Guide & Test Plan 2026-05-20
description: Top-down walkthrough of the wizard from .docx upload to the Standards editor — every screen, every click, every test criterion. Companion to wizard-user-guide-2026-05-20.pptx.
type: review
tags: [ai-import, sprint-1, user-guide, test-plan, coordinator]
audit_date: 2026-05-20
auditor: claude
last_reviewed: 2026-05-20
---

# AI Import Wizard — User Guide & Test Plan (2026-05-20)

Companion page to the [PowerPoint deck](wizard-user-guide-2026-05-20.pptx). Both cover the same surface; this page is the long-form walkthrough you can keep open in the second monitor while testing.

State of the wizard at this writing: commit `8ea57e6` on `developer`. Both `cshse-develop` and `cshse-ai-develop` are deployed and healthy.

---

## TL;DR — five steps, one click at the end

1. **Upload** — drop the .docx, pick program level, click Next.
2. **Parse** — ~4 minutes unattended; pipeline pulls the DOCX from S3, converts to HTML, walks every section, routes each one to a spec.
3. **Review** — three-pane workspace. Spec rail (left), item cards (middle), AI preview (right). Fix anything the matcher got wrong; "+ Add from source" for empties; per-card kind chips for narrative↔evidence flips.
4. **Matrix** — optional; map matrix columns to courses in your catalog. Skip if you'd rather populate later from the Curriculum Matrix tab.
5. **Apply** — the emerald **🚀 Apply to editor** button on the Review screen toolbar. Confirm dialog. Done.

After Apply: open the **Standards** tab to see your narratives + AI rationale blocks, and the **Curriculum Matrix** tab to see the imported matrix tables.

---

## When to use the AI Import Wizard vs the legacy Import Document path

Per [[change-requests/cr-001-both-importers-required]] both paths ship side-by-side on the Self-Study Editor toolbar. Both write to the **same `Submission` record** — pick whichever fits the situation, mix and match within a single self-study.

| Situation | Use | Why |
|---|---|---|
| You have **one finished `.docx`** (or PDF fallback) that covers the whole self-study | **AI Import (wizard)** | Mammoth → ai-service routes every section in one ~4-minute pass. Per-card Review lets you fix any misroutes before Apply. |
| You have **multiple co-authors** each handing you sections at different times | **Import Document (legacy)** | The legacy per-standard paste-and-tag modal lets each contributor's section land on the right spec without waiting for everyone else. |
| You imported via wizard, found one spec the matcher got wrong, want to **manually fix that one spec** | **Import Document (legacy)** for that one spec | The legacy paste modal targets a single (standard, spec) at a time — surgical edits. |
| You imported via legacy, want to **bulk-process** a newly arrived large document | **AI Import (wizard)** on the new doc | Wizard reads from the document only; the existing legacy-imported content stays in place and merges at Apply. |
| You're starting a fresh self-study and **have nothing yet** | **Import Document (legacy)** for the first pass | The AI wizard wants real content to route. Use legacy paste-as-you-write while the document grows; switch to wizard when you have a complete `.docx`. |

**Mixing safety.** A coordinator can run the wizard, then later use the legacy paste flow for an additional section, or vice versa. Both code paths write through the same `Submission.standards` model, so there is no separate state to reconcile. If both paths target the same spec, the merge rules:

- **Legacy paste replaces** the previous content for that spec by default.
- **Wizard Apply** offers a per-spec resolution dropdown (Replace / Merge / Per-spec choice) on the Apply screen so you don't lose the legacy work.

**UI labels.** The Self-Study Editor toolbar shows:
- `Import Document` with a grey `Legacy` chip — the per-standard paste flow.
- `Importer Wizard` with a teal `AI` chip — the 5-step wizard described below.

The two buttons are intentionally adjacent so a coordinator can see both options without scrolling. Tooltips on each button describe the use case in one sentence.

---

## Before you start

| Need | Why |
|---|---|
| Your finished self-study .docx (PDF is a fallback) | The wizard pipeline starts from a DOCX. Anything up to 100 MB. |
| Program Coordinator role | The "Import File Wizard" tab only shows for Coordinators. Readers / Lead Readers don't see it. |
| Browser hard-refresh | ⌘⇧R (Mac) / Ctrl⇧R (PC) — flushes cached client bundles after any deploy. The "Spec ?.?" rendering bug + old MatrixStep title come from a stale bundle. |
| OpenAI balance > $1 | A full Stevenson-scale run is ~$0.45 (matcher = ~557 OpenAI embeddings + ~80 Claude Haiku calls). Set auto-recharge in your OpenAI billing dashboard so the wizard doesn't halt mid-run. |

---

## Step 1 — Upload

### How

1. Open the **Self-Study Editor** for your submission. URL pattern: `/self-study/<submissionId>`.
2. Click the **Import File Wizard** tab in the top bar (next to Curriculum Matrix + Supporting File Library).
3. Drag your `.docx` into the drop zone (or click to browse).
4. Pick the program level — **Associate**, **Baccalaureate**, or **Master's**. The level drives which CSHSE handbook + matrix template the matcher uses.
5. Tick **"This is a re-import of an existing self-study"** if you're replacing a prior wizard run. (Keeps the existing submission's narratives + evidence around to merge with.)
6. Optionally tick **"Treat this upload as template format (skip auto-detect)"** — only if you're uploading a partly-filled CSHSE template DOCX (e.g. Kennesaw State style) and the auto-detector misroutes it.
7. Click **Next**.

### What to verify

- ☐ Drop zone accepts the file (no rejection bounce).
- ☐ Upload progress bar reaches 100%.
- ☐ "Starting AI service…" appears briefly while cshse-ai enqueues the job.
- ☐ Page advances to the Parse step.
- ☐ If you previously had a failed run: clicking "Start over" on the Parse step now clears the red error banner and returns you to a fresh upload form (no stale red text waiting for a new drop).

---

## Step 2 — Parse

The pipeline runs unattended. Seven stages, total wall time ~4-5 minutes on a Stevenson-sized doc (~350 MB HTML after mammoth conversion).

| Stage | Typical duration | What it does |
|---|---|---|
| `download_s3` | <1 s | Pulls the .docx from Tigris S3 to a temp file. |
| `format_detect` | <1 s | Auto-routes between `self_study` (free-form Stevenson-style) and `template` (CSHSE template format like Kennesaw). |
| `mammoth` | ~15 s | DOCX → HTML via mammoth. Output is ~350 MB for a Stevenson-sized doc. |
| `deep_walker` | ~15 s | Walks every top-level `<table>` + letter-tagged response. Suppresses `curriculum_matrix`-classified tables (those go to `matrix_extract`). Preserves short letter-tagged sections (like spec 1.a's 26-word response) by tier, not by length. |
| `matcher` | 2-3 min | OpenAI `text-embedding-3-small` per section → Qdrant cosine search → Claude Haiku 4.5 adjudication. Routes each section to a `(Standard, Spec)`. Pulls per-institution corrections as few-shot hints. |
| `coverage_review` | ~1 min | Claude pass per filled spec: are the gathered narratives + evidence enough? Sets the 🟢/🟡/🔴 dot you'll see in the rail. |
| `matrix_extract` | ~15 s | Walks the `#MatrixHSR` + `#Matrix2` anchors. Produces wire-format per-matrix dicts: full `<table>` HTML with per-row anchors + every filled cell with `(std, spec, columnIndex, codeRaw, contentTypes, depth)`. |

### "Looks hung"?

The matcher stage takes ~2-3 minutes and is the most common cause of coordinators bouncing.

- **Watch the detail line.** Each stage's row shows a status string like `200 / 557` → `557 / 557` that ticks up every few seconds.
- **Elapsed timer** at the top of the page keeps moving even when an individual stage is slow.
- **Stall banner** — if nothing updates for >30 s the page surfaces an amber "Still working — last update Ns ago" banner. The pipeline is alive; the worker just hasn't emitted a milestone.

### If parse fails

- Red banner appears with the failed stage + error detail.
- Click **Start over** — the button now clears errors + pipeline-stages + buckets + matrices + importId and returns you to a fresh upload form. (Pre-fix: it only navigated; the red error stuck around until you dropped a new file.)

---

## Step 3 — Review

This is where the coordinator actually spends time. The screen is a three-pane workspace:

```
┌───────────────┬───────────────────────┬──────────────────┐
│  Spec rail    │  Item cards            │  AI preview      │
│  (left)       │  (middle)              │  (right)         │
│               │                        │                  │
│ 📊 Matrices   │  Card #1   [Narrative] │  Selected card   │
│ Standard 1    │   ✓ Approve            │  rationale,      │
│   1.a [6]🟢   │  Card #2   [Evidence]  │  confidence,     │
│   1.b [2]🟡   │   ✓ Approve            │  change kind,    │
│   ...         │  ...                   │  reassign,       │
│ Unplaced [12] │                        │  show in source  │
│ Unwritten [4] │                        │                  │
└───────────────┴───────────────────────┴──────────────────┘
```

### Left — Spec rail

- **📊 Matrices (N)** — first entry when matrices were detected. Click → middle pane shows the full source `<table>` for each matrix (with per-row anchors). Useful for verifying the matrix extraction picked everything up.
- **STANDARD N** group headers (1 through 21 for baccalaureate).
- Each spec row: `1.a Institutional Requirements …` with:
  - A **green count badge** showing how many items the matcher routed here.
  - A **coverage dot**: 🟢 covered · 🟡 partial · 🔴 gaps remain · (none) nothing routed.
- **Unplaced** at the bottom — items the matcher couldn't confidently route. These will become "tag list" entries on apply.
- **Unwritten** — template-format placeholder prompts (only appears for template-format imports like Kennesaw).

### Middle — Item cards

Grouped by kind within each spec:

- **📝 Narratives** — substantive prose. Lands in `Submission.narratives[std][spec].content` on apply.
- **📄 Supporting evidence — text** — long-form (≥1000 words). Lands in `narratives[std][spec].supportingEvidenceText`.
- **📎 Supporting evidence — files** — likely-file content (CVs, syllabi, course catalogs). Becomes separate `SupportingEvidence` rows on apply.
- **🔢 Matrix cells** — when the spec has cells in any detected matrix. Each cell card links back to the matrix.

Each card has:

- **Checkbox** for bulk actions.
- **Confidence chip** color-coded — green ≥0.85, amber 0.5-0.85, slate <0.5.
- **Kind chips** — three-button segmented control: `Narrative · Evidence · File`. Click any chip to flip the kind in place. (Use this to turn a narrative into supporting evidence: just click "Evidence".)
- **Approve button** — top-right of the card header. Click to mark the card "Reviewed" — green border + emerald check badge. Coordinator workflow tracker; does NOT gate the Apply action. Counter in the top toolbar shows "N reviewed".
- **Full body text** — the actual narrative or evidence text. Source tables get rendered with rows/columns preserved.
- **Click the card body** to select; the right pane updates with the AI's rationale.

### Right — AI preview pane

When a card is selected:

- AI's primary `(Standard, Spec)` pick + confidence + 1-2 sentence rationale.
- **Place this item as** dropdown — same as the inline kind chips, but with extra options: "Defer to tag list" and "Discard".
- **Reassign to a different (Std, Spec)…** — opens a popup with the full spec list.
- **Show in source document** — opens the original DOCX (HTML-rendered) scrolled to the section.

### Bulk-action toolbar

Above the cards, sticky at the top of the middle pane:

| Button | What it does |
|---|---|
| **✓ Approve selected** | Mark every currently-checked card as reviewed. |
| **✓ Approve all** | Mark every card on this spec page as reviewed. |
| **Clear approvals** | Undo all reviewed marks across every spec. Only visible after at least one Approve. |
| **Send to tags** | Move checked items out of the spec and into the tag list (low-confidence triage). |
| **Apply as file** | Convert checked items into supporting evidence files. |
| **Reassign…** | Move checked items to a different `(Std, Spec)`. |

### When a spec is empty: the correction loop

Click any empty spec card → you'll see the **"+ Add from source"** CTA in the middle pane.

1. Click **"+ Add from source"**. The source-document viewer opens in **selection mode** targeted at that spec.
2. Highlight the passage in the document that addresses this spec. The bottom of the viewer shows your captured selection.
3. Click **Use this passage**. Three things happen at once:
   - The spec card fills with the highlighted text (you'll see it added to the Narratives group).
   - A correction record is written to MongoDB (`ImportCorrection` collection).
   - cshse-ai embeds the passage and stores it in Qdrant (`cshse_corrections_{env}`).

**Future runs at your institution use these corrections as soft few-shot hints in the Haiku prompt.** Scope is per-institution — Stevenson's corrections shape only Stevenson's future imports, never Kennesaw State's. After the third or fourth self-study, the matcher should need noticeably fewer manual fixes.

---

## Step 4 — Matrix (optional)

### Purpose

The AI extracted every filled matrix cell with `(spec, columnIndex)` — e.g. column 2 of spec 11.b = `I,KM`. But mammoth's DOCX→HTML conversion frequently can't recover the **column-header text** (merged or styled header cells). The matrix arrives with `columnHeaders: []` and the form shows placeholders like "Col 1, Col 2 …".

This step asks you to map each `Col N` to a course in your `ProgramCourses` catalog. Once mapped, the cells land in `CurriculumMatrix.standards[]` with real `courseId` references on apply.

### What's on the screen

- **Header**: `Curriculum matrix — map columns to your courses · N matrices detected · 0 of M columns named`.
- **Blue info banner** explaining the screen's purpose, the I/T/K/S + L/M/H legend, and that **Skip** is a valid path.
- **Per-matrix block**:
  - Title (`Matrix for Human Services Courses`).
  - Sub-line: `13 columns · 395 filled cells · 75 specs · 75 rows matched the template`.
  - **Amber warning** if `columnHeaders` is empty — explains *why* columns show as "Col 1..N" and points at the Skip path.
  - Per-column dropdowns — pick a course from the catalog. If `columnHeaders` had values, they're shown as a hint below each input.
  - **Cell-code legend** (I/T/K/S + L/M/H).
  - **Cell table** — sticky matrix-name banner stays visible while you scroll the 75 spec rows. Hover any row or cell for full context tooltip: `Matrix for HSR · 11.a · HS101 = I,KM`.
  - **Collapsible "Show original source-document table"** — opens the row-anchored `<table>` from your DOCX inline. Useful for reading off the course codes column by column.
  - **Skip this matrix** toggle, prominent in the top-right of each matrix block.
- **Next: Apply ▸** — no longer blocked. Even with zero columns mapped you can move forward (just nothing matrix-related gets applied).

### Cell-code reference

| Letter | Meaning |
|---|---|
| **I** | Introduction of the topic |
| **T** | Theory |
| **K** | Knowledge |
| **S** | Skills |
| **L** | Low depth |
| **M** | Medium depth |
| **H** | High depth |

Example: `I,KM` = Introduction + Knowledge at Medium depth · `T,L` = Theory at Low depth · `ITKSH` = all four content types at High depth.

---

## Step 5 — Apply

Two paths to the editor:

### Path A — One click (recommended)

On the **Review** screen top toolbar there's a prominent emerald **🚀 Apply to editor** button.

1. Click it.
2. A confirm dialog appears showing exact counts:
   - 📝 N narratives
   - 📄 N supporting evidence text
   - 📎 N evidence files
   - 🔢 N matrix cells across N matrices
   - 🏷 N unplaced items → Tag list
3. Click **🚀 Confirm — send to editor**.
4. Status flips to "applying" → "applied". Success banner appears.
5. The wizard advances to the Apply step's read-only success summary.

This path skips the Matrix step (column-mapping form). Useful when:
- You're going to populate the matrix manually from the Curriculum Matrix tab.
- The matrix-step columnHeaders were unreadable anyway (Stevenson).
- You're not changing the default merge mode (`merge`).

### Path B — Guided

Click **Next: Matrix ▸** (or **Next: Apply ▸** if no matrices were detected) at the top of the Review screen. The guided flow walks you through:

1. **Matrix step** — map columns to courses + decide skip vs. apply per matrix.
2. **Apply step** — choose merge behavior:
   - **Merge** (default) — keeps existing content; appends new content separated by `<hr/>`.
   - **Replace** — overwrites existing content. Use sparingly.
   - **Per-spec choice** — opens a diff modal showing existing vs. proposed for every touched spec; you pick keep/take/merge per spec.
3. Click **Apply & finish**.

Use Path B when you have a prior run on this submission and the merge decision matters per spec.

---

## What lands in the Standards editor

After apply succeeds, navigate back to the **Standards** tab in the self-study editor.

| Where | What you'll see |
|---|---|
| **Standards tab** | For each touched spec, the narrative content now has a styled `<div class="ai-analysis">` block at the top — AI confidence + accept-state + rationale — followed by the imported text. Click into any spec to see/edit. |
| **Curriculum Matrix tab** | One `CurriculumMatrix` document per matrix you didn't skip. `rawContent[]` is seeded with the row-anchored matrix HTML so you can see the full grid + the row IDs (`matrix-hsr-row-11-a`, etc.). |
| **Supporting File Library tab** | Evidence files (CVs, syllabi, course catalogs) became `SupportingEvidence` rows linked to the narrative they support. |
| **Standards-tab spec breadcrumb** | For specs 11-21 (the matrix-covered standards) you'll see a new **"View in matrix"** button next to the spec navigation arrows. Click → switches to the Curriculum Matrix tab, scrolls to and flashes the matching row. |
| **Tag list** (left rail in editor) | Anything the matcher couldn't confidently place. Triage at your own pace. |

---

## Test plan checklist

End-to-end pass criteria. Tick each as you verify:

- ☐ **1. Hard-refresh** the wizard tab — browser fetches the latest client bundle.
- ☐ **2. Start over** from a failed run — red error banner clears; upload form is fresh.
- ☐ **3. Drop the DOCX** — upload progress to 100%, "Starting AI service…" briefly, advance to Parse.
- ☐ **4. Parse completes** — all 7 stages done; `deep_walker` detail line shows "N raw, M after filter (preserved K short letter-tagged responses)".
- ☐ **5. Spec 1.a has content** — rail shows a number badge on 1.a (no longer empty).
- ☐ **6. Matrices entry visible** — top of the rail: "📊 Matrices · 2"; click shows the full `<table>` for each.
- ☐ **7. Kind chip flip** — click "Evidence" on a Narrative card → it re-buckets; the rail badges update.
- ☐ **8. Approve all** — bulk toolbar button marks every visible card green; "N reviewed" counter updates.
- ☐ **9. "+ Add from source"** — empty spec card → modal opens → highlight → "Use this passage" → card fills; correction lands in the `ImportCorrection` Mongo collection.
- ☐ **10. 🚀 Apply to editor** — confirm dialog shows counts; status flips to "applied"; success banner.
- ☐ **11. Standards tab** — narratives visible under each spec; `ai-analysis` blocks at the top of each.
- ☐ **12. Curriculum Matrix tab** — N new `CurriculumMatrix` documents; `rawContent` renders the matrix tables; `View in matrix` link on spec 11-21 breadcrumbs scrolls to the row.

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| **OpenAI 429 `insufficient_quota`** | Project balance is $0. Top up at platform.openai.com/billing. Turn on auto-recharge so the wizard doesn't halt mid-run. |
| **"Spec ?.?" rows on the Matrix step** | Old browser bundle. Hard-refresh (⌘⇧R / Ctrl⇧R). After refresh you should see actual spec markers like 11.a, 11.b. |
| **Matrix step shows "Matrix block matrix-hsr" instead of "Matrix for Human Services Courses"** | Same root cause — stale bundle. Hard-refresh. |
| **Matrix `columnHeaders` blank** | Mammoth couldn't read the source header cells (merged cell styling). Open your DOCX in Word side-by-side to read off column 1, 2, 3 …, OR skip the matrix and populate manually from the Curriculum Matrix tab. |
| **Parse "stuck" on matcher** | Coverage-review takes ~2-3 min on a Stevenson-scale doc. Watch the "N / M" counter — it ticks every few seconds. If nothing updates for >30 s you'll see an amber stall banner. |
| **Parse failed: red banner** | Click **Start over** — clears errors + transient state + returns to upload. Check the error detail for the failing stage. Common failure: `OpenAI insufficient_quota` (see above). |
| **Spec X.Y is empty but the document plainly addresses it** | Use the **"+ Add from source"** CTA. Highlight the passage. Confirm. The card fills + a correction is filed. Your next import learns from it. |
| **Apply hangs at "Applying…"** | Check the browser network panel. The `/apply-ai` POST should return in <10 s. If it errors, the wizard surfaces the message; common failure is a Mongo write conflict (legacy pipeline still touching the submission). Retry. |

---

## Related vault pages

- [[sprint-plan-2026-05-16]] — Sprint 1 detail; this user guide closes UAT for Sprint 1.
- [[import-wizard-ui-spec-2026-05-18]] — the signed-off UI spec the wizard implements.
- [[ai-import-stevenson-matrices-2026-05-19]] — smoke-test report for the matrix-as-first-class slice.
- [[ai-import-deploy-runbook-2026-05-18]] — Railway deploy procedure for the wizard.
- [[legacy-self-study-import]] — what the wizard replaces; the manual-tagging baseline.
- [[product-requirements]] — the wider portal's product requirements, of which the wizard is one of the biggest.
