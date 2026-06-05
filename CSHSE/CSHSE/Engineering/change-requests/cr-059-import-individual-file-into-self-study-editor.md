---
name: CR-059 — Import individual file into the Self-Study editor (standalone, replaces original editor)
description: Standalone "Import file" panel in the Self-Study editor (outside the AI Import Wizard) — drag/drop or browse one file, preview its parsed content, and copy/paste or insert a selected section into the active standard/sub-spec narrative OR route the file as supporting evidence. Replaces and removes the legacy per-standard "Import Document" editor from the settings panel.
type: change-request
cr_id: CR-059
status: shipped
priority: P1
source: user direction 2026-06-05 (PC needs to import one file + copy/paste its content into a chosen spec, outside the wizard — the pre-wizard importer did this; extract a subset and remove the original editor)
sprint_target: Sprint 11
tags: [self-study-editor, import, evidence, narrative, ux, legacy-removal]
last_reviewed: 2026-06-05
---

# CR-059 — Import individual file into the Self-Study editor (standalone, replaces original editor)

## Summary

While working in the Self-Study editor **outside the AI Import Wizard**, the PC needs to import a single file (a section draft, a CV, a syllabus, a project) and copy/paste — or insert — its content into the **exact** specification / sub-spec they have open, either as the standard's **narrative** or as **supporting evidence**. Before the AI wizard existed, the original "Import Document" editor did this. The wizard replaced the *bulk* flow but left a gap for the simple one-file case, and the legacy per-standard editor remains exposed behind a settings toggle (CR-045) that this CR removes.

This CR extracts a **subset** of the original importer into a single standalone "Import file" panel: drag/drop a file into a file window (or click to browse), read it into a document/preview window via the existing server parse path. The file itself is **auto-retained as an imported file** (a `SupportingEvidence` record) the moment it uploads — no separate "keep" step. The PC then selects a section of the parsed document and pastes that selected text as a **summary** into *either* (a) the active standard/sub-spec narrative, or (b) supporting evidence — the two paste targets are independent and non-exclusive. The new panel **replaces** the legacy "Import Document" editor, whose toolbar button and settings toggle are **removed**.

**Resolved design decisions (user direction, 2026-06-05):**
- The panel is reachable **even when no sub-spec is selected** — at standard level and on the Introduction surface. (See *Insert targets* below.)
- Section selection is **native browser text selection** over the rendered preview HTML (v1). A structured per-heading "insert this section" affordance is a possible follow-on, not in scope.
- The uploaded file is **always treated as an imported file** (auto-created `SupportingEvidence` on upload); there is no explicit "keep as evidence" gate. The two paste actions (into narrative / into supporting-evidence summary) are additive and independent.

## Source quotes

> "While in the Self-Study editor (OUTSIDE the AI Import Wizard), the PC needs to import an individual file and copy/paste its content into the exact specification/sub-spec — either as the standard's narrative OR as supporting evidence (a CV, syllabus, or project)." — user direction, 2026-06-05

> "We want to extract a SUBSET of the original importer: a panel that lets the user drag/drop a file into a file window (or click to open a directory/browse), reads that file into a document/preview window, and then lets the user copy/paste (or insert) a selected section of that document into the target specification window … This is a subset of the original editor and REPLACES the original editor functionality, which must be REMOVED from the settings panel." — user direction, 2026-06-05

## Decision

Build a single standalone panel, `ImportFilePanel`, mounted as a **right-side drawer** (`showImportFile`) that reuses the legacy importer's layout slot — it renders alongside whatever editor view is active, so the target narrative editor stays mounted and visible while the PC pastes into it. (Implemented as a drawer rather than a mutually-exclusive `activeView` precisely because a separate view would unmount the narrative editor, leaving nothing to paste into.) It reuses the **subset** of original-importer components that already exist — no new parsing, no new upload endpoint, no AI. It operates on **whatever standard/sub-spec is currently selected** (`selectedStandard` / `selectedSpec` in `SelfStudyEditor.tsx`), so "import into the exact spec" is implicit from editor state.

