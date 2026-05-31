---
name: CR-007 — Reader access only after PC final submit
description: Readers cannot see a self-study at all until the PC clicks final submit. No early access, no preview.
type: change-request
cr_id: CR-007
status: shipped
priority: P0
source: [[webinar-action-items-2026-05-20#1-19-38]], [[webinar-action-items-2026-05-20#1-20-00]]
sprint_target: Sprint 3 (S3.1 + S3.3) — server status gating pre-existed; reader-dashboard + access-hardening tests landed 2026-05-30.
tags: [readers, access-control, submission, lockout]
last_reviewed: 2026-05-30
revision_history:
  - 2026-05-20 — proposed
  - 2026-05-30 — shipped: `ReaderDashboard` + `/reader` route surface the CR-007-gated listing (`status >= submitted`); 5 access-hardening integration tests pin draft-403, draft-direct-read, cross-institution gate, assigned-200, and PC enumeration guard.
---

# CR-007 — Reader access only after PC final submit

## Summary

Yvonne explicitly clarified that readers should not have any visibility into a self-study before the PC formally submits it. Today's data model can leak a draft self-study to assigned readers because the assignment relation precedes submission. We need access to be gated on `SelfStudy.status === 'submitted-for-review'` (or later in the lifecycle), not on assignment alone.

## Source quotes

> **[1:19:38 — Yvonne]:** "I think that the reader should not have access to the self-study until it's complete and submitted."
> **[1:20:00 — Yvonne]:** "the reader does not have access to a program self-study until they've completed it and submitted it."
> **[1:20:11 — Eric]:** "That's the process. Yeah, that's the process. So that's what was supposed to happen."

## Decision

Reader-facing routes filter by both **assignment** AND **status**. A reader with an assignment to a `draft` self-study sees nothing for that self-study — neither in their dashboard list nor via direct URL.

The reader dashboard shows assignments grouped:

- **Available to review** — assigned + status >= `submitted-for-review`
- **Pending PC submission** — assigned + status === `draft`. Shows only "Awaiting PC submission" with no content.

## Acceptance

- [ ] All reader-facing API endpoints (`GET /api/reader/self-studies`, `GET /api/reader/self-studies/:id`, etc.) filter by `status >= submitted-for-review`.
- [ ] Reader dashboard groups assignments by readiness; pending shows only the program name.
- [ ] Direct URL to a draft self-study returns 403 for readers.
- [ ] Security test: a reader with an assignment to a draft cannot fetch any of its content via any API surface.
- [ ] Audit-log entries on first reader access per self-study (for compliance + reader-activity tracking).
- [ ] E2E: assign a reader → PC starts drafting → reader sees "pending" → PC final submit → reader sees content.

## Files affected

- `server/src/controllers/readerController.ts` (new or existing) — status filter
- `server/src/middleware/auth.ts` — role-aware view filters
- Reader dashboard UI

## Dependencies

- [[cr-005-pc-lockout-on-final-submit]] — drives the status transition
- [[cr-006-two-stage-submission]] — defines final submit
- [[cr-022-reader-assignment-lockout]] — only Admin can change assignments after submit

## Open questions

- Should readers see the PC name + institution before submission? Default: **yes, name + institution only** (they need to know who they're assigned to even if the doc is hidden).

## Verification (2026-05-31) — PARTIAL

Code-verified during the 2026-05-31 sweep. **Working:** `getSubmission` returns 403 for reader/lead_reader when status is `draft`/`in_progress` (`server/src/controllers/submissionController.ts:84-94`); `listSubmissions` restricts readers to submitted-or-later statuses (`:1433-1441`); reader review content is assignment-scoped via `Review` ownership (`reviewController.ts:84,112`). **Two gaps:** (1) **SECURITY** — an explicit `?status=draft` query param **substitutes** for the reader allow-list filter (`submissionController.ts:1444-1446` runs after the role filter), so a reader can enumerate draft submissions' metadata (the single-record gate still blocks opening them). Fix: intersect, don't replace. See [[sprint-plan-2026-05-31]] §2 BUG-A. (2) the read gate is **permissive, not assigned-only** — any reader can read any non-draft submission by id; neither path checks `assignedReaders`/`leadReader`. Product call to flip to assigned-only. Both scheduled Sprint 10 in [[sprint-plan-2026-05-31]].
