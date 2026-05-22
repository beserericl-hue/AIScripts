---
name: CR-032 — Inline text editing on Review-step cards
description: Coordinator can click a pencil on any narrative / evidence-text / tag card in the Review step, edit the text in a plain textarea (delete sentences, add sentences, reword), and save. No formatting — rich formatting belongs in the post-Apply Standards editor.
type: change-request
cr_id: CR-032
status: shipped
priority: P1
source: User observation 2026-05-22 — coordinator wants to trim/expand AI-extracted text before Apply rather than after
sprint_target: Sprint 3 polish
tags: [wizard, review, editing, ux, textarea]
last_reviewed: 2026-05-22
---

# CR-032 — Inline text editing on Review-step cards

## Summary

The wizard's Review step shows the AI's extracted narratives + evidence + tag fragments verbatim. Coordinators tell us "the importer brought in too much text" — they want to trim or reword BEFORE clicking Apply so it lands in the Self-Study Editor already cleaned up, rather than going through Apply and then having to edit it in the post-Apply Standards editor.

Today the only way to clean up extracted text is to:
1. Click Apply with the AI's text as-is.
2. Open the Self-Study Editor.
3. Navigate to each spec one by one.
4. Edit there.

That's slow + breaks the wizard's "review-then-commit" mental model. Coordinators want a pencil-icon edit on every text card in the Review step.

## Source quotes

User, 2026-05-22:

> "One more issue from the customer. They are saying that the importer brought in too much text and they want to edit it before they push it into the self study. Can we plan a CR that lets a user click an edit pencil in the text card in the importer so they can delete or add a sentence or change the wording. They feel that this will save them time later. Edit and save"

User direction on editor choice, 2026-05-22:

> "2 is simple, they want to delete text basically or add. They can format stuff in the self study editor."

## Decision

Add a pencil-icon button to every text-bearing card in the Review step (narratives, evidence-text, tags — NOT file rows since those are external uploads, and NOT matrix cells since they're structured). Clicking opens a **plain `<textarea>`** in the right preview pane (the same pane that today shows the AI's evaluation block).

**Plain textarea, not rich text.** Coordinators want to delete sentences and add sentences. Rich formatting (bold, italic, links, tables) belongs in the post-Apply Standards editor — that's where the final document gets polished. Keeping the wizard editor as a plain textarea:

- Dead-simple UX. No toolbar to learn.
- Loads instantly. No TipTap mount.
- Matches the user's mental model: "trim what the AI pulled in, then polish it later."

### What exists today

- `ItemCardList.tsx` renders each item as a `<button>` card; clicking selects it and the `ItemPreview.tsx` right pane shows the full text + AI evaluation read-only.
- `BucketItem.snippet` (plain text) and `BucketItem.htmlSnippet` (preserved `<table>` HTML for table-derived items) are the storage shape on every card.

### What's new

#### Per-card pencil icon

In `ItemCardList.tsx`, every KindSection row gets a pencil button alongside the existing approval / kind-chip controls. Tooltip: "Edit this text before applying."

**Disabled with a tooltip when `htmlSnippet` is present** (table-bearing items): "This item contains a table — edit it in the Standards editor after Apply." Plain-text editing of an HTML table in a textarea would corrupt the structure; we route those edits through the post-Apply path where TipTap's table extension is mounted.

#### Edit mode in the right preview pane

Click pencil → `ItemPreview.tsx` flips into edit mode for THAT item:

- Header reads "Editing — {{heading}}"
- Body: a `<textarea>` pre-populated with the item's `snippet`. Auto-resizes to content height. Monospace optional (probably no — proportional reads better for prose).
- Word count visible below the textarea ("214 words" — updates live).
- Footer buttons: "Save" + "Cancel" + "Revert to AI original" (the third only when the item is already edited).

#### Store mutation on Save

New action `editBucketItem(specKey, sectionId, kind, newText)`:

- Finds the item in `buckets[specKey][kind]` by sectionId.
- Updates `snippet`.
- Stamps an `editedAt: Date.now()` field.
- Preserves the original AI text in a new `originalSnippet?: string` field so the "Revert to AI original" button works.
- Sets `dirty: true` — survives hard refresh via the persist middleware (CR-029).

Similar action `editTag(tagId, newText)` for tags.

The new fields `originalSnippet` and `editedAt` are optional; legacy records stay valid.

#### Card visual indicator

Edited cards get a subtle "edited" badge so the coordinator can scan back through Review and see which ones they've touched.

