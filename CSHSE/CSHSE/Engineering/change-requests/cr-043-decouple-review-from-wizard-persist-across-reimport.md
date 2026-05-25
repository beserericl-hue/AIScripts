---
name: CR-043 — Decouple Review from the AI Import Wizard; Review persists across re-runs; reimport merges in place
description: Today the Review screen is hostage to the wizard's lifecycle — clicking "Import" a second time wipes the prior Review state. PCs importing partial documents from multiple authors lose work this way. Decouple Review (and Matrix) from the wizard, persist their state on the Self-Study, expose them as first-class toolbar buttons, and change the "reimport" checkbox semantics from "blow away prior data" to "merge in place; replace only when the EXACT same source artifact is being re-imported." Major UX + state-model change.
type: change-request
cr_id: CR-043
status: proposed
priority: P0
source: User direction 2026-05-25 — Stevenson PC workflow. Annotated screenshot showing "Review Button formerly from wizard" + "Matrix button formerly from wizard" as new toolbar entries on the Self-Study Editor.
sprint_target: Sprint 5 — coordinator-blocking for multi-author imports; ships alongside or after the CR-041 multi-file batched-import work, which today still resets between import sessions.
tags: [wizard, review, matrix, reimport, state, self-study-editor, p0, ux]
last_reviewed: 2026-05-25
---

# CR-043 — Decouple Review from the Wizard; Review persists; reimport merges in place

## Source quote

User, 2026-05-25 (after a Stevenson-style workflow walk-through):

> "The PC did an import and achieved success and the review screen showed a number of standards showing in the review screen with tiles. He has another document. He clicks on import again. But he wants to see the review screen one more time to check something. The review screen is now locked and cannot be displayed because the import wizard has reset its state. The import runs again, clicking on 'This is a reimport of an existing self study.' When he gets to the review screen, everything he had imported before and wants to keep is no longer there. This is a major issue for PCs who are importing a number of files written by different people."
>
> "Separate the Review from the Wizard. Once the parser stops, the review screen (button moved in UI) is displayed. Clicking back to the importer does not clear this screen, and this screen's data can be displayed by the logged-in PC."
>
> "The AI Importer button is shown first. Then the Review button from the importer (locked until there is data in the screen, then never unlocked until all data is approved). The matrix button from the importer is next to the review button and locked until there is something there."
>
> "The Self-Study editor has data either edited, imported from the legacy importer, or approved and moved from the review window."
>
> "If the check box to reimport is checked, only those standards, CVs, syllabi, papers that are in the import replace what is currently there IF AND ONLY IF THE EXACT DOCUMENT IS BEING REPLACED. We do not want duplicate files of the same paper, cv, etc."

## What's broken today

Three failure modes compound:

### Failure 1 — Review is hostage to the wizard's lifecycle

`ReviewStep` is rendered INSIDE `WizardShell`. The wizard's state is one Zustand store (`aiImportStore`) and one in-flight `SelfStudyImport` record. When the PC clicks the Importer Wizard button a second time, `startUpload` resets `buckets`, `tags`, `matrices`, `cvs`, `evidenceDocs`, `introductions`, `placeholderSections` to empty (see `aiImportStore.startUpload`). The prior Review state — even if the PC never clicked Apply — is gone.

Concretely, the regression sequence is:
1. PC uploads `standards-1-5.docx`. Wizard advances through Parse → Review.
2. PC reviews ~5 narratives, approves 3, leaves 2 mid-edit (e.g. fixing a typo in spec 3.b).
3. PC closes the wizard panel to look at the Standards editor.
4. PC returns to Self-Study editor a few minutes later; wants to drop a second file (`standards-6-9.docx`). Clicks Importer Wizard.
5. Wizard re-opens on the Upload step. There IS no path to view the prior Review state — the only way back is to click "Importer Wizard" which lands on Upload, which is fine, but the wizard's STEP RAIL shows Review as a forward-only step that's only reachable through Parse.
6. PC drops the second file. `startUpload` wipes the buckets. The 3 approved + 2 mid-edit items from import #1 are gone.

