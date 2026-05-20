---
name: CR-012 — Site visit partial-compliance tracking
description: Every spec scored "Partial" auto-flags into the site-visit checklist so the visit team verifies it in person.
type: change-request
cr_id: CR-012
status: proposed
priority: P1
source: [[webinar-action-items-2026-05-20#1-05-53]], [[webinar-action-items-2026-05-20#1-06-03]]
sprint_target: Sprint 6
tags: [site-visit, scoring, partial-compliance, readers]
last_reviewed: 2026-05-20
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

- [ ] `SiteVisitChecklistItem` model linking `selfStudyId`, `specCode`, `inclusionReason`, `verified: bool`, `verificationNote`.
- [ ] Auto-population on compilation finalize.
- [ ] Site-visit team UI: checklist sorted by standard, filter by inclusion reason, set verified + add note.
- [ ] Export checklist as DOCX/PDF for offline use during the visit.
- [ ] E2E: lead reader sets Partial → site-visit team sees item → verifies + notes → exports.

## Files affected

- `server/src/models/SiteVisitChecklistItem.ts` (new)
- `server/src/controllers/siteVisitController.ts` (new)
- `client/src/features/siteVisit/Checklist/` (new)

## Dependencies

- [[cr-003-zero-to-three-compliance-rubric]] — defines Partial
- [[cr-009-compilation-tab-lead-reader]] — final score is set here
- [[cr-013-site-visit-itinerary-builder]] — visit team is defined there

## Open questions

- Are these checklist items board-visible before the visit? Default: yes, board sees the checklist when reviewing.
