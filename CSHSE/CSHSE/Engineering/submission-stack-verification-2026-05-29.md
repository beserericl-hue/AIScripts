---
name: Submission / lockout stack verification — 2026-05-29 (Sprint R.1)
description: Empirical verification of the PC submit → lockout → reader-access stack against the actual developer codebase via integration tests (server/tests/integration/submission-lockout.test.ts, 13 tests green). Verdict — the lockout MIDDLEWARE is correct and proven, but the submit ENDPOINTS that drive into the locked state are broken: submitStandard's validation is non-functional (missing validateSection) and submitSelfStudy ALWAYS 400s (queries a Spec field that doesn't exist). So neither CR-005 nor CR-006 can ship until Sprint 2A fixes them.
type: review
tags: [verification, submission, lockout, sprint-R, cr-005, cr-006, cr-049, cr-050]
audit_date: 2026-05-29
auditor: claude
last_reviewed: 2026-05-29
---

# Submission / lockout stack verification — 2026-05-29 (Sprint R.1)

Sprint R.1 from [[sprint-plan-2026-05-29]]: *prove the lockout/submission stack before building on it.* Method: integration tests in `server/tests/integration/submission-lockout.test.ts` (13 tests, all green) exercising the real endpoints against an in-memory Mongo. This is empirical — it corrected an earlier code-reading inference (see "Correction" below).

## Verdict

**The lockout *middleware* is correct and proven. The submit *endpoints* that drive into the locked state are broken.** Net: a PC cannot actually final-submit today, so the end-to-end submit→lockout→reader loop does not work. **Neither CR-005 nor CR-006 can be promoted to shipped.** Both stay `in-progress`; the precise bugs below become Sprint 2A.

## Verified WORKING (permanent regression coverage)

- **CR-005 — lockout guard.** `submissionLockout` (`server/src/middleware/submissionLockout.ts`) returns **403 `LOCKED`** for a program-coordinator write (PATCH `/api/submissions/:id/narrative`) when `status ∈ {submitted, under_review, readers_assigned, review_complete}`; an **admin bypasses**; an `in_progress` submission is **writable**; unauth → 401. (7 tests.)
- **CR-006 — revertStandard.** Reverts a submitted standard back to `in_progress` (`submissionController.ts:644`), writes an `AuditLogEntry` (`action: 'submission.revert_standard'`), and refuses (409) to revert a `validated` standard. (2 tests.) Audit-on-transition works.
- **submitSelfStudy preconditions.** 400 when already submitted; 400 when no active spec. (2 tests.)

## Verified BROKEN (filed for Sprint 2A)

1. **`submitStandard` validation is non-functional (→ CR-049).** `submissionController.ts:550,758` call `validationService.validateSection({...})`, but `ValidationService` has **no `validateSection` method** (it has `triggerValidation:47`, `validateStandard:592`, …). The per-spec call throws `TypeError: validationService.validateSection is not a function`; it's **caught per-spec** so the request completes (<500), but **every spec is marked `validationStatus: 'fail'`** — nothing can ever pass. Verified: the test asserts the standard ends `'fail'` + the stderr shows the TypeError. Fix = CR-049 (real cshse-ai evaluator).

2. **`submitSelfStudy` (Final Submit) ALWAYS 400s (→ CR-006 bug fix).** Line 1035 queries `Spec.findOne({ isActive: true })`, but the **Spec model has no `isActive` field** (it uses `status`, `models/Spec.ts:15,55`). The query never matches → every final submit returns **400 "No active specification found"** regardless of validation state. **A PC can never final-submit.** A second latent bug sits just downstream — `for (const standard of activeSpec.standards)` (line 1044), but Spec has no `standards` field either (only `standardsCount`) — though it's never reached. Fix: resolve standards via `getAllStandards()` (as CR-047's workflow-summary does) and an active-spec mechanism that matches the schema.

3. **Submit-readiness has no N/A escape (→ CR-050).** Once #2 is fixed, the gate still requires **every** spec `validationStatus === 'pass'` with no way to mark a spec intentionally omitted — [[cr-050-intentionally-omitted-specs-do-not-block-submission]].

