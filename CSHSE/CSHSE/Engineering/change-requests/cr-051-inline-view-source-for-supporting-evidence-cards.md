---
name: CR-051 — Inline "View source" on CV / Syllabus / Paper cards
description: Add an inline "View source" button on each standalone Supporting Evidence card (CV / Syllabus / Paper) in the Review step, mirroring the existing "Show in source" button that the right-pane preview already exposes.
type: change-request
cr_id: CR-051
status: proposed
priority: P2
source: user feedback 2026-05-30 (raised inline during Sprint 6 review)
sprint_target: Sprint 7
tags: [ai-import, review, ux-polish, evidence]
last_reviewed: 2026-05-30
---

# CR-051 — Inline "View source" on CV / Syllabus / Paper cards

## Summary

When the coordinator browses the CVs / Syllabi / Papers panels in the Review step today, each card shows the metadata + a `📂 Download .docx (pending Apply)` button. There is **no inline "View source" affordance on the card itself**. The capability exists in the right pane (the `CVPreview` / `EvidenceDocPreview` components render a "Show in source" button that opens `ShowInSourceModal`) but only AFTER the coordinator clicks the card to select it.

This adds the inline button on each card so the coordinator can open the source-document fragment in one click without first selecting the card and then hunting in the right pane.

## Source quotes

> "When viewing CVs, Syllabi and Papers, the view button is commented out. What sprint is this supposed to be in?" — user, 2026-05-30

For the record: there is no literal commented-out View button in the current tree. The CR-033 Phase 3 comment at `client/src/features/selfStudy/Editor/AIImport/review/ItemCardList.tsx:1517` describes a "placeholder 'View file' button" that ended up shipped as the `📂 Download .docx` button instead — a download, not an in-app source view. The user is reading "no inline View affordance on the card" and assuming it was removed; in fact the capability lives one click further into the UI.

## Decision

Render a small `🔍 View source` button on every CV / Syllabus / Paper card, next to (or in place of) the Download button when Download is still pending Apply. Clicking it dispatches the same handler the right pane uses today — `onShowInSource(sectionId)` — which opens `ShowInSourceModal` against the section's source HTML fragment.

Implementation: a 1-2 LOC addition in `ItemCardList.tsx` `CVsView` and `EvidenceDocsView`, plus wiring `onShowInSource` from `ReviewStep` down into both views (currently it's only wired into `ItemPreview`).

## Acceptance

- [ ] CV cards show a `🔍 View source` button inline next to (or in place of) Download.
- [ ] Syllabus + Paper cards show the same button.
- [ ] Click opens `ShowInSourceModal` against `sectionId`, scrolled to the source fragment — same behavior as today's right-pane button.
- [ ] Card click still selects the card and updates the right pane (existing behavior preserved); inline button uses `e.stopPropagation()` so the two affordances don't conflict.
- [ ] Visual: matches the existing card chrome — small text button, no extra row.

## Files affected

- `client/src/features/selfStudy/Editor/AIImport/review/ItemCardList.tsx` — `CVsView` + `EvidenceDocsView`
- `client/src/features/selfStudy/Editor/AIImport/steps/ReviewStep.tsx` — thread `handleShowInSource` into both views

## Dependencies

- [[cr-040-appendix-papers-as-supporting-evidence-files]] — same view components.
- `ShowInSourceModal` already supports any sectionId; no server-side work.

## Open questions

- Replace the Download button pre-Apply (since Download is disabled then) or sit beside it? Lean: sit beside it — pre-Apply gives View source as the only useful affordance; post-Apply both are useful.
