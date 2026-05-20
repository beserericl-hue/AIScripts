---
name: CR-009 — Compilation tab (lead reader side-by-side)
description: Lead reader sees per-spec side-by-side scores from each reader with disagreement highlighting and a Final-score field.
type: change-request
cr_id: CR-009
status: proposed
priority: P1
source: [[webinar-action-items-2026-05-20#compilation-tab]], [[webinar-action-items-2026-05-20#1-25-52]]
sprint_target: Sprint 5 or 6
tags: [readers, lead-reader, compilation, scoring]
last_reviewed: 2026-05-20
---

# CR-009 — Compilation tab (lead reader side-by-side)

## Summary

The lead reader needs a single view comparing all readers' scores per spec, with disagreements automatically flagged, so they can drive a consensus discussion and set the Final score. This becomes the source of the lead-reader compilation report (one of the artifacts the board uses).

## Source quotes

> Slide referenced during the demo: "Compilation tab — side-by-side review" with columns Reader 1, Reader 2, Reader 3, Final and disagreement rows highlighted.

> **[1:25:52 — Eric]:** "the lead reader will generate the compilation report."

## Decision

Lead-reader-only tab listing every spec in the program with columns:

| Column | Source |
|---|---|
| Spec code + prompt | self-study metadata |
| Reader 1 (with link to their full review) | `Review` per reader |
| Reader 2 | … |
| Reader 3 | … |
| Final | lead-reader-set; editable on this screen |

Row highlighting:

- Yellow when readers disagree (any two scores differ by >= 1)
- Red when at least one reader scored `0` (Non-compliant)
- Green when all readers agree

Click a reader cell → opens that reader's narrative comment for the spec. Lead reader can pull the comment thread into a Comments side panel without leaving the tab.

The lead reader generates the **compilation report** (DOCX export) from this tab. The report is what the board reviews.

## Acceptance

- [ ] Compilation tab visible only to roles `lead-reader` and `admin`.
- [ ] Every spec in the program shows on one virtualized table.
- [ ] Disagreement highlighting matches the rules above.
- [ ] Final score persists per spec; audit-logged.
- [ ] Compilation DOCX export button generates a report mirroring the table + lead-reader comments.
- [ ] E2E: three readers score the same spec differently → lead reader sees yellow row → sets Final → exports DOCX → DOCX matches.

## Files affected

- `server/src/controllers/compilationController.ts` (new)
- `server/src/services/compilationDocx.ts` (new) — uses same docx pipeline as reader-report (S5.10)
- `client/src/features/reader/CompilationTab/` (new folder)
- Routing: only lead reader + admin

## Dependencies

- [[cr-003-zero-to-three-compliance-rubric]] — defines the score values
- [[cr-010-portal-direct-messaging]] — lead reader uses DM to ask a reader to clarify
- Existing S5.10 work — reuse reader-report DOCX scaffolding

## Open questions

- Does Final-score override propagate back to individual reader views, or stay lead-reader-private? Default: visible to all readers (transparency).
