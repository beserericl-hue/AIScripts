---
name: CR-032 — Inline text editing on Review-step cards
description: Coordinator can click a pencil on any narrative / evidence-text / tag card in the Review step, edit the text (delete sentences, add sentences, reword), and save. Edits are local until Apply and survive hard refresh via the existing dirty flag.
type: change-request
cr_id: CR-032
status: proposed
priority: P1
source: User observation 2026-05-22 — coordinator wants to trim/expand AI-extracted text before Apply rather than after
sprint_target: Sprint 3 polish
tags: [wizard, review, editing, ux, tiptap]
last_reviewed: 2026-05-22
---

# CR-032 — Inline text editing on Review-step cards

## Summary

The wizard's Review step shows the AI's extracted narratives + evidence + tag fragments verbatim. Coordinators tell us "the importer brought in too much text" — they want to trim, reword, or expand the extracted text BEFORE clicking Apply so it lands in the Self-Study Editor already cleaned up, rather than going through Apply and then having to edit it in the post-Apply Standards editor.

Today the only way to clean up extracted text is to:
1. Click Apply with the AI's text as-is.
2. Open the Self-Study Editor.
3. Navigate to each spec one by one.
4. Edit there.

That's slow + breaks the wizard's "review-then-commit" mental model. Coordinators want a pencil-icon edit on every text card in the Review step.

## Source quotes

User, 2026-05-22:

> "One more issue from the customer. They are saying that the importer brought in too much text and they want to edit it before they push it into the self study. Can we plan a CR that lets a user click an edit pencil in the text card in the importer so they can delete or add a sentence or change the wording. They feel that this will save them time later. Edit and save"

## Decision

Add a pencil-icon button to every text-bearing card in the Review step (narratives, evidence-text, tags — NOT file rows since those are external uploads, and NOT matrix cells since they're structured). Clicking opens an editor in the **right preview pane** (the same pane that today shows the AI's evaluation block — we replace the read-only display with an editable TipTap surface in edit mode).

### What exists today

- `ItemCardList.tsx` renders each item as a `<button>` card; clicking selects it and the `ItemPreview.tsx` right pane shows the full text + AI evaluation read-only.
- `BucketItem.snippet` (plain text) and `BucketItem.htmlSnippet` (preserved `<table>` HTML for table-derived items) are the storage shape on every card.
- TipTap is already in `client/package.json` — the Self-Study editor uses it post-Apply.

### What's new

#### Per-card pencil icon

In `ItemCardList.tsx`, every `KindSection` row gets a pencil button alongside the existing approval / kind-chip controls. Tooltip: "Edit this text before applying."

#### Edit mode in the right preview pane

Click pencil → `ItemPreview.tsx` flips into edit mode for THAT item:

- Header reads "Editing — {{heading}}"
- Body shows a TipTap editor pre-populated with the item's `snippet` (or `htmlSnippet` if it's table-bearing — TipTap handles `<table>` cleanly via the table extension already wired in for the standards editor).
- Toolbar: bold / italic / lists / undo / redo (same as the standards editor; reuse the existing `NarrativeEditor` component if possible).
- Footer: "Save" + "Cancel" buttons. "Revert to AI original" button if the item is already edited (see below).

#### Store mutation on Save

New action `editBucketItem(specKey, sectionId, kind, newText, newHtmlSnippet?)`:

- Finds the item in `buckets[specKey][kind]` by sectionId.
- Updates `snippet` (and `htmlSnippet` when applicable).
- Stamps an `editedAt: Date.now()` field.
- Preserves the original AI text in a new `originalSnippet?: string` field so a "Revert to AI original" button works.
- Sets `dirty: true` — survives hard refresh via the persist middleware (CR-029).

Similar action `editTag(tagId, newText)` for tags.

The new fields `originalSnippet` and `editedAt` are optional; legacy records stay valid.

#### Card visual indicator

Edited cards get a subtle "edited" badge so the coordinator can scan back through Review and see which ones they've touched. Click the badge → opens a tiny popover showing the original AI text + a one-click revert.

#### Apply uses the edited text

`apply()` already reads `buckets[].narratives[].snippet` (or `htmlSnippet`) and ships those values to the server. The store edits flow through unchanged — no API/server changes needed for the happy path.

### Optional: track edits as an audit signal

