---
name: CR-059 — Import individual file into the Self-Study editor (standalone, replaces original editor)
description: Standalone "Import file" panel in the Self-Study editor (outside the AI Import Wizard) — drag/drop or browse one file, preview its parsed content, and copy/paste or insert a selected section into the active standard/sub-spec narrative OR route the file as supporting evidence. Replaces and removes the legacy per-standard "Import Document" editor from the settings panel.
type: change-request
cr_id: CR-059
status: proposed
priority: P1
source: user direction 2026-06-05 (PC needs to import one file + copy/paste its content into a chosen spec, outside the wizard — the pre-wizard importer did this; extract a subset and remove the original editor)
sprint_target: Sprint 11
tags: [self-study-editor, import, evidence, narrative, ux, legacy-removal]
last_reviewed: 2026-06-05
---

# CR-059 — Import individual file into the Self-Study editor (standalone, replaces original editor)

## Summary

While working in the Self-Study editor **outside the AI Import Wizard**, the PC needs to import a single file (a section draft, a CV, a syllabus, a project) and copy/paste — or insert — its content into the **exact** specification / sub-spec they have open, either as the standard's **narrative** or as **supporting evidence**. Before the AI wizard existed, the original "Import Document" editor did this. The wizard replaced the *bulk* flow but left a gap for the simple one-file case, and the legacy per-standard editor remains exposed behind a settings toggle (CR-045) that this CR removes.

This CR extracts a **subset** of the original importer into a single standalone "Import file" panel: drag/drop a file into a file window (or click to browse), read it into a document/preview window via the existing server parse path, then let the PC select a section and **copy/paste it OR insert it** into (a) the active standard/sub-spec narrative via the live TipTap editor, or (b) supporting evidence via the existing evidence-create endpoint. The new panel **replaces** the legacy "Import Document" editor, whose toolbar button and settings toggle are **removed**.

## Source quotes

> "While in the Self-Study editor (OUTSIDE the AI Import Wizard), the PC needs to import an individual file and copy/paste its content into the exact specification/sub-spec — either as the standard's narrative OR as supporting evidence (a CV, syllabus, or project)." — user direction, 2026-06-05

> "We want to extract a SUBSET of the original importer: a panel that lets the user drag/drop a file into a file window (or click to open a directory/browse), reads that file into a document/preview window, and then lets the user copy/paste (or insert) a selected section of that document into the target specification window … This is a subset of the original editor and REPLACES the original editor functionality, which must be REMOVED from the settings panel." — user direction, 2026-06-05

## Decision

Build a single standalone panel, `ImportFilePanel`, mounted as a Self-Study editor view (peer of `files` / `introduction` / `review-surface`). It reuses the **subset** of original-importer components that already exist — no new parsing, no new upload endpoint, no AI. It operates on **whatever standard/sub-spec is currently selected** (`selectedStandard` / `selectedSpec` in `SelfStudyEditor.tsx`), so "import into the exact spec" is implicit from editor state.

The panel has two columns:

**Left — File window (drag/drop + browse).** Reuse the drag/drop + click-to-browse affordance from `FileUpload.tsx` (`features/selfStudy/EvidenceManager/FileUpload.tsx`) — its `handleDragOver` / `handleDragLeave` / `handleDrop` handlers, hidden `fileInputRef`, `ALLOWED_TYPES`, and 50 MB cap. The file uploads via the existing `POST /api/submissions/:submissionId/evidence/upload` (one file; `standardCode`/`specCode` pre-filled from the current selection; `description` blank). On success the returned `evidence._id` drives the preview.

**Right — Document / preview window.** Reuse the parsed-document preview from `FilePreviewModal.tsx` (`features/selfStudy/FileLibrary/FilePreviewModal.tsx`), rendered **inline** (not as a modal). It fetches `GET /api/submissions/:submissionId/evidence/:evidenceId/preview`, which runs the real server parse path — `documentParserService.parsePDF` / `parseDOCX` in `server/src/services/documentParser.ts` (PDF via `pdfParse`, DOCX via `mammoth` with the heading-preserving styleMap) — and returns `{ previewable, contentType, html, summary }`. The HTML renders in the same `prose prose-sm` container the modal already uses.

**Selection + two actions.** The PC selects a range in the preview (native browser text selection over the rendered HTML; the panel reads `window.getSelection()` for the selected fragment, falling back to the full `preview.html` when nothing is selected). Two action buttons:

