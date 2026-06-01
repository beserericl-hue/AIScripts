---
name: CR-057 — reader → lead-reader → board pipeline regression guard
description: A durable end-to-end integration test that chains the real endpoints — assign (CR-055) → reader scoring → lead final scores → finalize (CR-056) → board queue → board decision → reports (reader PDF + lead suggestions DOCX) — on one submission, asserting every hand-off plus the access-separation gate.
type: change-request
cr_id: CR-057
status: shipped
priority: P1
source: "[[cr-055-assignreaders-assignment-producer]] · [[cr-056-lead-reader-send-to-board]] · beta-walkthrough readiness (reader→lead-reader→board + report generation)"
sprint_target: Beta-walkthrough prep
tags: [tests, pipeline, reader, lead-reader, board, reports, regression-guard]
last_reviewed: 2026-06-01
shipped_notes: |
  The committed durable counterpart to the live walkthrough proof. The same
  16-check chain was run against cshse-develop on 2026-06-01 (all green) on a
  throwaway submission so Stevenson stayed primed at readers_assigned.
---

# CR-057 — reader → lead-reader → board pipeline regression guard

## Problem statement

CR-055 and CR-056 each have unit-level integration tests, but the *whole* pipeline the beta walkthrough exercises — assign → score → compile → finalize → board → decision → reports — had no single end-to-end guard. A future change to any one hand-off (e.g. the board-queue status filter, the Assignment access gate, a report content-type) could silently break the chain without failing the per-CR tests.

## Decision

Add one integration test that drives the real HTTP endpoints in sequence on a single seeded submission and asserts every transition:

1. **assign (CR-055)** → `readers_assigned`, one ACTIVE Assignment per user, `leadReader` stamped.
2. **access separation** → an UNASSIGNED lead 403s `GET /api/submissions/:id`; an ASSIGNED reader 200s it.
3. **reader scoring** → `PUT /api/submissions/:id/scores` (0–3) succeeds for both assigned readers.
4. **lead final scores** → `PUT /api/submissions/:id/compilation/final-score` succeeds for the lead.
5. **finalize (CR-056)** → `POST /api/submissions/:id/compilation/finalize` → `review_complete`.
6. **board queue** → `GET /api/board/queue` (admin) lists the submission.
7. **board decision** → `POST /api/submissions/:id/decision` accept → `compliant`.
8. **reports** → reader PDF (`application/pdf`) + lead suggestions DOCX (`wordprocessingml`) both stream >500 bytes (collected via an explicit binary parser since supertest doesn't auto-buffer DOCX).

## Acceptance

- [x] End-to-end chain test green (2 tests: full chain + a reader-cannot-finalize 403 case).
- [x] Asserts Assignment count/types, status transitions, board-queue membership, and both report content-types + byte lengths.
- [x] Mirrors the live verification run (16 checks) so the committed guard and the operational proof agree.

## Files affected (2026-06-01)

- `server/tests/integration/cr057-reader-lead-board-chain.test.ts` (new, 2 tests).

## Verification

- `cr057-reader-lead-board-chain.test.ts` (2) green locally against the in-memory test DB.
- Live (cshse-develop, 2026-06-01): the identical chain ran 16/16 green on a throwaway submission, then self-cleaned; Stevenson `2026-001` left untouched at `readers_assigned` for the walkthrough.
