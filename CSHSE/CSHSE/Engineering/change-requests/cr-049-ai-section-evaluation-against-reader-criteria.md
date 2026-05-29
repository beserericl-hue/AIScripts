---
name: CR-049 — AI section evaluation against reader-report criteria (replaces n8n validation)
description: At the end of editing a self-study section (and on submission), the PC needs an AI evaluation of the whole section — narrative + supporting-evidence list + submitted files + scraped web links — judged against the SAME criteria a reader uses, returning pass / needs-improvement / fail + a rationale. Today the per-section "validate" path calls ValidationService.validateSection which DOES NOT EXIST on the class (broken at runtime, submissionController.ts:550,758) and the real validation runs through an n8n webhook returning only pass/fail. This CR builds a real section evaluator on cshse-ai (reusing the CR-018 evidence building blocks), wires the existing per-section "validate" affordance + the submit path to it, and retires the n8n validation workflow. The output feeds the PC's improvement loop now and pre-populates the reader report on submission.
type: change-request
cr_id: CR-049
status: proposed
priority: P1
source: User direction 2026-05-29 — "there is a final AI review that looks at the Reader Report as a guide to review a section ... narrative, supporting evidence list, files submitted for that spec, web links (scraping the weblink) ... returning the AI evaluation (pass, needs improvement, fail) and rationale ... This will give the PC the feedback to improve the section ... and will give the reader the feedback that should be in the reader report. ... The code for this should be in the AI Importer backend as a separate API call ... this should replace the N8N workflow. I don't see this in any of the sprints."
sprint_target: Sprint 2.5 (between submission-lockout completion and the reader client). Fixes a broken submit-path call + removes the n8n validation dependency.
tags: [ai-service, evaluation, reader-criteria, n8n-removal, validation, submit-path]
last_reviewed: 2026-05-29
revision_history:
  - 2026-05-29 — proposed (surfaced during the 2026-05-29 reconciliation as a gap not covered by any sprint)
---

# CR-049 — AI section evaluation against reader-report criteria (replaces n8n validation)

## Status: PROPOSED 2026-05-29

Surfaced by the user while reviewing [[sprint-plan-2026-05-29]] — "I don't see this in any of the sprints." Confirmed during reconciliation that (a) the feature is genuinely absent, (b) the existing per-section validation call is **broken**, and (c) the real path is **n8n**.

## Source quote

> At the end of the edit in the Self Study Screen, there is a final AI review that looks at the Reader Report as a guide to review a section (individual section while editing — existing code) and/or multiple sections. This looks at the narrative, supporting evidence list, files submitted for that spec, web links (scraping the weblink) for returning the AI evaluation (**pass, needs improvement, fail**) and rationale for evaluation based on the criteria in the reader review. This will give the PC the feedback to improve the section if required, and will give the reader the feedback that should be in the reader report when it is generated (on submission). … The code for this should be in the AI Importer backend as a separate API call (can reuse existing code if needed) but this should replace the N8N workflow.
> — User, 2026-05-29

## Problem

Three problems, one fix:

1. **The feature doesn't exist.** No endpoint evaluates a *whole section* (narrative + evidence list + files + web links) against the reader-review criteria and returns pass/needs-improvement/fail + rationale.
2. **The current call is broken.** `server/src/controllers/submissionController.ts:550` and `:758` call `validationService.validateSection({...})`, but `ValidationService` exposes no `validateSection` method (`server/src/services/validationService.ts` has `triggerValidation:47`, `validateStandard:592`, `revalidateFailedSections:627`). So `submitStandard` and `revalidateFailed` throw at runtime — **this will block full verification of the submit path in Sprint R.1.**
3. **The real path is n8n.** `ValidationService.triggerValidation` posts to an n8n webhook (`settingType: 'n8n_validation'`, callback `/api/webhooks/n8n/callback`) and only ever resolves `pass`/`fail`. The user wants this off n8n and onto cshse-ai, consistent with CR-018 (evidence AI moved off n8n).

The `ValidationResult` model only supports `pass | fail | warning | pending` (`models/ValidationResult.ts:4,28`) — no `needs_improvement` and no structured rationale tied to the rubric.

## Decision

Build a **section evaluator on cshse-ai** and route both the in-editor "evaluate this section" affordance and the submit-path validation through it; retire the n8n validation workflow.

### New cshse-ai endpoint

```
POST /ai/section/evaluate
→ body: {
    institutionId, submissionId,
    specs: [{ standardCode, specCode, criteria }],   // 1 spec (in-editor) or many (whole standard / pre-submit)
    narrativeHtml,
    supportingEvidenceText: [...],
    files: [{ s3Key, filename, mimeType }],          // syllabi / papers / CVs already in S3 (CR-040/033)
    webLinks: [url, ...]                              // scraped server-side or in-service
  }
→ {
    perSpec: [{
      standardCode, specCode,
      verdict: 'pass' | 'needs_improvement' | 'fail',
      rationale,                                       // grounded in the reader criteria
      criteriaCoverage: [{ criterion, met: bool, note }],
      improvementSuggestions: [...],                   // PC-facing
      sourcesUsed: { narrative: bool, evidence: [...], files: [...], links: [...] }
    }]
  }
```

