---
name: CR-013 — Site visit itinerary builder
description: Lead reader + PC collaborate on an itinerary inside the portal. Scheduling moves out of email.
type: change-request
cr_id: CR-013
status: in-progress
priority: P1
source: [[webinar-action-items-2026-05-20#1-26-47]]
sprint_target: Sprint 6 or 7
tags: [site-visit, itinerary, scheduling, lead-reader]
last_reviewed: 2026-05-29
---

# CR-013 — Site visit itinerary builder

## Summary

Yvonne described the existing process: once a program clears for a site visit, the lead reader works directly with the PC to set up the itinerary, currently over email. The portal should host this — a shared itinerary builder with day-by-day agenda, attendee list, and ties back to the partial-compliance checklist.

## Source quotes

> **[1:26:14 — Yvonne]:** "under maybe it was under the lead reader, where you had site visits scheduled, is that under the lead reader"
> **[1:26:40 — Julia]:** "Yes, lead reader, and usually another one of the readers go with them."
> **[1:26:47 — Yvonne]:** "once the program's cleared for a site visit, the lead reader usually works with the program to actually set up the itinerary."

## Decision

`SiteVisit` model with:

- `selfStudyId`
- `leadReaderId` + `secondaryReaderId` (the "another one of the readers" Julia described)
- `pcId`
- `dates: [{ date, items: [{ time, title, location, attendees[], specCodes[] }] }]`
- `status: planning | confirmed | completed`

Shared edit surface for lead reader + PC (only). Other readers + board see read-only. Linked spec codes pull the relevant checklist items ([[cr-012-site-visit-partial-compliance-tracking]]) so each agenda slot can reference what's being verified.

Export: DOCX itinerary for the visit team to carry offline.

## Acceptance

- [ ] `SiteVisit` model + CRUD endpoints.
- [ ] UI for lead reader + PC to co-edit; conflict resolution via last-writer-wins with audit-log diff.
- [ ] Secondary reader read-only view.
- [ ] Per-slot link to relevant `SiteVisitChecklistItem`s.
- [ ] DOCX export.
- [ ] E2E: lead reader creates visit → PC adds details → both confirm → secondary reader views → export DOCX.

## Files affected

- `server/src/models/SiteVisit.ts` (new)
- `server/src/controllers/siteVisitController.ts`
- `client/src/features/siteVisit/Itinerary/` (new)

## Dependencies

- [[cr-012-site-visit-partial-compliance-tracking]] — checklist is referenced from itinerary
- [[cr-007-reader-access-after-submit]] — self-study is locked by this point

## Open questions

- Should the PC be temporarily un-locked-out during itinerary planning? Lean **no** — itinerary edits don't touch the self-study; PC has direct itinerary access without unlocking the self-study itself.
