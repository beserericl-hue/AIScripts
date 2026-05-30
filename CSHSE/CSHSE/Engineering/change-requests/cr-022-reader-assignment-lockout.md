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
- [ ] Lead reader UI removes "reassign" affordance once locked; instead shows "Request change from admin" form. **Deferred** — server contract is live; the lead-reader assignment surface is part of the upcoming admin/lead-reader assignment-UI refresh.

## Files affected (as shipped, Sprint 6.3, 2026-05-30)

- `server/src/controllers/reviewController.ts` — `assignReaders` adds the locked-phase gate + the `reason` body field + threads `priorStatus` + `lockedPhase` into the audit payload.
- `server/tests/integration/reader-assignment-lockout.test.ts` (5) pins the contract.
- `server/tests/integration/audit-transitions.test.ts` + `server/tests/integration/reader-endpoints-smoke.test.ts` updated to pass `reason: '...'` (the seeded fixtures use `submitted` submissions which now require a reason).

## Dependencies

- [[cr-005-pc-lockout-on-final-submit]] — same lockout boundary (a "submitted" submission triggers both).
- [[cr-020-account-lock-unlock-audit-trail]] — same audit log; `reader.assigned` action with `reason` is a peer of the lock/unlock actions.

## Open questions

- Should the locked-phase audit get a distinct action name (e.g. `reader.assigned_after_submit`)? Today both pre- and post-submit changes use `reader.assigned`, with `payload.lockedPhase` discriminating. Cleaner for the timeline reader; widening the union later is cheap.
