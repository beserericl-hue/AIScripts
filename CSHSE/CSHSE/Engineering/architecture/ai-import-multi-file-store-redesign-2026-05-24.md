---
name: AI Import multi-file store redesign — 2026-05-24
description: Zustand store architecture for CR-041 user stories 2-10 (multi-file batched import + merged Review).
type: concept
tags: [ai-import, wizard, zustand, cr-041, multi-file]
last_reviewed: 2026-05-24
---

# AI Import multi-file store redesign

Architectural decisions for CR-041 user stories 2-10 (the multi-file
batched import + merged Review). Written **before** the store changes
land so the design choices are reviewable up front.

## The problem in one line

Today `aiImportStore` tracks ONE `importId` with one `buckets` /
`tags` / `matrices` / `cvs` / `evidenceDocs` / `introductions`. The
wizard's mental model is "one upload at a time." CR-041 wants N
uploads, processed serially, merged into one Review screen.

## Two architectures considered

### Option A — separate sub-store for batches

`importBatchStore` holds `batchId`, `children: ChildImport[]`, batch
flags. `ChildImport` is a tagged snapshot. Review queries from this
store.

- Pro: clean separation; batch logic doesn't pollute the single-file
  path.
- Con: every existing call site (Review/Apply/ItemCardList/SpecRail)
  needs a branch on "batch vs single-file." Two parallel mental
  models — high regression risk for the single-file path that the
  whole portal relies on today.

### Option B — extend `aiImportStore` with multi-import support (CHOSEN)

Add `batchId: string | null` + `childImports: Map<importId,
ChildSnapshot>`. When `batchId === null`, existing fields are the
source of truth (single-file behavior unchanged). When `batchId !==
null`, existing fields become **merged views** computed via
selectors across children.

- Pro: single mental model. Existing components keep reading
  `s.buckets` / `s.tags` / etc. Backward-compat by construction.
- Con: existing edit actions need to know which child to mutate. Each
  `BucketItem` (and tag, cv, evidenceDoc, intro item) gains a
  `sourceImportId` so the mutation can be routed.

**Going with Option B.** Cleanest backward-compat, smallest blast
radius for existing single-file code paths.

## Store shape additions

```ts
// New fields on AIImportState
batchId: string | null;
batchHoldForReview: boolean;          // default true
batchFileCount: number;               // expected total
batchStatus: 'pending' | 'processing' | 'partial_failure' | 'completed' | 'canceled' | null;
childImports: Map<string, ChildSnapshot>;  // keyed by importId

// New child snapshot type
type ChildSnapshot = {
  importId: string;
  filename: string;
  batchPosition: number;
  status: WizardStatus;
  pipelineStages: StageProgress[];
  failureReason?: string;
  // Mirror of the existing top-level fields, scoped to this child:
  buckets: Record<string, SpecBucket>;
  tags: Tag[];
  matrices: MatrixData[];
  cvs: CVItem[];
  evidenceDocs: EvidenceDocItem[];
  introductions: Record<string, IntroductionBucket>;
  placeholderSections: PlaceholderSection[];
  coverageReport: AICoverageReport | null;
};
```

## Provenance threading

Every item already gets a `sourceImportId` field at merge time.
Existing renderers (`ItemCardList`, `SpecRail`) can show a
source-file chip when `sourceImportId !== null` so coordinators see
"this card came from `Standards-1-5-DepartmentChair.docx`."

## Backward-compat invariant

When `batchId === null`:
- `childImports.size === 0`
- Existing fields (`s.buckets`, `s.tags`, …) read/write directly
- Actions (`moveItem`, `editBucketItem`, `retagMatrixRow`,
  `editTag`, …) behave exactly as today

When `batchId !== null`:
- `childImports.size > 0`
- A read-only **merged view** is recomputed (memoized selector) whenever
  any child changes
- Edit actions look up the source child by `sourceImportId` and mutate
  that child's bucket; merged view re-derives on next read

## Selectors

