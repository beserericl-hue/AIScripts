---
name: CR-013 — Site visit itinerary builder
description: Lead reader + PC collaborate on an itinerary inside the portal. Scheduling moves out of email.
type: change-request
cr_id: CR-013
status: shipped
priority: P1
source: [[webinar-action-items-2026-05-20#1-26-47]]
sprint_target: Sprint 6.2
tags: [site-visit, itinerary, scheduling, lead-reader]
last_reviewed: 2026-05-30
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

- [x] `SiteVisit` model + CRUD endpoints (model existed pre-2026; agenda subdoc widened with `location` / `attendees` / `specCodes` / `checklistItemIds` / `notes` — all optional / additive).
- [x] UI for lead reader + PC to co-edit; last-writer-wins (no merge); audit-log entry `itinerary.updated` records `priorAgendaLen` + `newAgendaLen` per save.
- [x] Secondary reader read-only view (canCoEdit flag on the GET response; UI disables every input + hides Save/Add/Remove for non-editors).
- [x] Per-slot link to relevant `SiteVisitChecklistItem`s — `checklistItemIds[]` on each agenda slot; DOCX export resolves them inline and shows verified status.
- [x] DOCX export — `GET /api/submissions/:id/itinerary/export.docx` builds a printable .docx (cover + per-slot heading + location + attendees + specs + notes + linked checklist items).
- [ ] E2E: lead reader creates visit → PC adds details → both confirm → secondary reader views → export DOCX. **Deferred to S7.4 E2E expansion** — integration coverage is comprehensive at the API + UI layers (13 server + 10 client).

## Files affected (as shipped, Sprint 6.2, 2026-05-30)

- `server/src/models/SiteVisit.ts` — agenda subdoc widened with `location` / `attendees` / `specCodes` / `checklistItemIds` / `notes` (all additive; existing scheduler still works).
- `server/src/controllers/itineraryController.ts` (new) — `getItinerary` / `replaceAgenda` / `exportItineraryDocx`.
- `server/src/routes/itinerary.ts` (new) — GET / PUT / GET-DOCX.
- `server/src/index.ts` — mounts the router.
- `server/src/models/AuditLogEntry.ts` — adds `itinerary.updated` to the AuditAction union.
- `client/src/features/siteVisit/Itinerary/Itinerary.tsx` (new) — pure ItineraryView + container with TanStack-Query.
- `client/src/pages/SiteVisitItineraryPage.tsx` (new); `App.tsx` adds `/site-visit/:submissionId/itinerary` route.

## Files affected

- `server/src/models/SiteVisit.ts` (new)
- `server/src/controllers/siteVisitController.ts`
- `client/src/features/siteVisit/Itinerary/` (new)

## Dependencies

- [[cr-012-site-visit-partial-compliance-tracking]] — checklist is referenced from itinerary
- [[cr-007-reader-access-after-submit]] — self-study is locked by this point

## Open questions

- Should the PC be temporarily un-locked-out during itinerary planning? Lean **no** — itinerary edits don't touch the self-study; PC has direct itinerary access without unlocking the self-study itself.
