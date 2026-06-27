---
name: Monica Review-Panel Walkthrough — 2026-06-26
description: Findings from Eric + Monica Nandan's live prod walkthrough of the Review panel on the KSU self-study — parser data-loss + UI-noise bugs, evidenced by the Otter transcript and 84 screen-share screenshots.
type: review
tags: [review-panel, ai-import, usability, parser, monica, ksu]
audit_date: 2026-06-26
auditor: claude
last_reviewed: 2026-06-26
---

# Monica Review-Panel Walkthrough — 2026-06-26

Live walkthrough on **production** (`cshse.courseworx.media`) with **Monica Nandan** (KSU program coordinator) and Eric, against the Kennesaw State self-study ("DRAFT TO ERIC JUNE 2026.docx" / "BACCALAUREATE DEGREE IN HUMAN SERVICES v2025", submission `6a31f92483a01b1a6d930a4e`). Monica is the pilot ("guinea pig") user; this is the first real-user pass over the Review panel after this week's compare/overlay work shipped.

**Source:** Otter transcript + 84 embedded screen-share screenshots — Google Drive `Re_ [EXTERNAL] Re_ Transcript from today_otter_ai_transcript.docx` (id `1-DWoOAl64mGkDTwCPesaylXYqPDa7MyC`). Image references below (`imageNN`) are the in-doc screenshots.

Fix plan: [[review-panel-ux-plan-2026-06-26]].

## What's working (keep)
- **Compare button → side-by-side** is a hit. "This is a huge improvement… the whole screen now are my two documents." (image27)
- **URLs come through** for many sections; she explicitly noticed her links. (image38, image52/54)
- Edit-in-place + Save in the compare editor; standard autocorrect/grammar.
- The evidence-requirement insight (AI flags where a claim needs supporting evidence) landed as valuable.
- Re-import in **blocks of 5 standards** is her intended workflow (424-page doc); the reimport-replace logic already supports it — she confirmed "do I need to delete all this? No."

## Bugs found

