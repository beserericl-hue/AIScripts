---
name: CR-061 — Importer must not drop spec-body content
description: The template importer drops large amounts of a spec's response — whole bodies reduced to their appendix-pointer line. Import must be lossless: every paragraph of a spec's response lands in that spec's narrative/evidence, reconstructable in full.
type: change-request
cr_id: CR-061
status: shipped
priority: P0
source: "[[monica-review-walkthrough-2026-06-26]] (image49/image50) · Eric 2026-06-26 'There is a lot of missing material' · Monica 'the whole 1E is not copied' / 'I should have text after that, and the text is not there'"
sprint_target: Importer Fidelity (Sprint 1)
tags: [importer, parser, ai-import, fidelity, data-loss, P0]
last_reviewed: 2026-06-26
---

# CR-061 — Importer must not drop spec-body content

## Summary
On the KSU import, entire spec responses are reduced to a single line — e.g. 1E/1F show only *"Updated data are provided in Appendix 2 …"* while the source has multiple paragraphs (and a table). This is **data loss**: a self-study built on partial content is wrong. Import must be lossless — every paragraph of a spec's response must land in that spec (as narrative and/or supporting evidence) and be reconstructable in full.

## Source quotes
- **Eric, 2026-06-26 (the rule):** "The rule for importing is to **write everything until the next break**. The parser writes spec 1.a until it finds spec 1.b, then 1.c, etc. **Skipping too much information.**"
- Eric, 2026-06-26: "There is **a lot of missing material** and missing links and images."
- Monica: "the **whole 1E is not copied**"; "Updated data provided in Appendix 2 … **I should have text after that, and the text is not there**"; "it's **not copying the entire section**." (image49, image50)

## Decision
**The governing rule (deterministic, boundary-based): a spec owns _everything_ from its heading until the next spec break.** 1.a captures all content from the 1.a heading up to the 1.b heading; 1.b up to 1.c; the last spec of a standard up to the next Standard/Specification marker. Nothing between two spec breaks may be skipped.

1. **Make segmentation lossless by construction.** Walk the document; on each spec marker, assign the **entire span** to that spec until the next marker (next `N.x` spec, next Standard, or document end). Appendix references, "Response:" markers, tables, lists, images inside the span stay in the span — they are **not** boundaries and must not truncate capture.
2. The LLM **evidence-split** may only *tag* slices of an already-captured span as narrative vs supporting evidence — it must **never drop or elide** any of it. Removing the split as a drop-source is acceptable if it can't be made lossless.
3. Remove/raise any per-section char cap that truncates the span.
4. **Audit (Sprint 1 task 0, read-only):** re-import the KSU file in a scratch instance, diff source-vs-imported per spec, output a `review` page enumerating every drop to confirm the rule fixes them.

## Invariant
For every source spec, the imported content (narrative + evidence, concatenated) reconstructs the **full span between that spec's break and the next** — `plain(imported) == plain(source span)` modulo whitespace. Nothing silently dropped.

## Acceptance
- KSU 1E and 1F (and the audit's full drop list) import their **complete** response text — verified by the source-vs-imported diff showing 0 dropped paragraphs.
- A **regression test** runs the KSU document through the parser and asserts no spec body is reduced to its appendix-pointer line (and total imported char count per spec ≥ N% of source).
- Re-import on dev + prod shows the previously-empty specs now full (compare overlay left pane matches source).

## Files affected
- `CSHSE/ai-service/app/import_jobs.py` (evidence-split / section→item)
- `CSHSE/ai-service/app/splitter/template_walker.py` (segmentation, body emission)
- `CSHSE/ai-service/tests/` (new regression vs the KSU doc)

## Dependencies
- Gated by the **importer fidelity audit** (Sprint 1, task 0). Sibling: [[cr-062-importer-preserve-links-lists]], [[cr-063-importer-preserve-images-tables]].

## Open questions
- Tolerance threshold for the "no drop" invariant (exact vs ≥95%)?
- When a response legitimately points to an appendix with little inline text, how do we distinguish "correctly short" from "dropped"? (use source diff, not absolute length.)
