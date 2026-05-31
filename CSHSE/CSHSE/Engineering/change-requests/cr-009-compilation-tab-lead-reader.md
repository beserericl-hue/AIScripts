---
name: CR-009 — Compilation tab (lead reader side-by-side)
description: Lead reader sees per-spec side-by-side scores from each reader with disagreement highlighting and a Final-score field.
type: change-request
cr_id: CR-009
status: shipped
priority: P1
source: [[webinar-action-items-2026-05-20#compilation-tab]], [[webinar-action-items-2026-05-20#1-25-52]]
sprint_target: Sprint 5.1
tags: [readers, lead-reader, compilation, scoring]
last_reviewed: 2026-05-30
---

# CR-009 — Compilation tab (lead reader side-by-side)

## Summary

The lead reader needs a single view comparing all readers' scores per spec, with disagreements automatically flagged, so they can drive a consensus discussion and set the Final score. This becomes the source of the lead-reader compilation report (one of the artifacts the board uses).

## Source quotes

> Slide referenced during the demo: "Compilation tab — side-by-side review" with columns Reader 1, Reader 2, Reader 3, Final and disagreement rows highlighted.

> **[1:25:52 — Eric]:** "the lead reader will generate the compilation report."

## Decision

Lead-reader-only tab listing every spec in the program with columns:

| Column | Source |
|---|---|
| Spec code + prompt | self-study metadata |
| Reader 1 (with link to their full review) | `Review` per reader |
| Reader 2 | … |
| Reader 3 | … |
| Final | lead-reader-set; editable on this screen |

Row highlighting:

- Yellow when readers disagree (any two scores differ by >= 1)
- Red when at least one reader scored `0` (Non-compliant)
- Green when all readers agree

Click a reader cell → opens that reader's narrative comment for the spec. Lead reader can pull the comment thread into a Comments side panel without leaving the tab.

The lead reader generates the **compilation report** (DOCX export) from this tab. The report is what the board reviews.

## Acceptance

- [x] Compilation tab visible only to roles `lead_reader` and `admin` (server 403s readers + PCs; client nav hides the tab; server endpoints role-gated).
- [x] Every spec with a reader score (or a Final score) shows on one table; columns are one per reader, plus Final.
- [x] Disagreement highlighting matches the rules above — `hasZero` (red), `hasDisagreement` (yellow), `allAgree` (green), `excluded` (muted). Server returns the flags pre-computed.
- [x] Final score persists per spec; audit-logged (`compilation.final_set` / `compilation.final_cleared` with priorScore + new score).
- [ ] Compilation DOCX export button generates a report mirroring the table + lead-reader comments. **Deferred to Sprint 5.2 (CR-011 suggestions DOCX precedes it).**
- [ ] E2E: three readers score the same spec differently → lead reader sees yellow row → sets Final → exports DOCX → DOCX matches. **Partial:** the side-by-side / yellow / Final round-trip is pinned by integration + unit tests; the DOCX leg lands with Sprint 5.2.

## Files affected (as shipped, Sprint 5.1, 2026-05-30)

- `server/src/models/LeadFinalScore.ts` (new) — per-(submission, std, spec) Final-score collection, indexed unique.
- `server/src/controllers/compilationController.ts` (new) — getCompilation / setFinalScore / clearFinalScore.
- `server/src/routes/compilation.ts` (new) — `GET /api/submissions/:id/compilation` + `PUT|DELETE /compilation/final-score`.
- `server/src/models/AuditLogEntry.ts` — AuditAction union widened (`compilation.final_set`, `compilation.final_cleared`).
- `server/src/index.ts` — mounts the compilation router.
- `client/src/features/leadReader/CompilationTab/CompilationTab.tsx` (new) — pure `CompilationTabView` + container with TanStack-Query wiring; Score4LevelSelector reused for the Final editor.
- `client/src/features/leadReader/LeadReaderDashboard.tsx` (new) — pure view + container; lists compilations.
- `client/src/pages/LeadReaderDashboardPage.tsx`, `client/src/pages/LeadReaderCompilationPage.tsx` (new).
- `client/src/App.tsx` — adds `/lead-reader` + `/lead-reader/:submissionId` routes.
- `client/src/components/Layout.tsx` — adds "Compilations" nav for lead_reader + admin + superuser.

## Design notes (Sprint 5.1, 2026-05-30)

- **Source of truth = `Score` (0-3), not legacy `Review.assessments` compliance triplet.** The pre-existing `LeadReaderCompilation` model aggregates from the latter, but Sprint 3 readers write into the former. To make the compilation actually reflect what readers wrote, the new compilation surface reads `Score` directly. Legacy `LeadReaderCompilation` is left intact (its endpoints still serve the older flow; nothing in Sprint 5.1 mutates them).
- **Final scores live in a dedicated collection (`LeadFinalScore`), not on `Submission` or `LeadReaderCompilation`.** Avoids the Mongoose-8 Map dotted-key trap (see [[narrative-storage]]); per-spec upserts are trivial.
- **Disagreement rule:** any non-equal pair in the same spec is disagreement (equivalent to "any two scores differ by ≥ 1" for integers 0-3). Single-voter rows are neither agreement nor disagreement.
- **Audit payload** stores `priorScore` on update + clear so the timeline can reconstruct the path.

## Dependencies

- [[cr-003-zero-to-three-compliance-rubric]] — defines the score values (shipped Sprint 3).
- [[cr-010-portal-direct-messaging]] — lead reader uses DM to ask a reader to clarify (Sprint 5.4).
- [[cr-011-suggestions-consolidation-docx]] — DOCX export will land alongside Sprint 5.2.

## Open questions

- Does Final-score override propagate back to individual reader views, or stay lead-reader-private? Default: visible to all readers (transparency). The compilation read endpoint exposes Final scores to lead_reader + admin only today; making it visible to readers requires a small read-gate change.

## Resolution (2026-05-31, Sprint 11 / S11.3) — Final-score visibility to readers SHIPPED

The CR-009 "transparency" Open question is resolved in favor of **Final scores visible to readers** (peers' raw 0-3 votes stay lead/admin-only).
- **New read endpoint** `GET /api/submissions/:submissionId/final-scores` (`server/src/routes/compilation.ts:18-22`, `server/src/controllers/compilationController.ts` `getFinalScoresForReader`) returns ONLY the lead reader's Final score per (std, spec) plus the requesting reader's OWN score for context. The side-by-side `getCompilation` is unchanged and remains lead/admin-only — no peer votes leak through `final-scores` (response carries no `scores[]` array). Access: lead/admin/superuser always; reader/lead_reader only with an ACTIVE `Assignment` (CR-007 parity); PCs 403.
- **Reader review client** now fetches `final-scores` and renders a read-only "Lead reader final score: N — <label>" chip per spec (`client/src/features/reader/ReaderReviewScreen.tsx` `finalScoresQuery` + `finalScoresByKey`, `client/src/features/reader/ReaderSpecRow.tsx` `finalScore` prop + chip with testid `reader-final-score-<std>-<spec>`). The query uses `retry:false` so an unassigned reader's 403 silently hides the chips rather than erroring the page.
- Tests: `server/tests/integration/compilation-endpoint.test.ts` (+5 CR-009 follow-on cases: assigned reader sees Final + own score but no peer votes; unassigned reader 403; PC 403; lead reads without assignment; 404) — 18 green. `client/src/features/reader/ReaderSpecRow.test.tsx` (+2: chip shown when finalScore set, hidden when null) — 8 green.