### P1 — Data loss in the parser (most serious; produces a wrong self-study)
- **Whole spec bodies reduced to one line.** For specs whose response starts with an appendix pointer, only that pointer imports. image49/image50: left "Imported content" pane = single line *"Updated data are provided in Appendix 2 …"*, while the right source has the full multi-paragraph response. "I should have text after that, and the text is not there." "The whole 1E is not copied." Spec bodies 1E/1F affected.
- **Links missing in some sections; flattened lists.** image44/image45: KSU catalog / website / activity links that are real hyperlinks **and a list** in the source render as plain unlinked paragraph text. "All these links have not come in… this should be in a list form, but this is coming out in a paragraph form." (Other sections DO import links — image52/54 — so it's structure-specific, not global.)
- **Inconsistent table import.** image50 source has a table that didn't copy; image65 a different table *did* copy. "It's not copied every table, but it copied this table."
- Hypotheses to confirm in the audit: the LLM **evidence-split** fragmenting one response across narrative + evidence cards (`CSHSE/ai-service/app/import_jobs.py`); link extraction in the walker only handling `w:hyperlink` runs, missing list-item/field-code links and `<ul>/<li>` structure (`CSHSE/ai-service/app/splitter/template_walker.py`); per-section truncation. Walker fidelity (links/images/tables) shipped in `830742f` but does NOT cover these structure-specific drops.

### P2 — UI noise (Monica's loudest, most-repeated theme)
Organizing quote: *"If I am in the editor mode, just give me buttons for the editor, nothing else."* Every full-screen shot (image59, image78) shows the density.
- Review screen shows the entire workflow at once: top tabs (Import / Drafts / Review / Matrix / Introduction / Standards / Curriculum Matrix / Supporting File Library), `Validate All`, `0/21 Standards`, `0/83 Validated`, `Submit Self-Study`, plus `Re-run detectors`, `Next: Apply`, `Back`, `Back to editor`, `Filter by source`. She doesn't recognize most: "I don't know what that means" (repeatedly).
- **"Back to editor" button is confusing and redundant** (Eric, 2026-06-26) — the top workflow tabs (Standards / Self-Study / etc.) already provide that navigation. Remove it from the Review header.
- **The spec-level approve action is confusing** (Eric, 2026-06-26). Intended behavior: it should approve **the entire visible specification** — every card shown in the middle pane for the current spec (e.g. 1.a's items #1, #2, …) — and **move them all to the Self-Study editor** in one click. The label **"Approve This Subspecification" is wrong/confusing**: 1.a IS the *Specification* (not a "subspecification"), and the label hides the move-to-editor outcome. Rename + clarify (see plan).
- **Terminology mixes "validate" (self-study) and "approve" (review).** "Validate only happens in the self-study, not in the editor. In the editor it's approved — the language you're using is different."
- **Right "AI evaluation" sidebar** = "such small boxes… not useful… all duplicated functions." **Decision (Eric, 2026-06-26 screenshot):** make it a **read-only informational modal** — there is no need to edit data here or show original source. The placement controls (`Place this item as`, `Reassign to a different Std/Spec`) duplicate card actions, and `Show in source` is redundant because **Compare already shows the source**. Strip those; keep only the info (source heading, confidence, word count, classification, AI rationale) behind an on-demand "ⓘ"; reclaim the full right-pane width.
- **"Report issue" + "?" help sit on top of the editing area.** "Report issue should not be where I'm writing."
- Same density complaint repeats in the **Self-Study editor** ("wasting too much space"). **Concrete example (prod screenshot 2026-06-26, KSU Self-Study Editor → Standard 1 / Spec 1.a):** a **dead horizontal band** sits between the `Validate All / 0/83 Validated / Submit Self-Study` chrome and the content, and the **rich-text editor area is a large empty gray block** — both the chrome band and the empty editor should compress/fill so the working area dominates. The emptiness is amplified because 1.a's content hasn't been moved over from Review yet (ties to P5 — the editor renders empty/`0/83` even where Review has content). The header progress (`1. Import / 2. Drafts / 3. Self-Study / 4. Submit`), the full workflow tabs, **and** the per-spec toolbar + Validate/Save/Cancel/Clear cluster all stack above a sliver of usable space.

### P3 — Compare panel
- **Highlight only spans the first paragraph** of a multi-paragraph response; she wants the whole matched section boxed so she can see first word → last word and "know where to stop." image22/image23. (Today's locate finds + highlights one paragraph — `client/src/features/selfStudy/Editor/AIImport/review/SourceComparePane.tsx`.)
- **Synchronized scroll** of the two panes — explicit wish ("the two move together… that'd be a dream"), she flagged it herself as a stretch.

### P4 — Indicators & navigation
- **Red/green dot vs match-confidence collide.** A card at **0.92 confidence** shows **red**; Monica (and Eric) couldn't reconcile it. image59/image62. The dot is the spec **compliance/coverage** signal; 0.92 is the **matcher confidence** — two meanings, no labels, no legend. Eric: "it's not making sense to me… I'll find out why."
- **Evidence-vs-narrative auto-classification is opaque.** She uploaded everything as narrative; the header says "115 evidence." "How do I know that?" image78/image79. She wants the **counts ("31 narratives · 115 evidence · 9 files") to be clickable** and filter the rail to a flat list of that type, to QA all evidence/files in one pass "without going standard by standard." image81. (Eric agreed in-call.)

### P2.5 — Inline appendix upload at the center-pane placeholders (flagged HIGH VALUE — major time saver)
- Where a center-pane card is an **"import reminder" / appendix placeholder**, add an "upload file for this spec" button **in place** rather than bouncing to the Supporting File Library — "do it from here rather than flip around to different screens." Eric flagged this as a significant time saver. image74/79. Pairs with the clickable-counts evidence/file checklist (P4) so all appendices upload in one linear pass for a 424-page, many-appendix doc.

### P5 — "Open Self-Study" munges the screen
- Clicking **Open Self-Study** from the Review/Draft context rendered a **munged screen** — content that should be empty appeared already transferred. "It's already transferred this nonsense here"; Eric: "that looks like a mess… this should be empty… wrong interface." A **manual refresh** was needed to correct it; afterward the editor showed the document with supporting-evidence text. Then the same wasted-space/noise problem appeared ("same problem we had with the review screen"). transcript 16:42–16:44. Root-cause: stale/leaked state on the view switch (materialization timing / cached query / pre-hydration render).

## Already shipped this week (context; some predate this meeting's complaints)
Compare overlay + side-by-side; links open in a new tab; rich content renders in cards; "Approve This Subspecification" (scoped, renamed); reimport **replace** (no duplicates); heading cut-off (200→600); **source-document image auth fix** (`server/src/routes/imports.ts` — images served before the auth gate) — likely closes her "the pictures aren't there" remark; re-verify with her on a fresh import.
