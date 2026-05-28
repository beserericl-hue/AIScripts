---
name: CR-046 — Make the Introduction editor discoverable in the Self-Study Editor
description: CR-039 Phase 2c already shipped a working Introduction editor (IntroductionEditor.tsx) + PATCH /api/submissions/:id/introduction endpoint + saveIntroduction controller — it reads/writes Submission.documentIntroduction and standardIntroductions. The bug is DISCOVERABILITY, not a missing feature: the editor only renders in the buried "Standard selected, no spec yet" sub-state, which a PC never lands in naturally. CR-046 surfaces the EXISTING editor via a discoverable `Introduction` button in CR-045's `SELF-STUDY` toolbar group + an `activeView='introduction'` branch. Reuse, do not rebuild.
type: change-request
cr_id: CR-046
status: accepted
priority: P1
source: User direction 2026-05-27 — "The Self Study editor is missing sections. It has the standards which is good. But does not have the document introduction which is now part of the import/review process. This needs to be corrected so that the data flows from review directly to the final editor."
sprint_target: Ships AFTER CR-045 (the new button lives in CR-045's `SELF-STUDY` group). Can ship same sprint.
tags: [ui, editor, introduction, discoverability, cr-039-followon]
last_reviewed: 2026-05-27
revision_history:
  - 2026-05-27 — initial draft (proposed) — assumed editor + endpoint did not exist
  - 2026-05-27 — accepted; both open questions resolved (Introduction button first in SELF-STUDY group; empty state is a blank editor with no helper copy)
  - 2026-05-27 — RESCOPED after code verification: the editor (IntroductionEditor.tsx), the route (submissions.ts:74), and the controller (submissionController.ts:305) ALREADY EXIST from CR-039 Phase 2c. The real defect is discoverability. Scope reduced from "build a new editor + endpoint" to "surface the existing editor via a toolbar button." Effort dropped ~2h20m → ~45m.
---

# CR-046 — Make the Introduction editor discoverable in the Self-Study Editor

## Status: ACCEPTED 2026-05-27 (rescoped)

> **Correction (2026-05-27):** the original draft of this CR assumed the
> introduction editor and its persistence endpoint did not exist, and
> proposed building both. **Code verification proved otherwise** — both
> shipped in [[cr-039-standard-introduction-buckets]] Phase 2c part 2.
> The actual defect is that the editor is rendered only in an
> undiscoverable sub-state. This CR is rescoped to a discoverability
> fix: reuse the existing editor, just give it a real entry point.

Open questions resolved 2026-05-27:

1. **Button position in `SELF-STUDY` group** — `Introduction` first (matches document order).
2. **Empty-state copy** — none. A blank editor invites the PC to type or paste.

## Source quote

User, 2026-05-27:

> "The Self Study editor is missing sections. It has the standards
> which is good. But does not have the document introduction which is
> now part of the import/review process. This needs to be corrected
> so that the data flows from review directly to the final editor."

## What the code actually shows (verification 2026-05-27)

The data flow `Review → Apply → Editor` is **already complete**:

| Layer | Status | Evidence |
|---|---|---|
| Schema | ✅ exists | `Submission.documentIntroduction?: string` + `standardIntroductions?: Map<string,string>` (`server/src/models/Submission.ts:154-155`) |
| Apply path writes it | ✅ exists | `aiImportController.ts:1346-1370` (from Review introduction items) |
| Editor component | ✅ exists | `client/src/features/selfStudy/Editor/IntroductionEditor.tsx` — reads `initialContent`, two scopes (`document` / `standard`) |
| Editor is mounted | ✅ exists | `SelfStudyEditor.tsx:2488` (document scope) + `:2495` (standard scope) |
| Save endpoint | ✅ exists | `PATCH /api/submissions/:id/introduction` (`submissions.ts:74`, behind `submissionLockout`) |
| Save controller | ✅ exists | `saveIntroduction` (`submissionController.ts:305`) — handles both scopes |

**So the introduction editor works and persists.** Nothing in the data
flow is broken.

## The actual problem — discoverability

The editor renders **only** in the else-branch at
`SelfStudyEditor.tsx:2481`: *when a coordinator has clicked a Standard
in the left nav but has NOT yet selected a Specification.* That is a
transient, accidental sub-state — a PC clicks a Standard and the UI
immediately auto-selects spec `a`, so they sail straight past the
window in which the introduction editor is visible. They never see it,
conclude the introduction is "missing," and report exactly that.

There is no top-level, persistent entry point to the introduction
editor. CR-046 adds one.

## Decision — surface the existing editor (reuse, do not rebuild)

Add a discoverable `Introduction` button to the `SELF-STUDY` toolbar
group (per [[cr-045-self-study-editor-toolbar-workflow-alignment]]'s
locked vocabulary), positioned **first** (document order):

```
SELF-STUDY
[Introduction] [Standards] [Curriculum Matrix] [Files]
```

Clicking it sets `activeView = 'introduction'` and renders the
**existing** `IntroductionEditor` (document scope) in the main pane —
the same component already mounted at `SelfStudyEditor.tsx:2488`, just
reachable on purpose instead of by accident. Per-Standard
introductions continue to render in their current location (when a
Standard is selected without a spec); making those equally
discoverable is deferred (see Out of scope).

No new component. No new endpoint. No schema change. The work is:
lift the existing `<IntroductionEditor scope="document">` out of the
buried sub-state into a first-class `activeView`, and add the toolbar
button that routes to it.

## Acceptance

**Client**
- `SELF-STUDY` toolbar group renders `Introduction` first, then `Standards` · `Curriculum Matrix` · `Files`.
- Clicking `Introduction` sets `activeView = 'introduction'`.
- The `'introduction'` view renders the existing `IntroductionEditor` with `scope="document"` and `initialContent={submission.documentIntroduction ?? ''}` — the same props already passed at `SelfStudyEditor.tsx:2488`.
- Edits save via the existing `PATCH /api/submissions/:id/introduction` (no new endpoint).
- Empty state: blank editor (toolbar + empty editable area), no helper copy.
- Read-only when `submission.status` is locked (the existing `readOnly={isReadOnly}` prop already handles this).
- After Apply commits an introduction from Review, clicking `Introduction` shows the text. Edits persist across refresh. (This already works via the existing wiring — the acceptance is that it's now reachable.)

**Tests**
- `client/src/features/selfStudy/Editor/SelfStudyEditor.test.tsx` — `Introduction` button appears in `SELF-STUDY` group; clicking sets `activeView='introduction'`; the introduction editor renders in the main pane (not just the buried sub-state); toolbar order is `Introduction` then `Standards`.
- `e2e/tests/34_introduction_round_trip.spec.ts` — seed a fixture with `documentIntroduction` populated; click the `Introduction` toolbar button; verify text renders; edit; refresh; verify persisted. (This becomes the `23_introduction.spec.ts` that CR-039 deferred — fold it in here.)

## Files affected

**Client (only)**
- `client/src/features/selfStudy/Editor/SelfStudyEditor.tsx` — add `'introduction'` to the `activeView` union; add the toolbar button to the `SELF-STUDY` group; add an `activeView === 'introduction'` branch that renders `<IntroductionEditor scope="document" .../>`. (The component + endpoint are reused as-is.)
- `client/src/features/selfStudy/Editor/SelfStudyEditor.test.tsx` — new test cases.
- `e2e/tests/34_introduction_round_trip.spec.ts` — **new** spec (also discharges CR-039's deferred `23_introduction.spec.ts`).

**Server** — none. The route + controller already exist.

## Dependencies

- [[cr-039-standard-introduction-buckets]] — **shipped**. Provides the editor component, the persistence endpoint, the controller, and the schema. CR-046 reuses all of it. CR-046 also discharges CR-039's deferred `23_introduction.spec.ts` E2E spec.
- [[cr-045-self-study-editor-toolbar-workflow-alignment]] — **accepted** 2026-05-27. The new `Introduction` button lives in the `SELF-STUDY` group this CR-045 defines. Ship CR-045 first, CR-046 immediately after.

## Effort estimate

| Task | Machine time |
|---|---|
| Toolbar button + `activeView='introduction'` branch in SelfStudyEditor.tsx | ~15 min |
| Component unit test cases | ~15 min |
| E2E round-trip spec (discharges CR-039's deferred spec) | ~15 min |
| **Total** | **~45 min** |

## Open questions

Both resolved 2026-05-27 (see top of page):

1. **Button position** — RESOLVED: `Introduction` first (document order).
2. **Empty-state copy** — RESOLVED: none; blank editor.

## Out of scope (deferred follow-on)

- **Per-Standard introduction discoverability.** The per-Standard
  `IntroductionEditor` (`SelfStudyEditor.tsx:2495`) still renders only
  in the "Standard selected, no spec" sub-state. Surfacing it equally
  (e.g., an "Introduction" row at the top of each Standard's spec
  list) is a separate, larger UX change. The document-level intro is
  the one the user called out; per-Standard discoverability is a
  follow-on.
- **Wizard-side "+ Add from source for this Introduction"** — the
  other piece CR-039 deferred. Separate CR.

## Reference

- Editor component: `client/src/features/selfStudy/Editor/IntroductionEditor.tsx`
- Mount points: `client/src/features/selfStudy/Editor/SelfStudyEditor.tsx:2488` (document) + `:2495` (standard); buried in the `:2481` else-branch.
- Save endpoint: `server/src/routes/submissions.ts:74` → `saveIntroduction` (`server/src/controllers/submissionController.ts:305`).
- Schema: `server/src/models/Submission.ts:154-155`.
