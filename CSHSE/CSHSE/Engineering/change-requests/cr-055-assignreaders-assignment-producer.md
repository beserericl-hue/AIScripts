---
name: CR-055 — assignReaders is the Assignment producer
description: POST /reviews/submissions/:id/assign now reconciles ACTIVE Assignment docs (one per reader/lead, with assignmentType + leadReader pointer), so assigned reader-shaped roles actually pass the Assignment-gated read paths instead of 403'ing.
type: change-request
cr_id: CR-055
status: shipped
priority: P0
source: "[[cr-007-assigned-only-reads]] · reviewController.assignReaders · Assignment access-gate (listSubmissions/getSubmission/getFinalScoresForReader)"
sprint_target: Beta-walkthrough prep
tags: [reviews, assignment, access-control, reader, lead-reader]
last_reviewed: 2026-06-01
shipped_notes: |
  Commit 0b2c5ee (branch developer, deploy b2968d10 — first green develop
  deploy since 05-29). Verified live against cshse-develop: assigning a panel
  to Stevenson (2026-001) produced 3 ACTIVE Assignments (2 reader + 1
  lead_reader), stamped submission.leadReader, flipped status →
  readers_assigned, and the unassigned lead 403'd the read while the assigned
  reader 200'd it.
---

# CR-055 — assignReaders is the Assignment producer

## Problem statement

`Assignment` is the access source-of-truth for reader-shaped roles: `listSubmissions`, `getSubmission`, and `getFinalScoresForReader` all gate on an ACTIVE `Assignment` record for the caller. But `assignReaders` historically created only `Review` docs + `submission.assignedReaders[]` — it never wrote `Assignment` docs. Net effect: you could "assign" a reader and they'd still 403 on every read path. The reader → lead-reader → board chain dead-ended at the first reader read.

## Decision

Make `POST /api/reviews/submissions/:submissionId/assign` (`reviewController.assignReaders`) the producer that reconciles `Assignment` docs alongside the existing Review/assignedReaders writes:

- One ACTIVE `Assignment` per assigned user. Reader-role users get `assignmentType: 'reader'`; the lead gets `assignmentType: 'lead_reader'`.
- Reader assignments carry the `leadReaderId` / `leadReaderName` pointer.
- `submission.leadReader` is stamped from the lead in the panel.
- Re-assigning a different set marks dropped users' Assignments `status: 'removed'` (with `removalReason`) rather than deleting them, and keeps/creates exactly one ACTIVE record per retained user (re-activate, never duplicate).
- `Assignment.institutionId` / `institutionName` relaxed to optional (panels are assigned before an institution record always exists in the dev data).

## Acceptance

- [x] Assigning readers + a lead creates one ACTIVE Assignment per user with the right `assignmentType`.
- [x] Reader Assignments carry `leadReaderId` / `leadReaderName`.
- [x] `submission.leadReader` stamped; status → `readers_assigned`.
- [x] Re-assign marks dropped readers `removed`, keeps one ACTIVE per retained user.
- [x] A `lead_reader` can assign on a not-yet-locked submission (no reason); locked phase (submitted+) requires admin + reason (unchanged).
- [x] Assigned reader passes the Assignment-gated reads; unassigned lead is blocked.
- [x] 3 server integration tests + live verification.

## Files affected (commit 0b2c5ee, 2026-06-01)

- `server/src/controllers/reviewController.ts` — `assignReaders` reconciles Assignment docs + stamps `submission.leadReader`.
- `server/src/models/Assignment.ts` — `institutionId` / `institutionName` relaxed to optional.
- `server/tests/integration/cr055-assignment-producer.test.ts` (new, 3 tests) — active-per-user + types + lead stamp; re-assign removed/active reconciliation; lead assigns on in_progress.

## Verification

- Unit/integration: `cr055-assignment-producer.test.ts` (3) green; full pipeline guard in [[cr-057-reader-lead-board-pipeline-test]].
- Live (cshse-develop, 2026-06-01): Stevenson `2026-001` panel = reader1 + reader2 + lead-assigned → 3 ACTIVE Assignments, `leadReader` stamped, status `readers_assigned`, unassigned lead read → 403, assigned reader read → 200.
