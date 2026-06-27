---
name: Importer Fidelity + Review UX Sprint — 2026-06-26
description: Execution sprint to make, verify, and test the fixes from Monica's walkthrough. Sprint 1 = importer fidelity (P0, top priority — no dropped content/links/images/tables). Sprint 2 = Review/Self-Study de-noise + high-value workflow. Sprint 3 (optional) = compare sync-scroll.
type: plan
tags: [sprint-plan, importer, review-panel, parser, usability]
plan_date: 2026-06-26
horizon: ~2 sprints (+1 optional)
status: proposed
last_reviewed: 2026-06-26
---

# Importer Fidelity + Review UX Sprint — 2026-06-26

Execution plan for [[review-panel-ux-plan-2026-06-26]], sourced from [[monica-review-walkthrough-2026-06-26]]. **Importer fidelity is top priority and blocking (P0)** — Eric 2026-06-26: "a lot of missing material and missing links and images." A self-study built on dropped content is unusable, so Sprint 1 ships before the UX work.

## Definition of done (every CR)
Made → **verified** → **tested**, and demoed to Monica:
1. **Unit/parser regression** against the real KSU document (`ai-service/tests` for importer; `vitest` for client).
2. **E2E** (Playwright) for UI behavior where applicable.
3. **Headless verify on dev** (re-import / impersonate Monica / inspect DOM), then deploy via `railway up` (GitHub auto-deploy is unreliable), confirm on **prod**.
4. CR status → `shipped` with commit refs; update [[change-requests/index]] + [[log]].

---

## Decisions — all CR open questions resolved (2026-06-27)
Locked so execution runs without pause. Every task in every CR is in-scope; **nothing deferred**; **full test at the end of each CR**.
- **CR-061 invariant:** exact, whitespace-normalized text equality per spec span — `norm(imported narrative+evidence) == norm(source span)`. "Correctly short" vs "dropped" is decided by the **source diff only**, never absolute length.
- **CR-062 plain URLs:** emit `<a>` only for **real source hyperlinks**; never fabricate links from plain text. Lists always preserved. Audit flags "looks like it should link but source has none."
- **CR-063 large images:** raise the inline base64 cap to **2 MB**; anything larger is **referenced via the public import image route** (`/api/imports/:id/images/:file`) — **never dropped**.
- **CR-064 approach:** **hide-conditionally** (mode-aware render keyed on `activeView`), not a separate screen — lower risk, reversible.
- **CR-065 Reassign parity:** keep placement/reassign on the **card** (kind dropdown + Move text + reassign popup); the modal is read-only. Verify parity in code.
- **CR-066 wording:** **"Approve specification → editor"** (tooltip: "Approve every item shown for this specification and move them to the Self-Study editor").
- **CR-067 long span:** box the **whole** matched span; scroll to its start.
- **CR-068 layout:** filtered list **replaces** the spec rail with a "← Back to specs" affordance.
- **CR-069 dot:** keep the dot as **coverage/compliance**, relabel both signals (dot = AI review status; number = match confidence), add a legend. Confirm the dot's source value (`acceptState` vs coverage) first.
- **CR-070 files:** allow **multiple** files per placeholder.
- **CR-071 munge:** reproduce first; fix = force refetch on view-switch + ensure materialization completes before render + clean empty state. (Suspect a stale TanStack Query cache surviving the switch.)
- **CR-072 sync-scroll:** **anchor-by-matched-section** (P2, last).

---

## Sprint 1 — Importer fidelity (P0, TOP PRIORITY)
**Goal:** the importer captures everything between spec breaks — text, links, lists, images, tables — with zero silent drops.

**Governing rule (Eric):** *"Write everything until the next break."* A spec owns all content from its heading until the next spec break (1.a→1.b, 1.b→1.c, …). Make capture **deterministic and boundary-based**; the LLM split may only *tag* narrative-vs-evidence within a captured span, never drop it.

