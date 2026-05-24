---
name: CR-041 — Multi-file drag-drop import with batched "hold-for-review" semantics
description: Today the import wizard accepts exactly one document per session. Coordinators routinely receive self-study material as multiple files — one Standard per faculty author, bulk syllabi from the registrar, a folder of research-paper appendices, a faculty member's CV update. This CR adds multi-file drag-drop on the Upload step, treats the dropped set as a single logical "import batch" with one shared Review screen, processes each file through the existing ai-service pipeline serially, and gates advancement to Review on a per-batch "hold-for-review" flag (default ON — the whole point is batch review, not one-at-a-time). Eight numbered user stories sized for sprint planning.
type: change-request
cr_id: CR-041
status: shipped
priority: P0
source: User direction 2026-05-23 — "Allow many files to be drag/dropped to the importer. This will allow the PC to take different sections of the document written by different people or take bulk syllabi or papers and drag them to the import wizard. This will queue up multiple import jobs to be run consecutively. However there should be a flag in the wizard UI to hold off review until all documents have been run, so it is not an ordinary job queue. Analyse this requirement and break it down in the CR to specify the user stories in the sprint."
sprint_target: Sprint 5 — strong dependencies on CR-033 (CV detection), CR-039 (Introductions), CR-040 (papers/syllabi as files) all of which assume the "kind" of content a dropped file can carry; CR-041 makes multi-file workflows real.
tags: [wizard, upload, batch, drag-drop, multi-file, p0, user-stories, sprint-planning]
last_reviewed: 2026-05-24
---

# CR-041

## User stories 2-10 shipped 2026-05-24

The full multi-file batched-import surface ships:

- **US-2** — `ImportBatch` Mongoose model with submissionId / fileCount /
  holdForReview / status / completedCount / failedCount /
  reviewUnlockedAt / appliedAt. New routes:
  `POST /api/imports/batch`, `POST /api/imports/batch/:id/file`,
  `GET /api/imports/batch/:id`, `POST /api/imports/batch/:id/cancel`.
  SelfStudyImport gains optional `batchId` / `batchPosition` /
  `batchHoldForReview` back-pointers.
- **US-3** — `batchAdvancer.ts` service walks children serially via the
  same `/start-ai` codepath the single-file flow uses (new
  `startAIImportForBatch` helper). `receiveAICallback` calls
  `advanceBatch` on every terminal child to bump counts + kick off the
  next pending one. Batch transitions to `completed` /
  `partial_failure` once all children finish.
- **US-4** — `BatchProgress` component on the Parse step renders one
  row per child (filename + position + status badge) with 3 s polling
  via the new `pollBatch` store action.
- **US-5** — Hold-for-review checkbox on Upload step (default ON,
  persisted across refresh). `BatchProgress` gates the Review button:
  hold ON ⇒ wait for every child terminal; hold OFF ⇒ opens after the
  first completes.
- **US-6** — `loadBatchChildren` store action fetches each child's
  `/ai-status` and merges buckets / tags / cvs / evidenceDocs /
  introductions into the parent state. Each item is stamped with
  `sourceImportId` + `sourceFilename`. `ItemCardList` renders a
  source-file chip (📄 filename) on every card when in batch mode.
- **US-7** — Failed-row controls on `BatchProgress`: per-child Retry
  (re-runs `/restart-ai`) + Remove (new
  `POST /api/imports/batch/:id/file/:importId/remove` endpoint
  detaches the child, decrements `fileCount`).
- **US-8** — Merged Apply via
  `POST /api/imports/batch/:id/apply` — walks children + delegates to
  the existing `applyAIImport` per-child with batch-scoped
  idempotency keys; client `apply()` short-circuits to the batch
  endpoint when `batchId` is set. Per-child Mongo transactions for
  now; outer transaction wrapping all children is a future
  refactor.
- **US-9** — Mid-flight file add: existing `/batch/:id/file` endpoint
  now re-opens `completed` batches into `processing` + kicks the
  advancer; 25-file cap enforced.
