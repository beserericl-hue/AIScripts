---
name: CR-012 — Site visit partial-compliance tracking
description: Every spec scored "Partial" auto-flags into the site-visit checklist so the visit team verifies it in person.
type: change-request
cr_id: CR-012
status: shipped
priority: P1
source: [[webinar-action-items-2026-05-20#1-05-53]], [[webinar-action-items-2026-05-20#1-06-03]]
sprint_target: Sprint 6.1
tags: [site-visit, scoring, partial-compliance, readers]
last_reviewed: 2026-05-30
---

# CR-012 — Site visit partial-compliance tracking

## Summary

The 0-3 rubric ([[cr-003-zero-to-three-compliance-rubric]]) introduces a "Partial (1)" score. Julia tied this directly to site visits: "that's why we have the site visit to like verify whether or not the standard was met." Every spec scored Partial by at least one reader must surface on the site-visit checklist.

## Source quotes

> **[1:05:23 — Julia]:** "in addition, I think to past or not past, we will have to have something that is, like, like a maybe… a partial"
> **[1:05:54 — Julia]:** "if we have a list of the suggestions, or what have you, we could take that with us when we do the site visits."

> **[1:06:03 — Eric]:** "if you have something marked as low confidence or review, that's a topic for the site visit."

## Decision

A site-visit checklist record gets auto-populated when the lead reader finalizes scoring on the compilation tab. Inclusion rules:

- Final score === `1` (Partial) → **always** included.
- Final score === `0` (Non-compliant) → included with a "needs major remediation" tag.
- Any reader scored `0` or `1` but final is `2` or `3` → optional "follow-up" inclusion (lead-reader choice).

The checklist surfaces to the visit team (lead reader + secondary reader, per [[cr-013-site-visit-itinerary-builder]]). Each item carries a "verified" toggle the visit team flips during the visit.

## Acceptance

- [x] `SiteVisitChecklistItem` model: `{ submissionId, standardCode, specCode, inclusionReason, finalScoreAtInclusion, verified, verifiedBy/Name/At, verificationNote, addedByName, source }` with unique index on (sub, std, spec).
- [x] Auto-population on compilation finalize — `compilationController.setFinalScore` calls `syncChecklistForFinalScore`: score 0 → `non_compliant` row; score 1 → `partial` row; score 2/3 → remove auto row (unless verified). `clearFinalScore` removes auto rows that are not verified. Verified rows survive score-up so the visit team's note isn't silently lost.
- [x] Site-visit team UI sorted by standard then spec; per-row verify toggle + note + Remove (manual rows only); counts toolbar. Inclusion-reason chip colours `non_compliant` red / `partial` amber / `follow_up` indigo / `manual` slate.
- [x] DOCX export — `services/siteVisitChecklistDocx.ts` produces a table with Spec / Inclusion reason / Verified / Note columns. Validated by unzip-and-grep in integration tests.
- [x] Tests pin the round-trip: 11 server integration (auto-pop 0/1, no-pop 2/3, score-up removes auto, verified survives score-up, clear removes auto, PC 403, reader-can-read-but-not-write, audit on verify + unverify, counts, DOCX) + 10 client view tests.
- [ ] E2E happy-path (lead sets Partial → visit team verifies → DOCX). **Deferred** — integration coverage is comprehensive at the API + UI layers; a Playwright E2E can land alongside the broader S7.4 expansion.

## Files affected (as shipped, Sprint 6.1, 2026-05-30)

- `server/src/models/SiteVisitChecklistItem.ts` (new).
- `server/src/services/siteVisitChecklistDocx.ts` (new) — DOCX builder.
- `server/src/controllers/checklistController.ts` (new) — listChecklist / addManualChecklistItem / verifyChecklistItem / deleteChecklistItem / exportChecklistDocx.
- `server/src/controllers/compilationController.ts` — `syncChecklistForFinalScore` helper + side-effect call from setFinalScore + awaited delete from clearFinalScore.
- `server/src/routes/checklist.ts` (new) — `GET /api/submissions/:id/checklist`, `POST`, `PATCH /:itemId/verify`, `DELETE /:itemId`, `GET /export.docx`.
- `server/src/index.ts` — mounts the router.
- `server/src/models/AuditLogEntry.ts` — adds `checklist.item_verified` + `checklist.item_unverified` to the union.
- `client/src/features/siteVisit/Checklist/Checklist.tsx` (new) — pure ChecklistView + container.
- `client/src/pages/SiteVisitChecklistPage.tsx` (new); `App.tsx` adds `/site-visit/:submissionId/checklist` route.

## Dependencies

- [[cr-003-zero-to-three-compliance-rubric]] — defines the 0-3 rubric.
- [[cr-009-compilation-tab-lead-reader]] — the hook point. `setFinalScore` is where rows appear and disappear.
- [[cr-013-site-visit-itinerary-builder]] — the next sprint piece; itinerary slots will link to checklist items.

## Open questions

- Board-visible before the visit? Today the read endpoint is gated to reader / lead_reader / admin / superuser; PC 403. Board role isn't in the auth model yet — when it is, just add it to `_canRead`.
- Follow-up inclusion rule ("any reader scored 0/1 but final is 2/3") — not auto-populated. Lead reader can manual-add via `POST /api/submissions/:id/checklist` with `inclusionReason: 'follow_up'`.
