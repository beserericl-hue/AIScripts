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
last_reviewed: 2026-05-31
shipped_notes: |
  Sprint 9.2 (2026-05-31) — the deferred cycle-reminder PUSH shipped on top of
  the 9.1 notification core. New admin-only `POST /api/board/run-cycle-reminders?withinDays=N`
  (default 180, clamp [1, 1825]) scans accept decisions whose `expiresAt` lands
  in the window + tabled decisions whose `reconsiderAt` lands in the window, then
  notifies every admin/superuser (in-app + fail-soft email) via `notify`.
  Idempotent — each notification's `dedupeKey` embeds the relevant date, so
  re-runs never double-notify and a re-decided submission with a new expiresAt
  yields a fresh reminder. No in-process cron on this server; the endpoint is
  meant for an external scheduler or a manual Board-Console trigger. 3 server
  integration tests. Commit `f9bda21`. Still deferred: reaccreditation
  auto-spin-up of a new `type: 'reaccreditation'` submission.
---

# CR-053 — Board decisions + cycle scheduler

## Note 2026-06-16 — board-console UI gap (open follow-up)

Walked an admin through the Board Console (`/admin/board`). Confirmed the data flow: a self-study reaches the board only when the lead reader runs `finalizeCompilation` (`POST /api/submissions/:id/compilation/finalize`) → `status = review_complete` → appears in `GET /api/board/queue`; "Record decision" sets `compliant` (accept) / `non_compliant` (deny/suspend/revoke) / stays `review_complete` (table). "Upcoming cycles" is derived read-only from accept (`expiresAt`) + table (`reconsiderAt`) decisions within `withinDays` (default 365).

**Gap (not yet built):** `POST /api/board/spin-up-reaccreditations` and `POST /api/board/run-cycle-reminders` are live + idempotent but have **no button in the Board Console and no in-process cron** — today they'd only fire from an external scheduler. Candidate follow-up: two admin buttons in `BoardConsole.tsx` and/or a nightly scheduler. (The auto-spin-up endpoint itself shipped in Sprint 12.1, superseding the "still deferred" line in `shipped_notes`.) See [[email-deliverability]] for the cycle-reminder send path.

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

- ~~Email / in-app **reminders** that fire on `reconsiderAt` / `expiresAt` boundaries.~~ **SHIPPED Sprint 9.2** (`POST /api/board/run-cycle-reminders`).
- ~~Re-accreditation **workflow auto-creation**.~~ **SHIPPED Sprint 12.1** — see Resolution below.
- Board UI link in the Layout nav (today admins navigate via direct URL `/admin/board`). Picked up in Sprint 13 nav-link pass.

## Resolution (2026-05-31, Sprint 12 / S12.1) — reaccreditation auto-spin-up SHIPPED

The last deferred CR-053 item (workflow auto-creation) is closed.
- **New admin endpoint** `POST /api/board/spin-up-reaccreditations?withinDays=N` (default 365, clamp [1, 1825]) — `server/src/controllers/boardDecisionController.ts` (`spinUpReaccreditations`), `server/src/routes/boardDecisions.ts:19-20`. Scans `accept` decisions whose `expiresAt` lands inside the window and, for each prior cycle with no reaccreditation child yet, creates a fresh `type: 'reaccreditation'` self-study in `draft` (same institution / program / coordinator, 21-standard status map seeded like `createSubmission`), links it via the new `Submission.reaccreditationOf` field, audit-logs `submission.reaccreditation_spun_up`, and notifies the PC (prior submitter) with a new `reaccreditation.opened` notification linking to `/self-study/:newId`.
- **Idempotency:** `reaccreditationOf` is the dedupe key (one child per prior cycle) — re-runs create nothing new. The PC notification additionally carries `dedupeKey = reaccreditation:<priorId>`.
- **Model:** `server/src/models/Submission.ts` adds the optional indexed `reaccreditationOf` link; `server/src/models/Notification.ts` adds the `reaccreditation.opened` type; `server/src/models/AuditLogEntry.ts` adds the `submission.reaccreditation_spun_up` action.
- No in-process cron — driven by an external scheduler or a manual Board-Console trigger (mirrors `run-cycle-reminders`).
- Tests: `server/tests/integration/reaccreditation-spinup.test.ts` (3 — admin-only 403; in-window accept spins up a linked draft + notifies PC + audits, far-future skipped; idempotent re-run) — green. Existing `board-decisions` + `cycle-reminders` (11) unaffected.
