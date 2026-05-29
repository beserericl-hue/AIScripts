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
  - 2026-05-29 — OQ3 resolved: Final Submit auto-runs a full evaluation (re-evaluating every applicable spec, even ones already run) to seed the reader report; excluded/N-A specs ([[cr-050-intentionally-omitted-specs-do-not-block-submission]]) are skipped.
  - 2026-05-29 — OQ1 resolved (web scrape = raw text, strip HTML, no headless; unevaluable links flagged for human review, not auto-failed) + added the reader override→AI-learning loop (reuses the `/ai/corrections/ingest` RAG store).
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
2. **The current call is broken.** `server/src/controllers/submissionController.ts:550` and `:758` call `validationService.validateSection({...})`, but `ValidationService` exposes no `validateSection` method (`server/src/services/validationService.ts` has `triggerValidation:47`, `validateStandard:592`, `revalidateFailedSections:627`). **Verified in Sprint R.1** ([[submission-stack-verification-2026-05-29]]): the `TypeError` is caught per-spec so the request completes, but **every spec is marked `validationStatus: 'fail'` — no spec can ever pass.** Validation is effectively non-functional.
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
- **Web-link scraping** is a new sub-component, used to judge whether a *linked page* meets the supporting-evidence criteria for the standard: fetch each `webLink`, **strip HTML to raw text**, and feed that text into the evaluation (bounded size + timeout; no headless render). The verdict treats a passing linked page as satisfied evidence.
  - **Unevaluable links are flagged, not failed.** If a page can't be meaningfully read as text — an org chart, a diagram, an image-only page, a login-walled doc — the evaluator returns `linkVerdict: 'needs_human_review'` for that link (with the reason) rather than scoring it `fail`. The link is surfaced so a **reader can open it themselves** and judge visually. So a non-text evidence link never silently sinks an otherwise-good section.
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

### Reader override + learning loop (reader-client side, Sprint 3)

The AI verdict is a *seed*, not the final word. On the reader review surface (CR-003 / Sprint 3):
- The reader sees the AI verdict + rationale + each link's `linkVerdict` (including any `needs_human_review` links to open directly).
- The reader can **override** the verdict (e.g. an org-chart link the AI couldn't read but the reader confirms is valid → reader marks pass). The override becomes the report's recorded verdict.
- Each override is **submitted back to the AI for learning** — posted to the existing corrections RAG store via `POST /ai/corrections/ingest` (`ai-service/app/main.py:608`, `ai-service/app/corrections/store.py`, collection `cshse_corrections_{env}`, keyed by institution) with a new `correction_type: 'section_eval_override'` carrying {spec, AI verdict, reader verdict, reason, the link/evidence in question}. Future evaluations surface those overrides as RAG hints, so the evaluator improves on the same institution / similar evidence over time.

## Acceptance

- `POST /ai/section/evaluate` returns per-spec `verdict ∈ {pass, needs_improvement, fail}` + rationale + criteria coverage, for 1 spec and for many.
- Web links are fetched, **stripped to raw text**, and judged against the standard's evidence criteria (timeout-guarded; failures degrade gracefully, noted in `sourcesUsed`).
- A non-text / unreadable link (org chart, image, login-walled) returns `linkVerdict: 'needs_human_review'` (not `fail`) and is surfaced for the reader to open directly.
- The reader can **override** the AI verdict on the review surface; the override is recorded as the report verdict AND posted to `/ai/corrections/ingest` (`correction_type: 'section_eval_override'`) so it feeds future evaluations.
- The in-editor per-section evaluation calls the new endpoint (not n8n) and renders verdict + rationale + improvement suggestions.
- `submitStandard` + `revalidateFailed` no longer call the non-existent `validateSection`; they call `evaluateSection` and persist `ValidationResult` with the new `needs_improvement` status.
- The n8n validation webhook path is removed; no validation traffic hits n8n.
- The stored evaluation is consumable by the reader-report generator (verdict + rationale mapped to the rubric).
- **Final Submit auto-runs a full evaluation** across all applicable specs (re-running ones already evaluated) and writes the reader-report seed; excluded/N-A specs ([[cr-050-intentionally-omitted-specs-do-not-block-submission]]) are skipped, not failed.
- Per-institution isolation honored (HMAC + institutionId payload filter, same as CR-018).
- Tests: ai-service unit (prompt structure, web-scrape extraction, 1-spec vs many); server integration (evaluateSection client + submit-path persistence + `needs_improvement`); E2E (PC edits a thin section → Evaluate → "needs improvement" + rationale → improves → Evaluate → pass).

## Files affected

**ai-service**
- `ai-service/app/section_eval/` (new) — `scrape.py` (fetch + strip HTML to text + classify text-evaluable vs needs-human-review), `evaluate.py` (compose narrative + evidence + files + links → rubric adjudication).
- `ai-service/app/main.py` — `POST /ai/section/evaluate`.
- `ai-service/app/corrections/store.py` — accept `correction_type: 'section_eval_override'` (reader override → RAG); surfaced as a hint in future `/ai/section/evaluate` calls.
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

1. **Web-link scraping scope** — **RESOLVED 2026-05-29 (user):** raw fetch + strip HTML to text for evaluation; no headless render. Pages that aren't text-evaluable (org chart / image / diagram) are flagged `needs_human_review` for the reader to open, never auto-failed. Timeout 10s/link, cap N links.
2. **Verdict ↔ rubric mapping** — is 3-level (pass / needs-improvement / fail) the PC-facing surface while the reader uses the full 4-level (Non/Partial/Largely/Fully)? Recommendation: yes — PC sees 3, stored value carries the 4-level mapping for the reader report.
3. **Auto-evaluate on submit, or explicit button only?** **RESOLVED 2026-05-29 (user):** BOTH. Explicit "Evaluate" while editing, AND Final Submit **auto-runs a full evaluation** across every applicable spec — re-evaluating even ones already run individually — and seeds the reader report from the result. Excluded / N-A specs ([[cr-050-intentionally-omitted-specs-do-not-block-submission]]) are skipped. So the on-submit pass is the authoritative seed for the reader report, not a shortcut over prior per-section runs.

## Out of scope

- The reader report generator itself (separate; this CR produces the data it consumes).
- The reader-override **UI** lands on the reader review surface (CR-003 client / Sprint 3). This CR owns the **learning ingest** the override posts to (`section_eval_override` → `/ai/corrections/ingest`) and the evaluator's consumption of those hints; the button itself is built in Sprint 3.
