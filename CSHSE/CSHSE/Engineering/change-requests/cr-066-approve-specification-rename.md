---
name: CR-066 — Clarify the spec-level approve action
description: "Approve This Subspecification" is confusing. Intended behavior — approve every visible item for the current Specification and move them all to the Self-Study editor. Rename to clear, outcome-revealing wording; use correct Standard→Specification terms.
type: change-request
cr_id: CR-066
status: proposed
priority: P1
source: "[[monica-review-walkthrough-2026-06-26]] · Eric 2026-06-26 'Approve this subspec is very confusing … the entire visible specification … is approved and moved to the self study editor'"
sprint_target: Review De-noise (Sprint 2)
tags: [review-panel, ui, approve, terminology, P1]
last_reviewed: 2026-06-26
---

# CR-066 — Clarify the spec-level approve action

## Summary
Two approve actions exist; both must be unmistakable. The spec-level button currently reads "Approve This Subspecification" — wrong term and it hides the move-to-editor outcome.

## Source quotes
- Eric, 2026-06-26: "Approve this subspec is **very confusing**. What is supposed to happen is that **the entire visible specification** — spec1, spec2, etc if shown — **is approved and moved to the self study editor**."

## Decision
- **Card "Approve"** = approve that one item → move it to the Self-Study editor.
- **Spec-level button** = approve **every visible item for the currently-shown Specification** (all cards in the middle pane, e.g. 1.a's #1/#2/…) → move them all to the Self-Study editor in one click. (Behavior already scoped to the visible spec in `cc7f79b`; this CR fixes the label + makes the outcome explicit.)
- **Rename** to e.g. **"Approve this specification → editor"** (or "Approve all shown → editor"). Drop "subspecification" — 1.a IS the *Specification* (hierarchy: Standard → Specification).

## Acceptance
- The button label names the Specification and states it moves to the editor; "subspecification" is gone.
- Clicking it approves all visible cards for the current spec and they appear under that spec in the Self-Study editor.
- E2E asserts: N visible items → N approved + materialized to the editor for that spec; other specs untouched.

## Files affected
- `client/src/features/selfStudy/Editor/AIImport/review/ItemCardList.tsx` (label + tooltip)
- (verify) `ReviewStep.tsx` approveAll handler scopes to the active spec.

## Dependencies
- Independent; pairs with the de-noise CRs.

## Open questions
- Exact wording — confirm "Approve this specification → editor" with Eric.
