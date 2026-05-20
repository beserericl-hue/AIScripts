---
name: CR-022 — Reader assignment lockout (Admin only)
description: Once a self-study is locked, only Admin can change reader assignments. PCs and lead readers cannot.
type: change-request
cr_id: CR-022
status: proposed
priority: P2
source: implied by [[webinar-action-items-2026-05-20#1-17-54]] lockout flow
sprint_target: Sprint 3
tags: [readers, assignments, admin, lockout]
last_reviewed: 2026-05-20
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

- [ ] Reader assignment endpoints check `req.user.role === 'admin'` AND `selfStudy.status >= submitted-for-review`.
- [ ] Reason field required on every change.
- [ ] Audit log entry per change.
- [ ] Lead reader UI removes "reassign" affordance once locked; instead shows "Request change from admin" form.

## Files affected

- `server/src/controllers/readerAssignmentController.ts`
- Lead-reader assignment UI
- Admin assignment UI

## Dependencies

- [[cr-005-pc-lockout-on-final-submit]]
- [[cr-020-account-lock-unlock-audit-trail]]
