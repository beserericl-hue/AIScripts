---
name: Change Requests — Catalog
description: Master index of every shippable behavior change request derived from the 2026-05-20 Beta Group Training webinar and follow-on conversations.
type: overview
tags: [change-requests, catalog, webinar, requirements]
last_reviewed: 2026-05-29
---

# Change Requests — Catalog

All CRs are scoped to a single shippable behavior. Each is sourced from a timestamp in [[webinar-action-items-2026-05-20]] or from a follow-on engineering conversation captured in [[log]].

## Status legend

| Status | Meaning |
|---|---|
| `proposed` | Captured, not yet sized or scheduled |
| `accepted` | Sized + on the sprint plan |
| `in-progress` | Engineering started |
| `shipped` | Verified in prod |
| `rejected` | Considered + declined |
| `superseded` | Replaced by another CR |

## P0 — required before next reader cycle (Stevenson + Kennesaw beta)

| CR | Title | Status | Source |
|---|---|---|---|
| [[cr-001-both-importers-required]] | Keep both AI wizard + legacy per-standard importer | **shipped** (2026-05-24 — code already in place: both buttons side-by-side on SelfStudyEditor toolbar with Legacy/AI badges; user-guide doc updated with "When to use each" matrix) | [[webinar-action-items-2026-05-20#28-25]] |
| [[cr-005-pc-lockout-on-final-submit]] | PC locked to read-only + print after final submit | in-progress | [[webinar-action-items-2026-05-20#1-17-54]] |
| [[cr-006-two-stage-submission]] | Per-section submit-for-review vs final-submit | in-progress | [[webinar-action-items-2026-05-20#1-13-05]] |
| [[cr-007-reader-access-after-submit]] | Readers see nothing until PC clicks final submit | in-progress | [[webinar-action-items-2026-05-20#1-19-38]] |
| [[cr-004-comment-threading-identity-redaction]] | Reader names hidden from PC + Julia relays | proposed | [[webinar-action-items-2026-05-20#1-18-28]] |
| [[cr-003-zero-to-three-compliance-rubric]] | Non / Partial / Largely / Fully compliant rubric | in-progress | [[webinar-action-items-2026-05-20#1-05-23]] |
| [[cr-017-cross-institution-isolation-audit]] | Documented data-flow audit for cross-institution isolation | **shipped** (2026-05-24 — audit + Gap 1 negative-test suite + Gap 2 Qdrant payload-filter test; fixed two real leaks the tests exposed in listSubmissions/getSubmission) | [[webinar-action-items-2026-05-20#24-07]] |
| [[cr-025-ai-matrix-column-inference]] | AI infers matrix column → course mapping; dropdown replaces free-text | proposed | User observation 2026-05-21 |
| [[cr-026-matrix-correction-verify-in-context]] | Verify-in-context preview + per-row move/remove for AI matrix corrections | proposed | User observation 2026-05-21 |
| [[cr-027-stale-error-on-wizard-step-back]] | Stale error persists when navigating back to wizard Upload step | **shipped** (2026-05-24 — setStep clears errors[] on backward nav to Upload when no run in flight) | User observation 2026-05-21 |
| [[cr-031-unplaced-neighbor-context]] | Show nearest placed neighbor + spec for each Unplaced fragment; one-click append | shipped | User observation 2026-05-22 |
| [[cr-032-inline-edit-review-cards]] | Pencil-icon edit on each Review-step text card; trim/expand/reword before Apply | shipped | User observation 2026-05-22 |
| [[cr-033-cv-supporting-evidence]] | Detect faculty CVs in self-study, route to spec/subspec, emit as supporting-evidence file at Apply | **shipped** (Phase 2 complete 2026-05-24/27 — cv_detector + TOC-anchored detector + UI card variant + standalone-CV upload all live) | User observation 2026-05-22 (Barry W. Thomas CV under 7.b) |
| [[cr-034-e2e-seed-endpoint]] | Dev-only POST /api/test/seed for deterministic Playwright fixtures; unblocks the full regression suite | **shipped** (2026-05-24 — seed router mounted, Zustand snapshot built from fixture, persists across refresh, Approve persistence shipped, 16 seeded specs green) | User direction 2026-05-22 |
| [[cr-035-matrix-row-keep-populates-curriculum-matrix]] | "Keep this row" writes original-document cell codes to the structured Curriculum Matrix at the resolved spec | **shipped** (2026-05-24 — investigation = Outcome A: apply path already writes structured cells. Shipped the coordinator confirmation banner on MatrixStep) | User observation 2026-05-22 (Spec 11.b row in Matrix step) |
| [[cr-036-ai-service-handshake-retries]] | Exponential-backoff retries on the cshse-server → ai-service initial handshake (closes the "AI service unreachable" demo failure) | **shipped** (2026-05-24 — 5 attempts, 500/1000/2000/4000ms backoff with jitter, 30s per-attempt timeout) | Demo failure 2026-05-22 |
| [[cr-037-empty-buckets-guard]] | Three-layer guard rejecting empty-bucket imports before the wizard advances to Review (closes the "empty Review screen" demo failure) | **shipped** (2026-05-24 — Defenses 2 + 3: server rewrites empty terminal to failed; ParseStep disables Next + banner. Defense 1 still pending in ai-service) | Demo failure 2026-05-22 |
| [[cr-039-standard-introduction-buckets]] | Add per-Standard + document-level Introduction buckets; route school-intro / mission / terms text there; allow move-into-intro + Add-from-source for intros; fix parser silent-drop | **shipped** (2026-05-24 — data model + apply path + auto-detection + walker fix + editor surface + persistence all live). NOTE: the editor surface is undiscoverable (buried sub-state) — discoverability fix tracked in [[cr-046-introduction-editor-surface-in-self-study]]; deferred `+ Add from source for Introduction` + `23_introduction.spec.ts` also folded into CR-046. | User observation 2026-05-23 (Stevenson 1.a card contained school intro, not 1.a content) |
| [[cr-040-appendix-papers-as-supporting-evidence-files]] | Detect appendix research papers, student work samples, AND course syllabi; capture their images; package each as a .docx; store in S3; surface as compact "View file" cards (single shared `evidenceDoc` kind with `docSubKind: 'paper' \| 'syllabus'`). **+ Post-parse coverage verification** — every source byte accounted for; missing fragments surfaced for coordinator action; boundary-validation warnings on paper/syllabus cuts | **shipped** (Phase 2c/3 complete 2026-05-24/27 — detector + image capture + .docx generation + S3 + View-file card + coverage verification all live) | User observations 2026-05-23 (Stevenson appendix; coverage-verification addendum) |
| [[cr-041-multi-file-drag-drop-with-batch-review]] | Multi-file drag-drop on Upload step; serial processing; merged Review across all files in a batch; "hold-for-review" flag (default ON); add-mid-flight; broken into 10 user stories (~12.5 days, sprint-ready) | **shipped** (follow-ons complete 2026-05-24/27 — multi-file drop + queue + batch review merge + edit-routing + Apply txn + source-file filter live. Out-of-scope: outer-transaction wrapping all children, OCR for image-only PDFs, redundant-content auto-detection) | User direction 2026-05-23 (PC bulk-uploads syllabi / papers / per-author sections) |
| [[cr-042-memberclick-sso-api-entry-point]] | **Public** SSO API — versioned (`/api/v1/`), OpenAPI 3.1 spec, per-key tiered rate limits + dashboards, sandbox env, status page; MemberClick is consumer #1 (with a **non-programmer admin walkthrough**: integration-package generator + relay endpoint with 4-defense validation — Referer + IP + auto-derived-domain-from-existing-CSHSE-users + timestamp); also the password-less E2E auth path (kills plaintext passwords in CR-034 fixtures) | **shipped** (Phase A 2026-05-24 — schema + `/api/v1/auth/sso-login` + `loginAsSeededViaSso`; Phase B 2026-05-27 — SSO ticket flow + Settings UI + MemberClick relay + OpenAPI + rate limits) | User direction 2026-05-23 (MemberClick + future partners + non-programmer admin steps + auto-derived domains + E2E password elimination) |
| [[cr-043-decouple-review-from-wizard-persist-across-reimport]] | **P0** — Decouple Review (and Matrix) from the AI Import Wizard's lifecycle. Promote both to first-class Self-Study Editor toolbar buttons; persist Review state on `Submission.aiReviewState` so it survives wizard close + re-open. Merge-in-place reimport with same-source dedupe. | **shipped** (2026-05-25/27 — Review + Matrix surfaces decoupled + persisted; aiReviewMerge dedupe; full unit/integration/E2E coverage) | User direction 2026-05-25 (PC import-twice loses approved + mid-edit items; clear-on-cutover guidance 2026-05-25) |
| [[cr-044-review-screen-typography-parity]] | **P2** — Review screen body text + card content moves from `text-xs` to `prose prose-sm` to match the Self-Study NarrativeEditor. Metadata chrome stays small. | **shipped** (2026-05-25 — Tailwind class swap across ItemCardList / ItemPreview / StandaloneCVReview / MissingFragmentsView) | User direction 2026-05-25 (annotated editor screenshot — "Correct Font size on this screen") |
| [[cr-028-matcher-worker-timeout]] | Add per-call timeouts to matcher Anthropic/OpenAI/Qdrant + outer safety net | shipped | User observation 2026-05-21 (matcher wedge) |
| [[cr-029-matrix-step-redesign-simple]] | **BLOCKER** — full redesign of Matrix step: one row at a time, verify against source, no editing | **shipped** (2026-05-24 — one-row-at-a-time verify-against-source MatrixStep redesign) | User feedback 2026-05-21 |

## Test plans + reviews

| Doc | Purpose | Status |
|---|---|---|
| [[../ai-import-wizard-e2e-regression-plan-2026-05-22]] | Full Playwright regression suite for the AI Import Wizard; depends on CR-034 | draft |
| [[../ai-import-wizard-e2e-coverage-review-2026-05-22]] | Coverage inventory + gap analysis + per-tier spec list; pre-go-live checklist | draft |
| [[../critical-error-processing-review-2026-05-22]] | Critical review of error handling across client / server / ai-service; 14 findings ranked by impact | draft |
| [[../test-plan-cr043-cr044-regression-2026-05-25]] | **P0 — ready to execute.** Complete test plan to close the CR-043 testing gap. ~30 unit tests for `aiReviewMerge.ts`, ~30 integration tests for `aiReviewController.ts`, ~10 E2E tests for the multi-import lifecycle (AC#3-#10, #12-#14), ~5 @slow Stevenson real-file integration tests driven via `page.setInputFiles()` (no drag/drop), plus regression sweep against every existing AI-Importer spec. Designed for a fresh Claude Code session to read + execute in the background. | **ready-to-execute** |

## P1 — required for general beta

| CR | Title | Status | Source |
|---|---|---|---|
| [[cr-002-multi-author-wizard-upload]] | Wizard accepts partial documents from multiple PCs | **superseded 2026-05-24** by [[cr-041-multi-file-drag-drop-with-batch-review]] | [[webinar-action-items-2026-05-20#44-07]] |
| [[cr-008-pre-submission-validation-popup]] | Pre-submit validation popup + warnings | proposed | [[webinar-action-items-2026-05-20#1-08-47]] |
| [[cr-009-compilation-tab-lead-reader]] | Side-by-side reader-scores compilation tab | in-progress | [[webinar-action-items-2026-05-20#compilation-tab]] |
| [[cr-010-portal-direct-messaging]] | Reader-to-reader portal direct messaging | proposed | [[webinar-action-items-2026-05-20#1-25-52]] |
| [[cr-011-suggestions-consolidation-doc]] | Consolidated suggestions doc per standard for VP for accreditation | proposed | [[webinar-action-items-2026-05-20#1-04-19]] |
| [[cr-012-site-visit-partial-compliance-tracking]] | Partial-compliance carried into site-visit checklist | in-progress | [[webinar-action-items-2026-05-20#1-05-53]] |
| [[cr-013-site-visit-itinerary-builder]] | Itinerary builder for lead reader + PC | in-progress | [[webinar-action-items-2026-05-20#1-26-47]] |
| [[cr-014-drag-drop-multi-file]] | Drag-and-drop multi-file upload to Supporting Evidence | **superseded 2026-05-24** by [[cr-041-multi-file-drag-drop-with-batch-review]] (scope fully absorbed) | [[webinar-action-items-2026-05-20#50-36]] |
| [[cr-015-narrative-hyperlink-preservation]] | URLs in pasted narrative remain clickable | **shipped** (2026-05-24 — TipTap Link extension explicit autolink/linkOnPaste + apply path auto-linkifies plain-text URLs) | [[webinar-action-items-2026-05-20#56-14]] |
| [[cr-018-ai-evidence-review-via-cshse-ai]] | Move evidence review off n8n into cshse-ai | **in-progress** (ai-service side built: extract/recommend/score endpoints + pypdf extraction live. NOT fully delivered — no production Reader-side caller, `cshse_evidence_{env}` Qdrant collection not bootstrapped, n8n nodes not archived. Blocked on the unbuilt Reader workflow, Sprints 4-5. Status corrected `shipped` → `in-progress` 2026-05-27.) | [[sprint-plan-2026-05-11#sprint-3]] |
| [[cr-023-julia-relay-workflow]] | Julia-as-relay model for comments + clarifications | proposed | [[webinar-action-items-2026-05-20#1-11-35]] |
| [[cr-024-matrix-spec-bidirectional-link]] | Matrix ↔ spec bidirectional link + AI eval reads matrix rows | **shipped** (2026-05-24 — Sprint 2B UI + Sprint 4 post-apply hotlink + AI eval scoreEvidence accepts matrixRows; future Reader-scoring caller has the contract) | User observation 2026-05-21 |
| [[cr-045-self-study-editor-toolbar-workflow-alignment]] | **P1** — Reorganize the Self-Study Editor toolbar around the PC's actual workflow. Plain-English vocabulary locked: group labels `IMPORT` / `DRAFTS` / `SELF-STUDY`; inner buttons `Upload Files` / `Review` / `Matrix` / `Standards` / `Curriculum Matrix` / `Files`. Four-chip wizard phase indicator above the toolbar (`1. Import → 2. Drafts → 3. Self-Study → 4. Submit`). Hide legacy importer behind cogwheel preference (default on). ~2h45m machine-time. | **shipped** 2026-05-27 | User direction 2026-05-27 (PC feedback: "UI is disorganized and does not reflect the workflow of the self-study") |
| [[cr-047-pc-dashboard-workflow-alignment]] | **P1** — Reorganize the PC landing dashboard (`/dashboard`) around the same IMPORT → DRAFTS → SELF-STUDY → SUBMIT workflow as CR-045. Surface the imported file, draft counts (CVs / Syllabi / Projects / Introductions / per-spec review items), and self-study committed counts. New `GET /:id/workflow-summary` rollup endpoint (no schema change — derived from `aiReviewState` + `standardsStatus`). Accreditation-admin panels (change requests, site visits) demoted below the workflow. Shipped 2026-05-28 (commits df24cb6 + d49cd5d) — server endpoint + `WorkflowSummary.tsx` + deep-links to Review; 6 server + 12 client + 2 e2e tests green on cshse-develop. ("Plans" == Projects, resolved at acceptance.) | **shipped** | User direction 2026-05-27 ("the PC Dashboard needs to be reorganized to follow the workflow") |
| [[cr-046-introduction-editor-surface-in-self-study]] | **P1** — **RESCOPED 2026-05-27** after code verification: the introduction editor (`IntroductionEditor.tsx`), the `PATCH /api/submissions/:id/introduction` route, and the `saveIntroduction` controller ALREADY EXIST from CR-039 Phase 2c. The real defect is **discoverability** — the editor only renders in the buried "Standard selected, no spec" sub-state. CR-046 surfaces the EXISTING editor via a discoverable `Introduction` button in CR-045's `SELF-STUDY` group + an `activeView='introduction'` branch. Reuse, don't rebuild. No new component, no new endpoint. ~45m machine-time. | **shipped** 2026-05-27 | User direction 2026-05-27 ("the Self Study editor is missing sections ... data flows from review directly to the final editor") |
| [[cr-048-finish-review-bookkeeping]] | **P1** — "Finish review" bookkeeping. Review drafts only had two implicit end states (approved→applied / discarded); no way to say "I've reviewed enough, the rest aren't included," so the count never hit zero and the editor kept auto-opening Review. New `POST /:id/review/finish` discards every un-triaged draft; DRAFTS counts (dashboard tiles, phase badge, open-on-Review) now reflect UN-TRIAGED items only (total − approved − discarded). Shipped 2026-05-29 (commit 6ace428) — 3 server + e2e tests green on cshse-develop. | **shipped** | User direction 2026-05-28 ("how do we say... I have done enough... it is not going to be included. We need to do that piece of bookkeeping") |
| [[cr-049-ai-section-evaluation-against-reader-criteria]] | **P1** — Final AI review of a section against the reader-review criteria: narrative + supporting-evidence list + submitted files + scraped web links → **pass / needs-improvement / fail** + rationale. PC improvement loop now; pre-populates the reader report on submission. New cshse-ai `POST /ai/section/evaluate` (reuses CR-018 evidence blocks). **Replaces the n8n validation webhook** and fixes a broken submit-path call (`submissionController.ts:550,758` invoke a non-existent `ValidationService.validateSection`). Sprint 2.5. | proposed | User direction 2026-05-29 (final AI review missing from all sprints; move off n8n) |

## P2 — backlog

| CR | Title | Status | Source |
|---|---|---|---|
| [[cr-016-in-app-bug-reporter]] | Screenshot + paragraph in-app bug report | proposed | [[webinar-action-items-2026-05-20#37-56]] |
| [[cr-019-joint-venture-pull-forward]] | Consider pulling Joint Venture work earlier | rejected | [[sprint-plan-2026-05-11#sprint-7]] |
| [[cr-020-account-lock-unlock-audit-trail]] | Admin lock/unlock audit-trail UI | in-progress | [[webinar-action-items-2026-05-20#1-11-35]] |
| [[cr-021-reader-uploaded-files]] | Readers can attach files to comments (partial relevant evidence) | proposed | new — implied by relay flow |
| [[cr-022-reader-assignment-lockout]] | Only Admin can reassign readers post-lockout | in-progress | new — implied by lockout flow |

## Retired CRs

Not in any sprint. Kept here for historical context + back-links.

| CR | Title | Retired | Reason |
|---|---|---|---|
| [[cr-038-railway-path-based-deploy-filter]] | Railway path-based deploy filter | 2026-05-23 | Dev environment is developers-only; production deploys are PR-cadence; [[cr-036-ai-service-handshake-retries]] handles runtime resilience for both. |

## Existing CRs that need revision

These are flagged in [[sprint-plan-2026-05-16]] and need to be rewritten or split:

| Existing CR | Conflict | Action |
|---|---|---|
| S4.1 / S4.2 / S4.3 / S4.5 | n8n evidence review pipeline | Supersede with [[cr-018-ai-evidence-review-via-cshse-ai]] |
| S2.1 | Reader-identity redaction is narrower than [[cr-004-comment-threading-identity-redaction]] | Broaden in next sprint plan |
| S5.10 | Reader DOCX report uses pass/fail | Add 0-3 rubric per [[cr-003-zero-to-three-compliance-rubric]] |
| S7.3 | Site visit checklist | Merge with [[cr-013-site-visit-itinerary-builder]] |

## How to add a new CR

1. Pick next free `cr-NNN` number (zero-padded).
2. Copy frontmatter from any existing CR file. Required fields: `cr_id`, `status`, `priority`, `source`.
3. Body sections in this order: Summary · Source quotes · Decision · Acceptance · Files affected · Dependencies · Open questions.
4. Add a row to the table above in the correct priority block.
5. Append [[log]] with `## [YYYY-MM-DD] update | change-requests`.