## Correction to earlier notes

On 2026-05-29 I wrote (in CR-049 + the plan) that `submitSelfStudy` "throws/500 on `activeSpec.standards`." **That was wrong** — verification shows it returns **400 first** on the `{ isActive: true }` query mismatch and never reaches the `activeSpec.standards` line. Corrected in [[cr-049-ai-section-evaluation-against-reader-criteria]] and [[sprint-plan-2026-05-29]]. (This is exactly why R.1 runs before building — code reading mis-predicted the failure mode.)

## Sprint 2A backlog produced by R.1

- **2A.a — Fix `submitSelfStudy` active-spec + standards resolution** (use `getAllStandards()`; correct or remove the `{isActive:true}` query). Without this, nothing else in the submit/reader loop is reachable. **Do first.**
- **2A.b — CR-049** replaces the broken `validateSection` so specs can actually reach `pass`.
- **2A.c — CR-050** N/A escape so intentionally-omitted specs don't block.
- **2A.d — Re-run this verification** end-to-end (submit → locked → 403) once a-c land, then promote CR-005 + CR-006 to shipped.

## R.2 — reader / lead-reader endpoint smoke (truth table)

Walked the natural reader flow against the real endpoints (`server/tests/integration/reader-endpoints-smoke.test.ts`, 2 tests green). **Verdict: the reader/lead-reader server stack is FUNCTIONAL, not dead scaffolding — Sprint 3 (reader client) is greenlit to build on it.**

| Endpoint | Status | Note |
|---|---|---|
| `POST /api/reviews/submissions/:id/assign` (admin) | **200** | assigns reader, creates Review |
| `GET /api/reviews` (reader, getMyReviews) | **200** | returns assigned reviews |
| `GET /api/reviews/submissions/:id` (lead) | **200** | |
| `PUT /api/submissions/:id/scores` (reader, 0-3) | **200** | scoring works |
| `GET /api/submissions/:id/scores` | **200** | |
| `GET /api/submissions/:id/scores/summary` | **200** | |
| `POST /api/reviews/:id/submit` (reader) | **400** | alive — precondition (review not complete); not dead |
| `GET /api/lead-reviews` (lead, getMyCompilations) | **200** | |
| `POST /api/lead-reviews/submissions/:id` (lead) | **400** | alive — "no submitted reviews" (chain depends on submit) |
| `GET /api/lead-reviews/:id/comparison` | n/a | not reached (no compilation created) |
| `PUT …/scores` as program_coordinator | **403** | role gate works |

The two 400s are legitimate gates: `submitReview` requires a complete review, and `createOrGetCompilation` requires at least one submitted review. Both endpoints run — the reader client (Sprint 3) will satisfy the preconditions (score all specs → submit → compile).

**Caveat:** the harness (`tests/setup.ts`) wipes all collections in `afterEach`, so reader smokes must seed within a single test — the first draft's `beforeAll` seeding got wiped and produced false 401s (a test-authoring bug, not an endpoint problem).

## S2A.0 fix landed (2026-05-29) — Final Submit now functional

Fixed the headline R.1 bug: `submitSelfStudy` now resolves the required specs via `getAllStandards()` (dropping `Spec.findOne({ isActive: true })` + `activeSpec.standards`). Regression coverage added to `submission-lockout.test.ts`:
- Unvalidated submission → **400 "All specifications must be validated"** + `missingValidations[]` (reaches the readiness gate, no longer "no active spec").
- Every spec `pass` → **200**, `status → submitted`, then a PC write is refused **403 LOCKED** — the end-to-end submit→lockout loop works.

Remaining before CR-005/006 can ship: **CR-049** (so specs can actually reach `pass`) and **CR-050** (so intentionally-omitted specs count as satisfied).

## Artifacts

- `server/tests/integration/submission-lockout.test.ts` — 13 tests; the WORKING ones are permanent regression coverage, the two characterization tests pin the broken behavior and will need updating when 2A.0/CR-049 land.
- `server/tests/integration/reader-endpoints-smoke.test.ts` — 2 tests; the reader/lead-reader endpoint truth table above.