The panel has two columns:

**Left — File window (drag/drop + browse).** Reuse the drag/drop + click-to-browse affordance from `FileUpload.tsx` (`features/selfStudy/EvidenceManager/FileUpload.tsx`) — its `handleDragOver` / `handleDragLeave` / `handleDrop` handlers, hidden `fileInputRef`, `ALLOWED_TYPES`, and 50 MB cap. The file uploads via the existing `POST /api/submissions/:submissionId/evidence/upload` (one file; `standardCode` pre-filled from the current selection, `specCode` pre-filled when a sub-spec is active and left blank otherwise; `description` blank). **The uploaded file is auto-retained as an imported `SupportingEvidence` record** — this *is* "importing the file"; it immediately appears in the File Library. The returned `evidence._id` also drives the preview.

**Right — Document / preview window.** Reuse the parsed-document preview from `FilePreviewModal.tsx` (`features/selfStudy/FileLibrary/FilePreviewModal.tsx`), rendered **inline** (not as a modal). It fetches `GET /api/submissions/:submissionId/evidence/:evidenceId/preview`, which runs the real server parse path — `documentParserService.parsePDF` / `parseDOCX` in `server/src/services/documentParser.ts` (PDF via `pdfParse`, DOCX via `mammoth` with the heading-preserving styleMap) — and returns `{ previewable, contentType, html, summary }`. The HTML renders in the same `prose prose-sm` container the modal already uses.

**Selection + two paste targets.** The PC selects a range in the preview (native browser text selection over the rendered HTML — the panel reads `window.getSelection()` for the selected fragment, falling back to the full `preview.html` when nothing is selected). The selected text can be pasted into **either** destination (or both, in turn — they are independent, not mutually exclusive). Plain Ctrl/⌘-C → Ctrl/⌘-V from the preview into the narrative also works for free (CR-015's TipTap Link extension preserves pasted URLs); the two buttons are the one-click convenience over manual paste.

1. **Paste into narrative.** Inserts the selected HTML into the **active** narrative surface using the live TipTap editor already mounted in `NarrativeEditor.tsx`. Expose an imperative insert from `NarrativeEditor` (e.g. `editorRef.current.insertHtmlAtCursor(html)` calling `editor.chain().focus().insertContent(html).run()`), wired through the `NarrativeEditor` ↔ `SelfStudyEditor` boundary. Insertion fires the existing `onUpdate` → `triggerAutoSave(html)` path, which debounces and persists via `PATCH /api/submissions/:submissionId/narrative` with `{ standardCode, specCode, content }` (the existing `handleSave`). No new save endpoint.

2. **Paste as supporting-evidence summary.** Writes the selected text as the **summary/description** of the imported file's evidence record — i.e. a human-written blurb of what the document shows — via the existing `PATCH /api/submissions/:submissionId/evidence/:evidenceId` (`description`, plus a `tags: ['editor-import']` marker). The summary then renders against the file in the **File Library** (`FileLibrary.tsx`) and the per-spec `EvidencePanel.tsx`. No new model, no new endpoint — the same `SupportingEvidence` record auto-created on upload. (If the PC pastes a summary before the upload round-trips, the action queues until `evidence._id` is known.)

**Insert targets when no sub-spec is selected.** The panel is reachable at standard level and on the Introduction surface, so the *narrative* target adapts to the active editor view: a sub-spec → that spec's narrative; the Introduction view → the introduction editor (`IntroductionEditor.tsx` / `PATCH /api/submissions/:submissionId/introduction`); standard-level with no sub-spec → **Paste into narrative is disabled** (nothing to write to) while **Paste as supporting-evidence summary stays enabled** (the file attaches at standard level with `specCode` blank, matching `uploadEvidence`'s optional `specCode`).

