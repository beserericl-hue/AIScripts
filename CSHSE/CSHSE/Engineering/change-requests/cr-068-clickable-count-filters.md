---
name: CR-068 — Clickable count filters (narratives / evidence / files)
description: Make the header counts "31 narratives · 115 evidence · 9 files" clickable to filter the rail to a flat list of that type across all specs, for one-pass QA without going standard by standard.
type: change-request
cr_id: CR-068
status: proposed
priority: P1
source: "[[monica-review-walkthrough-2026-06-26]] (image78/image81) · Monica 'I want to see all the evidences in one shot … without going standard by standard' · Eric 'excellent suggestion, we're going to do it'"
sprint_target: Review De-noise (Sprint 2)
tags: [review-panel, navigation, evidence, ui, P1]
last_reviewed: 2026-06-26
---

# CR-068 — Clickable count filters (narratives / evidence / files)

## Summary
The header shows "31 narratives · 115 evidence · 9 files" but there's no way to review all of one type. Clicking a count should filter the rail/list to a flat, cross-spec list of that type so the user can QA (and, for evidence/files, upload — see CR-070) in one linear pass.

## Source quotes
- Monica: "I would love to see a **list of my 115 evidences** … so all I need to do at the end is go to those 115 … **without going standard by standard**."
- Eric: "I think that's an **excellent suggestion**. We're going to do it."

## Decision
- Make each header count a toggle filter. Selecting "evidence" (or "files"/"narratives") switches the rail/middle pane to a flat checklist of every item of that type across all specs, each showing its spec, status, and a Compare/Approve action.
- Also surfaces the evidence-vs-narrative classification so the auto-tagging is understandable (answers "how do I know what's evidence?").

## Acceptance
- Clicking "115 evidence" shows all 115 evidence items in one list; same for files/narratives. Clicking again clears the filter.
- Each row links back to its spec + Compare; counts match the totals.
- E2E asserts the filtered list length == the header count.

## Files affected
- `client/src/features/selfStudy/Editor/AIImport/steps/ReviewStep.tsx` (header counts → filter state; rail/list render)
- `client/src/features/selfStudy/Editor/AIImport/review/ItemCardList.tsx`

## Dependencies
- Pairs with [[cr-070-inline-appendix-upload]] (the evidence/file checklist is where inline upload happens).

## Open questions
- Filtered view replaces the spec rail or overlays it? (replace, with a "back to specs" affordance.)