### Failure 2 — The "Reimport" checkbox is destructive

`aiIsReimport` today is a UI hint that ships through to ai-service's matcher. It does NOT control how the merge with prior Review state happens — because there IS no prior Review state to merge with (it was wiped in step 5 above). So reimport-vs-fresh is mostly a labelling distinction and doesn't help here.

If we fix Failure 1 and Review state persists, "reimport" needs a clear contract. The user's specification is:

> "Only those standards, CVs, syllabi, papers that are in the import replace what is currently there IF AND ONLY IF THE EXACT DOCUMENT IS BEING REPLACED. We do not want duplicate files of the same paper, cv, etc."

So reimport ≠ wipe-and-replace. It's "merge: for each kind, replace items that came from the same source artifact (matched by content hash or filename); otherwise leave the existing items alone."

### Failure 3 — Matrix is similarly trapped inside the wizard

The Curriculum Matrix step also lives inside the wizard. Same problem: once the wizard resets, the prior matrix-row edits (CR-026 / CR-029 / CR-035) are gone. The user's screenshot calls this out explicitly: the Matrix button needs to move out of the wizard, alongside Review.

## Decision (summary)

Promote Review and Matrix to first-class surfaces on the Self-Study Editor toolbar, persist their state on `SelfStudyImport` (not just in-memory Zustand), and rewrite the "reimport" semantics from destructive replacement to merge-in-place with same-source dedupe.

The Wizard becomes a thin uploader + parser + handoff: drop a file, watch it parse, hand the result to Review. Coordinator workflow inside Review (Edit / Discard / Approve / Reassign / etc.) is owned by the Review surface, not the Wizard.

## Design

### Self-Study Editor toolbar (new order)

```
[ Standards ]  [ Curriculum Matrix ]  [ Supporting File Library ]
[ Import Document (Legacy) ]
[ Importer Wizard (AI) ]         ← unchanged from today
[ Review ]                       ← NEW; locked until parser produces data
[ Matrix ]                       ← NEW; locked until matrix data exists
```