- **Task 0 — Fidelity audit (read-only, do first).** Re-import the KSU file in a scratch instance; produce a section-by-section **source-vs-imported diff** cataloguing every dropped paragraph / link / image / table. Output a dated `review` page. Gates the fixes.
- **[[cr-061-importer-no-dropped-content]]** (P0) — deterministic span capture; nothing skipped between breaks.
- **[[cr-062-importer-preserve-links-lists]]** (P0) — all hyperlink encodings + `<ul>/<li>` preserved.
- **[[cr-063-importer-preserve-images-tables]]** (P0) — every inline image (mind the size cap) + every table imports.

**Verify & test:**
- Source-vs-imported diff shows **0 drops** per spec (KSU 1E/1F and the full audit list now complete).
- Parser **regression tests** against the KSU doc: per-spec char count ≥ threshold; hyperlink count == source; image/table count == source; no body reduced to its appendix-pointer line.
- Re-import on **dev + prod**; open Compare on previously-broken specs (1E/1F, the link/list spec, the image/table specs) → left pane matches source.
- Demo to Monica on her document.

**Exit:** Monica's missing-material / missing-links / missing-images complaints are gone on a fresh import, proven by the diff + green regression suite.

---

## Sprint 2 — Review & Self-Study de-noise + high-value workflow
**Goal:** "just the editor and compare" — strip noise, reclaim space, and remove the appendix-upload friction.

- **[[cr-064-mode-aware-review-chrome]]** (P1) — strip Validate/Submit/workflow-tabs/Next-Apply/Back-to-editor; move Report/Help to header; consistent approve(review) terms.
- **[[cr-065-ai-eval-modal]]** (P1) — right sidebar → read-only informational modal; remove placement + Show-in-source; reclaim the right pane.
- **[[cr-066-approve-specification-rename]]** (P1) — rename the spec-level approve to reveal "approve this specification → editor."
- **[[cr-067-full-section-compare-highlight]]** (P1, quick win) — highlight the whole matched span.
- **[[cr-068-clickable-count-filters]]** (P1) — clickable counts → flat narratives/evidence/files lists.
- **[[cr-069-confidence-indicator-legend]]** (P1, quick win) — reconcile the dot vs 0.92 confidence; add a legend.
- **[[cr-070-inline-appendix-upload]]** (P1, HIGH VALUE) — inline "upload file for this spec" at appendix placeholders; pairs with CR-068.
- **[[cr-071-self-study-editor-munge-and-denoise]]** (P1) — fix the Open-Self-Study munge/leak; clear empty state; de-noise the editor.

**Verify & test:** E2E per CR (removed controls absent in Review; modal opens; rename + move-to-editor; full-section highlight; count→list length matches; inline upload attaches to spec; Review→Self-Study with no refresh) + a Monica-style manual pass confirming the screen reads as "just Review."

**Exit:** Monica can review, compare, edit, approve-to-editor, and upload appendices without screen-hopping or unexplained noise.

---

## Sprint 3 — Compare polish (optional)
- **[[cr-072-compare-synchronized-scroll]]** (P2) — linked scroll of the two compare panes. Do only after P0/P1 land.

---

## Front-load (quick wins, low risk)
CR-067 (full-section highlight), CR-069 (dot legend), CR-066 (approve rename), and moving Report/Help out of the work area (part of CR-064) are small and can ship early for immediate relief while Sprint 1's parser work proceeds in parallel (backend vs frontend).

## Dependency notes
- CR-067 reuses CR-061's break-boundary logic to find the span end.
- CR-070 depends on CR-068's evidence/file checklist for the one-pass upload.
- CR-065 reclaims width that CR-064 also frees — sequence together.
- Sprint 1 (ai-service/server) and the Sprint 2 frontend can run in parallel.

## Relationship to the portal roadmap
Focused effort; **complements, does not supersede** [[sprint-plan-2026-05-31]] (the portal-completion roadmap). These CRs (cr-061…072) are the Monica-walkthrough remediation track.