- **US-10** — New `wizard_batch_review_minimal.json` fixture seeds a
  2-child batch in `completed` state. Test seed router (CR-034)
  extended to create ImportBatch + child SelfStudyImports +
  expose `batchId` on the returned Zustand state. New
  `e2e/tests/25_multifile_batch.spec.ts` asserts: GET batch returns
  2 children; BatchProgress UI lists both files; Next:Review enabled;
  merged Review shows source-file chips for both source documents.

Architecture decisions live in
`Engineering/architecture/ai-import-multi-file-store-redesign-2026-05-24.md`
— Option B (extend existing store with multi-import support) per the
"backward-compat by construction" rationale.

What's not in this slice (deferred to follow-ons):
- Edit-routing for batch mode (mutations apply to the merged view; a
  follow-on routes them back to the source child via `sourceImportId`).
- Outer Mongo transaction wrapping the whole batch Apply
  (per-child transactions only for now).
- Source-file filter dropdown on the Review screen (CR spec US-6
  acceptance #4) — still useful, not load-bearing for the workflow.

## User story 1 shipped 2026-05-24 — multi-file drop with visible queue

`client/src/store/aiImportStore.ts`:
  - `pendingFiles: File[]` field on store (not persisted via partialize
    — File objects don't survive JSON).
  - `enqueueFiles(files)` action — first file promotes into `uploadFile`
    if the slot is empty; rest queue. If `uploadFile` is already set
    (mid-run), entire batch queues without disturbing the in-flight
    upload.
  - `popNextPendingFile()` returns the head of the queue.
  - `clearPendingFiles()` resets.

`client/src/features/selfStudy/Editor/AIImport/steps/UploadStep.tsx`:
  - File input gains `multiple`; drop handler accepts N files.
  - Single-file paths still call `handleFile(file)` unchanged.
  - Multi-file paths call `enqueueFiles(Array.from(files))`.
  - New cshse-200 callout under the upload zone listing every queued
    file (name + size) and a "processed sequentially after Apply" note.

User stories 2-10 (parallel imports, batched Review merge across files,
hold-for-review flag, add-mid-flight) ride on top of this in a
follow-on — they require a Zustand redesign to support multiple
in-flight `importId`s + per-file state machines + cross-file Review
de-duplication logic. Each is its own day-plus of careful work.

 — Multi-file drag-drop with batched review

## Source quote

User, 2026-05-23:

> "Allow many files to be drag/dropped to the importer. This will allow the PC to take different sections of the document written by different people or take bulk syllabi or papers and drag them to the import wizard. This will queue up multiple import jobs to be run consecutively. However there should be a flag in the wizard UI to hold off review until all documents have been run, so it is not an ordinary job queue. Analyse this requirement and break it down in the CR to specify the user stories in the sprint."

## Problem analysis

### Today

The Upload step's dropzone accepts exactly one file. The wizard creates one `SelfStudyImport` record, runs one ai-service job, opens one Review screen. There is no concept of multiple files in flight or a combined review across files.

### Real-world coordinator workflows that break this assumption

1. **Author-divided self-study.** A program coordinator at a large institution often farms out sections of the self-study to different faculty:
   - Standards 1-5 → Department Chair
   - Standards 6-9 → Curriculum Lead
   - Standards 10-13 → Field Placement Coordinator
   - Each contributor sends a separate `.docx`. The PC assembles them by hand into one document today — error-prone, slow, version-conflict-prone.

2. **Bulk syllabi drop.** The registrar exports a folder of every course's syllabus PDF. PC needs all 30 attached as supporting evidence for various standards. Today they upload one at a time through the (legacy) per-standard importer, or skip the wizard entirely.

3. **Late-add paper appendix.** Faculty member emails a research paper after the main upload. PC wants to drop it in and have it routed to the right spec. Today: re-upload the whole self-study or wedge it into the legacy file-upload UI.

4. **CV refresh.** A faculty member's updated CV arrives mid-review. PC wants to drop it and have it replace (or join) the existing CV for that faculty member.

All four workflows reduce to the same shape: **N files dropped, processed independently, results merged for one combined review.**

### Why "not an ordinary job queue"

The user's specific direction. An ordinary queue would process files one at a time and surface each result as an independent import to review separately. That defeats the purpose: the PC wants to see the COMBINED state — "across all 12 dropped files, what's covered, what's missing, what's misplaced." Reviewing each file in isolation produces 12 separate context-switches with no holistic picture.

The "hold-for-review" flag formalizes this: default ON means the wizard waits for ALL jobs in the batch before unlocking Review. Optional OFF means each job opens its own Review tab as it completes (matches an ordinary queue — included for the rare PC who actually wants per-file review).

## Decision (summary)

Introduce a first-class `ImportBatch` concept. One batch = N files = N `SelfStudyImport` records sharing a `batchId`. The Upload step accepts a drop of N files at once and creates the batch. The Parse step shows per-file progress. The Review step is locked until all files in the batch finish parsing IF the "hold-for-review" flag is set; otherwise it opens as each file completes. The Review screen MERGES buckets across all files in the batch — one combined SpecRail, one combined item list per spec. Apply commits the merged state to the Self-Study Editor in a single transaction.

Serial processing, not parallel — ai-service today is single-tenant per import and parallelizing risks rate-limiting the Anthropic / OpenAI calls. Serial is also more predictable for failure recovery.

## Design

### Data model

**Server (`SelfStudyImport.ts`):**

Add to the existing schema:

```ts
batchId?: mongoose.Types.ObjectId;       // null = single-file import (legacy)
batchPosition?: number;                  // 1-indexed slot in the batch
batchHoldForReview?: boolean;            // mirrors the parent batch's flag
```

**New collection `ImportBatch.ts`:**

```ts
interface IImportBatch extends Document {
  submissionId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  fileCount: number;                       // expected number of imports
  holdForReview: boolean;                  // default true
  status: 'pending' | 'processing' | 'partial_failure' | 'completed' | 'canceled';
  completedCount: number;                  // ticks up as children finish
  failedCount: number;
  // The wizard reads these to gate the Review step:
  reviewUnlockedAt?: Date;                 // set when (a) holdForReview && all done, OR (b) !holdForReview && first done
  appliedAt?: Date;
}
```

### Wire-up summary

- `POST /api/imports/batch` — create a batch, return `batchId`.
- `POST /api/imports/batch/:batchId/file` — upload one file into the batch, returns the `SelfStudyImport` id.
- `POST /api/imports/batch/:batchId/start` — kick off serial processing.
- `GET /api/imports/batch/:batchId` — current batch state + child import states (SSE-friendly).
- `POST /api/imports/batch/:batchId/cancel` — abort all pending children.
- `POST /api/imports/batch/:batchId/apply` — Apply all children's approved items in one transaction.
- Existing `/api/imports/:importId/*` routes still work — the wizard uses them to read per-child detail.

### Serial processing semantics

The ai-service queue runs imports one at a time per batch. While doc 1 is in `parse`, docs 2-N are in `queued`. As soon as doc 1 finishes (or fails), doc 2 starts. ai-service callbacks update the batch's `completedCount` / `failedCount`. When `completedCount + failedCount === fileCount`, the batch transitions to `completed` (or `partial_failure` if any failed).

Failure semantics: a per-file failure does NOT block the rest. The batch completes with whatever succeeded. The Review screen shows what landed + a clearly-marked panel listing which files failed and why, with per-file retry.

### Merged Review semantics

When the wizard opens the Review step for a batch, the client requests the buckets for every completed child and merges them client-side:

```ts
// Merge rule per (standardCode, specCode):
mergedBucket.narratives    = concat(child.bucket.narratives    for all children)
mergedBucket.evidenceText  = concat(child.bucket.evidenceText  for all children)
mergedBucket.evidenceFiles = concat(child.bucket.evidenceFiles for all children)
// Same for tags / introductions / cvs / evidenceDocs / matrixCells.
// Each item retains its sourceImportId for "which file did this come from?" attribution.
```

The merged bucket count = sum of child counts. Each card on the Review screen shows a small chip indicating its source file (`📄 from Standards-1-5-DepartmentChair.docx`) so the PC can see provenance at a glance.

Conflict handling: if two children both placed content under spec 1.a, both items appear. PC chooses (Approve both, Discard one, Edit-and-merge via the existing CR-032 textarea, etc.). No automatic dedup — the AI can't decide what the PC wants.

### Apply semantics

Apply commits merged state across all children atomically:

- For each (spec, kind), append every approved item from every child.
- For each kind that's a top-level field (Introductions, CVs, evidenceDocs), write all approved items.
- Single Mongo transaction (uses the existing `MONGO_SUPPORTS_TRANSACTIONS` config from the critical-error review).
- Mark every child's `aiAppliedAt` + `aiAppliedCounts` at once.

After Apply: re-entering the wizard starts a fresh batch (clean Upload screen).

### Hold-for-review flag — exact UI behavior

On the Upload step, below the dropzone:

```
☑ Hold review until all files have processed (recommended)
   Default ON. If unchecked, the Review screen unlocks as the first
   file finishes; subsequent files merge in as they complete.
```

When ON:
- Parse step shows per-file progress + a global "X of N files complete" counter.
- "Next: Review" button is disabled until `completedCount + failedCount === fileCount`.
- A "Skip waiting and review what's done so far" link appears if the batch has been processing for >2 min — escape hatch for failure cases.

When OFF:
- Same per-file progress UI on Parse.
- "Next: Review" button is enabled as soon as the first file completes.
- New items from later-completing files merge into the Review screen live (toast: "+ 23 items from doc 2 of 5").

### Add-mid-flight

Per workflow scenario 3 above ("Late-add paper after main upload"), the PC needs to be able to add files to an EXISTING batch. The Upload step gains a "+ Add more files" button when a batch is already in flight (visible on Parse + Review steps too). New files join the batch's queue. If the PC adds a file while reviewing, the merge logic incorporates it as it completes.

## User stories (sprint-planning ready)

Each story is independently demoable, has explicit acceptance criteria, and an estimate. Stories are ordered: any prior story must land first for the next one to make sense.

---

### US-1 — Multi-file dropzone accepts N files at once

**As** a program coordinator
**I want** to drag multiple .docx files onto the Upload step at once
**So that** I can start an import session covering all the material from my different contributors without uploading one file at a time.

**Acceptance criteria:**

1. The dropzone accepts a drop of 2+ files (drag-drop) or a multi-select from the OS file picker.
2. Each dropped file appears as a row below the dropzone with its filename, size, and a Remove (X) button.
3. The PC can add more files (drop again) or remove individual files before starting.
4. PDF / unsupported file types are clearly flagged inline with an error icon; they don't block other valid files.
5. A 100 MB total cap protects the upload — exceeding it disables Start and shows a clear message.
6. The Start button is disabled until at least one valid file is present.

**Estimate:** 1 day. (Client only — server gets an unchanged single-file upload per file under the hood.)

---

### US-2 — Server-side ImportBatch record + per-file SelfStudyImport children

**As** the server
**I want** to model a batch as one parent record plus N child SelfStudyImport records
**So that** the wizard can query per-batch progress + the merged-review feature has a unit of work to gate on.

**Acceptance criteria:**

1. New Mongoose model `ImportBatch` with the fields above + indexes on `submissionId` and `createdBy`.
2. New endpoint `POST /api/imports/batch` creates a batch + returns its id.
3. New endpoint `POST /api/imports/batch/:batchId/file` accepts a single file (multipart), creates a child `SelfStudyImport` stamped with `batchId` + `batchPosition`, returns the import id.
4. Existing `SelfStudyImport` queries still work for child records (no breaking change for the legacy single-file path — `batchId` is optional).
5. Server enforces: only the batch creator can add files to or query the batch (auth-scoped, same as today's import scoping).
6. Integration test in `server/tests/integration/import-batch.test.ts` covering: create batch → add 3 files → query batch → assert 3 children.

**Estimate:** 1 day.

---

### US-3 — Serial processing engine: kick off the queue

**As** the system
**I want** to process a batch's child files through ai-service one at a time
**So that** Anthropic / OpenAI rate limits don't get hit and per-file failures don't cascade.

**Acceptance criteria:**

1. New endpoint `POST /api/imports/batch/:batchId/start` validates the batch is in `pending`, marks it `processing`, then immediately starts the first child via the existing `/api/imports/:importId/start-ai` code path.
2. On the cshse-server, a `batchAdvancer` service watches for child completions (via the existing matcher webhook). When a child enters `completed` or `failed`, the advancer starts the next `pending` child in the batch.
3. ai-service is unchanged — sees one job at a time as before.
4. The batch's `completedCount` / `failedCount` updates after each child callback.
5. When `completedCount + failedCount === fileCount`, batch transitions to `completed` (or `partial_failure`).
6. SSE event stream on `/api/imports/batch/:batchId/events` emits per-child status changes + batch terminal events.

**Estimate:** 1.5 days. (Includes hardening for CR-036 handshake retries — initial-job start failures on a child are retried before marking the child failed.)

---

### US-4 — Per-file progress UI on the Parse step

**As** a program coordinator
**I want** to see real-time progress for every file in my batch
**So that** I know which file is processing, which are waiting, and which have failed.

**Acceptance criteria:**

1. Parse step renders one row per child file. Each row shows:
   - Filename
   - Position (1 of 5)
   - State (queued / processing / completed / failed)
   - For the active processing row: the existing 5-stage progress bar (Document Reader → ... → Indexing) with friendly stage labels.
2. A global "X of N files complete" counter sits above the per-file rows.
3. Failed rows show the per-file failure reason in red + a "Retry" button that re-queues that single child.
4. Completed rows show a quick stat: "32 narratives · 4 evidence files · 2 matrices."
5. SSE-driven; falls back to 3 s polling if SSE drops (same pattern as today's single-file Parse step).
6. Hard refresh during parse returns to the same Parse view with no progress lost.

**Estimate:** 1.5 days.

---

### US-5 — Hold-for-review flag + Review-step gating

**As** a program coordinator
**I want** to set a "Hold review until all files have processed" flag at upload time
**So that** I'm not pushed into Review before the full batch context is available.

**Acceptance criteria:**

1. Upload step has a checkbox (default ON) labeled "Hold review until all files have processed (recommended)."
2. Tooltip explains the default: "If unchecked, the Review step opens as the first file completes and later files merge in live."
3. Flag is persisted on the batch (`holdForReview`).
4. When ON: "Next: Review" button on the Parse step is disabled until `completedCount + failedCount === fileCount`.
5. When ON: if 2 min elapse with the batch still processing, an inline link appears: "Skip waiting and review what's done so far →" — clicking it overrides the gate.
6. When OFF: "Next: Review" enables as soon as the first child completes. Subsequent completions emit a toast "+ N items from <filename>" and refresh the Review screen state.
7. Hard refresh preserves the flag's state + the gate state.

**Estimate:** 1 day.

---

### US-6 — Merged Review screen across batch children

**As** a program coordinator
**I want** the Review screen to show items from every file in the batch in one combined view
**So that** I can review my self-study as a whole, not as N disconnected slices.

**Acceptance criteria:**

1. The wizard's Review step queries all child `aiBuckets` (via the existing `/api/imports/:importId/buckets` endpoint per child) and merges them client-side.
2. Merged bucket counts in the SpecRail = sum of child counts.
3. Each card shows a small source-file chip (e.g. `📄 Standards-1-5-DepartmentChair.docx`) so the PC can see provenance.
4. Filter bar on the Review screen gains a "Filter by source file" dropdown — pick a file to scope the SpecRail counts and visible cards to that file only.
5. Conflict handling: two items routed to the same spec by different files both appear. PC can Approve both, Discard one, or Edit-merge per existing controls.
6. All existing per-card controls (Edit, Discard, Approve, Reassign, + Add from source, Show in source) work unchanged on merged items.
7. Unplaced bucket also merges; CR-031 neighbor context preserves per-file scope (a card from doc 2 finds its neighbor in doc 2, not doc 1).

**Estimate:** 2 days. (Most complex story — three places merge logic has to land: SpecRail counts, ItemCardList rendering, Show-in-source which file does this content live in.)

---

### US-7 — Per-file failure recovery on the Parse step

**As** a program coordinator
**I want** clear failure visibility and a one-click retry per failing file
**So that** one bad upload doesn't force me to restart the entire batch.

**Acceptance criteria:**

1. A failed child shows: filename, failure stage, failure reason text, Retry button, Remove-from-batch button.
2. Retry re-queues that child only — other children's state is untouched.
3. Remove-from-batch detaches the child (sets `batchId = null` and marks it canceled), decrements `fileCount`, allows the batch to complete based on the remaining children.
4. Batch transitions to `partial_failure` (not `failed`) when at least one succeeds and at least one fails.
5. The Review step is reachable in `partial_failure` state — coordinator sees what landed + a clearly-marked "1 of 5 files failed: <filename> — Retry / Remove" banner.

**Estimate:** 1 day.

---

### US-8 — Apply step commits merged state across all children

**As** a program coordinator
**I want** clicking Apply to commit everything I've approved across all files in one operation
**So that** I don't have to apply file-by-file and risk inconsistent state.

**Acceptance criteria:**

1. Apply button is disabled until every item in every child bucket is either approved or discarded.
2. Clicking Apply opens the diff modal showing merged totals: "47 narratives · 12 evidence files · 4 CVs · 2 introductions · 1 curriculum matrix updated · 30 syllabi attached" — totals are sums across children.
3. Confirm sends one `POST /api/imports/batch/:batchId/apply` request that wraps all per-child writes in a single Mongo session (transaction if available).
4. Idempotent: re-Apply with the same merged-payload hash returns the cached result (same pattern as today's per-import `aiLastIdempotencyKey`).
5. On success, every child's `aiAppliedAt` + `aiAppliedCounts` is stamped; batch's `appliedAt` is stamped; wizard navigates to a "Done — open the Self-Study Editor" success screen.
6. On failure, no partial writes — transaction rolls back, error surface explains which child / spec failed, user retries.

**Estimate:** 1.5 days.

---

### US-9 — Add files to an in-flight batch

**As** a program coordinator
**I want** to drop additional files into a batch that's already processing or in Review
**So that** late-arriving material (faculty CV update, missing syllabus) doesn't force a full restart.

**Acceptance criteria:**

1. Upload step has a persistent "+ Add more files" button when a batch is in progress or Review-state.
2. New files create new child `SelfStudyImport` records on the batch, status `queued`.
3. If the batch is `processing`, the new files enter the queue at the end.
4. If the batch is `completed`, adding files re-opens it to `processing` for the new children.
5. If `holdForReview` is ON, the Review step re-gates until the new children complete.
6. Hard cap of 25 files per batch — exceeding it disables "+ Add more files" with a clear message.

**Estimate:** 1 day.

---

### US-10 — E2E coverage for multi-file batches

**As** the engineering team
**I want** Playwright coverage of the multi-file path
**So that** the batch logic doesn't regress when CR-033 / CR-039 / CR-040 land.

**Acceptance criteria:**

1. New spec `25_multifile_batch.spec.ts` in the e2e suite. Depends on CR-034 seed endpoint extensions (a `wizard_batch_review_minimal` fixture with 2 child imports).
2. Tests:
   - Drop 3 files → batch created → all 3 process → merged Review shows summed counts.
   - Hold-for-review ON: Review gated until all 3 done.
   - Hold-for-review OFF: Review opens after the first file, late items merge in.
   - Force one file to fail: batch transitions to partial_failure, Review reachable, banner present.
   - Apply commits merged state across children; counts match.
3. Spec lands behind a feature flag if CR-041 is shipped in phases.

**Estimate:** 1 day.

---

## Story totals + sprint plan

| Story | Estimate |
|---|---:|
| US-1 — Multi-file dropzone | 1 d |
| US-2 — ImportBatch model + endpoints | 1 d |
| US-3 — Serial processing engine | 1.5 d |
| US-4 — Per-file progress UI | 1.5 d |
| US-5 — Hold-for-review gating | 1 d |
| US-6 — Merged Review screen | 2 d |
| US-7 — Per-file failure recovery | 1 d |
| US-8 — Apply commits merged state | 1.5 d |
| US-9 — Add files mid-flight | 1 d |
| US-10 — E2E coverage | 1 d |
| **Total** | **12.5 days** |

Two-week sprint (10 working days) is tight but feasible if we drop US-9 (add mid-flight) to the next sprint — it's the only story that isn't strictly required for the user's stated workflows. US-1 through US-8 + US-10 = 11.5 days, achievable with one engineer; two engineers in parallel (one client, one server) lands the whole thing in a sprint.

## Cross-CR dependencies

- **CR-033 (CVs):** US-6's merge logic must handle the `cv` kind correctly across children.
- **CR-039 (Introductions):** US-6's merge logic must merge introductions per-standard across children. Two files both contributing intro text for Standard 1 → both items in that Introduction bucket.
- **CR-040 (papers + syllabi):** US-6 must merge `evidenceDoc` items across children. Two syllabi for the same course code don't auto-dedup — PC chooses.
- **CR-034 (seed endpoint):** US-10 needs a multi-import seed fixture.
- **CR-036 (handshake retries):** US-3 needs CR-036 to protect against transient ai-service unavailability when starting each child in serial.
- **CR-037 (empty-buckets guard):** US-3 should treat an empty-bucket child as `failed`, not silently complete; the batch shouldn't merge zero items as if they were real.
- ~~**CR-038 (Railway deploy filter):**~~ **RETIRED 2026-05-23.** The runtime resilience from CR-036 covers any redeploy-window blip during a multi-file batch in production.

## Out of scope

- **Parallel processing within a batch.** Serial only for v1. Parallel adds rate-limiting risk + complicates per-file failure isolation.
- **Cross-batch deduplication.** If a PC runs a second batch later that re-uploads some of the same content, no auto-dedup — they get duplicates and choose.
- **OCR for image-only PDFs.** Out of scope (separate problem, separate CR if needed).
- **Folder upload.** Dropzone accepts files only, not folders. Most browsers don't support folder drag-drop consistently. Multi-file selection is good enough.
- **Per-author attribution beyond filename.** The source-file chip shows the filename. We don't ask "who wrote this section" — filename convention is the lightweight way.
- **Auto-detection of redundant content** ("you already imported a version of this CV last week"). Out of scope.

## Risk

- **Merge UI complexity.** US-6 is the biggest story for a reason — three places have to merge correctly + handle conflicts. Mitigation: ship CR-041 with manual conflict resolution only; do not attempt auto-merge.
- **Long-running batches.** 10 files × 90 s each = 15 min wall-clock. SSE connections can drop in that window. Polling fallback already exists; CR-041 inherits it.
- **Idempotency of Apply.** A batch Apply that partially succeeds could leave the Self-Study in a broken state. Mitigation: Mongo transaction wraps the whole Apply (US-8 acceptance #3). Refuse to ship Apply without transactions in production.
- **PC cognitive overload at the Review screen.** Merging 200+ items across 10 files into one SpecRail could be overwhelming. Mitigation: source-file filter dropdown (US-6 acceptance #4) lets the PC focus on one file at a time. CR-031 neighbor context + filter spec already help.
- **Failure of the batchAdvancer service.** If the advancer dies mid-batch, children stop advancing. Mitigation: idempotent retry on next callback; a periodic janitor scans for batches stuck in `processing` for >30 min and restarts the queue.

## Telemetry

- `batch_file_count` distribution — are PCs typically dropping 2 files, 10, 30?
- `batch_hold_for_review_rate` — how often is the default flag changed?
- `batch_completion_time_p50_p95` per file count.
- `batch_partial_failure_rate`.
- `batch_add_midflight_count` — how often is US-9 actually used?

## Related

- [[cr-033-cv-supporting-evidence]] — merged Review must handle the `cv` kind across files.
- [[cr-039-standard-introduction-buckets]] — same for `introduction`.
- [[cr-040-appendix-papers-as-supporting-evidence-files]] — same for `evidenceDoc` (papers + syllabi).
- [[cr-034-e2e-seed-endpoint]] — US-10 needs a multi-import fixture.
- [[cr-036-ai-service-handshake-retries]] — protects serial batch processing from transient outages.
- [[cr-037-empty-buckets-guard]] — empty-bucket child = failed child, not silently merged.
- [[../critical-error-processing-review-2026-05-22]] — multi-file processing surfaces every error path twice as often; the bulletproofing matters more here than for single-file imports.
- [[../ai-import-wizard-e2e-coverage-review-2026-05-22]] — add `25_multifile_batch.spec.ts` to Tier 1.