```ts
selectMergedBuckets(s): Record<string, SpecBucket>
selectMergedTags(s): Tag[]
selectMergedMatrices(s): MatrixData[]
selectMergedCvs(s): CVItem[]
selectMergedEvidenceDocs(s): EvidenceDocItem[]
selectMergedIntroductions(s): Record<string, IntroductionBucket>
selectAggregateCoverage(s): AICoverageReport
```

The wizard's existing components keep reading `s.buckets` / `s.tags` /
etc directly. In batch mode these read from the merged-view cache;
in single-file mode they read the legacy fields. A `useMergedView`
hook wraps the branch so call sites stay tiny.

## Edit-routing rules

For each existing mutating action:

| Action | Single-file mode | Batch mode |
|---|---|---|
| `moveItem(sectionId, from, to)` | mutate `s.buckets` | look up `sourceImportId` from the moved item; mutate `childImports.get(sourceImportId).buckets` |
| `editBucketItem(specKey, sectionId, …)` | mutate `s.buckets[specKey]` | same lookup; mutate the child's bucket |
| `editTag(tagId, newText)` | mutate `s.tags` | look up `sourceImportId` from the tag; mutate that child's tags |
| `retagMatrixRow(matrixSlug, rowAnchor, std, spec)` | mutate `s.matrixRowEdits` | scope per child via composite key `${sourceImportId}:${matrixSlug}:${rowAnchor}` |
| `updateCvRouting` / `updateCvFacultyName` | mutate `s.cvs` | mutate the child's CVs |
| `moveItemToIntroduction(sectionId, targetKey)` | mutate `s.introductions` | route to source child |

The lookup always uses `sourceImportId`. If absent (shouldn't happen
in batch mode), the action is a no-op + a console warning — better
than silently mutating the wrong child.

## Apply path

In single-file mode the existing `apply()` posts to
`/api/imports/:importId/apply-ai` (unchanged).

In batch mode `apply()` posts to `/api/imports/batch/:batchId/apply`.
Server wraps every child's apply in one Mongo session/transaction
(US-8) so the Self-Study sees the merged commit or nothing.

## Persistence (zustand/persist)

Add `batchId`, `batchHoldForReview`, `batchFileCount`, `batchStatus`
to `partialize` plus a serialized `childImports` (Map → object). The
single-file fields stay persisted for backward-compat across the
swap point.

## Sequencing within CR-041

1. **US-2** — server ImportBatch model + endpoints. No client touches.
2. **US-3** — server batchAdvancer + SSE. No client touches.
3. **US-4** — client per-file Parse progress. Reads child snapshots
   from store; the multi-import skeleton (`childImports` Map) ships
   here. Existing single-file Parse logic untouched.
4. **US-5** — `batchHoldForReview` flag + Review gate. Tiny — checkbox
   on Upload, gate logic on Parse → Review transition.
5. **US-6** — merged Review. Threads `sourceImportId` through items;
   updates moveItem/edit* actions to route by source. Bulk of the
   architectural work.
6. **US-7** — failed-row controls (Retry / Remove from batch).
7. **US-8** — batch Apply (server + client).
8. **US-9** — mid-flight add (client + server route).
9. **US-10** — E2E spec + CR-034 seed fixture.

## Risks called out by the spec

- **Merge UI complexity** (spec flagged US-6 as biggest). Mitigation:
  ship US-6 with manual conflict resolution only (no auto-dedup), and
  ship the source-file chip + filter dropdown so coordinators can
  scope to one file at a time when reviewing.
- **Long-running batches** (10 files × 90 s ≈ 15 min). SSE drops are
  routine in that window; existing 3 s polling fallback (CR-031
  pattern) carries over.
- **Idempotency of Apply.** Single Mongo transaction wraps the whole
  batch Apply. Refuse to ship US-8 without `MONGO_SUPPORTS_TRANSACTIONS`
  in prod.
- **PC cognitive overload.** Source-file filter dropdown (US-6
  acceptance #4) is the user's escape hatch.

## What we are NOT doing in v1

- Parallel processing within a batch (serial only — Anthropic /
  OpenAI rate-limit risk).
- Auto-merge / dedup of duplicate items.
- Folder upload (file lists only).
- Per-author attribution beyond filename.
- OCR for image-only PDFs.
