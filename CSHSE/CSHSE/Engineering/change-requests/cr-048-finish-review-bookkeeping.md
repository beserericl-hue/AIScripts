---
name: CR-048 — "Finish review" bookkeeping for leftover drafts
description: Review drafts only had two implicit destinies — approved (applied) or discarded — with no way to say "I've reviewed enough; the leftovers are intentionally NOT included." So the un-triaged count never reached zero and the workflow kept treating Review as having pending work. Add a "Finish review" action that discards every remaining un-triaged draft, and make the DRAFTS counts reflect un-triaged items only.
type: change-request
cr_id: CR-048
status: shipped
priority: P1
source: User direction 2026-05-28 — "anything in the draft section could be applied. How do we say, ok, I have done enough, there are stuff in the review, but it is not going to be included. We need to do that piece of bookkeeping."
sprint_target: Sprint 5 follow-on — closes the loop on the CR-045/047 workflow alignment + the 2026-05-28 sequencing fixes.
tags: [ui, workflow, review, program-coordinator, counts, bookkeeping]
last_reviewed: 2026-05-29
revision_history:
  - 2026-05-28 — proposed
  - 2026-05-29 — accepted (two questions resolved: Finish = discard the remainder; counts = un-triaged only) + shipped
---

# CR-048 — "Finish review" bookkeeping for leftover drafts

## Status: SHIPPED 2026-05-29

Delivered on `cshse-develop`. Commit `6ace428` (server endpoint + count
change + client store/ReviewSurface/editor + tests + e2e).

## Problem

After CR-043/045/047, Review drafts had only two *implicit* end states:

- **Approved** → Apply pushes them into the self-study (they leave the
  state).
- **Discarded** → explicitly excluded (soft mark; item stays for audit).

Everything else sat as **un-triaged** forever. There was no single
"I've reviewed enough — whatever's left is intentionally not included"
action. Consequences:

- The DRAFTS count (dashboard tiles, phase badge) counted *every*
  detected item, so it never reached zero.
- The 2026-05-28 "open editor on Review when drafts pending" behavior
  kept pulling the PC back to Review even after they'd effectively
  finished, because "pending" meant "any item exists."

## Decision

Two answers from the user (2026-05-29):

1. **Finish-review action = discard the remainder.** One click marks
   every still-un-triaged draft as discarded ("not included"). Items stay
   visible under the Discarded list and remain individually
   un-discardable later. Reuses the existing approve/discard model — no
   new item state.
2. **Counts = un-triaged items only.** A draft is "pending" until it is
   approved (→ applied, leaves the state) or discarded (→ excluded). The
   DRAFTS tiles, the phase badge, and the auto-open-on-Review decision all
   count `total − approved − discarded`, so they drop to zero once review
   is finished and the workflow advances.

## Implementation

**Server**
- `server/src/controllers/aiReviewController.ts` — new `finishReview`
  (`POST /api/submissions/:id/review/finish`): adds every un-triaged
  sectionId (collected across buckets narratives/evidenceText/
  evidenceFiles + tags + cvs + evidenceDocs + introduction items) to
  `discardedIds`. Idempotent. Owner-PC/admin auth via `_loadOwnedSubmission`.
- `server/src/routes/submissions.ts` — wire the route (behind
  `submissionLockout`).
- `server/src/controllers/submissionController.ts` — `getWorkflowSummary`
  draft counts (cvs / syllabi / papers / introductions / specItems /
  bySpec) now count UN-TRIAGED items (exclude `approvedIds` +
  `discardedIds`).

**Client**
- `client/src/store/aiImportStore.ts` — track `discardedIds` (state +
  initialState + partialize + hydrate in `loadPersistedReviewState`);
  keep it in sync in `approveItemOnServer` / `discardItemOnServer`; new
  `finishReviewOnServer()` action.
- `client/src/features/selfStudy/Editor/Review/ReviewSurface.tsx` — new
  "✓ Finish review — exclude remaining (N)" header button (confirms,
  calls finish, reloads). Disables to "Review complete" at N = 0.
- `client/src/features/selfStudy/Editor/SelfStudyEditor.tsx` —
  `computeDraftsCount` now counts un-triaged only (the DRAFTS badge + the
  open-on-Review lazy-init both use it; the old `status`-based gate was
  dropped — unresolved-count is the single signal).

## Acceptance

- `POST /:id/review/finish` discards all un-triaged items, leaves
  approved + already-discarded untouched, is idempotent, 401 unauth.
- Dashboard/editor DRAFTS counts reflect un-triaged items; finishing
  review drops them to zero and the editor stops auto-opening Review.
- "Finish review" reversible per item from the Discarded list.

**Tests**
- `server/tests/integration/aiReviewController.test.ts` — finishReview
  (discards un-triaged, idempotent, 401).
- `server/tests/integration/workflow-summary.test.ts` — counts exclude
  approved + discarded.
- `e2e/tests/36_workflow_sequencing.spec.ts` — Finish review CTA →
  "Review complete", reload no longer auto-opens Review.

## Dependencies

- [[cr-043-decouple-review-from-wizard-persist-across-reimport]] — the
  approve/discard model + persisted `aiReviewState` this builds on.
- [[cr-047-pc-dashboard-workflow-alignment]] — the DRAFTS counts whose
  semantics this changes to un-triaged.

## Out of scope

- A bulk "un-discard all" / restore. Per-item un-discard already exists.
- Surfacing a "reviewed on <date>" milestone on the dashboard (the
  user chose discard-the-remainder, not the extra flag).