If we want to surface "how much the coordinator trusted the AI" for support / metrics, the server-side `applyAIImport` can record per-item `editedFromAIOriginal: boolean` on the resulting `SelfStudy.narratives` write. **Deferred to a follow-on CR** — not in scope for v1.

## Acceptance

- [ ] Every text-bearing card in `ItemCardList` (narratives, evidence-text, tags) has a pencil-icon button visible without selecting the card.
- [ ] Clicking the pencil opens edit mode in the right preview pane with a TipTap editor pre-populated with the item's text.
- [ ] Table-bearing items (htmlSnippet present) render in TipTap as an editable table; rows/columns can be edited.
- [ ] "Save" updates the local store; "Cancel" discards changes and returns to read-only preview.
- [ ] Edited cards show an "edited" badge in the rail/list view.
- [ ] "Revert to AI original" button is visible on edited cards and restores `originalSnippet`.
- [ ] Hard refresh after editing keeps the edit (CR-029 dirty flag carries the new fields).
- [ ] `apply()` posts the edited text — verify the resulting `Submission.narratives[std][spec].content` matches what the coordinator saved, not the AI's original.
- [ ] E2E: AI extracts 500-word narrative → coordinator edits down to 200 words → Save → Apply → Standards editor shows the 200-word version.

## Files affected

### Client

- `src/store/aiImportStore.ts`
  - Add `originalSnippet?: string`, `editedAt?: number` to `BucketItem`
  - Add `editBucketItem(specKey, sectionId, kind, newSnippet, newHtmlSnippet?)` action
  - Add `editTag(tagId, newText)` action
  - Add `revertBucketItem(specKey, sectionId, kind)` action
  - All three set `dirty: true`
  - `partialize` already includes `buckets` + `tags` — no change to persist config

- `src/features/selfStudy/Editor/AIImport/review/ItemCardList.tsx`
  - Pencil button on every KindSection row (skip file + matrix kinds)
  - "edited" badge when `editedAt` is set

- `src/features/selfStudy/Editor/AIImport/review/ItemPreview.tsx`
  - Two modes: read-only (existing) + edit (new)
  - Edit mode mounts TipTap with toolbar + save/cancel/revert
  - Reuse `NarrativeEditor` from the standards editor if possible; otherwise a small wrapper

- New helper or thin wrapper if NarrativeEditor isn't reusable as-is (probably is)

### Server

- None. The wizard's apply payload already carries the snippet text; the server doesn't care whether the AI or the coordinator wrote it.

### Tests

- Client unit: `editBucketItem` mutates the right list, preserves originalSnippet, sets dirty
- Client unit: `revertBucketItem` restores from originalSnippet
- E2E: edit a narrative → Save → Apply → check Submission.narratives matches the edit

## Dependencies

- CR-029 (dirty flag) — already shipped, gives us hard-refresh persistence for free
- Existing TipTap setup in the Standards editor — reuse, don't reimplement

## Open questions

- Should edits be allowed mid-parsing (status='parsing')? **Decision: no.** Only show the pencil when status is 'parsed' or later — earlier and the SSE snapshots might overwrite local state (mitigated by dirty flag but cleaner to disable the affordance).
- Per-card edit history (multiple undo steps across cards)? **Decision: no.** TipTap's own undo within the editor session is enough; cross-card history is overkill for v1.
- Word-count display in the editor toolbar? **Decision: yes, useful.** Coordinator can see they're trimming a 500-word card down to 200.
- Markdown source mode vs rich-text mode? **Decision: rich-text only.** Aligns with the post-Apply Standards editor; coordinators don't need to learn markdown for this surface.
- What happens to the matcher's `confidence` after an edit? **Decision: stays unchanged.** Confidence describes the AI's placement decision, not the text quality. The "edited" badge is sufficient signal that the text has been touched.
- Concurrent edits across two browser tabs of the same wizard run? **Out of scope.** Zustand persist is single-tab. Document the limitation; revisit if it becomes a real problem.

## Estimate

~2 engineer-days:

- Half a day: store actions + types + tests
- Half a day: pencil icon + edited badge on cards
- One day: edit mode in ItemPreview (TipTap mount, save/cancel/revert wiring, polish, E2E)

## Rollout

Vault doc only at the moment. Implementation queued for Sprint 3 polish next to CR-027 (stale-error fix) and CR-031 (already shipped). No schema migration. No new API endpoints. No AI cost.
