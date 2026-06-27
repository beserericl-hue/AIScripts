---
name: CR-063 — Importer must preserve images and tables
description: Images go missing and tables import inconsistently (some specs get their table, others don't). Every inline image and table inside a spec's span must import into that spec's content.
type: change-request
cr_id: CR-063
status: shipped
priority: P0
source: "[[monica-review-walkthrough-2026-06-26]] (image50/image65) · Eric 2026-06-26 'missing … images' · Monica 'the link did not come in as well as the table' / 'it copied this table … not copied every table'"
sprint_target: Importer Fidelity (Sprint 1)
tags: [importer, parser, ai-import, fidelity, images, tables, P0]
last_reviewed: 2026-06-26
---

# CR-063 — Importer must preserve images and tables

## Summary
Images are missing from imported content, and tables are hit-or-miss — image50's spec has a source table that didn't import, while image65's table did. Per the CR-061 rule (everything until the next break), images and tables inside a spec's span are **part of that span** and must import into the spec's content (narrative or supporting evidence), not be skipped.

## Source quotes
- Eric, 2026-06-26: "a lot of missing material and missing links and **images**."
- Monica: "the **link did not come in as well as the table**"; "it copied this table … so it's **not copied every table**, but it copied this table." (image50, image65)

## Decision
1. **Images:** ensure every inline image in a spec's span is emitted (base64 data URI, per the walker's existing inline-image path). Re-check the **size cap** (`_MAX_INLINE_IMAGE_BYTES`, currently ~1.2 MB) — images above it are silently dropped; either raise it, or store large images via the import image route and reference them (the route is now public per `server/src/routes/imports.ts`) rather than dropping.
2. **Tables:** make table capture deterministic — every `<table>` inside a spec's span imports and attaches to that spec; none skipped. Confirm tables aren't being lost when they fall between an appendix marker and the next break.
3. Audit diff asserts image count + table count per spec == source.

## Acceptance
- The image50 spec imports its table; spot-checked specs import their images (rendered in the card + compare overlay).
- Audit diff shows imported image/table counts == source per spec (0 dropped); regression test asserts it for the KSU document.
- Large images (>cap) are preserved (inlined or referenced), not dropped — verified on a KSU image known to exceed the cap.

## Files affected
- `CSHSE/ai-service/app/splitter/template_walker.py` (inline image emission + `_MAX_INLINE_IMAGE_BYTES`; table capture)
- `CSHSE/ai-service/app/import_jobs.py` (table → item association)
- `CSHSE/ai-service/tests/test_template_walker.py`

## Dependencies
- Gated by the importer fidelity audit. Sibling: [[cr-061-importer-no-dropped-content]], [[cr-062-importer-preserve-links-lists]]. Source-document image **serving** already fixed (`28b2470`, image route public); this CR is about images surviving **import** into the content.

## Open questions
- For very large images, inline base64 (bloats `htmlSnippet` / aiReviewState) vs reference via the import image route — pick a threshold.
