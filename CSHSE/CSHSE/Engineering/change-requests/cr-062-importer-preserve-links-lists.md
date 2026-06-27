---
name: CR-062 — Importer must preserve hyperlinks and list structure
description: Hyperlinks come through for some specs but not others, and lists of links are flattened into plain paragraphs. Import must preserve every hyperlink (all Word link encodings) and keep list structure (and the links inside).
type: change-request
cr_id: CR-062
status: shipped
priority: P0
source: "[[monica-review-walkthrough-2026-06-26]] (image44/image45) · Eric 2026-06-26 'missing links' · Monica 'All these links have not come in' / 'this should be in a list form, but this is coming out in a paragraph form'"
sprint_target: Importer Fidelity (Sprint 1)
tags: [importer, parser, ai-import, fidelity, links, lists, P0]
last_reviewed: 2026-06-26
---

# CR-062 — Importer must preserve hyperlinks and list structure

## Summary
Links import for some specs (image52/54) but are missing in others (image44/45) — and a **list** of KSU links (catalog / website / activity) arrives as plain unlinked paragraph text. The walker's link extraction handles inline `w:hyperlink` runs but misses other Word link encodings and does not emit `<ul>/<li>`. Every hyperlink must survive, and list structure (with its links) must be preserved.

## Source quotes
- Monica: "**All these links have not come in**"; "KSU catalog should have a link … this should be in a **list form, but this is coming out in a paragraph form**." (image44, image45)
- Eric, 2026-06-26: "a lot of missing material and **missing links** and images."

## Decision
1. Broaden link extraction in the walker to cover **all** Word link encodings: `w:hyperlink` runs, **field-code** (`HYPERLINK`) links, list-item links, and auto-formatted URLs — resolve each via the rels and emit `<a href>`.
2. **Preserve list structure** — emit `<ul>/<ol>/<li>` for Word lists instead of flattening every paragraph to `<p>`; keep links inside list items.
3. Add a parser test against the KSU doc asserting link count + list structure match the source.

## Acceptance
- The KSU spec in image44/45 imports **all** its hyperlinks as clickable `<a href>` and renders as a **list**, matching the source.
- Audit diff shows imported hyperlink count == source hyperlink count per spec (0 dropped).
- Regression test asserts links + `<li>` structure preserved for the KSU document.
- Re-import on dev shows the links/list rendering in the card + compare overlay.

## Files affected
- `CSHSE/ai-service/app/splitter/template_walker.py` (`_run_inline_html` / `_paragraph_to_html` — link + list emission)
- `CSHSE/ai-service/tests/test_template_walker.py`

## Dependencies
- Gated by the importer fidelity audit. Sibling: [[cr-061-importer-no-dropped-content]], [[cr-063-importer-preserve-images-tables]]. Walker hyperlink/inline-image fidelity baseline shipped in `830742f` — this extends it to the missed encodings + lists.

## Open questions
- Any Word docs where "links" are plain typed URLs (not real hyperlinks)? Those won't be `<a>` in source — flag in audit rather than fabricate.
