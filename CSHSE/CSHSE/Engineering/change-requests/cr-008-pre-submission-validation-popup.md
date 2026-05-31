---
name: CR-008 — Pre-submission validation popup
description: Final submit triggers an error/warning summary so the PC catches missing evidence, narrative, or standards before lockout.
type: change-request
cr_id: CR-008
status: shipped
priority: P1
source: [[webinar-action-items-2026-05-20#1-08-47]], [[webinar-action-items-2026-05-20#1-12-45]]
sprint_target: Sprint 2A (S2A.2) preflight popup; Sprint 10 (S10.3) override-with-reason.
tags: [validation, submission, ux, pc]
last_reviewed: 2026-05-31
revision_history:
  - 2026-05-20 — proposed
  - 2026-05-29 — Phase 1 shipped: GET /api/submissions/:id/preflight + FinalSubmitModal wired (errors/warnings/Go-to). Override + audited override-reason capture still pending (Sprint 2B).
  - 2026-05-31 — Phase 2 (Sprint 10.3) shipped: override-with-reason control + server bypass + audit branch. CR closed shipped.
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

## Verification (2026-05-31) — PARTIAL (status: in-progress)

Code-verified during the 2026-05-31 sweep. **Shipped:** the pre-submit popup with errors + warnings is live — `FinalSubmitModal.tsx:157-201` renders `preflight-errors` (each with a "Go to" jump) + `preflight-warnings`, backed by `GET /api/submissions/:id/preflight` (`submissionController.ts:1053`, route `routes/submissions.ts:129`). **Gap (the catalog's "Sprint 2B"):** there is **no override-with-reason path** — when preflight has errors the modal just disables Submit (`FinalSubmitModal.tsx:239`) and the server unconditionally hard-blocks on `missingValidations` (`submissionController.ts:1600-1606`). The "Submission note" textarea is an optional always-on note, not a gated override. Remaining work: an override-with-reason control + server bypass + dedicated audit branch. Scheduled Sprint 10 in [[sprint-plan-2026-05-31]].

## Closure (2026-05-31) — SHIPPED (Sprint 10.3)

The Sprint-2B gap identified in the verification note above is now closed; CR-008 is **shipped**.

- **Client** — `FinalSubmitModal.tsx` gained the override-with-reason control: a `preflight-override-checkbox` ("Submit anyway, despite the items above") that reveals a required `preflight-override-reason` textarea (≥10 chars). With errors present, Submit stays blocked until both are satisfied; the confirm button turns red and reads "Override & submit anyway", and `onConfirm` passes `{ reason }`.
- **Server** — `submissionController.ts:1662-1684+` accepts `override === true` + `overrideReason` (trimmed, ≥10 chars, capped 2000). When `missingValidations` is non-empty the request now branches: no override → 422 hard-block (historical behaviour); override + valid reason → submit proceeds and a dedicated `submission.final_submit_override` audit event records the reason.
- Closed under the Sprint 10 "submission-integrity hardening" pass ([[sprint-plan-2026-05-31]] S10.3).
