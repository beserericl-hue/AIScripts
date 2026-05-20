---
name: CR-007 — Reader access only after PC final submit
description: Readers cannot see a self-study at all until the PC clicks final submit. No early access, no preview.
type: change-request
cr_id: CR-007
status: proposed
priority: P0
source: [[webinar-action-items-2026-05-20#1-19-38]], [[webinar-action-items-2026-05-20#1-20-00]]
sprint_target: Sprint 2
tags: [readers, access-control, submission, lockout]
last_reviewed: 2026-05-20
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
