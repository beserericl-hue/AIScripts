---
name: CR-070 — Inline appendix upload at center-pane placeholders
description: Add an "Upload file for this spec" button directly on each appendix/import-reminder placeholder card, scoped to the right standard/spec, so appendices upload in place instead of bouncing to the Supporting File Library. Major time saver.
type: change-request
cr_id: CR-070
status: proposed
priority: P1
source: "[[monica-review-walkthrough-2026-06-26]] (image74/image79) · Eric 2026-06-26 (flagged HIGH VALUE / major time saver) · Eric 'have a button to load a file under this particular standard … do it from here rather than flip around to different screens' · Monica 'Exactly'"
sprint_target: Review De-noise (Sprint 2)
tags: [review-panel, evidence, upload, appendix, high-value, P1]
last_reviewed: 2026-06-26
---

# CR-070 — Inline appendix upload at center-pane placeholders

## Summary
The parser surfaces appendix/import-reminder **placeholder cards** in the center pane wherever the self-study points to an appendix. Uploading that appendix today means leaving Review for the Supporting File Library and re-associating by hand. Add an inline upload, already scoped to the spec. For a 424-page, many-appendix doc this removes the single biggest manual chore.

## Source quotes
- Eric, 2026-06-26 (flagged a **major time saver**): "have a **button to load a file under this particular standard** … **do it from here** rather than have to flip around to different screens." Monica: "**Exactly.**"

## Decision
- On each appendix-placeholder / import-reminder card, add an **"Upload file for this spec"** button that uploads via the existing evidence/file path used by the Supporting File Library, pre-scoped to the card's standard/spec.
- The uploaded file lands as that spec's supporting file (cataloged by specification), where the reader expects it — no second pass.
- Pairs with CR-068: the filtered "files/evidence" checklist lets the user walk all placeholders and upload them in one linear pass.

## Acceptance
- An appendix-placeholder card has an upload button; uploading attaches the file to the correct spec and it appears in that spec's supporting files (and Supporting File Library).
- No navigation away from Review required.
- E2E: upload at a placeholder → file present under that spec; reader can see it.

## Files affected
- `client/src/features/selfStudy/Editor/AIImport/review/ItemCardList.tsx` (placeholder card upload control)
- existing evidence/file upload service + `server` evidence routes (reuse, scoped by spec)

## Dependencies
- Pairs with [[cr-068-clickable-count-filters]]. Reuses the Supporting File Library upload path.

## Open questions
- Multiple files per placeholder? (allow ≥1.)
