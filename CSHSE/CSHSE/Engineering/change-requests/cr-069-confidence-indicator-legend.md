---
name: CR-069 — Reconcile the status dot with confidence + add a legend
description: A 0.92-confidence card shows a red dot. The red/yellow/green dot (compliance/coverage) collides with the match-confidence number with no labels. Separate and label the two signals; add a legend.
type: change-request
cr_id: CR-069
status: proposed
priority: P1
source: "[[monica-review-walkthrough-2026-06-26]] (image59/image62) · Monica 'how do I interpret what red means … why is this red? Confidence is .92' · Eric 'it's not making sense to me … I'll find out why'"
sprint_target: Review De-noise (Sprint 2)
tags: [review-panel, indicators, confidence, ui, P1]
last_reviewed: 2026-06-26
---

# CR-069 — Reconcile the status dot with confidence + add a legend

## Summary
A card at **0.92 confidence (high)** shows a **red** dot. The dot (spec compliance/coverage) and the confidence number (matcher confidence) are two different signals shown side-by-side with no labels, so a high-confidence item looks "bad." Both Monica and Eric couldn't reconcile it.

## Source quotes
- Monica: "how do I interpret what **red** means? … **why is this red?** Confidence is **.92**."
- Eric: "it's **not making sense to me** … I'll find out why."

## Decision
- Decide and document what the dot represents (compliance/coverage vs match confidence) and make the two **distinct, separately labeled** signals.
- Add a **one-line legend** (red/yellow/green meaning) visible in Review.
- Ensure the dot and the confidence number can't contradict in a way that reads as a bug (e.g., label the dot "needs review / compliance" and the number "match confidence").

## Acceptance
- The dot's meaning is labeled; a legend is visible; a high-confidence item no longer looks contradictory.
- Definition documented in the wiki ([[ai-import]] / this CR).
- Manual: a 0.92 item's dot + number read consistently to a new user.

## Files affected
- `client/src/features/selfStudy/Editor/AIImport/review/ItemCardList.tsx` (rail dots + card)
- `client/src/features/selfStudy/Editor/AIImport/review/ItemPreview.tsx` (confidence display / modal per CR-065)

## Dependencies
- Confirm the source of the dot value (acceptState vs coverage) before relabeling.

## Open questions
- Should the dot reflect confidence directly, or stay coverage/compliance with a clearer label? (lean: keep coverage, label both.)
