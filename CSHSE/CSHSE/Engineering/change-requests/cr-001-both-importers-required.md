---
name: CR-001 — Keep both AI wizard and legacy per-standard importer
description: Both import paths must coexist. AI wizard for finished docs; legacy per-standard cut-and-paste for multi-author piecewise entry.
type: change-request
cr_id: CR-001
status: proposed
priority: P0
source: [[webinar-action-items-2026-05-20#28-25]], [[webinar-action-items-2026-05-20#44-07]]
sprint_target: Sprint 2
tags: [import, wizard, legacy-importer, ui]
last_reviewed: 2026-05-20
---

# CR-001 — Keep both AI wizard and legacy per-standard importer

## Summary

The 2026-05-20 beta-training webinar revealed that some institutions have a single author with a finished self-study (wizard target) and others have several authors contributing piecewise (legacy per-standard target). Both flows must remain available. The wizard is **not a replacement** for the existing per-standard cut-and-paste flow.

## Source quotes

> **[27:23 — Nicole]:** "the cut and paste felt did not feel good… so this feels to me just a little bit less arduous to do." — but **Julia [22:26]** pushed back: "what we were doing before was the individual standards, and them being able to cut and paste into each individual standard, which was useful because sometimes you have more than one person that is giving you pieces of that self-study… at different times."

> **[28:25 — Eric]:** "Let's not remove this feature. Let's keep this one and the second, you know, the wizard in the same system."
> **[28:20 — Julia]:** "I'm okay with that. I mean, having the option is fine."

> **[41:11 — Eric]:** "instead of taking the regular importer out, we're going to have the import document, and the wizard is going to be labeled as AI import, so you'll know which ones different."

## Decision

Ship both paths. Surface them as two clearly-labelled entry points on the self-study editor:

- **Import document** — the legacy per-standard cut-and-paste editor. Lives at the existing route. No change to behavior.
- **AI Import (wizard)** — the new 5-step wizard. Labelled "AI Import" so coordinators can tell them apart at a glance.

The two paths write to the same data model (standards / specs / narratives / evidence). A PC may start with one path and finish with the other on the same self-study.

## Acceptance

- [ ] Self-study editor shows two top-level entry points: "Import document" and "AI Import" (with badge).
- [ ] Both paths land on the same `SelfStudy` record after apply; switching paths does not lose work.
- [ ] AI Import is labelled with a visible "AI" badge in both the entry point and the wizard chrome.
- [ ] User-guide doc ([[wizard-user-guide-2026-05-20]]) is updated to describe when to pick each path.
- [ ] Mixed-mode smoke test: import three sections via legacy, run wizard on a partial DOCX, verify both sets of data merge cleanly.

## Files affected

- `client/src/features/selfStudy/Editor/SelfStudyEditor.tsx` — entry points
- `client/src/features/selfStudy/Editor/AIImport/` — wizard already exists
- Existing legacy importer routes — untouched
- [[wizard-user-guide-2026-05-20]] — add "when to use each"

## Dependencies

- None. Both code paths exist today; the change is UX surfacing + documentation.

## Open questions

- Should we pre-flight conflict detection when a PC imports the same standard via both paths within a session? — defer to CR-002 follow-up.
