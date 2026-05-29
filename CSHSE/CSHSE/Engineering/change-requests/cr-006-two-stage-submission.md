---
name: CR-006 — Two-stage submission (per-section vs final)
description: PC submits each section for review during editing; final-submit happens once when the whole self-study is ready and triggers the PC lockout.
type: change-request
cr_id: CR-006
status: in-progress
priority: P0
source: [[webinar-action-items-2026-05-20#1-13-05]]
sprint_target: Sprint 2
tags: [submission, workflow, pc, lockout]
last_reviewed: 2026-05-29
---

# CR-006 — Two-stage submission (per-section vs final)

> **R.1 verification (2026-05-29, [[submission-stack-verification-2026-05-29]]):** `revertStandard` works (transition + audit). Both submit events were broken: per-section **submitStandard** validation is non-functional (missing `validateSection` → every spec marked fail, → CR-049, **still open**), and **final submit (submitSelfStudy) ALWAYS 400'd** — it queried `Spec.findOne({ isActive: true })` but the Spec model has no `isActive` field.
> **S2A.0 FIXED (2026-05-29):** `submitSelfStudy` now resolves the required specs via `getAllStandards()` (dropping the broken Spec lookup + `activeSpec.standards`). Verified end-to-end — when every spec is validated `pass`, final submit succeeds (status → `submitted`) and the lockout then refuses PC writes (403); an unvalidated submission returns 400 *missingValidations* (the readiness gate, not "no active spec"). Final-submit is now functional. Remaining for CR-006 done: specs must be able to actually reach `pass` (CR-049) and intentionally-omitted specs must count as satisfied (CR-050). Stays `in-progress` until those land.

## Summary

Eric clarified that there are two distinct submission events:

1. **Submit-for-review (per section)** — PC marks a section ready for AI sanity-check and reader pre-read. Reversible.
2. **Final submit (whole self-study)** — PC declares the whole document done. Triggers the lockout ([[cr-005-pc-lockout-on-final-submit]]) and gives readers access ([[cr-007-reader-access-after-submit]]).

Today the system has only one submit. Adding the per-section concept lets the PC iterate during the build while reserving the lockout for genuine completion.

## Source quotes

> **[1:13:05 — Eric]:** "there's two types of submissions. Submitting it to the review is what's going to happen. Submit the entire document isn't going to happen until the document is completed, when it's ready, when you guys are ready to submit it, it's going to check to see whether or not this stuff has been submitted for review, whether or not there are missing items. It's going to do an error check."

> **[1:13:48 — Eric]:** "when you're done a section and you submit it for review, that is what it's done."

## Decision

Add per-standard / per-spec submit state:

```
StandardSection.status: in-progress | submitted-for-review
```

A standard's submit-for-review:
- Sends the AI a request to run gap analysis + confidence check (the matcher feedback loop)
- Surfaces warnings to the PC
- Is reversible (PC can flip back to in-progress and edit)

Final submit on the whole self-study:
- Requires every standard to be `submitted-for-review` first (or PC waives with explicit confirmation)
- Runs the pre-submission validation popup ([[cr-008-pre-submission-validation-popup]])
- Transitions `SelfStudy.status` to `submitted-for-review` (full lockout)

## Acceptance

- [ ] `StandardSection.status` field added with `in-progress` / `submitted-for-review` enum.
- [ ] Per-standard submit button + revert button in standards editor.
- [ ] Final submit button on self-study root; gated behind validation popup.
- [ ] Final submit refuses if any standard is `in-progress` (with override + reason).
- [ ] Audit-log entries on every per-standard submit + revert + final submit.
- [ ] E2E: per-section submit → AI flags missing evidence → PC adds → revert → re-submit → final submit succeeds.

## Files affected

- `server/src/models/SelfStudy.ts` — embedded section status
- `server/src/controllers/selfStudyController.ts` — submit-section, revert-section endpoints
- `client/src/features/selfStudy/Editor/SelfStudyEditor.tsx` — per-standard submit toolbar
- Final submit modal — validation summary

## Dependencies

- [[cr-005-pc-lockout-on-final-submit]] — final submit triggers it
- [[cr-008-pre-submission-validation-popup]] — gates final submit

## Open questions

- Does per-section submit trigger any reader notification? Default: **no** — readers only see the whole self-study after final submit.
