---
name: CR-011 — Suggestions consolidation document
description: Per-standard reader suggestions roll up into one document the PC can hand to the VP for accreditation.
type: change-request
cr_id: CR-011
status: proposed
priority: P1
source: [[webinar-action-items-2026-05-20#1-04-19]], [[webinar-action-items-2026-05-20#1-04-53]]
sprint_target: Sprint 5
tags: [reports, readers, vp-for-accreditation, exports]
last_reviewed: 2026-05-20
---

# CR-011 — Suggestions consolidation document

## Summary

Yvonne flagged that some reader suggestions need to be escalated through the VP for accreditation back to the program. Today that requires manually copying across multiple reader reports. The portal should generate a single consolidated suggestions document — all readers' suggestions, grouped by standard.

## Source quotes

> **[1:04:19 — Yvonne]:** "the suggestions from each standard can be pulled together in one document, and the reason that I ask is that sometimes some of those suggestions need to be addressed, need to go through the VP for accreditation, and back to the program to ask them to provide more data in the process of completing the self-study review."

> **[1:04:53 — Eric]:** "I see that as necessary as well, and so my note taker is taking that as an action item to effectively get that in."

## Decision

Lead-reader-triggered export. Generates a DOCX with:

- Cover page (institution, program, accreditation cycle, date)
- TOC by standard
- Per-standard section listing every reader's suggestions verbatim, attributed by `pcLabel` (anonymized per [[cr-004-comment-threading-identity-redaction]]) or by reader name (depending on consumer — see below).

Two output modes:

1. **Internal (board / VP)** — full reader names visible.
2. **PC-facing** — reader names redacted to `pcLabel`. This is the document the PC receives via Julia.

## Acceptance

- [ ] Lead-reader-only "Generate suggestions doc" button on the Compilation tab.
- [ ] Two-mode toggle (internal vs PC-facing) selectable at export time.
- [ ] PC-facing mode strips reader identity server-side (not client filter).
- [ ] DOCX matches CSHSE branding (header/footer + logo).
- [ ] E2E: 3 readers leave suggestions → lead reader exports → DOCX renders all suggestions grouped + attributed appropriately.

## Files affected

- `server/src/services/suggestionsDocx.ts` (new)
- `server/src/controllers/compilationController.ts` — `POST /:id/export-suggestions`
- Shared DOCX header/footer template (reused from reader-report and compilation-report)

## Dependencies

- [[cr-009-compilation-tab-lead-reader]] — same data source
- [[cr-004-comment-threading-identity-redaction]] — PC-facing mode honors redaction rules

## Open questions

- Should the AI matcher suggest additional remediation language inline? Defer.
