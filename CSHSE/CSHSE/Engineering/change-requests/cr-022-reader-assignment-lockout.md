---
name: CR-022 — Reader assignment lockout (Admin only)
description: Once a self-study is locked, only Admin can change reader assignments. PCs and lead readers cannot.
type: change-request
cr_id: CR-022
status: shipped
priority: P2
source: implied by [[webinar-action-items-2026-05-20#1-17-54]] lockout flow
sprint_target: Sprint 6.3
tags: [readers, assignments, admin, lockout]
last_reviewed: 2026-05-30
---

# CR-022 — Reader assignment lockout (Admin only)

## Summary

Reader assignment changes after final submit create chain-of-custody problems: a reader who saw the doc shouldn't be silently removed; a new reader getting access mid-review needs a documented reason. Today the assignment surface is ungoverned.

## Source quotes

Implied by Yvonne + Julia's discussion of the lockout-and-relay flow.

## Decision

After a self-study transitions to `submitted-for-review` ([[cr-005-pc-lockout-on-final-submit]]):

- Only `admin` can add or remove reader assignments.
- Every assignment change is logged ([[cr-020-account-lock-unlock-audit-trail]]) with a required reason.
- Lead reader cannot reassign — they request a change from admin.
- PC has no assignment view at all.

## Acceptance

- [x] `POST /api/reviews/submissions/:id/assign` checks the locked phase (`status ∈ {submitted, under_review, readers_assigned, review_complete, compliant, non_compliant}`). When locked: non-admin (including lead_reader) → **403**; admin without `reason` → **400**; admin with `reason` → **200**. Pre-submit phase keeps existing behavior (lead_reader can assign without a reason; back-compat).
- [x] Audit entry per change carries the `reason` (when locked-phase), `payload.submissionStatusAtChange` (the prior status), and `payload.lockedPhase: true|false` — so the timeline shows whether the change was inside or outside the lockout window.
- [x] Lead reader UI removes "reassign" affordance once locked; instead shows "Request change from admin" form. **Shipped S13c (2026-05-31)** — see Resolution below. `AssignmentChangeRequestBox` on the compilation surface + `POST /api/reviews/submissions/:id/request-assignment-change` (notifies admins, audit-logged).

## Files affected (as shipped, Sprint 6.3, 2026-05-30)

- `server/src/controllers/reviewController.ts` — `assignReaders` adds the locked-phase gate + the `reason` body field + threads `priorStatus` + `lockedPhase` into the audit payload.
- `server/tests/integration/reader-assignment-lockout.test.ts` (5) pins the contract.
- `server/tests/integration/audit-transitions.test.ts` + `server/tests/integration/reader-endpoints-smoke.test.ts` updated to pass `reason: '...'` (the seeded fixtures use `submitted` submissions which now require a reason).

## Dependencies

- [[cr-005-pc-lockout-on-final-submit]] — same lockout boundary (a "submitted" submission triggers both).
- [[cr-020-account-lock-unlock-audit-trail]] — same audit log; `reader.assigned` action with `reason` is a peer of the lock/unlock actions.

## Open questions

- Should the locked-phase audit get a distinct action name (e.g. `reader.assigned_after_submit`)? Today both pre- and post-submit changes use `reader.assigned`, with `payload.lockedPhase` discriminating. Cleaner for the timeline reader; widening the union later is cheap.

## S13c Resolution (2026-05-31) — "Request change from admin" affordance shipped

The last open acceptance box (the lead-reader UI affordance) is now delivered. The server contract was already live (S6.3 — a lead reader gets a 403 from the locked-phase `assignReaders`); this pass adds the governed *ask*.

### Server — new ask endpoint (no assignment mutation)

`POST /api/reviews/submissions/:submissionId/request-assignment-change` (`server/src/controllers/reviewController.ts` → `requestAssignmentChange`, wired in `server/src/routes/reviews.ts`). It performs NO reassignment — the admin still acts via the reason-gated `assignReaders` flow. It:

- gates to `lead_reader` only (admins act directly → 403; plain readers have no assignment authority → 403);
- requires a non-blank `reason` → else 400;
- writes an append-only audit entry `reader.assignment_change_requested` (new `AuditAction`) carrying the `reason` + `payload.submissionStatusAtRequest`;
- fan-out notifies every active admin via the shared `notify` service with a new `NotificationType` `reader.assignment_change_requested`. Fail-soft; `dedupeKey = reader.assignment_change_requested:{submissionId}:{leadReaderId}` so repeated asks from the same lead reader on the same submission don't spam.

### Client — locked-phase affordance on the compilation surface

`client/src/features/leadReader/CompilationTab/CompilationTab.tsx` now renders an `AssignmentChangeRequestBox` when the submission is in a locked phase (status ∈ {submitted, under_review, readers_assigned, review_complete, compliant, non_compliant}). Instead of a disabled reassign control, the lead reader sees "Reader list is locked. Only an admin can change who reads this self-study." → opens a reason textarea → "Send to admin", which POSTs the new endpoint and confirms ("Your note went to the admin."). Five-year-old-voice copy.

### Tests

- **Server (4):** `server/tests/integration/request-assignment-change.test.ts` — lead-reader request notifies every admin + writes the audit entry with the reason; blank reason → 400; plain reader → 403; admin → 403. All green.
- **Client (4 new, file now 19):** `CompilationTab.test.tsx` — box hidden when not locked; box shows + reveals reason form on open with Send disabled until typed; Send fires `onRequestAssignmentChange` with the trimmed reason; done-state confirmation renders.

### Files touched (S13c, additive)

- `server/src/models/AuditLogEntry.ts` — `reader.assignment_change_requested` action.
- `server/src/models/Notification.ts` — `reader.assignment_change_requested` type.
- `server/src/controllers/reviewController.ts` — `requestAssignmentChange`.
- `server/src/routes/reviews.ts` — route wired.
- `server/tests/integration/request-assignment-change.test.ts` (new).
- `client/src/features/leadReader/CompilationTab/CompilationTab.tsx` — `AssignmentChangeRequestBox` + locked-phase wiring.
- `client/src/features/leadReader/CompilationTab/CompilationTab.test.tsx` — 4 new tests.

All three CR-022 acceptance boxes are now checked. CR-022 is fully shipped.
