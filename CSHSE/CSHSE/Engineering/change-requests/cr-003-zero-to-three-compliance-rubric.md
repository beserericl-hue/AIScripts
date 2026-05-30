---
name: CR-003 — 0-3 compliance score rubric
description: Replace pass/fail with Non / Partial / Largely / Fully compliant (0-3). Partial scores carry to site-visit checklist.
type: change-request
cr_id: CR-003
status: shipped
priority: P0
source: [[webinar-action-items-2026-05-20#1-05-23]], [[webinar-action-items-2026-05-20#1-06-03]]
sprint_target: Sprint 3 (S3.2) — server Score model + routes pre-existed; client `Score4LevelSelector` + reader review surface landed 2026-05-30.
tags: [scoring, rubric, readers, reports]
last_reviewed: 2026-05-30
revision_history:
  - 2026-05-20 — proposed
  - 2026-05-30 — shipped: `Score4LevelSelector` (Non/Partial/Largely/Fully + helper text) + `ReaderSpecRow` per-spec PUT to `/api/submissions/:id/scores`; reader sees only their own scores per CR-007.
---

# CR-003 — 0-3 compliance score rubric

## Summary

The current data model has pass/fail validation. Julia and Nicole explicitly asked for a four-level rubric matching how readers actually score: **Non-compliant (0)**, **Partial (1)**, **Largely (2)**, **Fully compliant (3)**. Partial scores must flow into the site-visit checklist so the visit team can verify in person.

## Source quotes

> **[1:05:23 — Julia]:** "you said that the validation can pass or not pass, but in some cases this what we have kind of meets the standard, but that's why we have the site visit to like verify whether or not the standard was met, so like, in addition, I think to past or not past, we will have to have something that is, like, like a maybe"
> **[1:05:53 — Nicole]:** "is it's a partial"
> **[1:05:54 — Julia]:** "a partial, yeah, something like that"

> **[1:06:03 — Eric]:** "right now I think it's either failed or passed, but I also, you know, what we did, the import was we have wizard, we have the confidence level… if you have something marked as low confidence or review, that's a topic for the site visit."

## Decision

Adopt the rubric:

| Score | Label | Meaning |
|---|---|---|
| 0 | Non-compliant | Standard not met; no path forward without remediation |
| 1 | Partial | Some evidence; site visit must verify |
| 2 | Largely compliant | Most evidence present; minor gaps acknowledged |
| 3 | Fully compliant | Standard met without reservation |

Each spec gets a score from each reader. The compilation tab ([[cr-009-compilation-tab-lead-reader]]) shows side-by-side scores and the lead reader's final score. A score of `1` (Partial) automatically flags the spec for the site-visit checklist ([[cr-012-site-visit-partial-compliance-tracking]]).

## Acceptance

- [ ] Reader review UI offers four buttons (or a 0-3 dropdown) per spec, not pass/fail.
- [ ] DB schema: `Review.scores[].value` is `0 | 1 | 2 | 3`. Migration plan for any existing pass/fail data.
- [ ] Compilation tab shows scores per spec per reader.
- [ ] Reader-DOCX export ([[wizard-user-guide-2026-05-20]] template) shows label + numeric value.
- [ ] Site-visit checklist auto-includes every spec scored `1` by any reader.
- [ ] Unit tests cover the rubric mapping. E2E test covers a partial → site-visit flow.

## Files affected

- `server/src/models/Review.ts` (or equivalent) — score enum
- Migration script for existing data
- Reader review UI (route TBD — currently unbuilt per [[sprint-plan-2026-05-16]] S4.x)
- Reader DOCX template (S5.10) — update score column

## Dependencies

- [[cr-009-compilation-tab-lead-reader]] consumes these scores
- [[cr-012-site-visit-partial-compliance-tracking]] consumes "partial" flag

## Open questions

- Do we expose the score to the PC after relay, or only the comment? Currently leaning **score yes, names no** (consistent with [[cr-004-comment-threading-identity-redaction]]).
