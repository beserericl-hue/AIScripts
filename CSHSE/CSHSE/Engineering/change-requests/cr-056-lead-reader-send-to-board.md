---
name: CR-056 — lead-reader "Complete review & send to board"
description: New POST /api/submissions/:id/compilation/finalize (lead/admin) flips a submission to review_complete so it surfaces in the board queue, audits compilation.finalized, and notifies every admin board.ready. Wired into CompilationTab via a SendToBoardPanel.
type: change-request
cr_id: CR-056
status: shipped
priority: P0
source: "board queue (GET /api/board/queue) reads status='review_complete' but nothing in the Score-based compilation surface advanced a submission there · [[cr-053-board-decisions-cycle-scheduler]]"
sprint_target: Beta-walkthrough prep
tags: [lead-reader, compilation, board, workflow, notifications, audit]
last_reviewed: 2026-06-01
shipped_notes: |
  Commit 0b2c5ee (branch developer, deploy b2968d10). Verified live against
  cshse-develop end-to-end: lead finalize flipped a review_complete, the board
  queue then listed it, and an admin Accept decision moved it to compliant.
---

# CR-056 — lead-reader "Complete review & send to board"

## Problem statement

The board queue (`GET /api/board/queue`, [[cr-053-board-decisions-cycle-scheduler]]) reads submissions in `status: 'review_complete'` with no decision yet. But nothing in the Score-based compilation surface ever advanced a submission to `review_complete`. So even after a lead finished compiling final scores, the submission never reached the board — the reader → lead-reader → board chain dead-ended at the lead.

## Decision

Add `POST /api/submissions/:submissionId/compilation/finalize` (`compilationController.finalizeCompilation`), lead/admin only:

- Advanceable only from `ADVANCEABLE = ['submitted', 'readers_assigned', 'under_review']`.
- Idempotent on an already-`review_complete` submission (200, `alreadyComplete: true`).
- 409 from a non-advanceable status (`draft`) or a decided one (`compliant` / `non_compliant`).
- For a `lead_reader` caller, stamps `submission.leadReader`.
- Sets `status: 'review_complete'`, audits `compilation.finalized` (priorStatus / newStatus), and notifies every admin with a new `board.ready` notification.

Client: `SendToBoardPanel` inside `CompilationTab` renders a two-step confirm for advanceable statuses, a "done" banner for `review_complete`, and a "decided" banner for `compliant`/`non_compliant`; on success it invalidates the compilation + `['board','queue']` queries.

## Acceptance

- [x] `finalize` is lead/admin only (403 for PC/reader).
- [x] Advanceable from submitted/readers_assigned/under_review → `review_complete`.
- [x] Idempotent on review_complete; 409 from draft / compliant / non_compliant.
- [x] lead_reader caller stamps `submission.leadReader`.
- [x] Audit `compilation.finalized`; every admin gets a `board.ready` notification.
- [x] 404 for an unknown submission.
- [x] CompilationTab SendToBoardPanel wires the action + query invalidation.
- [x] 8 server integration + 27 client CompilationTab tests; live verification.

## Files affected (commit 0b2c5ee, 2026-06-01)

- `server/src/controllers/compilationController.ts` — `finalizeCompilation`.
- `server/src/routes/compilation.ts` — `POST /submissions/:submissionId/compilation/finalize`.
- `server/src/models/AuditLogEntry.ts` — adds `compilation.finalized`.
- `server/src/models/Notification.ts` — adds `board.ready`.
- `client/src/features/leadReader/CompilationTab/CompilationTab.tsx` — SendToBoardPanel + `onFinalizeToBoard` handler + view wiring.
- `client/src/features/leadReader/CompilationTab/CompilationTab.test.tsx` — +8 tests (now 27).
- `server/tests/integration/cr056-finalize-compilation.test.ts` (new, 8 tests).

## Verification

- Integration: `cr056-finalize-compilation.test.ts` (8) + CompilationTab (27) green; full pipeline guard in [[cr-057-reader-lead-board-pipeline-test]].
- Live (cshse-develop, 2026-06-01): on a throwaway submission the lead finalize returned `status: review_complete`, `GET /api/board/queue` then listed it, and an admin Accept decision flipped it to `compliant`.