- **Importer Wizard button** — opens the upload + parse flow only. No Review tab inside the wizard. The wizard's Stepper collapses to Upload → Parse (+ Apply gate when CR-005 lockout applies); Review + Matrix moved out.
- **Review button** — visible on the Self-Study Editor toolbar at all times; **disabled** when the persisted `Submission.aiReviewState` is empty AND no prior import has parsed content. **Enabled** as soon as the first parser-produced data lands. Stays enabled until every item is approved or discarded (then the data is gone from Review — it lives in the Self-Study Editor's Standards / Supporting File Library / Matrix views as approved content).
- **Matrix button** — visible on the toolbar; **disabled** when no matrix data exists in either the in-progress Review state OR the persisted CurriculumMatrix documents. **Enabled** once matrix rows exist anywhere.

The "ready to review" pill currently rendered on the Importer Wizard button moves to the Review button.

### State model — what lives where

| State | Where it lives today | Where it should live |
|---|---|---|
| Wizard step (Upload / Parse) | `aiImportStore` (in-memory + localStorage) | Unchanged. Wizard is ephemeral. |
| Per-import buckets / tags / cvs / evidenceDocs / introductions | `aiImportStore` (in-memory + localStorage) | Promote to `Submission.aiReviewState` (server-persisted). Zustand becomes a read-through cache hydrated from server. |
| Per-import matrix data | `aiImportStore.matrices` (in-memory) + applied `CurriculumMatrix` documents | Promote to `Submission.aiMatrixState` (in-flight, pre-Apply) — separate from the post-Apply `CurriculumMatrix` documents that already exist. |
| Approved / discarded item state | `aiImportStore.approvedIds` (in-memory + localStorage) | Promote to `Submission.aiReviewState.approvedIds`. Persisted. |
| Source-file provenance (CR-041) | Item.sourceImportId / sourceFilename | Unchanged but ride with the persisted state. |

The wizard's localStorage cache becomes a stale-read optimization — server state wins on any conflict.

### Schema additions (`Submission.ts`)

```ts
// CR-043 — persisted in-flight Review state. Independent of the wizard's
// localStorage cache; survives wizard close, re-open, page reload, and
// multi-author multi-file imports. Cleared per item as the PC approves
// + applies, OR cleared entirely on explicit "discard all and start
// fresh" from the Review surface.
aiReviewState?: {
  buckets: Record<string, IAIBucket>;        // mirror of aiImportStore.buckets
  tags: IAITag[];
  cvs: IAICVItem[];
  evidenceDocs: IAIEvidenceDocItem[];
  introductions: Record<string, IAIIntroductionBucket>;
  placeholderSections: IAIPlaceholderSection[];
  approvedIds: string[];                     // per-item approval marks
  discardedIds: string[];                    // explicit discards
  // Provenance: which SelfStudyImport(s) contributed which items, so
  // reimport-replace can locate matching source artifacts.
  itemSources: Record<string, {              // keyed by item.sectionId
    importId: string;
    sourceFilename: string;
    sourceContentHash: string;
    importedAt: Date;
  }>;
  lastUpdatedAt: Date;
};

aiMatrixState?: {
  matrices: any[];                           // mirror of aiImportStore.matrices
  matrixRowEdits: Record<string, any>;       // CR-026 row controls
  lastUpdatedAt: Date;
};
```

Both fields are optional. Empty/missing state ⇒ Review + Matrix buttons disabled.

### Lock / unlock rules

```
Review button:
  disabled ⇔  (aiReviewState is null OR
               (aiReviewState.buckets / tags / cvs / evidenceDocs / introductions
                all empty AND approvedIds + discardedIds together cover everything))

  Re-enables the moment a parser-produced snapshot writes to aiReviewState.
  "Never re-locked until all data approved" — even if PC navigates away,
  closes browser, returns next week. Persists.

Matrix button:
  disabled ⇔  aiMatrixState is null OR aiMatrixState.matrices is empty

  Same persistence.
```

### Wizard handoff to Review

When the ai-service parser hits terminal status (`parsed`):

1. `receiveAICallback` writes the import's per-source content (`aiBuckets`, `aiTags`, `aiCVs`, `aiEvidenceDocs`, `aiIntroductionHints`, etc.) — unchanged from today.
2. **NEW:** `receiveAICallback` ALSO merges this import's items into `Submission.aiReviewState` using the merge rules below. The Review surface reads from `Submission.aiReviewState`.
3. The wizard navigates from Parse to a brief "Parse complete — open Review" page (one button: "Open Review"); not a full Review screen inside the wizard. Click → close wizard, switch to Review surface.

The wizard's old Review step is removed.

### Merge rules — fresh import vs reimport

When `receiveAICallback` integrates a new import's content into `Submission.aiReviewState`:

**Fresh import (default — checkbox off):**
- For each kind (narratives, evidenceText, evidenceFiles, tags, cvs, evidenceDocs, introductions), ADD this import's items to the existing collection, stamped with `itemSources[sectionId] = {importId, sourceFilename, sourceContentHash, importedAt}`.
- No deduplication.
- Pre-existing approved / discarded ids carry through unchanged.

**Reimport (checkbox on — "This is a reimport of an existing self-study"):**
Per-kind merge rules:

| Kind | Match key | Replace behavior |
|---|---|---|
| Narratives / evidenceText | (standardCode, specCode, sourceFilename) | Replace prior items that share the SAME filename + spec. Items from different source files at the same spec are left alone. |
| Evidence files | sourceContentHash | Replace items whose content hash matches a file in the new import. New files added; old non-overlapping files kept. |
| CVs | (facultyName, sourceContentHash) | If same faculty + same source hash → replace. If same faculty but different hash → keep both, PC chooses which to discard. |
| Evidence docs (papers/syllabi) | (title, sourceContentHash) | Same as CVs — strict-match replace, drift adds a second entry. |
| Introductions | (introBucketKey, sourceFilename) | Replace items from the same source for the same intro bucket. |
| Matrix data | matrixId | Whole-matrix replace when matrixId matches. |

**"EXACT DOCUMENT being replaced"** is operationalized as a SHA-256 content hash AND matching source filename. If either differs, treat as a fresh add (no replace). This is the user's "we do not want duplicate files of the same paper, cv, etc." with the strict-match invariant.

**Approved-item handling on reimport:**
If an item is in `approvedIds` AND its source is being replaced, the replacement does NOT inherit the approved mark — the PC must re-approve the new version. This is intentional: the new version might differ subtly (the whole point of reimport) and silent re-approval would mask changes.

### Self-Study Editor data model

The user's spec:

> "The Self-Study editor has data either edited, imported from the legacy importer, or approved and moved from the review window."

Today the Self-Study Editor reads from `Submission.narratives` + `Submission.documents` + `Submission.curriculumMatrices`. Three sources fill those:

1. **Manual edits** — the existing TipTap editor flow.
2. **Legacy importer** — the per-standard cut-and-paste tool.
3. **AI Importer Wizard Apply step** — moves approved Review items into the Submission's narratives / supporting evidence / matrices.

This already works today. CR-043's only impact is timing: Apply now reads from `Submission.aiReviewState.{...}` filtered to `approvedIds`, instead of from the wizard's in-memory `buckets`.

Items NOT approved (still mid-review) stay in `aiReviewState` until the PC either approves them or discards them. Once the PC's set of `(approvedIds ∪ discardedIds)` covers every item across every kind, `aiReviewState` is empty + Review button disables.

### Re-enabling Review for a fully-applied state

If the PC has finished a round (everything approved + applied + Self-Study editor updated), the Review button disables. When they drop a new file later, the parser writes new items into `aiReviewState`, the button re-enables. This is the "stays unlocked until all data approved" invariant — applied to each fresh round.

### Wizard's Stepper after this CR

Today: Upload → Parse → Review → Matrix → Apply (5 steps).
After CR-043: Upload → Parse → "Open Review" handoff (1 button page that just closes the wizard and routes the PC to the persisted Review surface).

Apply step moves entirely OUT of the wizard — it's a button on the persisted Review surface, since that's where the PC now drives item state.

## Acceptance criteria

1. **Toolbar order** — Self-Study Editor toolbar shows Standards / Curriculum Matrix / Supporting File Library / Import Document (Legacy) / **Importer Wizard (AI)** / **Review** / **Matrix** in that order. Review + Matrix render disabled until their persisted state has content.
2. **Wizard close ↔ Review survives** — PC parses one file in the Wizard, closes the Wizard panel, reopens an hour later. Review button is enabled. Clicking it shows the prior Review state (buckets, tags, CVs, etc.) — every item the parser produced is visible.
3. **Second-file workflow** — PC parses `file-A.docx`. Review shows 12 items across 4 standards. PC approves 3, leaves 9 pre-decision. PC opens the Wizard again WITHOUT reimport checkbox, drops `file-B.docx`. After parse, Review shows the 12 prior items PLUS file-B's new items. Approved/discarded marks on file-A's items persist.
4. **Reimport with strict-match dedupe** — PC parses `file-A.docx` (3 narratives + 2 syllabi). Approves 1 narrative. PC parses `file-A.docx` AGAIN with the reimport checkbox checked. After parse, Review still has 3 narratives + 2 syllabi (replaced by content hash), the previously-approved narrative is now back to unapproved (PC must re-confirm), and there are NO duplicate entries.
5. **Reimport with drifted content** — PC parses `file-A.docx`, approves 1 CV. PC then parses `file-A-v2.docx` (different filename) with reimport on. Both CVs appear — strict-match failed; the PC discards one manually.
6. **Approved item moves to editor + leaves Review** — PC approves item X + clicks Apply. Item X appears in the Standards Editor's narrative for its spec. Item X is no longer in `aiReviewState`. If approval covered the last item, Review button disables.
7. **Browser refresh mid-review** — PC parses, opens Review, mid-edit on item 5. Hits hard refresh. Review state survives (server-persisted) including the in-progress edit (already covered by CR-032 + the new server persistence).
8. **Re-locking** — PC finishes one round (all approved + applied). Review button disables. PC drops a new file later. Review re-enables on parse completion. PC can't re-open the empty Review surface in between.
9. **Matrix button parity** — Same enable/disable + survival rules for the Matrix surface.
10. **Cross-PC isolation** — Submission's `aiReviewState` is owned by the submission's PC. A different user (admin, reader) sees Review disabled even if `aiReviewState` is populated. (Standard auth scoping.)
11. **Wizard re-entry never destroys Review state** — There is no path in the wizard that calls a `clearReviewState` action on `aiReviewState`. The only thing that clears items is per-item approve/discard from the Review surface, or a deliberate "Discard all unreviewed" action.
12. **No more "wipe on startUpload"** — `aiImportStore.startUpload` no longer resets `buckets` / `tags` / `matrices` / `cvs` / `evidenceDocs` / `introductions` / `approvedIds`. The store reads merged state from `aiReviewState` instead. (The pre-CR-043 reset was the load-bearing bug.)

## Files affected

- `server/src/models/Submission.ts` — new `aiReviewState` + `aiMatrixState` fields.
- `server/src/controllers/aiImportController.ts` — `receiveAICallback` performs the merge into `aiReviewState` (with the reimport flag governing replacement). `applyAIImport` reads from `aiReviewState` instead of request body.
- `server/src/routes/submissions.ts` + `submissionController.ts` — new routes for reading the Review state + per-item approve/discard.
- `client/src/store/aiImportStore.ts` — `buckets` etc become **selectors** over the server-fetched `aiReviewState`. `startUpload` no longer resets them. Reimport flag wired into the `/start-ai` call.
- `client/src/features/selfStudy/Editor/SelfStudyEditor.tsx` — new Review + Matrix toolbar buttons; routing to dedicated Review + Matrix surfaces.
- `client/src/features/selfStudy/Editor/Review/ReviewSurface.tsx` (new) — extracted from `AIImport/steps/ReviewStep.tsx`; the same UI minus the wizard step-rail chrome.
- `client/src/features/selfStudy/Editor/Matrix/MatrixSurface.tsx` (new) — extracted from `AIImport/steps/MatrixStep.tsx`.
- `client/src/features/selfStudy/Editor/AIImport/Wizard.tsx` — Stepper collapses to Upload / Parse / "Open Review" handoff.
- `client/src/features/selfStudy/Editor/AIImport/steps/ApplyStep.tsx` — moved to ReviewSurface or merged into it.

## Dependencies

- [[cr-002-multi-author-wizard-upload]] — superseded by [[cr-041-multi-file-drag-drop-with-batch-review]] which assumed wizard-scoped state; this CR is the natural correction to that scoping decision.
- [[cr-041-multi-file-drag-drop-with-batch-review]] — the multi-file batched-import flow IS the workflow this CR fixes for. CR-041 ships per-batch state today; CR-043 generalizes to "every import contributes to one persisted Review state for the submission."
- [[cr-032-inline-edit-review-cards]] — per-item edit state needs to persist on the server side as part of `aiReviewState.buckets[].items[].editedAt` + `originalSnippet`. Already partially there; this CR completes it.
- [[cr-024-matrix-spec-bidirectional-link]] — Matrix surface owns the post-parse pre-Apply matrix data.
- [[cr-033-cv-supporting-evidence]], [[cr-039-standard-introduction-buckets]], [[cr-040-appendix-papers-as-supporting-evidence-files]] — each contributes a kind that participates in the reimport merge.
- [[cr-005-pc-lockout-on-final-submit]] — once the Submission transitions to `submitted-for-review`, BOTH the Wizard AND the Review surface go read-only.

## Risk

- **State migration on first deploy.** Existing in-flight imports have wizard-side state but no `Submission.aiReviewState`. Migration: on first read after deploy, build `aiReviewState` from the most-recent `SelfStudyImport.aiBuckets/Tags/CVs/EvidenceDocs/Introductions` for the submission. One-time hydration; no manual coordinator action.
- **Reimport merge bugs are coordinator-visible.** A bad hash comparison would silently drop items or accumulate duplicates. Mitigation: every merge writes an audit log entry on `aiReviewState.mergeLog` with kept-count / replaced-count / added-count per kind. Coordinators can request a support replay if numbers look wrong.
- **Approved-item carry-through.** Approve marks tied to `sectionId` (which changes on reimport since the parser produces new section ids). The strict-match-by-content-hash replacement preserves the LOGICAL identity but the section id changes. We need the approve mark to ride on `itemSources` (the immutable per-item source-record), not on the volatile section id. Implementation detail: approvedIds becomes a set of `itemSources` content hashes, not section ids.
- **CR-041 multi-file batch state.** CR-041 introduced batch-scoped Review state. CR-043 supersedes that scoping — `aiReviewState` is submission-scoped, not batch-scoped. Refactor: the batch advancer's merge-on-completion now writes to submission's `aiReviewState`. Batch becomes a parse-orchestration concern only, not a Review-state container.
- **Wizard's Stepper collapse.** Existing specs (`gotoReviewStep`, `13_review_edit_pencil`, `14_review_discard`, `17_recovery_hard_refresh`, etc.) navigate via the wizard's step-rail. They'll need to be updated to navigate via the toolbar's Review button. Behavior of the underlying assertions stays the same — only the entry point changes.

## Out of scope

- The Reader workflow's view of an applied self-study (CR-007, CR-009) — Reader still sees the Submission's applied content; no change.
- The Self-Study Editor's narrative editing surface itself (CR-039 Phase 2c part 2 IntroductionEditor stays unchanged).
- Cross-submission deduplication — if PC A and PC B both upload the same Stevenson CV in different submissions, there's no shared dedup. Each submission has its own `aiReviewState`.

## Engineering size

L. Estimated breakdown:

- Server schema + migration: ~1 day
- `receiveAICallback` merge logic + content-hash plumbing: ~1.5 days
- Client store decoupling (read-through cache; remove resets in startUpload): ~1.5 days
- Toolbar restructuring + new ReviewSurface + MatrixSurface components: ~2 days
- ApplyStep migration to ReviewSurface: ~0.5 day
- Reimport-merge unit tests (server-side merge function): ~1 day
- E2E spec updates (gotoReviewStep + a new `26_review_persistence.spec.ts` covering the multi-import scenario): ~1 day

**Total: ~8-9 days.**

## Sequencing

Critical sequencing — `Submission.aiReviewState` must be written by `receiveAICallback` BEFORE the wizard's Stepper changes ship, because the wizard's existing Review tab will fall back to reading from server state during the transition.

1. Server schema + write path in `receiveAICallback` (`aiReviewState` populated on every parse-complete).
2. Client store rewires `buckets`/`tags`/etc as selectors over `aiReviewState`. Existing Review UI keeps working unchanged.
3. Move ReviewSurface to a top-level route in the Self-Study editor.
4. Add toolbar buttons; gate by `aiReviewState` content.
5. Collapse the wizard's Stepper; remove its Review step.
6. Reimport merge logic + content-hash dedupe.
7. E2E coverage.

Each step ships independently. After step 3, the Review surface exists in BOTH the wizard AND on the toolbar — the wizard's copy gets removed in step 5.

## Related

- [[cr-041-multi-file-drag-drop-with-batch-review]] — the workflow this CR is built for.
- [[cr-002-multi-author-wizard-upload]] — original framing of the multi-author problem.
- [[../ai-import-wizard-e2e-coverage-review-2026-05-22]] — add `26_review_persistence.spec.ts` to the Tier 1 list when this CR ships.
- [[../critical-error-processing-review-2026-05-22]] — the "Review state wiped on second import" failure mode adds another theme to that review: "wizard reset destroys coordinator work in progress."
