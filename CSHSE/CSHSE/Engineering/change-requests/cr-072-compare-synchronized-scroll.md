---
name: CR-072 — Synchronized scroll in Compare
description: Scroll the imported (left) and source (right) panes together in the Compare overlay so the two documents track each other. Nice-to-have Monica explicitly wished for.
type: change-request
cr_id: CR-072
status: proposed
priority: P2
source: "[[monica-review-walkthrough-2026-06-26]] (image20) · Monica 'It'll be lovely the two move together … as I'm scrolling this, this one is moving too. That'll be phenomenal'"
sprint_target: Compare polish (Sprint 3, optional)
tags: [review-panel, compare, ui, nice-to-have, P2]
last_reviewed: 2026-06-26
---

# CR-072 — Synchronized scroll in Compare

## Summary
In the Compare overlay, scrolling one pane could scroll the other proportionally so the imported content and source document track together. Monica flagged it herself as a stretch ("asking for the sun and the moon") but high-delight.

## Source quotes
- Monica: "It'll be lovely **the two move together** … as I'm scrolling this, **this one is moving too**. That'll be phenomenal."

## Decision
- Add an optional **linked-scroll** mode to the Compare overlay: map scroll position proportionally between the editable left pane and the source right pane (best-effort by relative offset; anchor on the highlighted match).
- Make it a toggle so independent scroll is still possible.

## Acceptance
- With linked-scroll on, scrolling either pane moves the other proportionally; the highlighted match stays roughly aligned.
- Toggle off restores independent scroll.
- Manual smoke on a long KSU spec.

## Files affected
- `client/src/features/selfStudy/Editor/AIImport/review/CompareEditOverlay.tsx`
- `client/src/features/selfStudy/Editor/AIImport/review/SourceComparePane.tsx`

## Dependencies
- Lowest priority; do only after P0/P1 land. Benefits from CR-067 (anchor on full-section highlight).

## Open questions
- Proportional-by-offset vs anchor-by-matched-section? (anchor is more useful; start there.)
