---
name: CR-008 — Pre-submission validation popup
description: Final submit triggers an error/warning summary so the PC catches missing evidence, narrative, or standards before lockout.
type: change-request
cr_id: CR-008
status: proposed
priority: P1
source: [[webinar-action-items-2026-05-20#1-08-47]], [[webinar-action-items-2026-05-20#1-12-45]]
sprint_target: Sprint 2 or 3
tags: [validation, submission, ux, pc]
last_reviewed: 2026-05-20
---

# CR-008 — Pre-submission validation popup

## Summary

Nicole asked for warnings during editing — "you fail to submit the standard, or you failed to submit the supporting evidence." Eric translated this into a validation popup at final-submit time that surfaces every gap the AI matcher / completeness check can detect, with the option to cancel and fix or override and submit anyway.

## Source quotes

> **[1:08:47 — Nicole]:** "it might be helpful as they're uploading things to get warnings… you fail to submit, the standard, or you failed to submit the supporting evidence, or that would be lovely."
> **[1:09:09 — Julia]:** "right. That's what we were talking about with the confidence level."

> **[1:12:45 — Nicole]:** "the AI can't give them that instantaneous. Let's say they do their first section and submit text and upload some documents and forget to maybe answer, you know, B, they answer A, they answer C, forget the answer, B. It doesn't immediately say to them, 'Hey, you're missing this.'"
> **[1:13:05 — Eric]:** "Submit the entire document isn't going to happen until the document is completed… It's going to do an error check."

## Decision

A pre-submission modal that lists, grouped by standard:

- **Errors** (block submission unless overridden):
  - Spec with no narrative AND no evidence
  - Required-by-CSHSE specs not addressed
- **Warnings** (informational, do not block):
  - Low AI confidence on a spec match
  - Narrative below a minimum word count
  - Standard with no AI-confirmed coverage

The PC can:
- Cancel → return to editor
- Override → submit with errors (logged in audit trail with a reason field)

## Acceptance

- [ ] Final submit calls a `/api/self-studies/:id/preflight` endpoint that returns structured errors + warnings.
- [ ] Modal shows errors first, warnings second; both link to the offending spec.
- [ ] Override requires a free-text reason; reason persists in audit log.
- [ ] All errors and warnings come from server-side checks (not client-only), so they can't be bypassed.
- [ ] E2E: submit with missing evidence → modal lists it → PC clicks the link → editor scrolls to the spec → PC adds evidence → modal re-runs → submit succeeds.

## Files affected

- `server/src/controllers/selfStudyController.ts` — preflight endpoint
- `client/src/features/selfStudy/Editor/SubmitModal.tsx` (new)
- `client/src/features/selfStudy/Editor/SelfStudyEditor.tsx` — wires the modal

## Dependencies

- [[cr-006-two-stage-submission]] — final submit triggers the popup
- [[cr-003-zero-to-three-compliance-rubric]] — AI confidence informs warnings

## Open questions

- Should the popup also flag per-standard `in-progress` (not yet submitted-for-review)? Yes, as a blocking error.
