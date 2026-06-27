---
name: CR-064 — Mode-aware Review chrome (strip the noise)
description: The Review screen shows the entire app workflow at once. Show only Review-relevant controls; remove Validate/Submit/workflow-tabs/Next-Apply/Back-to-editor; move Report-issue + Help out of the work area; consistent approve(review)/validate(self-study) terminology.
type: change-request
cr_id: CR-064
status: proposed
priority: P1
source: "[[monica-review-walkthrough-2026-06-26]] (image59) · Monica 'just give me buttons for the editor, nothing else' · Eric 2026-06-26 'Back to editor is confusing and redundant'"
sprint_target: Review De-noise (Sprint 2)
tags: [review-panel, ui, usability, de-noise, P1]
last_reviewed: 2026-06-26
---

# CR-064 — Mode-aware Review chrome (strip the noise)

## Summary
The Review screen renders the whole workflow simultaneously — top tabs, `Validate All`, `0/21 Standards`, `0/83 Validated`, `Submit Self-Study`, `Next: Apply`, `Back`, `Back to editor`, `Re-run detectors`, `Filter by source`. Monica doesn't recognize most ("I don't know what that means"). Show only what Review needs.

## Source quotes
- Monica: "If I am in the editor mode, **just give me buttons for the editor, nothing else**." "Only buttons pertaining to that mode should be there. And lots of editing space."
- Eric, 2026-06-26: "**Back to editor** button is confusing and redundant — the navigation already provided" (top tabs).
- Monica: "**Validate** only happens in the self-study, not in the editor. In the editor it's **approved** — the language you're using is different."

## Decision
- In Review, **hide**: `Validate All`, `0/21 Standards`, `0/83 Validated`, `Submit Self-Study`, the non-Review workflow tabs, `Next: Apply`, `Back`, and `Back to editor` (redundant with the top tabs).
- Show `Filter by source` only when >1 source; move `Re-run detectors` into an overflow menu.
- **Move `Report issue` + `?` Help to the top header**, out of the editing/work area.
- **Terminology:** "approve" in Review only; never show "validate" in Review.

## Acceptance
- Review shows only: spec rail, cards, Compare, Approve, the spec-level approve (CR-066), and an autosave indicator. No Validate/Submit/Back-to-editor/workflow-tabs.
- `Report issue` + Help are in the header, not overlapping the cards/editor.
- E2E asserts the removed controls are absent in Review and present in Self-Study.
- Manual: Monica-style pass confirms the screen reads as "just Review."

## Files affected
- `client/src/features/selfStudy/Editor/AIImport/steps/ReviewStep.tsx`
- `client/src/features/selfStudy/Editor/Review/ReviewSurface.tsx`
- `client/src/features/selfStudy/Editor/SelfStudyEditor.tsx` (mode-conditional toolbar), `components/OverflowNav.tsx`

## Dependencies
- Pairs with [[cr-065-ai-eval-modal]] (reclaims the right pane) and [[cr-066-approve-specification-rename]]. Sibling self-study de-noise: [[cr-071-self-study-editor-munge-and-denoise]].

## Open questions
- Hide-conditionally vs split Review into its own minimal screen? (Eric to decide — split is cleaner, bigger change.)