#### Apply uses the edited text

`apply()` already reads `buckets[].narratives[].snippet` and ships those values to the server. The store edits flow through unchanged — no API/server changes needed.

## Acceptance

- [ ] Every text-bearing card in `ItemCardList` (narratives, evidence-text, tags) has a pencil-icon button visible without selecting the card.
- [ ] The pencil is **disabled** with a tooltip on cards whose `htmlSnippet` is non-null (table-bearing items).
- [ ] Clicking the pencil opens edit mode in the right preview pane with a `<textarea>` pre-populated with the item's text.
- [ ] Word count updates live as the coordinator types.
- [ ] "Save" updates the local store; "Cancel" discards changes and returns to read-only preview.
- [ ] Edited cards show an "edited" badge in the list view.
- [ ] "Revert to AI original" button visible on edited cards; restores `originalSnippet`.
- [ ] Hard refresh after editing keeps the edit (CR-029 dirty flag).
- [ ] `apply()` posts the edited text — verify the resulting `Submission.narratives[std][spec].content` matches what the coordinator saved.
- [ ] E2E: AI extracts 500-word narrative → coordinator edits down to 200 words → Save → Apply → Standards editor shows the 200-word version.

## Files affected

### Client

- `src/store/aiImportStore.ts`
  - Add `originalSnippet?: string`, `editedAt?: number` to `BucketItem` and `Tag`
  - Add `editBucketItem(specKey, sectionId, kind, newSnippet)` action
  - Add `editTag(tagId, newText)` action
  - Add `revertBucketItem(specKey, sectionId, kind)` + `revertTag(tagId)` actions
  - All set `dirty: true`
  - `partialize` already includes `buckets` + `tags` — no change to persist config

- `src/features/selfStudy/Editor/AIImport/review/ItemCardList.tsx`
  - Pencil button on every KindSection row (skip file + matrix kinds; disable when htmlSnippet present)
  - "edited" badge when `editedAt` is set

- `src/features/selfStudy/Editor/AIImport/review/ItemPreview.tsx`
  - Two modes: read-only (existing) + edit (new)
  - Edit mode mounts a controlled `<textarea>` with save/cancel/revert + live word count
  - No new dependencies; just React + the existing api client (which we don't even need here)

### Server

- None. The wizard's apply payload already carries the snippet text; the server doesn't care whether the AI or the coordinator wrote it.

### Tests

- Client unit: `editBucketItem` mutates the right list, preserves originalSnippet, sets dirty
- Client unit: `revertBucketItem` restores from originalSnippet
- Client unit: pencil disabled when htmlSnippet present
- E2E: edit a narrative → Save → Apply → check Submission.narratives matches the edit

## Dependencies

- CR-029 (dirty flag) — already shipped, gives us hard-refresh persistence for free
- **No TipTap dependency.** Plain textarea only. Rich-text editing happens in the post-Apply Standards editor.

## Open questions

- Should edits be allowed mid-parsing (status='parsing')? **Decision: no.** Only show the pencil when status is 'parsed' or later — earlier and SSE snapshots could overwrite local state (mitigated by dirty flag but cleaner to disable the affordance).
- Per-card edit history (multiple undo steps across cards)? **Decision: no.** Browser-native `undo` inside the textarea is enough for the active edit session.
- Word-count display? **Decision: yes**, live under the textarea ("214 words"). Helps coordinator see they're trimming 500 → 200.
- Markdown source mode? **Decision: no.** Plain text only. No special syntax interpretation.
- What happens to the matcher's `confidence` after an edit? **Decision: stays unchanged.** Confidence describes the AI's placement decision, not the text quality. The "edited" badge is sufficient signal.
- Table-bearing items (htmlSnippet present)? **Decision: pencil disabled with tooltip.** Editing a flat textarea version of an HTML table corrupts structure; route those through the Standards editor post-Apply where TipTap's table extension is mounted.
- Concurrent edits across two browser tabs? **Out of scope.** Zustand persist is single-tab. Document the limitation; revisit if reported.

## Estimate

~1 engineer-day (down from 2 — textarea is much less work than TipTap):

- 2 hours: store actions + types + unit tests
- 2 hours: pencil icon + disabled-state-on-tables + edited badge on cards
- 3 hours: edit mode in ItemPreview (textarea, save/cancel/revert, word count, polish)
- 1 hour: E2E test

## Rollout

Vault doc only at the moment. Implementation queued for Sprint 3 polish. No schema migration. No new API endpoints. No AI cost. No new client dependencies.
