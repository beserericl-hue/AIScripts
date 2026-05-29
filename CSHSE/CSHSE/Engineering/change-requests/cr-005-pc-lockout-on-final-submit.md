---
name: CR-005 — PC lockout on final submit (read-only + print)
description: Once the PC clicks final submit, the self-study becomes read-only with print enabled. No edits, no comment view, no narrative changes until unlocked.
type: change-request
cr_id: CR-005
status: shipped
priority: P0
source: [[webinar-action-items-2026-05-20#1-17-54]], [[webinar-action-items-2026-05-20#1-18-09]]
sprint_target: Sprint 2A (S2A.0 + S2A.4) — submit + admin unlock + audited override.
tags: [lockout, submission, pc, readers, security]
last_reviewed: 2026-05-29
revision_history:
  - 2026-05-20 — proposed
  - 2026-05-29 — shipped: submissionLockout middleware verified by 14 lockout tests; S2A.0 fixed submitSelfStudy active-spec lookup; S2A.4 added admin unlock POST /api/submissions/:id/unlock with audit; reader-lock transitions audited (S2A.1).
---

# CR-005 — PC lockout on final submit (read-only + print)

> **R.1 verification (2026-05-29, [[submission-stack-verification-2026-05-29]]):** the lockout *middleware* (`server/src/middleware/submissionLockout.ts`) is implemented and **verified working** (PC → 403 LOCKED on locked statuses; admin bypass; in_progress writable). But it's unreachable in practice because final submit is broken (always 400 — see [[cr-006-two-stage-submission]]). Stays `in-progress` until the submit endpoints work end-to-end.

## Summary

After the PC clicks final submit, the self-study is locked. The PC can still view and print, but cannot edit narrative, add evidence, see reader comments, or see reader names. The lockout is the precondition that lets readers begin their work ([[cr-007-reader-access-after-submit]]).

## Source quotes

> **[1:11:35 — Yvonne]:** "the application itself, I assume, is locked once they submit it, so a reader would need to go back through Julia to actually let them know what they needed to add at any point, is that correct?"
> **[1:12:10 — Eric]:** "That's absolutely correct. That was the process that we started with."

> **[1:17:54 — Julia]:** "Correct. Once they submit, they do no longer have access to make any changes at all. It's locked."
> **[1:18:09 — Julia]:** "I believe they can still see it, and they should still be able to print it if they need to."

## Decision

`SelfStudy.status` transitions:

```
draft → submitted-for-review → in-review → board-decision → returned-to-pc | accepted
```

On `submitted-for-review`:
- PC's role on this record drops to `viewer-only`.
- All edit endpoints reject writes with `403 LOCKED`.
- Print endpoint stays open.
- Comment threads are hidden from the PC view (per [[cr-004-comment-threading-identity-redaction]]).

Only **Admin (Julia)** can move back to `draft` (which triggers the unlock).

## Acceptance

- [ ] `SelfStudy.status` enum updated; migration for existing records.
- [ ] Server-side middleware rejects PC edit attempts on locked records with structured error code.
- [ ] Client-side editor switches to read-only chrome (banner: "Submitted for review on YYYY-MM-DD — read only").
- [ ] Print button works in locked mode; export-to-DOCX works in locked mode.
- [ ] Comment threads return `[]` for PC role on locked records.
- [ ] Audit-log entries on every lock + unlock event (who, when, why).
- [ ] E2E test: PC submits, attempts edit (fails), prints (succeeds), admin unlocks, PC edits (succeeds).

## Files affected

- `server/src/models/SelfStudy.ts` — status enum + transitions
- `server/src/middleware/lockout.ts` (new) — write-blocker
- `client/src/features/selfStudy/Editor/SelfStudyEditor.tsx` — read-only banner + chrome
- `client/src/features/selfStudy/PrintView/` — already exists; gate behind status
- Admin UI — unlock control

## Dependencies

- [[cr-006-two-stage-submission]] — defines the distinction between per-section submit and final submit
- [[cr-007-reader-access-after-submit]] — what happens on the reader side after lockout
- [[cr-022-reader-assignment-lockout]] — locking down reader assignments too

## Open questions

- "Submitted-for-review" status: does it apply per-section (S5.10 era) or only at the whole-self-study level? Per webinar, **whole self-study** — per-section submits don't lock. Confirm with Julia.
