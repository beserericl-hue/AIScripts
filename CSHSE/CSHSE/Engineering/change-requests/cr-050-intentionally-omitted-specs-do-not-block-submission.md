---
name: CR-050 — Intentionally-omitted specs must not block submission
description: Not every CSHSE spec/subspec applies to every program — some are intentionally left out. Today Final Submit hard-requires EVERY spec to be validationStatus==='pass' (server submitSelfStudy ~submissionController.ts:1051 collects missingValidations for any non-pass spec → 400; client isSelfStudyReadyForSubmit at SelfStudyEditor.tsx:2108 requires every spec 'pass' → Submit CTA disabled). There is no "not applicable / intentionally excluded" state, so an empty-by-design spec blocks the whole submission. This CR adds an explicit per-spec N/A (excluded) state the PC sets with a reason, teaches both submit-readiness gates to treat pass-OR-excluded as satisfied, and surfaces excluded specs as "N/A" (not "fail") in the pre-submission popup, the AI evaluation, and the reader report.
type: change-request
cr_id: CR-050
status: proposed
priority: P1
source: User direction 2026-05-29 — "Not all specs and subspecs will have content. There are some left out intentionally. This should not block submission. Currently I think it does."
sprint_target: Sprint 2A (submission lockout completion) — pairs with CR-006 (submit readiness) + CR-008 (pre-submission popup).
tags: [submission, validation, not-applicable, submit-gate, program-coordinator]
last_reviewed: 2026-05-29
revision_history:
  - 2026-05-29 — proposed (submit gate confirmed to hard-block on any non-pass spec; no N/A concept exists)
---

# CR-050 — Intentionally-omitted specs must not block submission

## Status: PROPOSED 2026-05-29

## Source quote

> Not all specs and subspecs will have content. There are some left out intentionally. This should not block submission. Currently I think it does.
> — User, 2026-05-29

## Problem

Final Submit is gated on **every** spec being validated `pass`, with no concept of "this spec doesn't apply":

- **Server** — `submitSelfStudy` (`server/src/controllers/submissionController.ts` ~1051) walks every standard × spec and pushes any spec whose `standardsStatus[key].validationStatus !== 'pass'` into `missingValidations`; a non-empty list returns **400** and refuses the submission.
- **Client** — `isSelfStudyReadyForSubmit` (`client/src/features/selfStudy/Editor/SelfStudyEditor.tsx:2108`) returns `standards.every(s => s.specifications.every(spec => status?.validationStatus === 'pass'))`, so the Submit CTA is disabled unless **every** spec passes.
- **Model** — `Submission.standardsStatus` statuses are `not_started | in_progress | complete | submitted | validated` with `validationStatus: pending | pass | fail` (`models/Submission.ts:196-204`). **No `not_applicable` / `excluded` value.**

A spec a program intentionally omits has no content, is never validated, never reaches `pass`, and therefore **hard-blocks the entire submission** with no override. (Note: simply "don't block on empty" is the wrong fix — it would let *accidental* gaps through silently. The PC must explicitly mark intent.)

## Decision

Add an explicit **per-spec "Not applicable / intentionally excluded"** state the PC sets (with an optional reason), and make submission readiness = **every spec is `pass` OR `excluded`**.

### Data

- `Submission.standardsStatus[key]` gains an `excluded: boolean` + `excludedReason?: string` + `excludedAt`/`excludedBy` (or a `validationStatus`/`status` value of `not_applicable` — implementer's call; a boolean flag avoids disturbing the existing enum consumers). No migration needed (absent = not excluded).

### Submit-readiness (both gates)

- A spec is **satisfied** when `validationStatus === 'pass'` **OR** `excluded === true`.
- Server `submitSelfStudy`: only push a spec into `missingValidations` when it is neither passed nor excluded.
- Client `isSelfStudyReadyForSubmit`: same predicate.

### PC affordance

- In the Self-Study editor, each spec gets a **"Mark not applicable"** toggle (with reason). Excluded specs render muted/struck with an "N/A" chip and are skipped by the completion math (e.g. the dashboard's `X / Y validated` denominator excludes them, or shows `X / (Y − excluded)`).

### Downstream consumers

- **CR-008 pre-submission popup** — lists only specs that are neither passed nor excluded; offers "fill it" or "mark N/A" inline. (This is the natural home for the triage.)
- **CR-049 AI evaluation** — Final-Submit auto-eval **skips** excluded specs (no verdict, no rationale).
- **Reader report** — excluded specs appear as **"N/A — intentionally omitted (reason)"**, not as `fail`. (`Review` already has a `not_applicable` compliance value, `models/Review.ts:93` — reuse it on the reader side.)

## Acceptance

- A PC can mark any spec **Not applicable** (with optional reason); it persists and shows an N/A chip in the editor.
- Final Submit **succeeds** when every spec is `pass` OR `excluded`, even if some have no content.
- Final Submit still **blocks** on specs that are neither passed nor excluded (accidental gaps), listing them.
- Server `submitSelfStudy` and client `isSelfStudyReadyForSubmit` share the pass-OR-excluded predicate (no divergence).
- Excluded specs are skipped by the CR-049 on-submit evaluation and render as **N/A** (not fail) in the reader report + the pre-submission popup.
- Completion counters (dashboard `X/Y validated`, phase progress) account for excluded specs sensibly.
- Tests: server integration (submit with 1 excluded + rest passed → 200; submit with 1 un-triaged gap → 400 listing it); client unit (readiness predicate with excluded specs); E2E (PC marks 11.x N/A → Submit enabled → submits).

## Files affected

**server**
- `server/src/models/Submission.ts` — `excluded`/`excludedReason` on the standard-status subdoc.
- `server/src/controllers/submissionController.ts` — `submitSelfStudy` readiness predicate; a `markSpecNotApplicable` / `clearNotApplicable` endpoint (or extend `markStandardComplete`).
- `server/src/routes/submissions.ts` — wire the N/A endpoint.

**client**
- `client/src/features/selfStudy/Editor/SelfStudyEditor.tsx` — `isSelfStudyReadyForSubmit` predicate + per-spec "Mark not applicable" toggle + N/A chip + completion math.
- `client/src/features/dashboard/WorkflowSummary.tsx` — `X / Y` denominator accounts for excluded.

## Dependencies

- [[cr-006-two-stage-submission]] — owns the submit-readiness logic this changes. (in-progress)
- [[cr-008-pre-submission-validation-popup]] — the triage surface where "fill or mark N/A" lives. (proposed)
- [[cr-049-ai-section-evaluation-against-reader-criteria]] — must skip excluded specs in the on-submit evaluation.
- [[cr-003-zero-to-three-compliance-rubric]] — reader-side `not_applicable` already exists in `Review`; reuse for report rendering.

## Open questions

1. **Granularity** — N/A at the spec/subspec level only, or also a whole standard? Recommendation: spec-level (matches the gate); a "mark all of Standard N N/A" convenience can come later.
2. **Who can mark N/A** — PC only, or does it need admin/reader concurrence? Recommendation: PC sets it; it's visible to readers in the report; reader can flag disagreement via the normal comment path.
3. **CSHSE-required specs** — are some specs mandatory (cannot be marked N/A)? If CSHSE designates required specs, block N/A on those. Needs the rubric metadata (CR-003) to know which. Recommendation: allow N/A on all in v1; add a required-spec guard when the rubric carries that flag.
