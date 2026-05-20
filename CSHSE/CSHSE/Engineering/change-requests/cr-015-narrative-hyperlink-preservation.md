---
name: CR-015 — Narrative hyperlink preservation
description: Embedded URLs in narrative paste survive the import and remain clickable in the rendered self-study.
type: change-request
cr_id: CR-015
status: proposed
priority: P1
source: [[webinar-action-items-2026-05-20#56-14]], [[webinar-action-items-2026-05-20#56-57]]
sprint_target: Sprint 2
tags: [narrative, hyperlinks, paste, editor]
last_reviewed: 2026-05-20
---

# CR-015 — Narrative hyperlink preservation

## Summary

Monica asked whether a DOCX with embedded hyperlinks would survive copy-paste into the narrative editor. Eric committed to verify and fix. We need to confirm both paths preserve hyperlinks:

1. **AI Import wizard** — DOCX → mammoth → review → apply
2. **Legacy paste** — copy from Word, paste into TipTap, save

## Source quotes

> **[56:14 — Monica]:** "if I give you a text document that has an embedded URL already in a hyperlink, will the reader recognize? Oh, this is a hyperlink."
> **[56:28 — Eric]:** "Yes, document that you're copying and pasting"
> **[56:37 — Monica]:** "Yes, it'll recognize it. Thank you. It'll recognize it. I appreciate it."
> **[56:57 — Eric]:** "Something I'm going to ask the importer if that's the case, and if it's not, it will be."

## Decision

Three checks required:

1. **mammoth conversion** — confirm hyperlinks survive DOCX → HTML. (mammoth default: yes; verify against a real CSHSE doc.)
2. **AI Import apply path** — when bucket items are converted to narrative HTML and saved, anchors must be preserved end-to-end.
3. **TipTap paste handler** — verify the Word-paste extension keeps `<a href>` rather than stripping it.

For each, add a test fixture (a DOCX with mixed inline + autolink + bookmark hyperlinks) and assert clickable anchors in the rendered editor.

## Acceptance

- [ ] Integration test in `ai-service/tests/test_hyperlink_preservation.py`: DOCX with hyperlinks → splitter → bucket → apply → confirm anchors in saved narrative.
- [ ] Integration test in `server/tests/`: paste-from-Word path preserves anchors.
- [ ] E2E test: PC pastes Word text with a URL → editor renders + saves clickable link → reader view shows clickable link.
- [ ] Bug fixes if any of the three checks fail. Document the affected pipeline stage.

## Files affected

- TBD until tests are written; expected:
  - `ai-service/app/splitter/sections.py` — HTML snippet handling (already preserves `<a>`)
  - `client/src/features/selfStudy/Editor/NarrativeEditor.tsx` — TipTap config
  - `client/src/extensions/PasteHandler.ts` (or equivalent)

## Dependencies

- None.

## Open questions

- Should we auto-detect bare URLs in plain-text paste and convert to anchors? Lean **yes** — small UX win.
