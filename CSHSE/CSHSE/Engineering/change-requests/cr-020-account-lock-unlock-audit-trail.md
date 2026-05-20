---
name: CR-020 — Admin lock/unlock audit-trail UI
description: When admin (Julia) locks or unlocks a self-study, account, or reader assignment, the action shows up in a visible audit trail.
type: change-request
cr_id: CR-020
status: proposed
priority: P2
source: [[webinar-action-items-2026-05-20#1-11-35]], [[security-audit-2026-05-10]]
sprint_target: Sprint 3
tags: [audit, admin, security, lockout]
last_reviewed: 2026-05-20
---

# CR-020 — Admin lock/unlock audit-trail UI

## Summary

The lockout workflows ([[cr-005-pc-lockout-on-final-submit]], [[cr-007-reader-access-after-submit]], [[cr-022-reader-assignment-lockout]]) all hinge on admin actions. Today there's no visible log of who unlocked what and when. We need an admin-facing audit-trail screen showing every lock/unlock event with actor, target, timestamp, and reason.

## Source quotes

Implied by Julia / Yvonne's discussion of the relay model and Paul's security concerns.

## Decision

Audit-trail events:

- `selfstudy.lock` / `selfstudy.unlock`
- `account.lock` / `account.unlock`
- `reader.assigned` / `reader.removed`
- `comment.relayed` / `comment.unrelayed` (per [[cr-004-comment-threading-identity-redaction]])

Stored as immutable records (`AuditLogEntry`). Admin UI filters by actor, target type, date range. Read-only — cannot be edited or deleted.

## Acceptance

- [ ] `AuditLogEntry` model with append-only constraints (no update/delete).
- [ ] Hook every lock/unlock/assignment/relay endpoint.
- [ ] Admin UI for browsing entries; CSV export.
- [ ] Retention policy documented (default: forever).
- [ ] Security test: non-admin cannot read audit log.

## Files affected

- `server/src/models/AuditLogEntry.ts` (new)
- `server/src/services/auditLog.ts` (new)
- Hooks in all controllers that handle locks/unlocks
- `client/src/features/admin/AuditTrail/` (new)

## Dependencies

- [[cr-005-pc-lockout-on-final-submit]], [[cr-022-reader-assignment-lockout]] for the events
