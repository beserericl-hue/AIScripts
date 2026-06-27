---
name: CR-067 — Highlight the full matched section in Compare
description: The Compare source pane highlights only the first paragraph of a multi-paragraph response. Highlight the entire matched span (first word → last word) so the reviewer can see where it starts and stops.
type: change-request
cr_id: CR-067
status: proposed
priority: P1
source: "[[monica-review-walkthrough-2026-06-26]] (image22/image23) · Monica 'having the entire section of this text in the box highlighted is a lot simpler … it should highlight it right till here … I know where to stop'"
sprint_target: Review De-noise (Sprint 2)
tags: [review-panel, compare, ui, P1]
last_reviewed: 2026-06-26
---

# CR-067 — Highlight the full matched section in Compare

## Summary
In Compare, the source pane scrolls to + highlights only the **first paragraph** of the matched response. Monica wants the **whole section** boxed so she can verify first word → last word and "know where to stop."

## Source quotes
- Monica: "**having the entire section of this text in the box highlighted is a lot simpler** … it should **highlight it right till here** … Then I know where to stop."

## Decision
- Extend the source-locate to compute the **span end** (the next spec/heading break per CR-061's rule) and highlight from the match start to that end — every paragraph/table/list in the span, not just the first node.
- Keep the prominent box + scroll-to-top of the match.

## Acceptance
- Opening Compare on a multi-paragraph spec highlights the **entire** matched response in the source pane (verified on a KSU spec with ≥3 paragraphs).
- Highlight ends at the next spec break, not at the first paragraph.
- E2E asserts >1 highlighted block for a multi-paragraph spec.

## Files affected
- `client/src/features/selfStudy/Editor/AIImport/review/SourceComparePane.tsx`

## Dependencies
- Benefits from CR-061's deterministic span boundaries (same break logic to find the end).

## Open questions
- When the source span is very long, cap the highlight or box the whole thing? (box whole; rely on scroll.)