**Remove the legacy editor.** Delete the legacy per-standard "Import Document" path that this panel replaces:
- The legacy toolbar button block (gated on `!hideLegacyImporter`) in `SelfStudyEditor.tsx` (lines ~2379–2395) and its `showImportModal` modal mount + state.
- The "Hide legacy importer" preference UI in the settings menu in `Layout.tsx` (lines ~320–342, the `hideLegacyImporter` checkbox under "Preferences").
- The now-dead `hideLegacyImporter` state in `SelfStudyEditor.tsx` (lines ~494–495). Leave the `user.preferences.hideLegacyImporter` field in `authStore.ts` deprecated-but-tolerated (read removed; field no longer written) to avoid a data migration.

The new "Import file" entry replaces the legacy button in the editor toolbar (in CR-045's `IMPORT` group, next to `Upload Files`), opening `activeView='import-file'`.

## Acceptance

- [ ] A new **Import file** button appears in the Self-Study editor toolbar (CR-045 `IMPORT` group); clicking it opens the `ImportFilePanel` view for the currently selected standard/sub-spec.
- [ ] The panel's left column accepts a file by **drag/drop** AND by **click-to-browse**; same `ALLOWED_TYPES` + 50 MB cap as `FileUpload.tsx`; invalid type/size is rejected client-side with a message.
- [ ] On drop/select, the file uploads via `POST /…/evidence/upload` (`standardCode` from the active selection, `specCode` when a sub-spec is active else blank); the file is **auto-retained** as a `SupportingEvidence` record and appears in the File Library without any explicit "keep" step; the returned `evidence._id` is used to render the preview.
- [ ] The right column renders the parsed document HTML from `GET /…/evidence/:id/preview` (PDF + DOCX) in a `prose prose-sm` window; unsupported types / >15 MB show the existing not-previewable message.
- [ ] **Paste into narrative**: with a text range selected in the preview, clicking the button places that HTML at the cursor in the active narrative surface; with no selection, the full document HTML is inserted. The insert triggers autosave → `PATCH /…/narrative`, and the content survives a page refresh.
- [ ] Pasting into spec **7.b** writes only to 7.b's narrative (not any other spec); switching specs and pasting writes to the newly selected spec.
- [ ] **Paste as supporting-evidence summary**: the selected text is written as the `description` of the imported file's evidence record via `PATCH /…/evidence/:id` and renders as the file's summary in both the File Library (`FileLibrary.tsx`) and the per-spec `EvidencePanel.tsx` without a page reload. The two paste actions are independent — using one does not consume or disable the other.
- [ ] **No sub-spec selected**: the panel still opens at standard level and on the Introduction surface. On the Introduction view, "Paste into narrative" targets the introduction editor. At standard level with no sub-spec, "Paste into narrative" is disabled while "Paste as supporting-evidence summary" remains enabled (file + summary attach with `specCode` blank).
- [ ] Selection is native browser text selection over the rendered preview (no structured per-heading picker in v1).
- [ ] The legacy "Import Document" toolbar button + its modal are **removed** from `SelfStudyEditor.tsx`; the "Hide legacy importer" preference is **removed** from the settings menu in `Layout.tsx`; the editor builds with no remaining reference to `hideLegacyImporter` or `showImportModal`.
- [ ] No AI matcher / wizard code is invoked by this panel (no `aiImportStore` run, no `/review/apply`).

## Files affected

- `client/src/features/selfStudy/Editor/ImportFilePanel.tsx` — **new**. Drawer: drag/drop + browse (top) reusing `FileUpload`'s upload contract; inline parsed preview reusing the `FilePreviewModal` fetch/render; `selectionchange` capture; "Paste into narrative" / "Paste as supporting-evidence summary" actions.
- `client/src/features/selfStudy/Editor/SelfStudyEditor.tsx` — `showImportFile` state + a right-side `ImportFilePanel` drawer (renders alongside the active editor view, reusing the legacy modal's slot); toolbar **Import file** button in the CR-045 `IMPORT` group; `narrativeInsertRef` / `docIntroInsertRef` wired to the editors via `onEditorReady`; **removed** the legacy "Import Document" toolbar button + `hideLegacyImporter`. (As-built: implemented as a drawer, not an `activeView`, so the narrative editor stays mounted to receive the paste. The legacy import modal's ~1000-line lifecycle is now unreachable and left inert — see Deferred below.)
- `client/src/features/selfStudy/Editor/NarrativeEditor.tsx` — `onEditorReady` callback hands the parent an imperative `insertHtml` (callback-registration, **not** `forwardRef`). `insertHtml` inserts AND calls `onSave(editor.getHTML())` immediately, so a paste persists even if an editor remount would otherwise cancel the debounced autosave.
- `client/src/features/selfStudy/Editor/IntroductionEditor.tsx` (CR-046) — same `onEditorReady`/`insertHtml`; insert calls `handleSave()` (this editor saves on blur), so the "Paste into narrative" target persists on the Introduction surface via `PATCH /…/introduction`.
- `client/src/components/Layout.tsx` — **remove** the "Hide legacy importer" preference block (~320–342) from the settings menu.
- `client/src/features/selfStudy/EvidenceManager/FileUpload.tsx` — extract/reuse the drag/drop + browse + validation logic (refactor into a shared hook or import directly); no behavior change to existing callers.
- `client/src/features/selfStudy/FileLibrary/FilePreviewModal.tsx` — allow inline (non-modal) rendering of the parsed-HTML preview (extract the preview body so the panel can reuse it without the modal chrome); existing modal callers unchanged.
- `client/src/store/authStore.ts` — `user.preferences.hideLegacyImporter` deprecated (no longer read/written); field left tolerated to avoid migration.

_No server changes._ Reuses existing `POST /…/evidence/upload`, `GET /…/evidence/:id/preview`, `PATCH /…/evidence/:id`, `PATCH /…/narrative`, and `documentParser.ts` — all already in production.

> **Note (verify-before-implement):** the line numbers above (`SelfStudyEditor.tsx` ~2379–2395 / ~494–495, `Layout.tsx` ~320–342) were captured from the codebase on 2026-06-05 and are approximate anchors; confirm them at implementation time, as files drift.

## Test plan

- **Server integration** (`server/tests/integration/`): the underlying endpoints already have coverage (`evidence-owner-access`, `cv-assign-packaging`, narrative save). Add `import-file-panel-endpoints.test.ts` only if a new thin endpoint is introduced; per this design, none is — so the integration surface is unchanged and re-run as a regression guard.
- **Playwright E2E** (`e2e/tests/`), seeded via `wizard_review_minimal` + SSO login, against the develop deploy:
  - `47_editor_import_file_dragdrop.spec.ts` — open the editor on a chosen sub-spec, drag/drop (and separately, browse) a fixture DOCX into the Import file panel; assert the parsed preview renders AND the file auto-appears in the File Library (no explicit keep).
  - `48_editor_import_paste_into_narrative.spec.ts` — select a range in the preview, click **Paste into narrative**, assert the active spec's `narrativeContent` contains the pasted text and survives a reload; assert a *different* spec is untouched.
  - `49_editor_import_paste_evidence_summary.spec.ts` — click **Paste as supporting-evidence summary**, assert the imported file's `description` (via `GET /…/evidence`) holds the selected text and the summary renders in the File Library / EvidencePanel without reload.
  - `50_editor_import_introduction_target.spec.ts` — reachable beyond a sub-spec: on the Introduction surface, "Paste into narrative" is enabled and persists to the document introduction (`PATCH /…/introduction`).
  - `51_legacy_importer_removed.spec.ts` — assert the legacy "Import Document" toolbar button is gone and the "Hide legacy importer" settings preference no longer renders; the new "Import file" button is present.

_All five specs pass on the live `develop` deploy (2026-06-05)._

## Deferred / related

- **Legacy importer dead-code deletion.** The legacy "Import Document" lifecycle (`showImportModal` + `importStep` state machine + its ~1000-line modal, `SelfStudyEditor.tsx`) is now **unreachable** (the trigger button and the settings toggle are removed) but left inert. Fully excising it (and the entangled `importStep` effects/handlers) is a separate low-risk cleanup, intentionally not bundled here to avoid destabilizing a feature that had to be E2E-proven.
- **Review-surface change-kind persistence (pre-existing, NOT fully fixed — needs its own CR).** While E2E-verifying persistence, spec `43_review_autosave` (Review-rail narrative→evidence kind flip surviving a reload) was found failing **deterministically on the live deploy**. It is in the Review surface (`aiImportStore` / `ReviewStep` / `ReviewSurface`), which CR-059 does **not** change logically (`git diff` confirms zero changes to that path) — but CR-059's larger client bundle shifted load timing enough to tip a latent race from passing to failing. Root cause: cards render instantly from the localStorage seed; the autosave is debounced 1.2s; a late `loadPersistedReviewState` GET clobbers the unsaved kind change back to the server copy, and the debounced autosave then re-saves that stale copy. Fixes attempted and their results: (a) a `dirty` clobber-guard in `loadPersistedReviewState` — **regressed** 39/40/41/44/45/46 (it skipped the essential initial load), reverted; (b) an immediate save in `handleChangeKind` — harmless (39–46 stay green) but **insufficient alone** (the load-clobber + debounced re-save still wins), kept as a defensive improvement. **A proper fix needs a dedicated CR** to redesign the Review autosave/load (e.g. drop the seed-vs-server clobber and flush pending writes on navigate). CR-059's own surface persists correctly (specs 47–51 green); the regression suite (39/40/41/44/45/46) is back to green.

## Rollout / risk

- **Risk: data migration.** None — no schema change; `hideLegacyImporter` is left tolerated.
- **Risk: regressing existing FileUpload / FilePreviewModal callers** during the refactor-to-reuse. Mitigation: extract via a shared hook / sub-component, leave existing call sites behaviorally unchanged, and rely on their current tests plus the new E2E.
- **Risk: removing the legacy editor strands a workflow.** Mitigation: this panel is a strict superset of the legacy single-file import; ship the panel and the removal in the **same** PR so there is never a gap.
- Feature is client-only and additive (plus a deletion) — safe to ship behind the normal develop → verify → main flow; no env/secret changes.

## Dependencies

- [[cr-045-self-study-editor-toolbar-workflow-alignment]] — this CR removes the "Hide legacy importer" preference CR-045 introduced and replaces the legacy button with the new **Import file** button in CR-045's `IMPORT` group.
- [[cr-015-narrative-hyperlink-preservation]] — pasted/inserted URLs in the narrative remain clickable (covers the copy/paste affordance).
- [[cr-040-appendix-papers-as-supporting-evidence-files]] — same `SupportingEvidence` model the "Keep as supporting evidence" action writes to; CVs / syllabi / projects land in the same File Library.

## Resolved decisions

_All three open questions were answered by the user on 2026-06-05 and are now locked into the Decision + Acceptance above._

- **Auto-import, not an explicit keep step.** Every uploaded file is treated as an imported file — a `SupportingEvidence` record is created on upload and shows in the File Library immediately. There is no "Keep as evidence" gate. Separately, the PC can paste selected text as a **summary** into either the narrative or the file's supporting-evidence description; the two paste targets are independent and non-exclusive. (Removing an unwanted import uses the existing `DELETE /…/evidence/:id`.)
- **Native text selection (v1).** Section selection is native browser selection over the rendered preview HTML. A structured per-heading "insert this section" picker is a possible follow-on, out of scope here.
- **Reachable with no sub-spec selected.** The panel opens at standard level and on the Introduction surface. The narrative paste target adapts (sub-spec narrative / introduction editor / disabled at bare standard level); the evidence-summary paste target stays available at standard level with `specCode` blank.
- **Second summary appends.** Pasting another summary onto the same imported file **appends** to the evidence `description` (separated by a blank line) rather than overwriting, matching how narrative inserts accumulate. The panel shows the current summary so the PC can see what is there before adding more.

## Open questions

- _None blocking — CR accepted for implementation 2026-06-05._
