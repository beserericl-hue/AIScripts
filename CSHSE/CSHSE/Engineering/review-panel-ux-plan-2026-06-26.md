---
name: Review-Panel UX & Parser-Fidelity Plan — 2026-06-26
description: Prioritized fix plan responding to Monica's 2026-06-26 walkthrough — P1 parser data-loss audit+fix, P2 mode-aware de-noise of Review, P3 full-section compare highlight, P4 clickable count filters + indicator legend, P5 inline upload + self-study leak.
type: plan
tags: [review-panel, ai-import, usability, parser, sprint-plan]
plan_date: 2026-06-26
horizon: ~2 sprints
status: proposed
last_reviewed: 2026-06-26
---

# Review-Panel UX & Parser-Fidelity Plan — 2026-06-26

Driven by [[monica-review-walkthrough-2026-06-26]]. Two themes dominate: **(1) parser data loss** (some specs drop text/links/tables — a correctness risk for the self-study) and **(2) UI noise** (show only mode-relevant controls). Sequence below; P1 and P2 can run in parallel (backend vs frontend).

## P1 — Parser fidelity audit, then fix
The #1 work item — wrong/partial imports produce a wrong self-study. Eric 2026-06-26: "a lot of missing material and missing links and images."

**Governing rule (Eric, 2026-06-26):** *"Write everything until the next break."* A spec owns **all** content from its heading until the next spec break — 1.a until 1.b, 1.b until 1.c, etc. The parser is "skipping too much information" inside those boundaries. The fix is **deterministic boundary-based capture** (assign the whole span to the spec; appendix refs / tables / lists / images are not boundaries), with the LLM split only *tagging* narrative-vs-evidence within an already-captured span — never dropping any of it. → [[cr-061-importer-no-dropped-content]], [[cr-062-importer-preserve-links-lists]], [[cr-063-importer-preserve-images-tables]].
1. **Audit first (read-only).** Re-import the KSU file into a scratch instance and produce a section-by-section diff (source-doc HTML vs imported `htmlSnippet`) cataloguing **every** drop. Bring findings before code changes.
2. Confirm/fix root causes:
   - **Lossless evidence-split** — a response must never be reduced to its appendix-pointer line; every character lands somewhere reconstructable. (`CSHSE/ai-service/app/import_jobs.py`)
   - **Link extraction breadth** — handle list-item links, field-code links, not just `w:hyperlink` runs; **preserve `<ul>/<li>`** structure (and the links inside). (`CSHSE/ai-service/app/splitter/template_walker.py`)
   - **Deterministic table association** — every source table attaches to its spec; stop skipping some.
3. **Regression tests against Monica's actual document** so these specific drops can't recur.
4. Re-verify the **source-doc image fix** (`server/src/routes/imports.ts`) with Monica on a fresh import.

