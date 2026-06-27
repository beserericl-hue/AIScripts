---
name: CR-065 — AI-evaluation sidebar → read-only informational modal
description: Replace the permanent right "AI evaluation" sidebar with an on-demand read-only modal; remove its editing/placement controls and Show-in-source (Compare handles source); reclaim the full right pane for content.
type: change-request
cr_id: CR-065
status: proposed
priority: P1
source: "[[monica-review-walkthrough-2026-06-26]] · Eric 2026-06-26 'This sidebar should be an informational modal window. There is no need to edit the data … or show original source since the compare function handles that' · Monica 'this end sidebar is really not useful … duplicated functions … shown in a modal window'"
sprint_target: Review De-noise (Sprint 2)
tags: [review-panel, ui, usability, de-noise, P1]
last_reviewed: 2026-06-26
---

# CR-065 — AI-evaluation sidebar → read-only informational modal

## Summary
The always-on right "AI evaluation" pane eats ~25–30% of the screen with small boxes and duplicated controls. Make it a **read-only informational modal** opened on demand; strip the controls that belong elsewhere.

## Source quotes
- Eric, 2026-06-26: "This sidebar should be an **informational modal window**. There is no need to **edit the data** in this window or **show original source** since the **compare function handles that**."
- Monica: "this end sidebar is really not useful … all **duplicated functions** … could be shown in a **modal window** … click a question mark on the side and see all of this."

## Decision
- Convert the pane to an on-demand modal (trigger: an "ⓘ" on the card).
- **Keep (read-only):** source heading, confidence, word count, classification ("Unknown — manual review"), AI rationale.
- **Remove:** `Place this item as`, `Reassign to a different (Std, Spec)` (placement lives on the card — Move text / Intro dropdown / kind badges / Approve), and `Show in source` (Compare shows the source).
- Delete the permanent sidebar; the cards/compare take the full width.

## Acceptance
- Review has no permanent right sidebar; an "ⓘ" opens a read-only modal with the kept fields.
- No edit/placement controls and no Show-in-source inside it.
- The content area is visibly wider (cards + compare fill the freed space).
- E2E: modal opens/closes; the removed controls are absent.

## Files affected
- `client/src/features/selfStudy/Editor/AIImport/review/ItemPreview.tsx` (the pane → modal)
- `client/src/features/selfStudy/Editor/AIImport/steps/ReviewStep.tsx` (layout width)

## Dependencies
- Pairs with [[cr-064-mode-aware-review-chrome]]. Placement still reachable on the card; ensure no placement capability is lost.

## Open questions
- Does any user rely on `Reassign` from the pane? It stays available via the card's reassign path — confirm parity.
