---
name: CR-044 — Review screen typography parity with Self-Study Editor
description: The AI Importer Review screen's body text + card content renders at `text-xs` (~12px). The Self-Study Editor uses `prose prose-sm` (~14px). Coordinators flip between the two surfaces during the multi-author workflow; the size mismatch makes the Review screen feel cramped + unscannable next to the editor. Standardize the Review screen on the same `prose prose-sm` baseline so the eye doesn't have to re-calibrate.
type: change-request
cr_id: CR-044
status: shipped
priority: P2
source: User direction 2026-05-25 (annotated screenshot — Standard 1 / spec 1.a editor view marked "Correct Font size on this screen"; Review screen tile body text noticeably smaller)
sprint_target: Sprint 5 — paired with [[cr-043-decouple-review-from-wizard-persist-across-reimport]] since the new Review surface is the natural place to set the new baseline
tags: [wizard, review, typography, ux, accessibility]
last_reviewed: 2026-05-25
---

# CR-044 — Review screen typography parity with Self-Study Editor

## Shipped 2026-05-25

Tailwind class swaps across four files:

- `ItemCardList.tsx` — card body wraps in `prose prose-sm max-w-none`
  (matches the editor's NarrativeEditor baseline); displayLabel goes
  to `text-base font-semibold`; source-heading subline goes to
  `text-sm italic`. HTML-table cards keep their dense table chrome
  but the surrounding body inherits `prose-sm`.
- `ItemPreview.tsx` — header heading + source-heading both
  `text-base`; AI rationale body wraps in `prose prose-sm`.
- `StandaloneCVReview.tsx` — CV body preview moves from
  `font-mono text-[11px]` to `prose prose-sm max-w-none`. Preserves
  the whitespace-pre-wrap for the CV's pre-formatted layout.
- `MissingFragmentsView.tsx` — fragment body moves to
  `prose prose-sm`.

Card chrome (Edit / Discard / Approve / Reassign buttons; confidence
chips; word-count badges; source-file chips) unchanged. Coordinator
no longer re-calibrates flipping between Review tiles + the editor.

## Source

User, 2026-05-25, annotated screenshots:

> Screenshot 1 — Self-Study Editor, Standard 1 / Specification a in the
> NarrativeEditor surface, body text rendered at the editor's standard
> size. Annotation: **"Correct Font size on this screen."**
>
> Screenshot 2 — AI Importer Review screen. Tile body text noticeably
> smaller than the editor (`text-xs` vs `prose prose-sm`).

## What's broken

The Review screen's card text uses tiny utility classes — `text-xs`,
`text-sm` for chrome, italic sub-text at the same size — across:

- `ItemCardList.tsx` (the middle pane)
- `ItemPreview.tsx` (the right pane)
- `StandaloneCVReview.tsx` (CR-033 surface)
- `MissingFragmentsView.tsx` (CR-040 Phase 3b surface)

Body text on every card renders at ~12px. The Self-Study Editor's
`NarrativeEditor` uses `prose prose-sm` (~14px base, with Tailwind's
prose plugin applying line-height + paragraph spacing tuned for body
copy).

Coordinator workflow today:
1. Open Review, scan tiles, decide which to Approve / Discard / Edit.
2. Click into the Standards editor, read the existing narrative to
   compare against the AI's tile.
3. Eye re-calibrates because the editor body is bigger + has different
   line-height.
4. Click back to Review, eye re-calibrates again.

The eye-strain compounds across a 200-narrative Stevenson-style import.

## Decision

Set the Review surface's body baseline to **`prose prose-sm
max-w-none`** — same baseline the `NarrativeEditor` uses. Card chrome
(badges, action button labels, confidence + word counts) stays at
`text-xs` because it's metadata, not body copy.

Specifically:

| Element | Today | After |
|---|---|---|
| Card body (the snippet excerpt) | `text-xs` plain text | Wrap in `prose prose-sm max-w-none` |
| Card heading / displayLabel | `text-sm font-medium` | `text-base font-semibold` |
| Source heading (italic sub-text) | `text-xs italic` | `text-sm italic` |
| AI rationale (right pane) | `text-xs` | `text-sm` |
| Coverage / boundary banners | `text-xs` (status info) | unchanged (metadata) |
| Action button labels (Edit / Discard / Approve / Reassign) | `text-xs` | unchanged (controls) |
| Confidence + word-count chips | `text-xs` | unchanged (metadata) |
| Source-file chip (CR-041 US-6) | `text-[10px] font-mono` | unchanged (provenance) |

The rule: **body content (text the coordinator reads to decide) at
`prose prose-sm` parity with the editor; chrome + metadata stays
small.**

## Files affected

- `client/src/features/selfStudy/Editor/AIImport/review/ItemCardList.tsx`
  — card body wrapper + heading sizing.
- `client/src/features/selfStudy/Editor/AIImport/review/ItemPreview.tsx`
  — right-pane body + rationale.
- `client/src/features/selfStudy/Editor/AIImport/review/StandaloneCVReview.tsx`
  — single-CV body preview.
- `client/src/features/selfStudy/Editor/AIImport/review/MissingFragmentsView.tsx`
  — fragment snippet body.
- (After [[cr-043-decouple-review-from-wizard-persist-across-reimport]])
  `ReviewSurface.tsx` — same rules apply when Review is extracted from
  the wizard.

## Acceptance criteria

1. Standing in the Self-Study Editor on Standard 1 / spec 1.a, body
   text of the editor's NarrativeEditor renders at the prose-sm
   baseline (today's behavior).
2. Clicking into the Review surface, the AI's tile body renders at the
   SAME visual size + line-height as the editor body — the eye does
   not re-calibrate.
3. Coordinator can scan 5 tiles without needing to lean in.
4. Card chrome (Edit/Discard/Approve buttons, badges, confidence
   chips) stays at `text-xs` — visibly smaller than the body content.
   It's reference material, not the thing being read.
5. The same parity holds in the right-pane preview (the larger
   detail view of a selected card).
6. ItemPreview rationale text reads at `text-sm` — bigger than today,
   smaller than the body. Rationale is "supporting" content; body is
   primary.
7. The change is purely additive (Tailwind class swaps) — no layout
   regression in narrow viewports.

## Out of scope

- Custom font choices. Stays on the existing Tailwind body font.
- Dark mode. Existing color palette unchanged.
- Per-coordinator preference (font-size selector). The fix is global.

## Engineering size

XS — ~1-2 hours. Four files, mechanical Tailwind class swaps. No tests
needed (typography is visual; would need a Playwright snapshot test to
guard against drift, and we don't have those today). Manual eyeball
QA: open Review next to editor side-by-side, confirm parity.

## Risk

- Increasing the body size could push cards taller and reduce the
  number visible per scroll. Mitigation: confirm via eyeball that 3+
  cards still fit on a 1080p viewport, which is the realistic minimum.
- ProseMirror inherits `prose` styles when its container has them — if
  the Review card wraps the snippet in `prose prose-sm`, any HTML in
  the snippet (e.g. table cells from `htmlSnippet`) will inherit prose
  styling. Today the cards have ad-hoc styling on `htmlSnippet`-bearing
  tables; verify no conflict.

## Related

- [[cr-043-decouple-review-from-wizard-persist-across-reimport]] —
  ships the new Review surface. CR-044 applies to both the old
  wizard-embedded Review AND the new toolbar-Review.
- [[cr-032-inline-edit-review-cards]] — Edit pencil opens a textarea;
  the textarea should match the new body size so the edit experience
  matches the read experience.