## P2 — Mode-aware de-noise of Review (highest perceived-quality win)
Principle (Monica): *"Only buttons pertaining to that mode should be there. And lots of editing space."*
- **Strip the Review screen to essentials.** Hide from Review: `Validate All`, `0/21 Standards`, `0/83 Validated`, `Submit Self-Study`, the non-Review workflow tabs, `Next: Apply`, `Back`, and **`Back to editor`** — the last is **confusing and redundant** (Eric, 2026-06-26): the top workflow tabs (Standards / Self-Study / …) already provide that navigation, so remove it. Show `Filter by source` only when >1 source; move `Re-run detectors` into a menu. (`client/src/features/selfStudy/Editor/AIImport/steps/ReviewStep.tsx`, `Review/ReviewSurface.tsx`, `components/OverflowNav.tsx`)
- **Convert the right "AI evaluation" sidebar into a read-only informational modal** (decision confirmed by Eric 2026-06-26): trigger it on demand from an "ⓘ" on the card; keep only **read-only info** — source heading, confidence, word count, classification ("Unknown — manual review"), AI rationale. **Remove from it** the editing/placement controls (`Place this item as`, `Reassign to a different Std/Spec`) — placement already lives on the card (Move text / Intro dropdown / Approve) — and **remove `Show in source`** because **Compare already shows the source**. Deleting the permanent sidebar **reclaims the full right pane (~25–30%)** for the cards/compare. (`AIImport/review/ItemPreview.tsx`)
- **Move "Report issue" + "?" help** to the top header, out of the work area.
- **Consistent terminology** — "approve" in Review, "validate" only in Self-Study; never show Validate in Review.
- **Fix the spec-level approve action (label + clarity).** Two approve actions must be unmistakable: (a) the **card "Approve"** = approve that one item → move it to the Self-Study editor; (b) the **spec-level button** = approve **every visible item for the currently-shown specification** (all cards in the middle pane for e.g. 1.a) → move them all to the Self-Study editor in one click. The current label **"Approve This Subspecification" is confusing** (Eric, 2026-06-26): "subspecification" is the wrong term — **1.a IS the Specification** — and the label doesn't reveal the move-to-editor outcome. Rename to clear, action-revealing wording, e.g. **"Approve this specification → editor"** / "Approve all shown → editor," and use correct CSHSE hierarchy terms (Standard → Specification). (`AIImport/review/ItemCardList.tsx`)
- Apply the same de-noise pass to the **Self-Study editor** (concrete example in [[monica-review-walkthrough-2026-06-26]], prod screenshot KSU Standard 1 / 1.a): **collapse the dead band** between the `Validate All / Submit Self-Study` chrome and the content; **let the rich-text editor fill the available height** (it's a large empty gray block today); compress the stacked header (progress steps + workflow tabs + per-spec toolbar + Validate/Save/Cancel/Clear) so the writing area dominates. (`client/src/features/selfStudy/Editor/SelfStudyEditor.tsx`, `NarrativeEditor.tsx`)
- **Open decision for Eric:** *hide* the non-Review chrome conditionally, or *split Review into its own minimal screen*? The split is cleaner but a bigger change.

## P3 — Full-section compare highlight (small, high value)
- Extend the source locate to **box the entire matched response** (first word → last word), not just the first paragraph. (`AIImport/review/SourceComparePane.tsx`)
- **Synchronized scroll** of the two compare panes — nice-to-have; do if cheap.

## P4 — Indicators & navigation clarity
- **Reconcile the red/yellow/green dot with the 0.92 confidence number.** Decide what the dot means (compliance/coverage vs match confidence), label both, add a one-line legend. Likely two distinct, separately-labeled signals. (`AIImport/review/ItemCardList.tsx`, `ItemPreview.tsx`)
- **Clickable header counts** ("31 narratives · 115 evidence · 9 files") → filter the rail to a flat list of that type across all specs, for one-pass QA. (`ReviewStep.tsx` / rail)
- Make **evidence-vs-narrative classification visible** so the auto-tagging is understandable.

## P2.5 — Inline appendix upload at the center-pane placeholders (HIGH VALUE — major time saver)
Eric flagged this as a significant time saver, and Monica asked for it directly. The parser already surfaces **appendix/import-reminder placeholder cards in the center pane** (e.g. "Import reminder — appendix reference") for every spot where the self-study points to an appendix. Today, uploading that appendix means leaving Review for the Supporting File Library and re-associating by hand.
- **Add an "Upload file for this spec" button directly on each appendix-placeholder card**, so Monica imports the appendix file in place, already scoped to the correct standard/spec — "do it from here rather than flip around to different screens." (`client/src/features/selfStudy/Editor/AIImport/review/ItemCardList.tsx`; upload wiring via the existing evidence/file path used by the Supporting File Library.)
- The uploaded file lands as the spec's supporting file (cataloged by specification), exactly where the reader expects it — no second pass.
- **Pairs with the consolidated evidence/file list (P4):** clicking the "115 evidence" / "9 files" counts filters the rail to a flat checklist so Monica can walk the appendix placeholders and upload **all** of them in one pass, "without going standard by standard." Together these two are the appendix-import efficiency win — for a 424-page, many-appendix self-study this removes the single biggest manual chore.
- **Why it matters:** appendices are the bulk of the manual upload work; doing it inline + as a single filtered checklist turns a screen-hopping, standard-by-standard slog into a quick linear pass.

## P5 — "Open Self-Study" munges the screen
Clicking **Open Self-Study** from the Review/Draft context renders a **munged screen**: content that should be empty appears already transferred ("it's already transferred this nonsense here" / "that looks like a mess"), and it took a **manual refresh** to correct. Both Monica and Eric were confused ("this should be empty… wrong interface"). (transcript 16:42–16:44)
- Root-cause the stale/leaked state — materialization timing, a cached query that survives the view switch, or the wrong view rendering before hydration — so Open-Self-Study always lands clean (and correct after a single navigation, no refresh).
- The Self-Study editor also carries the **same wasted-space/noise** as Review ("same problem we had with the review screen") → apply the P2 de-noise pass here too.

## Suggested order
P1 audit → (P2 in parallel) → **P2.5 inline appendix upload (front-loaded — biggest time saver)** → P3 → P4 → P5. Other quick wins to front-load: full-section highlight (P3), move Report/Help out of the work area (P2), dot legend (P4). The two real efforts are the **P1 parser audit/fix** and the **P2 mode-aware UI rework**; P2.5 is high-value and relatively contained.