1. **Insert into narrative.** Inserts the selected HTML into the **active** standard/sub-spec narrative using the live TipTap editor already mounted in `NarrativeEditor.tsx`. Expose an imperative insert from `NarrativeEditor` (e.g. `editorRef.current.insertHtmlAtCursor(html)` calling `editor.chain().focus().insertContent(html).run()`), wired up through the `NarrativeEditor` ↔ `SelfStudyEditor` boundary. Insertion fires the existing `onUpdate` → `triggerAutoSave(html)` path, which debounces and persists via `PATCH /api/submissions/:submissionId/narrative` with `{ standardCode, specCode, content }` (the existing `handleSave`). No new save endpoint. (Plain copy/paste from the preview into the editor continues to work for free — CR-015's TipTap Link extension preserves pasted URLs — so "Insert" is the one-click convenience over manual paste.)

2. **Keep as supporting evidence.** The file is *already* uploaded (step above created a `SupportingEvidence` record via `uploadEvidence`), linked to the current `standardCode`/`specCode`. This button simply confirms/keeps it as evidence (optionally setting `description` and a `tags: ['editor-import']` marker via the existing `PATCH /api/submissions/:submissionId/evidence/:evidenceId`), then refreshes the evidence list so it appears in the **File Library** (`FileLibrary.tsx`) and the per-spec `EvidencePanel.tsx`. No new model, no new endpoint — this is the same `SupportingEvidence` create/list flow the AI Apply path and `FileUpload` already use.

**Remove the legacy editor.** Delete the legacy per-standard "Import Document" path that this panel replaces:
- The legacy toolbar button block (gated on `!hideLegacyImporter`) in `SelfStudyEditor.tsx` (lines ~2379–2395) and its `showImportModal` modal mount + state.
- The "Hide legacy importer" preference UI in the settings menu in `Layout.tsx` (lines ~320–342, the `hideLegacyImporter` checkbox under "Preferences").
- The now-dead `hideLegacyImporter` state in `SelfStudyEditor.tsx` (lines ~494–495). Leave the `user.preferences.hideLegacyImporter` field in `authStore.ts` deprecated-but-tolerated (read removed; field no longer written) to avoid a data migration.

The new "Import file" entry replaces the legacy button in the editor toolbar (in CR-045's `IMPORT` group, next to `Upload Files`), opening `activeView='import-file'`.

## Acceptance

- [ ] A new **Import file** button appears in the Self-Study editor toolbar (CR-045 `IMPORT` group); clicking it opens the `ImportFilePanel` view for the currently selected standard/sub-spec.
- [ ] The panel's left column accepts a file by **drag/drop** AND by **click-to-browse**; same `ALLOWED_TYPES` + 50 MB cap as `FileUpload.tsx`; invalid type/size is rejected client-side with a message.
- [ ] On drop/select, the file uploads via `POST /…/evidence/upload` with `standardCode`/`specCode` pre-filled from the active selection; the returned `evidence._id` is used to render the preview.
- [ ] The right column renders the parsed document HTML from `GET /…/evidence/:id/preview` (PDF + DOCX) in a `prose prose-sm` window; unsupported types / >15 MB show the existing not-previewable message.
- [ ] **Insert into narrative**: with a text range selected in the preview, clicking Insert places that HTML at the cursor in the active standard/sub-spec narrative; with no selection, the full document HTML is inserted. The insert triggers autosave → `PATCH /…/narrative`, and the content survives a page refresh.
- [ ] Inserting into spec **7.b** writes only to 7.b's narrative (not any other spec); switching specs and inserting writes to the newly selected spec.
- [ ] **Keep as supporting evidence**: the uploaded file is retained as a `SupportingEvidence` record linked to the active `standardCode`/`specCode` and then appears in both the File Library (`FileLibrary.tsx`) and the per-spec `EvidencePanel.tsx` without a page reload.
- [ ] The legacy "Import Document" toolbar button + its modal are **removed** from `SelfStudyEditor.tsx`; the "Hide legacy importer" preference is **removed** from the settings menu in `Layout.tsx`; the editor builds with no remaining reference to `hideLegacyImporter` or `showImportModal`.
- [ ] No AI matcher / wizard code is invoked by this panel (no `aiImportStore` run, no `/review/apply`).

## Files affected

- `client/src/features/selfStudy/Editor/ImportFilePanel.tsx` — **new**. Two-column panel: drag/drop + browse (left) reusing `FileUpload` upload logic; inline parsed preview (right) reusing `FilePreviewModal` render; selection capture + "Insert into narrative" / "Keep as supporting evidence" actions.
- `client/src/features/selfStudy/Editor/SelfStudyEditor.tsx` — add `activeView='import-file'` branch + mount `ImportFilePanel`; add toolbar **Import file** button in the CR-045 `IMPORT` group; thread `selectedStandard`/`selectedSpec` + a `narrativeEditorRef` (imperative insert) into the panel; **remove** legacy `!hideLegacyImporter` button block (~2379–2395), `showImportModal` modal + state, and `hideLegacyImporter` state (~494–495).
- `client/src/features/selfStudy/Editor/NarrativeEditor.tsx` — expose imperative `insertHtmlAtCursor(html)` via `forwardRef`/`useImperativeHandle`, calling `editor.chain().focus().insertContent(html).run()`; existing `onUpdate` → `triggerAutoSave` path persists it.
- `client/src/components/Layout.tsx` — **remove** the "Hide legacy importer" preference block (~320–342) from the settings menu.
- `client/src/features/selfStudy/EvidenceManager/FileUpload.tsx` — extract/reuse the drag/drop + browse + validation logic (refactor into a shared hook or import directly); no behavior change to existing callers.
- `client/src/features/selfStudy/FileLibrary/FilePreviewModal.tsx` — allow inline (non-modal) rendering of the parsed-HTML preview (extract the preview body so the panel can reuse it without the modal chrome); existing modal callers unchanged.
- `client/src/store/authStore.ts` — `user.preferences.hideLegacyImporter` deprecated (no longer read/written); field left tolerated to avoid migration.

_No server changes._ Reuses existing `POST /…/evidence/upload`, `GET /…/evidence/:id/preview`, `PATCH /…/evidence/:id`, `PATCH /…/narrative`, and `documentParser.ts` — all already in production.

> **Note (verify-before-implement):** the line numbers above (`SelfStudyEditor.tsx` ~2379–2395 / ~494–495, `Layout.tsx` ~320–342) were captured from the codebase on 2026-06-05 and are approximate anchors; confirm them at implementation time, as files drift.

## Test plan

- **Server integration** (`server/tests/integration/`): the underlying endpoints already have coverage (`evidence-owner-access`, `cv-assign-packaging`, narrative save). Add `import-file-panel-endpoints.test.ts` only if a new thin endpoint is introduced; per this design, none is — so the integration surface is unchanged and re-run as a regression guard.
- **Playwright E2E** (`e2e/tests/`), seeded via `wizard_review_minimal` + SSO login, against the develop deploy:
  - `47_editor_import_file_dragdrop.spec.ts` — open the editor on a chosen sub-spec, drag/drop (and separately, browse) a fixture DOCX into the Import file panel, assert the parsed preview renders.
  - `48_editor_import_insert_into_narrative.spec.ts` — select a range in the preview, click **Insert into narrative**, assert the active spec's `narrativeContent` contains the inserted text and survives a reload; assert a *different* spec is untouched.
  - `49_editor_import_keep_as_evidence.spec.ts` — click **Keep as supporting evidence**, assert the file appears via `GET /…/evidence` and in the File Library view without reload.
  - `50_legacy_importer_removed.spec.ts` — assert the legacy "Import Document" toolbar button is gone and the "Hide legacy importer" settings preference no longer renders.

## Rollout / risk

- **Risk: data migration.** None — no schema change; `hideLegacyImporter` is left tolerated.
- **Risk: regressing existing FileUpload / FilePreviewModal callers** during the refactor-to-reuse. Mitigation: extract via a shared hook / sub-component, leave existing call sites behaviorally unchanged, and rely on their current tests plus the new E2E.
- **Risk: removing the legacy editor strands a workflow.** Mitigation: this panel is a strict superset of the legacy single-file import; ship the panel and the removal in the **same** PR so there is never a gap.
- Feature is client-only and additive (plus a deletion) — safe to ship behind the normal develop → verify → main flow; no env/secret changes.

## Dependencies

- [[cr-045-self-study-editor-toolbar-workflow-alignment]] — this CR removes the "Hide legacy importer" preference CR-045 introduced and replaces the legacy button with the new **Import file** button in CR-045's `IMPORT` group.
- [[cr-015-narrative-hyperlink-preservation]] — pasted/inserted URLs in the narrative remain clickable (covers the copy/paste affordance).
- [[cr-040-appendix-papers-as-supporting-evidence-files]] — same `SupportingEvidence` model the "Keep as supporting evidence" action writes to; CVs / syllabi / projects land in the same File Library.

## Open questions

- Should "Keep as supporting evidence" be an **explicit** keep step, or should every imported file already count as evidence the moment it uploads (with "Insert into narrative" as an additional, non-exclusive action)? Lean: upload always creates the evidence record (needed for the preview), and the two action buttons are independent — Insert copies text into the narrative, Keep is a no-op confirm + optional `description`/tag. Discarding without keeping would soft-delete the evidence via the existing `DELETE /…/evidence/:id`.
- Section "selection" granularity: native browser text selection over the rendered HTML (proposed) vs. a structured per-heading "insert this section" affordance like the wizard's section cards. Lean: native selection for v1 (matches "copy/paste a selected section"); structured selection is a follow-on.
- Should the panel be reachable when **no** spec is selected (standard-level or Introduction)? Lean: enable "Insert into narrative" only when a sub-spec (or Introduction surface) is active; "Keep as supporting evidence" can attach at standard-level (`specCode` blank), matching `uploadEvidence`'s optional `specCode`.