- **Reuse, don't rebuild:** the CR-018 evidence pipeline (`ai-service/app/evidence/` — `extract.py`/`embed.py`/`score.py`, endpoints `/ai/evidence/extract|recommend|score` at `main.py:820/887/907`) already extracts + scores evidence against a spec. The section evaluator composes those + the narrative + a Haiku adjudication against the rubric criteria.
- **Web-link scraping** is a new sub-component: fetch + extract readable text from each `webLink` (bounded size/time, allow-list-free but timeout-guarded), pass excerpts into the evaluation. (New capability — see Open questions.)
- **Criteria source:** the reader-review criteria = the CSHSE rubric (CR-003 0-3) per spec. The evaluator maps its verdict to the 4-level rubric so the reader report can consume it directly (pass ≈ Largely/Fully; needs-improvement ≈ Partial; fail ≈ Non).

### Server wiring

- `server/src/services/cshseAiClient.ts` — `evaluateSection(...)` (HMAC-signed, mirrors the evidence-client pattern).
- Replace the broken `validationService.validateSection` calls in `submissionController.ts:550,758` with `evaluateSection`; keep `ValidationResult` as the persistence record.
- `ValidationResult` model — add `needs_improvement` to the status enum + a `rationale` + `criteriaCoverage` field.
- **Retire n8n:** remove/disable `triggerValidation`'s n8n webhook path + the `/api/webhooks/n8n/callback` validation branch; archive the n8n validation nodes (parallels CR-018's n8n-archive step).

### Client wiring (reuse existing surface)

- The Self-Study editor already has a per-section "validate / Passed / Needs improvement" affordance (the green "Passed" chip seen on spec 1.a). Point it at the new evaluator and render verdict + rationale + improvement suggestions inline.
- Add a "Evaluate all" action for a whole standard / pre-submit (multiple sections).
- The verdict + rationale persist so the **reader report generator** (Sprint 5 / report path) pre-populates reader feedback from the AI evaluation.

## Acceptance

- `POST /ai/section/evaluate` returns per-spec `verdict ∈ {pass, needs_improvement, fail}` + rationale + criteria coverage, for 1 spec and for many.
- Web links are fetched + summarized into the evaluation (timeout-guarded; failures degrade gracefully, noted in `sourcesUsed`).
- The in-editor per-section evaluation calls the new endpoint (not n8n) and renders verdict + rationale + improvement suggestions.
- `submitStandard` + `revalidateFailed` no longer call the non-existent `validateSection`; they call `evaluateSection` and persist `ValidationResult` with the new `needs_improvement` status.
- The n8n validation webhook path is removed; no validation traffic hits n8n.
- The stored evaluation is consumable by the reader-report generator (verdict + rationale mapped to the rubric).
- Per-institution isolation honored (HMAC + institutionId payload filter, same as CR-018).
- Tests: ai-service unit (prompt structure, web-scrape extraction, 1-spec vs many); server integration (evaluateSection client + submit-path persistence + `needs_improvement`); E2E (PC edits a thin section → Evaluate → "needs improvement" + rationale → improves → Evaluate → pass).

## Files affected

**ai-service**
- `ai-service/app/section_eval/` (new) — `scrape.py` (web-link text), `evaluate.py` (compose narrative + evidence + files + links → rubric adjudication).
- `ai-service/app/main.py` — `POST /ai/section/evaluate`.
- `ai-service/tests/test_section_eval.py` (new).

**server**
- `server/src/services/cshseAiClient.ts` — `evaluateSection`.
- `server/src/controllers/submissionController.ts:550,758` — replace broken `validateSection` calls.
- `server/src/services/validationService.ts` — retire the n8n webhook path (or repurpose as the cshse-ai caller).
- `server/src/models/ValidationResult.ts` — `needs_improvement` + `rationale`/`criteriaCoverage`.
- `server/src/controllers/webhookController.ts` — drop the n8n validation callback branch.

**client**
- Self-Study editor per-spec evaluation surface — point at the new endpoint; render verdict + rationale + suggestions; add "Evaluate all".

## Dependencies

- [[cr-003-zero-to-three-compliance-rubric]] — defines the reader criteria / rubric the evaluator scores against. (in-progress: server `Score` 0-3 exists; criteria text per spec needed.)
- [[cr-018-ai-evidence-review-via-cshse-ai]] — the evidence extract/score building blocks to reuse; also the n8n-archive precedent. (in-progress.)
- Reader report generator (Sprint 5 reports path) — consumer of the stored evaluation.

## Open questions

1. **Web-link scraping scope** — fetch raw text only, or render JS (headless)? Recommendation: raw fetch + readability extraction, timeout 10s/link, cap N links; no headless browser in v1.
2. **Verdict ↔ rubric mapping** — is 3-level (pass / needs-improvement / fail) the PC-facing surface while the reader uses the full 4-level (Non/Partial/Largely/Fully)? Recommendation: yes — PC sees 3, stored value carries the 4-level mapping for the reader report.
3. **Auto-evaluate on submit, or explicit button only?** Recommendation: explicit "Evaluate" while editing + an automatic pass on Final Submit that populates the reader-report seed.

## Out of scope

- The reader report generator itself (separate; this CR produces the data it consumes).
- The reader's manual override of the AI verdict (reader-client work, CR-003 client / Sprint 3).
