---
name: CR-053 — Board decisions + cycle scheduler
description: Five board outcomes (Accept / Table / Deny / Suspend / Revoke) with audit-logged decisions, default 7-year accreditation cycle on Accept, and an admin Board Console listing both the decision queue and upcoming re-accreditation cycles.
type: change-request
cr_id: CR-053
status: shipped
priority: P1
source: sprint-plan-2026-05-29 S7.1
sprint_target: Sprint 7.1
tags: [board, decisions, accreditation, admin, audit]
last_reviewed: 2026-05-30
---

# CR-053 — Board decisions + cycle scheduler

## Problem statement

Pre-Sprint-7 the only "decision" surface was a 3-outcome enum on `Submission.decision` (`approve | deny | conditional`) with no API to write it, no audit, and no cycle-management story. The board needs to record Accept / Table / Deny / Suspend / Revoke decisions with effective dates, get back a queue of submissions awaiting decision, and see a calendar of approaching re-accreditation cycles.

## Decision

Widen `IDecision.outcome` to the five board outcomes (preserve `approve`/`conditional` in the enum for pre-Sprint-7 records). Add three admin-only endpoints:

- `POST /api/submissions/:submissionId/decision` — stamp the decision; audit-logged; status auto-flips per outcome (accept → compliant; deny/suspend/revoke → non_compliant; table leaves status alone). Accept stamps `effectiveAt` (default now) and `expiresAt` (default effectiveAt + 7y, the CSHSE cycle).
- `GET /api/board/queue` — submissions in `review_complete` with no decision yet.
- `GET /api/board/upcoming-reaccreditations?withinDays=N` — submissions whose `expiresAt` lands in the window + tabled decisions whose `reconsiderAt` lands in the window.

Minimal admin client surface: `features/admin/BoardConsole/BoardConsole.tsx` with one screen — queue cards (inline decision form) on top, upcoming-cycles list below — mounted at `/admin/board`.

## Acceptance

- [x] Five outcomes accept/table/deny/suspend/revoke; legacy `approve`/`conditional` preserved in enum.
- [x] POST decision is admin-only (403 for PC/reader/lead); validates outcome + comments; requires reconsiderAt for `table`.
- [x] accept default 7-year cycle; explicit effectiveAt/expiresAt overridable from body.
- [x] Status auto-flips per outcome (with table as the explicit no-op).
- [x] Audit `board.decision_recorded` with priorOutcome on re-decide.
- [x] Board queue + upcoming-reaccreditations endpoints with role gate.
- [x] Admin BoardConsole client at `/admin/board` (queue + upcoming sections).
- [x] 8 server integration + 7 client view-unit tests.

## Files affected (as shipped, Sprint 7.1, 2026-05-30)

- `server/src/models/Submission.ts` — `BoardDecisionOutcome` union; `IDecision` widens with `decidedByName`, `reconsiderAt`, `effectiveAt`, `expiresAt`; enum widened.
- `server/src/controllers/boardDecisionController.ts` (new) — recordBoardDecision / boardQueue / upcomingReaccreditations.
- `server/src/routes/boardDecisions.ts` (new) — POST decision + GET queue + GET upcoming.
- `server/src/models/AuditLogEntry.ts` — adds `board.decision_recorded`.
- `server/src/index.ts` — mounts the router.
- `client/src/features/admin/BoardConsole/BoardConsole.tsx` (new) — pure view + container.
- `client/src/pages/AdminPage.tsx` — adds `board` route under `/admin/board`.

## Deferred

- Email / in-app **reminders** that fire on `reconsiderAt` / `expiresAt` boundaries. Today the data is queryable via `/board/upcoming-reaccreditations`; pushing notifications lives in the same notification-pass that covers CR-010 (DM notifications). Discrete follow-on CR.
- Re-accreditation **workflow auto-creation** (when `expiresAt` is N months away, spin up a new `Submission` of `type: 'reaccreditation'` and notify the PC). Also a follow-on.
- Board UI link in the Layout nav (today admins navigate via direct URL `/admin/board`).
