---
name: Log
description: Chronological record of vault activity (ingests, queries that produced new pages, lints).
type: log
---

# Log

Append-only. Format: `## [YYYY-MM-DD] <action> | <subject>` followed by free-form body.

## [2026-05-25] ingest | CR-043 + CR-044 regression test plan written + ready to execute

The CR-043/CR-044 acceptance gap was 10 of 14 acceptance criteria implemented-but-not-tested, plus zero unit coverage on `aiReviewMerge.ts` (the heart of the CR). User direction: close the gap with a full regression suite, including Stevenson real-file integration driven via `page.setInputFiles()` (no drag/drop).

[[test-plan-cr043-cr044-regression-2026-05-25]] enumerates:
- Every function in `aiReviewMerge.ts` that needs unit tests (~30 tests across `sha256Hex`, `buildEmptyReviewState`, `mergeImportIntoReviewState` fresh + reimport branches, per-kind dedupe for tags/cvs/evidenceDocs/intros/placeholders, audit-log appending, `clearPreCR043State`).
- Every endpoint in `aiReviewController.ts` that needs integration tests (~30 tests across `getReviewState`, `approveItem`, `discardItem`, `clearItem`, `applyReviewState`, matrix-state get + set, plus cross-PC isolation which will SURFACE a known gap — `_loadOwnedSubmission` doesn't enforce creator scoping today).
- 10 E2E tests for the multi-import lifecycle (AC#3-#10, #12-#14) using a new `wizard_review_two_imports.json` fixture + a new `27_review_lifecycle.spec.ts`.
- 5 @slow E2E tests driving the real Stevenson splits in `~/Desktop/CSHSE/` via `page.setInputFiles()` — bypasses drag/drop entirely.
- A regression assertion that every existing AI-Importer spec still passes against the new wizard handoff.

The plan is structured so a fresh Claude Code session reads section 1 → 7 in order and produces the entire suite without further context. Estimated 8-12 hours of focused work. After execution, AI-Importer track moves from "implemented and hoping it works" to "regression-proof."

## [2026-05-25] update | CR-043 first-deploy migration tightened + CR-044 proposed

**CR-043 update.** Replaced the "auto-hydrate `aiReviewState` from prior `SelfStudyImport.aiBuckets/...`" risk-mitigation with the user's preferred cutover story: on first post-CR-043 import per submission, `receiveAICallback` explicitly **clears** pre-CR-043 wizard state on every prior `SelfStudyImport` record for that submission before writing the new `aiReviewState`. The clear is scoped to the submission, idempotent (only fires when `aiReviewState === null`), and audit-logged. Trade-off: coordinators with in-flight imports re-run them once at the cutover. Benefit: no risk of half-migrated state shapes colliding under the new merge rules. Two new acceptance criteria (#13 + #14) pin the cutover behavior.

**[[cr-044-review-screen-typography-parity]] proposed.** Review screen card body text renders at `text-xs` (~12px); the Self-Study NarrativeEditor uses `prose prose-sm` (~14px). The PC's eye re-calibrates every time they flip between the two surfaces during a multi-author workflow. CR-044 lifts the Review body baseline to match — card chrome (buttons / chips / metadata) stays small; only the *content* the coordinator reads to decide grows. ~1-2 hour Tailwind class swap across four files (`ItemCardList`, `ItemPreview`, `StandaloneCVReview`, `MissingFragmentsView`). Will also apply to the new ReviewSurface that [[cr-043-decouple-review-from-wizard-persist-across-reimport]] introduces.

## [2026-05-25] ingest | CR-043 proposed — decouple Review from the AI Import Wizard

User flagged a coordinator-breaking regression in the multi-author workflow: after a successful first import + partial Review (some approved, some mid-edit), clicking "Importer Wizard" a second time wipes the prior Review state. The `aiReviewState` lives in the wizard's Zustand store + localStorage cache; `startUpload` resets the whole structure. Reimport (the checkbox) doesn't help — it ships through to the matcher but doesn't change the merge-vs-wipe behavior on the client.

[[cr-043-decouple-review-from-wizard-persist-across-reimport]] proposes:
- Promote Review + Matrix to first-class Self-Study Editor toolbar buttons (currently buried inside the wizard's Stepper).
- Persist `aiReviewState` + `aiMatrixState` on `Submission` (server-side), so wizard close → re-open → second-file-drop doesn't destroy work.
- Rewrite "reimport" semantics to merge-in-place with strict (content-hash + filename) dedupe. No silent duplicate CVs / papers / syllabi.
- Approved-mark identity moves from volatile `sectionId` to immutable `itemSources` content hash so reimport doesn't wipe approval marks accidentally.
- Wizard Stepper collapses to Upload → Parse → "Open Review" handoff button; ApplyStep moves to the persisted Review surface.

Estimated 8-9 days. Sequencing: server schema first, then client decoupling, then UI toolbar restructure, then reimport merge logic + content-hash plumbing, then E2E coverage (new `26_review_persistence.spec.ts` for the multi-import scenario).

Supersedes the wizard-scoped state assumption in [[cr-041-multi-file-drag-drop-with-batch-review]] (which still ships per-batch state); CR-043 generalizes to one persisted Review state per Submission.

## [2026-05-10] setup | initial vault scaffolding

Created vault skeleton: CLAUDE.md (schema), index.md (catalog), overview.md (placeholder), README.md, glossary.md, log.md. MCP server `obsidian-vault` configured in project `.mcp.json`. Skills `challenge-obsidian` and `save-obsidian` installed under `.claude/skills/`.

## [2026-05-10] setup | testing infrastructure (Vitest + Playwright) + sprint plan

Stood up automated testing across all three layers and drafted the next-quarter sprint plan.

**Testing infrastructure (in repo, not vault):**
- Server: Vitest + supertest + mongodb-memory-server. Configured in `server/vitest.config.ts`. Setup in `server/tests/setup.ts` spins up in-memory MongoDB once per run, drops collections between tests. `server/src/index.ts` gated to skip `app.listen` and process error handlers under `NODE_ENV=test`. Three test files: unit user-model, integration auth-routes, integration webhook-callback-security (regression guard for audit C2). **23/23 passing.**
- Client: Vitest + RTL + MSW + jsdom. Configured in `client/vitest.config.ts` extending `vite.config.ts`. Setup in `client/src/test/setup.ts` includes MSW server with `onUnhandledRequest: 'error'`, plus jsdom polyfills (matchMedia, scrollIntoView, localStorage Map shim). Three test files: authStore role gating, api interceptor, HelpChat component. **20/22 passing, 2 skipped** with TODO note (api 401 interceptor test interacts with window.location stub + localStorage shim — needs vi.spyOn pattern instead of Object.defineProperty).
- E2E: Playwright at repo root in `e2e/`. Two specs: login + health smoke. `webServer` block intentionally commented out — the dev stack needs MongoDB/S3/n8n to be operator-managed; documented in TESTING.md.
- Docs: TESTING.md at repo root.

**New vault pages:**
- [[product-requirements]] — concept page synthesizing what the portal must do, drawn from the CSHSE Member Handbook (2024).
- [[evidence-document-review-pipeline]] — concept page documenting the missing AI workflow for reading evidence files (the gap the user surfaced: docs are uploaded to S3 but the n8n validation never opens them).
- [[sprint-plan-2026-05-10]] — eight-sprint plan: critical security (S1) → high security + RBAC tests (S2) → evidence-doc-review server+n8n (S3) → evidence-doc-review UI + email notifications (S4) → server+client test expansion (S5) → E2E coverage with seeded DB (S6) → common-error checks + completion checklist (S7) → polish (S8).

**Updated:**
- [[CLAUDE]] — added `plan` page type for forward-looking dated plans.
- [[overview]] — added link to product-requirements.
- [[glossary]] — added handbook terms (VPA, Lead Reader, BMA, Initial vs. Reaccreditation, Site Visit, Notice to Proceed, Tabled / Deny / Suspend / Revoke, Update Management Inc.).
- [[index]] — added new entries; added Plans section.

## [2026-05-10] audit | comprehensive application review (security, architecture, n8n, import, docs)

Ran a five-track parallel review of the entire codebase covering: backend security, backend architecture + storage, frontend architecture, n8n workflows + import flow, and incomplete features + documentation. Synthesized into eight pages.

**Created (concept):**
- [[system-architecture]]
- [[storage-layer]]
- [[import-pipeline]]
- [[n8n-integration]]
- [[frontend-architecture]]

**Created (review, dated):**
- [[security-audit-2026-05-10]]
- [[incomplete-features-2026-05-10]]
- [[documentation-gaps-2026-05-10]]

**Updated:**
- [[CLAUDE]] — added `review` page type with `audit_date` / `auditor` frontmatter.
- [[overview]] — replaced placeholder with real synthesis.
- [[index]] — added all new entries.
- [[glossary]] — populated CSHSE/tech terms.

**Top critical findings to act on:**
1. Hardcoded API key in [n8n-workflows/cshse-specification-loader-pdf.json:102](../../../../n8n-workflows/cshse-specification-loader-pdf.json) — rotate immediately.
2. JWT verification falls back to `'development-secret-key'` if `JWT_SECRET` unset — refuse to boot in production without it.
3. Four webhook callback endpoints are unauthenticated and the validation handler accepts arbitrary `submissionId` — HMAC-sign + dedup on `executionId`.
4. CORS is wide open (`app.use(cors())` with no options).
5. Help-chat sessions are keyed only on client-supplied `sessionId` — bind to authenticated user IDs.
6. `isS3Configured()` is called from the evidence controller but not exported from `s3Service`; evidence storage silently falls back to base64-in-Mongo, defeating the recent S3 work.

Coverage gaps explicitly out of scope this run: no end-to-end manual UI testing, no live n8n test, no infrastructure / Railway-config audit, no review of the [cshse-parts/](../../../../cshse-parts/) directory.

## [2026-05-10] audit | comprehensive client+backend review and module catalog (answers user's "EC3 folders" question)

User requested a comprehensive review of all client + backend code, documentation of the import flow, evidence/standards indexing, narrative storage + AI evaluation, and "what needs to change to evaluate files stored in the EC3 folders."

**Spot-checked existing concept pages** ([[system-architecture]], [[import-pipeline]], [[storage-layer]], [[n8n-integration]], [[frontend-architecture]], [[product-requirements]], [[evidence-document-review-pipeline]]) — all accurate against current code; no edits required beyond a clarification on `evidence-document-review-pipeline`.

**Created (concept):**
- [[narrative-storage]] — the doubly-nested `Map<standardCode, Map<specCode, INarrativeContent>>` shape on `Submission`, the Mongoose-8 Map persistence trap (`markModified('narratives')` vs atomic `$set`), the edit lifecycle (TipTap → useAutoSave → controller → Mongo), and how `validationService` packages a Spec for AI evaluation. Cited at `path:line` throughout.
- [[module-catalog]] — every server route ↔ controller ↔ service ↔ model and every client page ↔ feature ↔ component, one-line each. Acts as the "where is X" index.

**Created (review, dated):**
- [[code-review-2026-05-10]] — comprehensive verify-and-catalog pass; explains how files are saved/indexed under standards and Specs (S3 key `{institutionId}/{versionId}/{filename}` + Mongo compound indexes); answers the "EC3 folders" question (term not in code; it's the user's external shorthand for what needs to become an evidence-class layer or, more likely, just the AI-reads-the-files work in [[evidence-document-review-pipeline]]); sequences the work.

**Updated:**
- [[evidence-document-review-pipeline]] — added the EC3 clarification + a tighter line citation for the metadata-only evidence query.
- [[index]] — added [[narrative-storage]], [[module-catalog]], and [[code-review-2026-05-10]]; cleared the "Missing" tag on [[evidence-document-review-pipeline]].

**New observations from this pass:**
- Server tests now run; **3 of 23 fail** — `auth-routes > PUT /api/auth/change-password` returns 404 instead of 200/403/400. Likely route-mounting drift since the tests were written. Tracked for the next [[incomplete-features-2026-05-10|incomplete-features]] update.
- Confirmed "EC3" string is **absent** from the entire codebase, both standards PDFs, the Member Handbook, and every n8n workflow. Logged in [[code-review-2026-05-10]].
- Confirmed the import-side narrative collision policy is **append, not overwrite** ([importController.ts:1531-1533](../../../../server/src/controllers/importController.ts)) — re-running the same import will duplicate every narrative. Documented in [[narrative-storage]].

## [2026-05-10] audit | client-side deep dive on every features/* file (prep for evidence-AI work)

User instructed: read every file under `client/src/features/`, `pages/`, `components/`, `hooks/`, `services/`, `store/`, `lib/` to full depth so we can plan changes around evidence-file storage in the self-study screen ("EC3 folders"). Five parallel Explore agents covered the bulk; I personally read the 4-file EvidenceManager + EvidencePanel + 955-line FileLibrary critical path so the citations are first-hand.

**Created (concept):**
- [[evidence-file-storage]] — durable concept page on the file-upload critical path. Documents all THREE upload surfaces (`EvidencePanel` inline / `EvidenceManager` split-panel / `FileLibrary` accordion-by-Standard) sharing one backend endpoint. Maps "EC3 folders" → the per-(Standard, Sub-standard) accordion buckets in `FileLibrary`. Includes the data model, S3 key convention, server contract, and a checklist of changes for evidence-AI review keyed to each UI surface.

**Created (review, dated):**
- [[client-features-deep-2026-05-10]] — file-by-file documentation of all ~22,000 lines of client features code. Pages, shared components, hooks, services, store, lib all covered too. New findings table at the end captures issues not in the prior audit.

**Updated:**
- [[index]] — added [[evidence-file-storage]] under Architecture & systems and [[client-features-deep-2026-05-10]] under Reviews.

**New observations from this pass (not in prior audits):**
- Three independent upload UIs share one backend (`EvidencePanel` + `EvidenceManager` + `FileLibrary` all `POST /api/submissions/:id/evidence/upload`). Adding evidence-AI-review pills means touching all three.
- `FileLibrary.tsx` (955 lines) is the canonical "evidence folders" view — accordion by Standard, sub-section by Sub-standard. **This is what the user calls "EC3 folders."** Files without a Standard/Spec assignment ("unassigned") are bucketed in code but **never rendered** — invisible in this view; only `EvidenceManager`'s "Unlinked" filter exposes them.
- `EvidenceViewer.tsx` (in EvidenceManager) hardcodes `Array.from({length: 21})` and `['a'..'h']` for its link-to-Standard dropdown ([EvidenceViewer.tsx:283-304](../../../../client/src/features/selfStudy/EvidenceManager/EvidenceViewer.tsx)). FileLibrary fetches the live standards list correctly. Bug-prone divergence.
- Two description fields on `SupportingEvidence` (`description` vs `metadata.description`); UI fallback to either. Dead-tech-debt.
- `imageMetadata.ocrText` and `linkedNarratives[]` fields exist on the model but are never populated — dead schema.
- Many independent polling timers (lock 30s, validation 3s/60s, AI loading 2s, help-doc 3s, progress 30s) — no coordination.
- Two `dangerouslySetInnerHTML` sites — `DocumentViewer` (already known XSS risk) and `CurriculumMatrixEditor.tsx:171` (also imported HTML — same risk).
- `SelfStudyEditor.tsx` has 40+ useState slices for the import workflow — strong candidate for `useReducer` or a state machine.

## [2026-05-10] audit | deep import-marker mechanism + repo-docs cross-referencing

User asked for a complete documentation of how the import flow marks the original file with placeholder markers and shortens what's left, including how it's stored in the database. Then opened `docs/api.md` and instructed: "make sure you read these files and add to the documentation."

**Created (concept):**
- [[import-marker-mechanism]] — deep mechanical companion to [[import-pipeline]]. Documents the two-step extract operation (`extract-section` saves metadata to MongoDB; `insert-marker` is what actually shortens the GridFS HTML). The `<!-- EXTRACTED:sectionId:type:title:length -->` marker format. The text-walker that maps plain-text offsets to HTML byte positions. Table-aware boundary expansion + `TABLE_FRAG_START/END` wrappers so non-tagged rows stay visible. Two-pass streaming restore. /tmp + GridFS + MongoDB triple-storage with stage-by-stage lifecycle table. Three-tier repair flow (T1 direct removedHtml match → T2 text-offset matching with table-splitting → T3 sequential re-find for overlaps). Memory-safety patterns including `flattenString()` for V8 SlicedString/ConsString chains. Diagnostics, mongosh queries, server log signatures.
- [[repo-docs-reference]] — index of the four authoritative markdown docs that live in the application repo at `/docs/`: IMPORT_PROCESS_REFERENCE.md (792 lines), api.md (1475), n8n-workflow-integration-guide.md (675), claude-code-web-interface-prompt.md (740, design-intent only). Drift table tracks where these disagree with current code.

**Updated:**
- [[n8n-integration]] — added workflow IDs (UWg1TsqA9Bmc7NFg / B9fsLY5OK5H1C245) and a doc-vs-code drift table.
- [[narrative-storage]] / [[evidence-file-storage]] — corrected the spec-letter range from `a-h` to `a-f` (verified against [data/standards.ts](../../../../server/src/data/standards.ts)). Flagged [EvidenceViewer.tsx:300](../../../../client/src/features/selfStudy/EvidenceManager/EvidenceViewer.tsx) as a real bug — its hardcoded `['a'..'h']` dropdown offers `g` and `h` which do not map to any real Spec.
- [[index]] — added [[import-marker-mechanism]] and [[repo-docs-reference]].

**Drift findings (verified 2026-05-10):**
1. `data/standards.ts` defines specs `a`–`f` only; UI hardcoding of `a`–`h` in EvidenceManager is a real bug (allows linking evidence to non-existent specs).
2. n8n workflows actually use `gpt-4o-mini` — `docs/n8n-workflow-integration-guide.md:29` claims `gpt-4-turbo` (stale).
3. Spec-loader actually uses `text-embedding-ada-002` (1536 dims), not `text-embedding-3-small` as the doc claims.
4. `docs/api.md:95-109` documents `POST /auth/refresh` which does not exist in code ([api.ts:31-43](../../../../client/src/services/api.ts) explicitly says "no token refresh").
5. The repair pipeline uses three matching tiers + `flattenString()` for memory safety — fully documented in `IMPORT_PROCESS_REFERENCE.md` but not in any wiki page until now.

**Key insight from cross-checking:** The two halves of the import storage that I had described separately are tied together by `finishTagging`, which deletes BOTH the GridFS HTML and `/tmp/imports/{importId}/` after applying sections to `Submission.narratives`. After `finishTagging`, the only durable copy of section content lives in `SelfStudyImport.detectedSections[].htmlContent` — surprising but documented behaviour (per IMPORT_PROCESS_REFERENCE §5).

## [2026-05-11] audit | product-requirements vs code audit (supersedes 2026-05-10 incomplete-features)

User asked: "audit the code, architecture, and implementation to create a document to add to incomplete-features.md, using product-requirements.md as a guideline." Per vault schema rules, review pages are dated and not edited in place — so I created a new dated review that supersedes the prior one.

**Created (review, dated):**
- [[incomplete-features-2026-05-11]] — product-requirements-driven audit. Walks tier-by-tier through [[product-requirements]] and asks "where is this in the code?" Each requirement gets one of ✅ implemented / ⚠️ partial / ❌ missing / 🚫 compliance gap. Carries forward every item from the 2026-05-10 review with a status column.

**Updated:**
- [[index]] — linked [[incomplete-features-2026-05-11]] and marked [[incomplete-features-2026-05-10]] superseded.

**The most consequential findings this audit surfaces (NEW, not in the prior review):**

1. **🚫 H1 — Reader identity leaks to Program Coordinators via comments.** [server/src/controllers/commentController.ts:181-192](../../../../server/src/controllers/commentController.ts) persists `authorName: req.user!.name + authorRole`. The Handbook says "Reader feedback is confidential and available only to Board members" — this is a real violation, not just a doc gap. Fix: role-aware display-name resolver at read time (`Reader 1`, `Reader 2`, `Lead Reader`).
2. **🚫 H2 — No impersonation audit log.** Superuser can `X-Impersonated-Role` into any role with zero trail. Compliance blocker for handling real submissions.
3. **🚫 H3 — URL accessibility check is purely cosmetic.** [evidenceController.ts:466](../../../../server/src/controllers/evidenceController.ts) hardcodes `isAccessible: true`; nothing ever updates it. Handbook says links must work and NOT be password-protected.
4. **🚫 H4 — PDF preference not enforced.** Word/PowerPoint/Excel/images all allowed without conversion prompt.
5. **⚠️ T1.2 — Curriculum matrix has a rich backend but the client is view-only.** `matrixController` exposes addCourse / updateAssessment / duplicateStandardRow / etc.; `CurriculumMatrixEditor.tsx` only displays imported rawContent HTML. This is the largest "we're already half done" feature.
6. **⚠️ T1.5 — `LeadReaderCompilation` has 16 backend endpoints** including disagreement detection, comment threads, reader reminders, bulk determinations. Surprising depth that's likely under-surfaced in the UI.
7. **❌ T2.2 — Handbook §IV "Common Errors" — none implemented.** Matrix↔narrative congruence, missing Specs, missing required document types, inconsistent data, unlinked references, broken links. All mechanizable.
8. **❌ T2.4 — No Self-Study Completion Checklist.** A coordinator can submit with zero evidence.
9. **⚠️ T2.7 — 45-day reader deadline.** `Review.assignedAt` exists, `dueAt` doesn't. No overdue detection or reminder cron.
10. **🟡 Status change — "no tests" item from 2026-05-10 is now PARTIAL** (Vitest + Playwright landed; coverage is thin).

**Drift confirmations from this audit:**
- Spec letters: code defines `a`–`f` only; EvidenceViewer hardcodes `a`–`h` — a real bug allowing linkage to non-existent specs. (Already flagged in [[evidence-file-storage]] / [[repo-docs-reference]].)
- N8N Document Matcher still uninvoked at [importController.ts:3176](../../../../server/src/controllers/importController.ts).
- `isS3Configured()` still bug-ridden.

**Suggested re-sequencing of [[sprint-plan-2026-05-10]]:** H1+H2 first (compliance blocker), then emails+reader deadlines, then isS3 fix + evidence AI review, then matrix client editor, then completion checklist + link/PDF hygiene together.

## [2026-05-11] update | new 6-sprint plan structured for Claude Code consumption

User asked for a 6-sprint plan that (a) reads as actionable Claude Code instructions and (b) covers every shortfall from the incomplete-features list, security audits, and prior plans. Per vault schema, plans are dated and superseded rather than edited in place — so I created [[sprint-plan-2026-05-11]] which supersedes [[sprint-plan-2026-05-10]] (compressed 8→6 sprints by merging adjacent themes and re-prioritising against the product-requirements audit).

**Created (plan):**
- [[sprint-plan-2026-05-11]] — 6 sprints × 2 weeks (~12 weeks total). Each of ~50 stories carries:
  - Source citation (which audit / Handbook rule / requirement it fixes)
  - Context: the durable concept page Claude should read first
  - Files: exact paths and line ranges to change
  - Steps: concrete instructions
  - Acceptance criteria as a checklist
  - Tests required with file paths
  - Estimate in days
  - Dependencies on other stories
- Structured so Claude Code can pick up any single story and execute it without re-reading the whole plan.

**Sprint shape:**
1. **S1 Compliance + Critical Security** — H1 reader-identity redaction, H2 impersonation audit, H3 URL probe, H4 PDF preference, C1 key rotation, C3 JWT_SECRET boot guard, C2/M7/M8 HMAC callbacks, C4 CORS, C5 help-chat binding, isS3 fix. (10 stories, ~12d)
2. **S2 Auth Hardening + Input Validation** — H1 rate-limit, H7 forgot-password, H2 short JWT + refresh, H3 sanitize-html on import, H5 httpOnly cookies, H6 Zod validation, H4 admin-reset audit, M2 default-deny, M5 magic-byte upload. (9 stories, ~13d)
3. **S3 Evidence AI Review + Emails + Reader Deadlines** — new n8n workflow, trigger endpoint, HMAC callback, dedup cache, retry/backoff, OCR fallback, 11+ stubbed email sites, 45-day reader cron. (8 stories, ~14d — tight)
4. **S4 Evidence Review UI + Curriculum Matrix Editor** — pills in 3 surfaces, validation modal Evidence tab, **spreadsheet matrix editor** (the largest "half-done" feature), spec-letter dropdown fix, unassigned accordion, dead-field cleanup, bulk upload. (7 stories, ~10.5d)
5. **S5 Common-Error Checks + Completion Checklist + Tests** — matrix↔narrative congruence, missing-Specs check, missing-required-docs, unlinked references, completion checklist pre-submit gate, server tests (marker round-trip, S3, RBAC matrix), client tests, auth-routes test fix. (7 stories, ~13d)
6. **S6 Board Decisions + Cycle Scheduler + E2E + Polish** — informal/formal/web-post automation, 5/10-year cycle reminders, 2-year initial deadline, mock site-visit template, **4 E2E journeys + seed endpoint**, DOCX→PDF conversion, restore-marker atomicity, ops runbooks, accessibility, ErrorLog TTL, re-audit. (10 stories, ~16d — likely overflows; defer S6.5 if needed)

**Updated:**
- [[index]] — added [[sprint-plan-2026-05-11]] and marked [[sprint-plan-2026-05-10]] superseded.

**Key design choices for Claude-Code consumption:**
- Each story is self-contained: source → context → files → steps → acceptance → tests → estimate → blocks.
- File citations include line numbers from current code (verified against today's state).
- Context links point to durable concept pages, not other review pages, so a Claude Code agent has stable references.
- Acceptance criteria are verifiable outcomes, not handwavy goals.
- Cross-cutting tracks (test ratchet, concept-page freshness, drift sweeps) are called out as not single-sprint so they don't get dropped between sprints.

## [2026-05-11] update | sprint plan stories expanded with 3-layer test plans + email-server-config story

Two follow-up changes to [[sprint-plan-2026-05-11]] in response to user feedback. Edited in place (same-day refinement, not drift — schema's "supersede with a new dated plan" rule kicks in once a plan is partially executed).

**Test plans (3-layer structure):** Every one of the ~50 stories now has a `**Test plan:**` block with three layers:
- **Unit** — isolated functions/components with mocked deps (`server/tests/unit/`, `client/src/**/*.test.tsx`).
- **System / integration** — full HTTP route or fully-wired component with real DB (mongodb-memory-server) / MSW.
- **E2E** — Playwright in `e2e/tests/`, typically rolled into one of the 4 S6.4 journeys to keep the suite under 5 min.

Stories where a layer doesn't apply are explicitly marked `N/A` with a reason (pure cron with no UI → no E2E; documentation work → no integration). Honest rather than padded. Added a "Test plan conventions" section near the top documenting the three stacks (Vitest+supertest+mongodb-memory-server / Vitest+RTL+MSW / Playwright), test-file path conventions, and the post-S5 coverage ratchet rule (no PR may drop line coverage by >0.5%).

**New story for email server env config:** S3.7 — Email server env config + sender identity. Added at user's request. Covers env keys `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`, `EMAIL_DOMAIN`, `EMAIL_REPLY_TO`. New `server/src/config/email.ts` validates at boot in production; dev falls back to JSON transport. New admin page surfaces config (read-only, no secrets) and offers a "Send test email" button. Domain mismatch between `EMAIL_FROM_ADDRESS` and `EMAIL_DOMAIN` causes a clear boot error. Pre-dates the existing wire-up story so all stubbed call sites can go through one central `sendEmail()` wrapper. Renumbered the old S3.7→S3.8 and S3.8→S3.9; Sprint 3 grew from 8 stories to 9 (+1.5 days estimate).

**Notable design choices:**
- E2E coverage rolls up to the S6.4 journeys wherever possible — 50 stories × 1 dedicated spec each would make the E2E suite unmaintainable. Security-critical surfaces (auth lifecycle, cookie auth, forgot-password) get dedicated specs.
- For pure-server infra changes (CORS config, cron jobs, model migrations), integration tests carry the weight; E2E is N/A.
- For pure-UI presentational changes, unit-level testing is N/A and integration (RTL with MSW) is the main layer.
- The vault schema rule that plans get superseded rather than edited still holds; this is a same-day refinement (the plan was created today, hasn't been acted on). When the plan starts being executed and reality diverges, the next change will be a new dated plan.

## [2026-05-11] setup | added Marketing/ folder + marketing-plan-2026-05-11

User asked for website sales copy + a 3-minute Heygen video script + screen-capture B-roll plan for the CSHSE Accreditation Self-Study Portal v1 launch. Since this is customer-facing rather than engineering content, created a sibling top-level folder `Marketing/` to keep it out of the Engineering namespace.

**Created (marketing, dated):**
- [[marketing-plan-2026-05-11]] (in `Marketing/`) — full launch package: §1 website sales copy with hero + body + 10 feature bullets; §2 full 3-minute Heygen master script (~440 words, single copy-paste block); §3 nine-scene film plan as a table (timing × scene × narration × B-roll directions × text overlay/type-in); §4 step-by-step filming instructions (no production budget — screen capture + Canva overlays); §5 per-scene Heygen scripts ready for segmented production; §6 honest caveats (newsletter is marketing-site only; matrix editor not yet shipped; AI score example illustrative; impersonation no audit log); §7 run-time summary; §8 distribution channels — **pivoted mid-write to publish via cshse.org (CSHSE's existing website) rather than building a separate landing page** after user clarification; §9 iteration plan (v1.1 after matrix editor lands, v1.2 after compliance work, v2.0 with customer testimonial).

**Updated (schema):**
- [[CLAUDE]] — added `Marketing/` to the top-level folders list; added `marketing` page type ("dated, forward-looking marketing artefact for a launch or campaign — supersede when product or messaging changes"); added `plan_date` + `status` frontmatter fields shared by `plan` and `marketing` types.
- [[index]] (in Engineering/) — added a "Sibling folders" section linking to `Marketing/` and the current artefact.

**Notable choices:**
- New folder rather than nesting under Engineering — marketing artefacts have a different audience (CSHSE staff + prospects vs engineers), different update cadence (campaign-driven, not code-driven), and different change rules (re-record on product update, not on code change). Forcing them into Engineering would pollute the namespace.
- Marketing plans follow the same dated-supersede rule as engineering plans — v1.1 / v1.2 will be new dated files when product changes warrant re-filming, not edits to v1.0.
- Distribution pivot: original draft assumed a new product landing page; user clarified CSHSE has their own website (cshse.org), so the plan now treats cshse.org as the publishing target and routes Scene 9's CTA to a cshse.org URL slug to be coordinated with CSHSE staff. Newsletter scene now references CSHSE's existing newsletter rather than mocking a Mailchimp-style signup.

## [2026-05-11] update | added user-requested multi-PC + Joint Ventures (Sprint 7)

User raised two product requirements not in the 2024 Member Handbook:
1. **Multiple Program Coordinators per Institution** (U1) — different departments at one institution often have different PCs.
2. **Joint Ventures** (U2) — group 2+ institutions for dashboard organization and aggregate reporting; **explicitly cosmetic / UI only — no permission changes.**

**Updated (concept):**
- [[product-requirements]] — added a "User-requested additions (post-Handbook, 2026-05-11)" section documenting U1 and U2 in detail. These supplement (not supersede) the Handbook-derived requirements.

**Updated (plan):**
- [[sprint-plan-2026-05-11]] — added S2.10 (multi-PC) to Sprint 2 and a brand-new Sprint 7 (Joint Ventures) with 4 stories: S7.1 (data model + API), S7.2 (admin UI), S7.3 (dashboard grouping), S7.4 (reporting roll-up). Header / horizon / at-a-glance / success metrics / out-of-scope sections all updated to reflect 7 sprints.
- Plan grew: 6 → 7 sprints, 52 → 56 stories, ~80 → ~90 days, ~12 → ~14 weeks at one engineer.

**Why S2.10 is in Sprint 2, not Sprint 7:**
- Multi-PC is foundational — every RBAC test from S5.5 onwards must run against the multi-PC model. Adding it late forces rework on completed RBAC code.
- Sits naturally inside Sprint 2's auth + RBAC theme.
- 3 days of work; parallelizable against the bigger S2.3/S2.5 stories.

**Why Joint Ventures is its own sprint:**
- Cleanly isolated additive feature — depends only on S2.10 and S6.4 (E2E).
- Substantial enough (4 stories, 7 days) to deserve its own theme.
- Could in principle defer post-beta if scope pressure arises, but the user has been explicit (no corner-cutting); included as full beta scope.

**Test plans for the new stories** follow the same 3-layer convention (unit / system / E2E) as the rest of the plan; E2E stories extend the existing S6.4 admin journey with a JV setup + grouping check.

**Beta gate impact:** the beta-readiness summary (chat-only) now includes Sprint 7 in the required set. All 7 sprints are beta-blocking; the user's earlier "do not cut corners" directive carries forward.

## [2026-05-11] update | template-driven curriculum matrices (U3 added; S4.3 revised, S4.8 + S4.9 added)

User supplied three Google Docs links containing CSHSE's official curriculum matrix templates (Associate, Baccalaureate, Master's) and asked for the editor to be revised to:
1. Include the template documents (visible inside the editor as the generation source).
2. Allow user to fill in fields to generate a matrix (or more) for each listed standard.
3. Follow the directions and fill in the missing data.
4. Allow a new matrix for each set of courses for each spec.

Fetched the three docs via Google's text-export endpoint. Got structural summaries (Google's pipeline returned summaries rather than full verbatim text for the full templates). Extracted enough detail to design the work cleanly:
- Associate template: Standards 11–20, 250 field hours.
- Baccalaureate template: Standards 11–21, 350 field hours.
- Master's template: Standards 11–21.
- Coding system: content type `I` (Introduction) / `T` (Theory) / `K` (Knowledge base) / `S` (Skills) **combined with** depth `L` / `M` / `H`. Multiple letters allowed per cell.
- Key directions: use as many versions of the matrix as needed for all required courses; course numbers in header columns (vertical); each matrix-listed course must be referenced in the narrative; multiple letters allowed per box.

**Updated (concept):**
- [[product-requirements]] — added U3 (template-driven curriculum matrices, multi-matrix per submission). Notes the 3 source documents and the requirement that templates land in `docs/matrix-templates/` as version-controlled DOCX files.

**Updated (plan):**
- [[sprint-plan-2026-05-11]] — **revised S4.3 substantially** (was: generic spreadsheet editor; now: template-driven with directions panel, new-matrix modal, multi-letter cells). Estimate up from 4 → 5 days. **Added S4.8** (template registry: static `data/matrixTemplates.ts` modeled on `data/standards.ts`, plus controller endpoints + DOCX streaming, 1.5 days). **Added S4.9** (multi-matrix per submission: list view inside Matrix tab with "+ New Matrix" workflow, 2 days). Sprint 4 grew from 7 → 9 stories and 10.5 → 14 days; will overflow a single-engineer 7-day sprint, noted in Sprint 4 success metrics. All at-a-glance / overall-metrics tables updated.

**Plan totals:**
- 7 sprints → 7 sprints (no new sprint added; Sprint 4 absorbs).
- 56 stories → 58 stories.
- ~90 days → ~94.5 days.
- ~14 weeks → ~14.5 weeks at one engineer.

**Test plans for the new stories** follow the 3-layer convention (unit / system / E2E):
- Unit: cell-edit logic, multi-letter rendering, virtualization performance, template-registry consistency, directions render, list view.
- System / integration: create-from-template fires correct POST; multi-letter `type[]` array persists; template `specText` matches `data/standards.ts` byte-for-byte (anti-drift test); multi-matrix per submission persists + archives.
- E2E: extended S6.4 coordinator journey covers create-from-template, fill cells with multi-letter combinations, create a second matrix, archive one.

**Open item:** user must save the three CSHSE-issued DOCX files into `docs/matrix-templates/{associate,baccalaureate,masters}-matrix-template.docx` before S4.8 implementation begins. Sprint plan flags this as a hard prerequisite.

## [2026-05-14] update | reader-report DOCX export added (U4; S4.10)

**Trigger:** Product owner provided three Google Doc reader-report templates (one per degree level — Associate `1YBs8V1LDNTvob80xU-dFQOCMCpEtwH07`, Baccalaureate `1Xz8VItPH0a4OKuUttZK69WlK1D7XzmLB`, Master's `13uvbdX5ySF6ygJJ4MkN2hiW5zMBk4OiO`) with a new workflow requirement: each reader generates a single Word-document report (filled from the template matching `review.programLevel`), with their comments placed by Standard / Sub-standard. The DOCX is auto-uploaded to shared storage (S3) on review submit so the Lead Reader can compile without manual upload.

**Updated (concept):**
- [[product-requirements]] — added **U4. Reader report — template-based DOCX export**. Documents the 3 template sources, S3 storage layout (`reader-report-templates/{level}.docx` + `submissions/{submissionId}/reader-reports/{reviewerId}.docx`), placeholder convention (`{{standardN[_specM]_comments}}`), and that the existing [Comment.standardCode](../../../server/src/models/Comment.ts) / `specCode` fields already carry the routing data so no schema migration is needed.

**Updated (plan):**
- [[sprint-plan-2026-05-11]] — **added S4.10** "Reader-report DOCX export from template + auto-share with Lead Reader" (3 days). New `server/src/data/readerReportTemplates.ts` registry, `server/src/services/readerReportGenerator.ts`, controller + routes, admin upload UI, reader "Generate Report" button, lead-reader download list. Triggered automatically from `submitReview` ([reviewController.ts:470](../../../server/src/controllers/reviewController.ts#L470)) so the S3 copy is ready by the time the Lead Reader looks. Sprint 4 grew from 14 → 17 days; will overflow a single-engineer 7-day sprint or partially spill into Sprint 5. At-a-glance roster + overall metrics tables updated.

**Plan totals:**
- 7 sprints → 7 sprints (no new sprint).
- 58 stories → 59 stories.
- ~94.5 days → ~97.5 days.
- ~14.5 weeks → ~15 weeks at one engineer.

**Test plan for S4.10** follows the 3-layer convention:
- Unit: generator placeholder substitution; registry vs `data/standards.ts` anti-drift.
- System / integration: `POST .../generate` writes to S3 + persists `Review.readerReportS3Key`; `submitReview` triggers generation; RBAC matrix (authoring reader / lead reader / admin succeed; PC + other readers 403); admin template-upload UI multipart POST.
- E2E: extended S6.4 reviewer journey covers generate → download → Lead Reader sidebar shows the new file.

**Open items:**
- User must save the three Google Doc reader-report templates as DOCX into `docs/reader-report-templates/{associate,bachelors,masters}-reader-report-template.docx` with the `{{standardN[_specM]_comments}}` placeholders before S4.10 implementation begins. Hard prerequisite mirrored from the matrix-template pattern.
- `docxtemplater` + `pizzip` need to be added to `server/package.json` as part of S4.10 setup.

## [2026-05-14] update | reader-report DOCX export (U4 added; S4.10 added)

User supplied three Google Docs links containing CSHSE's official reader report templates (Associate, Baccalaureate, Master's) and asked for a new story that:
1. Uploads the three templates into shared storage (S3).
2. Collects each reader's comments on the self-study and exports a single Word document, with comments placed by Standard / Sub-standard.
3. Auto-copies the generated DOCX to shared storage so the Lead Reader can pick up all reader reports as input for compilation.
4. The reader generates the report when their review is complete.
5. There is **one report per reader per submission**; the template is chosen by `review.programLevel`.

Source documents (Google Doc IDs):
- Associate: `1YBs8V1LDNTvob80xU-dFQOCMCpEtwH07`
- Baccalaureate: `1Xz8VItPH0a4OKuUttZK69WlK1D7XzmLB`
- Master's: `13uvbdX5ySF6ygJJ4MkN2hiW5zMBk4OiO`

**Updated (concept):**
- [[product-requirements]] — added **U4** (reader-report template-based DOCX export). Header updated: user-requested additions now span 2026-05-11 (U1/U2/U3) + 2026-05-14 (U4); planned-in pointer extended to `S2.10, S4.10 + Sprint 7`.

**Updated (plan):**
- [[sprint-plan-2026-05-11]] — **added S4.10** in Sprint 4 (reader-report DOCX generator + admin template upload + reader generate-button + lead-reader download list; 3 days). Sprint 4 success metrics and total-estimate roll-up updated (~14 → ~17 days). Anti-drift safeguard: template placeholder names cross-checked against [data/standards.ts](../../../../server/src/data/standards.ts) at module load.

**Plan totals:**
- 7 sprints → 7 sprints (no new sprint added; Sprint 4 absorbs).
- 58 stories → 59 stories.
- ~94.5 days → ~97.5 days.
- Single-engineer Sprint 4 overflow now firmly two-engineer territory or partial spill into Sprint 5.

**Reuse over new infrastructure** — S4.10 builds on what already exists:
- [Comment.standardCode / specCode](../../../../server/src/models/Comment.ts) — already model comment placement by Standard / Sub-standard.
- [s3Service](../../../../server/src/services/s3Service.ts) — already provides `uploadFile`/`downloadFile`/`isS3Configured`.
- [reportController.generateReaderReportPDF](../../../../server/src/controllers/reportController.ts) — provides the RBAC pattern for the new DOCX handler.
- [reviewController.submitReview](../../../../server/src/controllers/reviewController.ts) — the hook for async DOCX generation on review completion.

**New dependencies:** `docxtemplater` + `pizzip` (both MIT). No `libreoffice` needed — DOCX is the output, not the input.

**Test plans for the new story** follow the 3-layer convention:
- Unit: generator placeholder substitution + registry anti-drift (`placeholderMap` ⊆ `data/standards.ts`).
- System / integration: generate endpoint persists `Review.readerReportS3Key` and uploads to the expected S3 key; submit-review auto-generates within 2s; RBAC matrix (reader-not-author / PC / authoring-reader / lead-reader / admin); admin template-upload UI replaces the active S3 copy.
- E2E: extends S6.4 reviewer journey — complete a review → "Generate Report" → DOCX downloads → Lead Reader view lists the new file.

**Open items / hard prerequisites:**
- User must save the three Google Doc templates locally as `.docx` and commit to `docs/reader-report-templates/{associate,bachelors,masters}-reader-report-template.docx` before S4.10 implementation begins (mirrors the S4.8 pattern for matrix templates).
- Placeholder pattern is `{{standardN_comments}}` and `{{standardN_specM_comments}}`. The templates' static "comment goes here" cells must be replaced with these tokens.

## [2026-05-14] update | sprint work moves to developer branch (consistent with main baseline)

Per user direction: the sprint-plan + product-requirements baseline (with U4 / S4.10 added) is being placed on a new `developer` branch of the [beserericl-hue/AIScripts](https://github.com/beserericl-hue/AIScripts) repository. `developer` is branched from `main` at commit `7c8ec91` — identical to `origin/main` at the moment of branch creation, so the planning baseline is fully consistent with what Railway deploys before any development starts. The stale `origin/Development` branch (capital D, unmerged, last commit `e464b6d`) is unrelated and untouched.

## [2026-05-17] audit | architectural gap surfaced — import flow doesn't preserve original DOCX

While testing Stevenson's classifications the user noticed AI returning South-Korea content as 1.d's narrative while the actual self-study editor shows the correct "Family Studies Program, Dr. Gigi Franyo, 1999" content. Root cause: the live `htmlContent` GridFS file is the post-extraction (mutated) version. Every time the human tags a section via the existing copy-paste flow, that section's HTML is replaced with an `<!-- EXTRACTED:... -->` marker comment and the bytes move to `selfstudyimports.detectedSections[].fullContent`. The deep walker reads the mutated HTML, not the original.

**Storage inventory for Stevenson's import on 2026-05-17:**

| Where | Has original DOCX bytes? | Notes |
|---|---|---|
| `selfstudyimports` doc | ❌ | only parsed HTML + extracted detectedSections |
| `htmlContent` GridFS (352.9 MB) | ❌ | mutated by every human tag (sections removed) |
| `files` collection | ❌ | 0 matches for this import |
| `supportingevidences` (s3Key, storageType=s3) | ✅ | user uploaded DOCX manually as supporting evidence |

The DOCX only exists because the user **separately** uploaded it as supporting evidence. The import flow itself doesn't preserve the original. **This is exactly what [[sprint-plan-2026-05-16#s1-2|S1.2 DocumentVersion]] was designed to fix** — every import would auto-save the DOCX as a versioned `kind='original_import'` record (model + service already built, 13 tests passing, just not wired into the upload controller yet).

**Mitigation today:** the AI classify script now ALSO injects `detectedSections[].fullContent` from Mongo into the pipeline so the AI sees the already-tagged content. Result on Stevenson's 5 human-tagged sections:

- **Agree** with human: 1.e, 1.f, 2.a (3/5)
- **Disagree** with human (correctly flagged `review_letter_disagrees`): 1.d → AI picked 1.a; 2.b → AI picked 2.c

The 1.d/1.a mismatch is a genuine ambiguity case: Stevenson's "history" section also discusses CSHSE accreditation milestones (the program "was awarded accreditation from CSHSE in October of 2004") — AI weighted the accreditation language more heavily. The wizard's `review_letter_disagrees` flag is the correct UX outcome — user sees both candidates and decides.

**Next step:** wire S1.2 DocumentVersion into the import upload (~30 min of Node-side work). Then every import preserves the original DOCX in S3, the AI can read from there directly, and we stop the apples-to-oranges comparison.

## [2026-05-17] audit | by-spec coverage report — exact import-text per (standard, spec) slot

Added a complementary vault page [[ai-import-stevenson-by-spec-2026-05-17]] that inverts the by-section view: for **every one of the 99 Baccalaureate specifications**, it shows the EXACT text the wizard would write to `narratives[std][spec].content` (narrative slot) and `.supportingEvidenceText` (supporting-evidence slot). Format the wizard uses on import:

```
Standard {std}.{spec} — {standard_title}

Prompt: {spec prompt from Handbook}

Response:
{section body — FULL text, no truncation}
```

Full snippets preserved end-to-end (re-ran classify with `snippet` field unbounded; JSON grew from 963 KB → 1.16 MB).

**Coverage on Stevenson (real numbers from today's run):**

| Bucket | Count | % of 99 specs |
|---|---|---|
| Specs with at least one **narrative** match | 86 | 87% |
| Specs with at least one **supporting-evidence** match | 38 | 38% |
| Specs with **any** matched content | 88 | 89% |
| **Spec gaps** (zero matches → user must triage) | 8 | 8% |
| Curriculum matrices identified | 5 | — |

Plus 3 sections classified as `unknown` (off-topic content the AI confidently rejected — legal MOU language, South Korea geography, HIPAA boilerplate — these are correctly NOT imported).

The 8 spec gaps tell the user immediately where Stevenson's self-study either doesn't address a spec OR the content is buried somewhere the deep walker didn't reach. They're listed with their Handbook prompts so the coordinator can verify manually.

## [2026-05-17] update | full Baccalaureate Handbook loaded (99 specs) — accuracy 4.2× on Stevenson

Built [`app/standards/handbook_parser.py`](../../../../ai-service/app/standards/handbook_parser.py) that pulls the official CSHSE Baccalaureate Handbook PDF from Mongo (`specs._id 6977b95db1dffec75ea656fc`) and extracts every Standard + lettered subspec via pdfplumber + regex. Handles three Handbook formatting quirks: lettered subspecs (`a./b./c.`), bare-paragraph subspecs (Standard 2 uses imperative verbs without letter markers — parser assigns a-e by paragraph order), and bare-letter subspecs (Standard 3 uses `a /b /c ` without periods).

**Coverage now: 99 specs across all 21 Standards** (was 11 specs across 1, 2, partial 11).

Re-ran the full 564-section classification on Stevenson with the new spec set:

| Metric | 11-spec stub | 99-spec full Handbook |
|---|---|---|
| Median confidence | 0.52 | **0.68** (+31%) |
| Mean confidence | 0.54 | **0.66** (+22%) |
| Auto-accept rate | 5% (29) | **22% (123)** (+4.2×) |
| Standard coverage | 1, 2, 11 only | **all 21** |

Confidence didn't reach the 0.85 I'd projected because some sections are genuinely ambiguous (context paragraphs without a strong single-spec mapping) or off-topic (legal boilerplate, MOU samples in appendices). Claude correctly returns low confidence there — that's the wizard's signal to route to user review, not silently auto-accept.

**Standards-drift detection working as designed:** the live ground-truth test went from 5/5 → 3/5 because Stevenson's 2.a was tagged against an **older** spec ("Provide a succinct philosophical statement") that no longer exists in 2025. The 2025 spec's 2.a is "Include a mission statement"; Stevenson's narrative content correctly maps to current 2.c ("Provide a brief description of the major knowledge base"). The "miss" is the system reporting drift, exactly as designed.

Updated vault review: [[ai-import-stevenson-2026-05-17]]. Static spec data: `ai-service/app/standards/baccalaureate_2025.py` (auto-generated). Parser tests: 8/8 passing.

## [2026-05-17] setup | Qdrant develop instance kept asleep — single shared instance in prod env

Briefly woke develop's Qdrant ("dashboard shows offline, fix") then put it back to sleep after the user agreed it's cleaner to keep a single shared instance in the production env. The "offline" the dashboard showed was the sleeping develop instance; the prod Qdrant (which the AI service actually queries) was running fine.

Topology + waking instructions now documented in [[railway-deployment-topology#qdrant--single-shared-instance-prod-env-only]].

## [2026-05-17] audit | AI import pipeline run end-to-end on Stevenson — 564 sections classified

Ran [[sprint-plan-2026-05-16|Sprint 1]]'s AI import pipeline against the actual Stevenson University self-study DOCX in dev Mongo (`SelfStudyImport._id = 6988ea3dc92032593e6bb9cd`, 352.9 MB HTML).

**Pipeline:** deep table walker (rowspan-aware) → OpenAI `text-embedding-3-small` → Qdrant cosine search → Claude Haiku 4.5 adjudication. Result captured per-section: snippet read, AI's (standard, spec) pick, confidence, rationale, alternates, accept-state.

**Numbers:**
- 604 raw sections from inside tables (rowspan-aware extraction), 564 with ≥30 words
- 115 seconds wall time, ~$0.45 total cost
- 222 narrative_response / 84 supporting_evidence / 4 curriculum_matrix / 242 context / 12 unknown
- 26 auto_accept / 84 review_letter_disagrees / 435 review_low_confidence / 19 review_unknown

**Accuracy caveat:** the spec cache only has 11 hand-curated Baccalaureate specs (`app/standards/loader.py:BACCALAUREATE_SAMPLE`). Median confidence is 0.52 because Claude is being forced to pick from too-few candidates. Loading the full ~150 specs from the 2025 CSHSE Handbook is the next single-largest accuracy lever; tracked as the first follow-up for Sprint 1 close.

**Deliverable:** [[ai-import-stevenson-2026-05-17]] — 760 KB vault review page, 564 per-section entries each showing the snippet that was read, Claude's pick, and Claude's rationale. Browsable in Obsidian.

## [2026-05-16] update | sprint plan resequenced — AI-assisted import wizard becomes Sprint 1

New dated sprint plan [[sprint-plan-2026-05-16]] (eight sprints) supersedes [[sprint-plan-2026-05-11]] (seven sprints). User direction 2026-05-16: AI-assisted import wizard takes priority over the original Sprint 1 (security). Reasons: manual tagging of legacy self-studies (e.g. Stevenson 353 MB DOCX, 100+ sections) takes coordinators days; security work is critical but not blocking active users.

**Decisions locked in (2026-05-16):**
- New Python FastAPI microservice (`cshse-ai`) in Docker, deployed as a new Railway service per env. Repo path: `ai-service/` at AIScripts root.
- **Qdrant** for vector storage; **single shared instance** lives in production env, dev env's instance sleeping. Collections are namespaced (`cshse_specs` shared, `cshse_sections_{prod|dev}`, `cshse_narratives_xinst_{prod|dev}`).
- Anthropic Claude Haiku 4.5 for spec-matching adjudication with prompt caching.
- Voyage `voyage-3-lite` recommended for embeddings (OpenAI `text-embedding-3-small` as alternative).
- Linear 5-step wizard UI: Upload → Parse → Review splits → Review recommendations → Apply & finish.
- **Cross-institution semantic search** wired but feature-flagged OFF pending CSHSE board approval.
- **Document versioning** (S1.2): every imported and exported doc gets a `DocumentVersion` row + S3 versioned key. Foundational for institutional records across years; required by S5.10 (reader-report DOCX, was S4.10).

**Qdrant installed today:**
- Service `Qdrant` (id `88a41a9a-f0c4-46f2-be0b-b4ea7d62532d`) added to `bubbly-solace`. Prod deployment SUCCESS. Volumes created (prod: `qdrant-volume`, dev: `qdrant-volume-IHWH` — orphaned, dev instance sleeping). API key in `/tmp/cshse-creds-2026-05-16/qdrant.env`.

**Sprint count:** 7 → 8. Original Sprint 1-7 shifts to Sprint 2-8. Mechanical renumber pass on the old plan (S1.x → S2.x, etc.) is staged as a separate PR.

**Old plan status:** [[sprint-plan-2026-05-11]] marked `status: superseded`, `superseded_by: sprint-plan-2026-05-16`.

**New concept page:** [[legacy-self-study-import]] — comprehensive analysis of the current import flow + the AI-augmented redesign that drives Sprint 1.

## [2026-05-16] setup | bootstrap dev MongoDB from prod snapshot (one-shot mongodump/restore)

Initial data sync, plus fixed two URI/DB-name bugs discovered along the way:

**Bugs fixed:**
1. **Dev CSHSE `MONGODB_URI` was missing `/CSHSE` database path** — left over from when I rebuilt the URI during the Mongo password mismatch fix earlier today. App had been writing to the default `test` database. Updated to `mongodb://mongo:<pw>@mongodb.railway.internal:27017/CSHSE?authSource=admin`.
2. **Stale `test` database in dev Mongo** containing collections the CSHSE app had created when writing to the wrong DB. Dropped.

**Data sync performed:**
- Used Railway TCP proxies (prod: `turntable.proxy.rlwy.net:41283`, dev: `autorack.proxy.rlwy.net:37997`) — both already had public-TCP enabled on the MongoDB services.
- `mongodump --uri="mongodb://mongo:<pw>@turntable.proxy.rlwy.net:41283/CSHSE?authSource=admin"` → `/tmp/cshse-prod-snapshot-{ts}/` (371MB total, includes 1418 GridFS chunks for htmlContent).
- `mongorestore --drop --nsInclude='CSHSE.*'` into dev.
- **Verified: 1481 / 1481 documents restored** across 21 collections matching prod exactly.
- Redeployed dev CSHSE service → SUCCESS, `/health` 200.

**No PII scrub applied** — dev env is currently single-user (Eric), no exposure. The eventual `db:sync-from-prod` script (sprint-zero infra item) will scrub by default per [[db-migration-strategy#layer-3--develop-from-prod-refresh-script]].

**No prod data was touched.** The dump was a read-only operation against prod (mongodump opens cursors, doesn't write). Restore wrote only to dev.

## [2026-05-16] audit | DB migration strategy for sprint changes, develop-to-prod sync model

Walked [[sprint-plan-2026-05-11]] and catalogued every DB-touching story against the [[storage-layer|production data model]] (21 collections + GridFS + S3). Result: **9 new collections, 9 field additions, 1 TTL index — all additive (zero prod-data risk); 2 breaking changes** (S2.10 multi-PC, S4.6 description consolidation) **that require expand-contract rollout**.

Designed a three-layer strategy now documented in [[db-migration-strategy]]:
1. **Forward-only migration runner** in `server/src/migrations/` (doesn't exist yet — first sprint-zero infra). Numbered, idempotent, applied at boot before `app.listen`.
2. **Expand-migrate-contract for the 2 breaking changes**: each ships in 2–3 PRs across sprint cycles so prod readers are never in a half-applied state.
3. **`server/scripts/sync-from-prod.ts`**: one-direction mongodump+restore (prod → develop), reapplies all migrations on top, optional PII scrub. Refreshes develop's data without ever writing back to prod.

Also flagged the shared-S3 wrinkle from [[railway-deployment-topology]]: develop and prod use the same Tigris bucket, so develop writes risk colliding with prod keys. Mitigation: add `S3_KEY_PREFIX` env var (`""` on prod, `"dev/"` on develop). Strict envvar-presence check at service init to prevent misconfiguration.

**Sprint-zero infra needed before any DB story ships:** (a) migration runner, (b) S3_KEY_PREFIX support, (c) sync-from-prod script, (d) prod read-only Mongo user for sync access. ~1.5 days of work, all in.

## [2026-05-16] setup | Railway two-env split (production/main + new develop/developer) with isolated Mongo and shared S3

Stood up a parallel `develop` environment in the `bubbly-solace` Railway project so Sprint 1 security work can land off-production. **Production keeps its well-known DNS (`cshse.courseworx.media`)**.

**Changes:**
- **Production env**: CSHSE deploy trigger switched from `feature/s3-file-storage` → `main`. New build SUCCESS, serving traffic. `/health` 200.
- **Develop env** (new): duplicated from production, CSHSE trigger pointed at `developer` branch. Public URL `https://cshse-develop.up.railway.app`. `/health` 200.
- **Sleeping in develop**: `satisfied-clarity`, `upwork-proposal`, `WritersWorkbench`, `PROD Redis` (CSHSE doesn't use them).
- **MongoDB**: each env has its own volume (full data isolation). Fixed an env-duplicate bug where develop's Mongo service had a fresh `MONGO_INITDB_ROOT_PASSWORD` (vSikCMqp...) but `MONGO_URL`/`MONGOPASSWORD` still held prod's old pw (NqsIvkud...) — caused the first dev deploy to crash with `MongoServerError: Authentication failed`. Realigned the dev Mongo service's exposed creds with its actual init pw.
- **S3 / Tigris**: per spec, both envs share `cshse-filestorage-qlyj5pn`. Override needed because env-duplicate auto-provisioned a separate `cshse-filestorage-nvffngd` for develop; replaced develop's `AWS_*` vars with prod's so CSHSE in develop writes to the prod bucket.

**Branch swap mechanics:** Railway CLI doesn't expose deployment-trigger edits, so used the GraphQL `deploymentTriggerUpdate` mutation (`backboard.railway.com/graphql/v2`, bearer from `~/.railway/config.json` user.accessToken). Documented in [[railway-deployment-topology]].

**Key IDs** (for future ops): project `87cb760d-…`, service CSHSE `04e40a6b-…`, env production `e56e386b-…`, env develop `7b03b69a-…`, prod trigger `de23c3a8-…` (main), develop trigger `01b0bf86-…` (developer).

**Open items:** decide whether `develop` auto-deploys on every push or needs manual promotion. (Re: the supposed orphan bucket — Railway has one Bucket entity per project, so there's no separate tile to delete; the physical `cshse-filestorage-nvffngd` bucket on Tigris is empty and costs nothing. Leave in place.)

New concept page: [[railway-deployment-topology]]. Index updated.

## [2026-05-17] update | matrix data extractor + AI Import Wizard UI spec

Closed out the AI side of Sprint 1 with `ai-service/app/matrix/data_extractor.py`: anchor-driven walk of `#MatrixHSR` / `#Matrix2`, template-row matching (substring + Jaccard), and ITKS/LMH cell decoding. On Stevenson: 150/191 rows matched, 370 cells extracted. 6 unit tests pass.

Wrote [[import-wizard-ui-spec-2026-05-17]] — the full UI spec for the wizard. Lives in its own tab under the Self-Study Editor. Five linear steps (Upload → Parse → Review → Matrix → Apply). Defines the auto-apply rules per item shape (narrative / supportingEvidenceText / SupportingEvidence file / matrix cell), the click-to-popup tag list for questionable items, and the end-state contract for the apply call. This is a **sign-off gate** before any React code lands.

## [2026-05-18] update | gap-filling pipeline + live wizard preview on Stevenson

New AI service module `app/gap_filling/` (committed 2827b89): per-import Qdrant collection lifecycle (`index_appendix`/`drop_appendix_collection`), per-gap vector search with Standard-filtered + unfiltered fallback, Haiku verification of each appendix candidate against the specific shortcoming the coverage reviewer flagged, classification as narrative_text or evidence_file, and a second-pass coverage review on augmented evidence. 28 offline tests, 79 total green.

Live end-to-end run against Stevenson produced [[ai-import-wizard-preview-stevenson-2026-05-18]] — the exact artifacts the wizard would write today on Stevenson: 269 narrative auto-applies, 53 supporting-evidence text snippets, 14 evidence files with simulated S3 keys, 47 tag-list items needing user triage, 178 context sections skipped, 6 unknown sections routed to tags. First-pass review flagged 653 gaps across the 96 unique Baccalaureate specs; gap-fill verifier accepted only **2** appendix candidates (3798 rejected). Signals threshold/strictness needs calibration in the verifier prompt or the 0.65 confidence floor before this pass is worth its API cost.

Pipeline wall time: HTML stream 14s, appendix walk 6s, first-pass review 70s, appendix index 28s, gap-fill (concurrency=8) 150s, render 1s — ~5 min total for 99 specs.

Handbook parser bug surfaced: Standard 16 has three duplicate (std, spec) keys (`16.a`, `16.b`, `16.c` each duplicated). Dict-keyed lookup collapses these to one each, so the preview ran on 96 unique specs instead of 99. Tracked for the `baccalaureate_2025` parser fix.

New `ai-service/scripts/build_wizard_preview.py` driver and helper `tmp/run_wizard_preview.sh` (env composer across CSHSE / WritersWorkbench / Qdrant Railway services).

## [2026-05-18] update | gap-fill verifier calibration — 250× acceptance, +99 evidence files

Re-ran [[ai-import-wizard-preview-stevenson-2026-05-18]] after tuning the gap-fill verifier. Root cause of the 2/3800 acceptance rate was the verifier prompt's strictness directive (_"the snippet must actually provide the missing content the reviewer asked for"_) — Haiku was correctly following it, but accreditation evidence is rarely a 1:1 gap closure; it's typically partial supporting material a reviewer assembles. Two coordinated changes in `ai-service/app/gap_filling/gap_searcher.py`:

1. **Verifier prompt reframed** as _"is this relevant evidence a reviewer would cite for this shortcoming?"_ with an explicit confidence band: 0.80–1.00 direct documentation, 0.50–0.79 partial/contextual support, <0.50 tangential.
2. **Default confidence threshold** `0.65 → 0.50` (also in `--gap-fill-confidence` flag on `build_wizard_preview.py`), so the partial-support band counts.

Headline before → after:

- Candidate acceptance rate: **2/3800 (0.05%) → 333/2647 (12.6%)** — 250×
- Verified gap fills: **2 → 333**
- Specs with at least one wizard write: 84 → **95** (of 96)
- Specs with supporting-evidence text: 27 → **87**
- Specs with supporting-evidence files: 11 → **66**
- Total evidence files (with simulated S3 keys): 14 → **113**
- Gaps still remaining after gap-fill: 638 → **541**
- Tag list: 47 (unchanged — gated on matcher confidence, not the verifier)

Spot-checks on the new fills look right: for Std 1.a's "institutional context" gap the verifier pulled the Stevenson/CCBC articulation WHEREAS clause; for 1.b's "teaching methodology" gap it pulled a course description listing "lecture, class discussions, team projects, papers, videos, and fieldwork" — exactly the partial/contextual band the prompt now targets (0.62–0.72).

Diagnostic improvement bundled in (cost-free): both the coverage reviewer (`app/coverage/spec_coverage.py`) and the verifier carry the actual `str(exc)` into the `suggestion` / `rationale` field on persistent API failure, so credit-balance / model-id / quota issues surface in the preview itself instead of needing a separate diagnostic call. Caught a real exhausted-credits state during smoke-testing this calibration via that path.

Preview file rewritten in place (1.07 MB / 12,550 lines, was 630 KB / 6,916). Calibration changes are **uncommitted** — left in the worktree so we can iterate further on the prompt or threshold once you've reviewed the new numbers.

## [2026-05-18] update | template-format walker + Kennesaw State preview (spec-as-outline import path)

Second self-study input format wired in: the **CSHSE Self-Study Template** — the spec-as-outline DOCX that institutions just starting accreditation use as their writing framework, re-imported repeatedly as more sections get filled. Different from Stevenson's free-form self-study: each section heading IS a Handbook prompt, the institution writes a `Response:` underneath, and there's typically no appendix until late drafts.

**Additive, not a rewrite.** The Stevenson parsing rules are untouched — `toc_anchor_walker.py`, `deep_walker.py`, `appendix_walker.py`, and `sections.py` are unchanged, and `build_wizard_preview.py` (the Stevenson driver) still works exactly as before. The template walker is a *new* rule that coexists with the existing ones. The driver picks one based on which input you point it at; future work can add format auto-detection so a single entry point routes to the right walker.

**New AI service module: `ai-service/app/splitter/template_walker.py`**

- Reads DOCX paragraphs directly (no HTML conversion — template format is small, ~400 KB).
- Cuts on template heading patterns: `1.` / `2a.` / `11.b` / `Standard 1, Specification a.` / `Standard 12b.` — patterns ordered most-specific first, std + spec hints captured per match.
- Strips `Response:` markers inline (they're visual cues, not section boundaries).
- Detects placeholder responses (empty body, `Not applicable`, `TBD`, bare `See Appendix` pointer) so the matcher doesn't waste API calls and the preview can show "started-but-unwritten" sections distinctly.
- Skips front matter (TOC, Introduction & Instructions, template title) so title-page lines don't bleed into pseudo-sections.
- 20 offline tests; full suite 99 passing, 4 skipped (live-only).

**New driver: `ai-service/scripts/build_template_preview.py`**

Parallel to `build_wizard_preview.py` but adapted for the spec-as-outline format:

- Walks the DOCX → matcher only on authored sections (placeholders skipped).
- First-pass coverage review only on specs with bucket entries; empty specs get a synthesized "no content yet" verdict so the preview is full coverage without 87 redundant Haiku calls saying "no content".
- **No gap-fill pass** — template format has no appendix to search. Once the institution adds an appendix in a later draft, the Stevenson-style preview applies.
- Output filename `ai-import-wizard-preview-<suffix>-<date>.md` (configurable via `--output-suffix`, default `ksu`).

**End-to-end run on `docs/Sample to Council from KSU.docx` (Kennesaw State, partial fill):**

- Source document: Kennesaw State baccalaureate template, 354 paragraphs, ~407 KB DOCX.
- 27 raw template sections detected → 14 authored / 13 placeholder (`Not applicable` multi-site + hybrid-online, plus the unfilled per-spec stubs at Std 12b / 14c / 16b / 16c / 17b / 17c).
- 6,417 authored words total across all responses.
- 14 matcher calls → 0 failures. 8 specs received narrative auto-applies: 1.a, 1.b, 1.f, 3.a, 4.a, 4.b, 9.e, 21.a.
- 2 evidence files (with simulated S3 keys): VPA letter reference under 1.c, glossary under 1.a.
- 2 tag-list items needing triage (one curriculum-matrix-classified 17d response at conf 0.92, one low-confidence multi-site placeholder at 0.42).
- 9 Haiku coverage reviews on populated specs, 90 synthesized; the 8 narrative-bearing specs all came back 🔴 — partial content doesn't fully address any Handbook prompt yet, which is correct for a template at this fill stage. The synthesized empty-spec verdicts give the institution a clean list of "prompts you haven't responded to yet."
- Cost: ~$0.30. Wall time: ~25s.

**Bootstrap note:** the Qdrant `cshse_specs` collection wasn't populated for this account (Stevenson driver used a cached classify JSON). Bootstrapped via `app.embeddings.spec_cache.bootstrap_spec_cache(store, embedder, program_levels=('bachelors',))` → 99 spec definitions upserted. This is a one-time step per env; subsequent template-format imports re-use the same collection.

**Why the template preview matters for the wizard:** institutions in the writing phase will run this on every re-import to see (a) which prompts still need a response (placeholder table at the top of the preview), (b) where their current text would land in `Submission.narratives[std][spec]`, and (c) which placed sections need manual triage. The Stevenson-style full pipeline (with appendix gap-fill) becomes relevant once the institution finishes a draft with an appendix.

New preview page: [[ai-import-wizard-preview-kennesaw-state-2026-05-18]]. Index updated.

## [2026-05-18] update | single-entry-point dispatcher with format auto-detect

Wired both walkers behind one CLI: `ai-service/scripts/build_preview.py`. Takes `--docx <path>`, sniffs the format, and dispatches to the right pipeline. Still additive — Stevenson walkers, template walker, and the Stevenson driver are all untouched.

**New: `ai-service/app/splitter/format_detector.py`** — pure-function sniff with explicit signals + reasoning. Decision rules:

- Template title (`Self-Study Template`, `Self-Study Reader Report`, etc.) matched in the first 20 paragraphs → **template** @ 0.95.
- ≥3 `Response:` markers AND ≥5 template-style headings → **template** @ 0.85 (catches templates with stripped front matter).
- Otherwise → **self_study** @ 0.70 (bumped up to 0.90 cap by Curriculum Matrix / Appendix / Faculty CVs / Faculty Handbook heading hits).

9 offline tests covering both formats, mixed signals, edge cases. Live sniff on `Sample to Council from KSU.docx`: `template @ 0.95` ✓. Suite is now **108 passed, 4 skipped**.

**New: `ai-service/scripts/build_preview.py`** — single entry point. Behavior:

- `--format auto` (default): sniffs, prints verdict + signals + reasoning, dispatches.
- `--format template|self_study`: forces, skips sniff.
- `--output-suffix <slug>` (default: slug from DOCX basename — `--output-suffix kennesaw-state` recommended for production).
- Template branch: invokes the refactored `run_template_preview()` in-process (no subprocess overhead, shares env).
- Self-study branch: prints "DOCX-direct self-study not yet wired" with the recommended next step (legacy import flow → Mongo → existing `build_wizard_preview.py`). Exits non-zero so automation knows the input wasn't fully processed.

**Refactor (small):** `ai-service/scripts/build_template_preview.py` — moved the body of `main()` into a callable `run_template_preview(docx, program_level, date, concurrency, output_suffix, base_id, ...)` that returns the written `Path`. The CLI is now a thin arg-parser shim. No behaviour change for direct invocation.

End-to-end smoke through the dispatcher on the Kennesaw State sample: auto-detected `template @ 0.95`, ran the full pipeline (14 matcher calls, 9 coverage reviews on populated specs + 90 synthesized empty-spec verdicts), wrote `ai-import-wizard-preview-kennesaw-state-2026-05-18.md` (128 KB / 2,657 lines). Wall time ~30s, cost ~$0.30.

**Follow-up sized but not built:** DOCX-direct self-study branch — mammoth (already in deps) converts DOCX → HTML, then the existing Stevenson walkers run on the converted HTML, matcher runs live (no cached classify JSON), then coverage + gap-fill + render. Estimated ~10-12 min wall time on a Stevenson-sized DOCX. That makes this dispatcher the production wizard's full entry point for both formats; today it's the entry point for template format and a clear pointer for self-study.

## [2026-05-18] update | DOCX-direct self-study branch + Std 16 dup-key fix

Two more pieces landed:

**1. DOCX-direct self-study (dispatcher's other branch is now live).**

Added `run_self_study_preview_from_docx(...)` to `ai-service/scripts/build_wizard_preview.py` as a sibling to the existing Mongo-backed `main()`. New flow takes a DOCX off disk and runs the full self-study pipeline without touching Mongo:

1. `mammoth.convert_to_html(io.BytesIO(docx_bytes))` → fresh HTML
2. `deep_walk_with_fallback(html_bytes)` → Section list (existing walker, unchanged)
3. Min-words filter (default 30) drops fragments
4. `bootstrap_spec_cache(store, embedder, program_levels=(...))` — idempotent so it's safe to call every run
5. `SpecMatcher.recommend(section, program_level)` LIVE per section, concurrency-fanned (no cached classify_rows JSON required)
6. Merge sections + recommendations into the existing classify_rows dict shape via new `_classify_rows_from_sections(...)` helper
7. `walk_appendix(html_bytes)` (existing walker, unchanged)
8. Existing shared helpers `_allocate_to_buckets`, `_apply_gap_fills`, `_render_obsidian` produce the preview
9. Gap-fill auto-skips when no appendix is detected (template-shaped DOCX) — same behaviour as `--skip-gap-fill` so the call is safe across formats

Dispatcher (`scripts/build_preview.py`) self-study branch now invokes this in-process. New flags pass through: `--skip-gap-fill`, `--gap-fill-confidence`, `--min-section-words`.

Smoke (forced `--format self_study` on the Kennesaw State DOCX to exercise every line):

- mammoth: 0.4 MB DOCX → 0.50 MB HTML in 1.4s
- deep_walk: 21 raw → 20 sections (min-words filter)
- matcher live: 20/20 matched in 17s
- appendix walk: 0 items (KSU has no Stevenson-shape appendix) → gap-fill auto-skipped
- bucket allocation: 7 narratives, 1 file, 12 context, 0 unknown
- coverage review: 96 specs in 49s
- rendered preview: 171 KB, 3169 lines

Total wall time ~70s, cost ~$0.50. Every line of the new code path ran cleanly. Smoke artifact deleted after validation. Estimated Stevenson-sized run: ~10–12 min, ~$3–5.

This makes `scripts/build_preview.py --docx <path>` the production wizard's single entry point for both formats. No parsing rule changes anywhere (`toc_anchor_walker.py`, `deep_walker.py`, `appendix_walker.py`, `sections.py` all 0 lines changed).

**2. Std 16 duplicate-key fix (96 → 99 unique specs).**

The Handbook PDF has two independent letter-lists under Standard 16 — "Theory & Knowledge" (a/b/c) and "Skills" (a/b/c again). The parser originally emitted both sets under the same letter codes, so any `{(s.standard_code, s.spec_code): s for s in specs}` dedupe (used in every preview driver) collapsed 99 specs to 96 — and Qdrant's UUID5 point IDs collided too, so only the *second* "Skills" entry survived per cell. Net effect: the Theory & Knowledge prompts for 16.a/b/c were silently dropped from the matcher's candidate space.

Fix in `ai-service/app/standards/baccalaureate_2025.py`: disambiguate the Skills trio to 16.d / 16.e / 16.f. Theory & Knowledge keeps the original 16.a / 16.b / 16.c. Comment added inline explaining the historical bug so future parser changes don't re-collapse the lists.

Three new regression tests in `tests/test_handbook_parser.py`:

- `test_baccalaureate_2025_registry_has_no_duplicate_keys` — fails fast on any future (std, spec) collision
- `test_baccalaureate_2025_registry_has_expected_count` — asserts exactly 99
- `test_load_specifications_dedupe_via_dict_is_lossless` — guards the downstream pattern

Qdrant `cshse_specs` re-bootstrapped via `app.embeddings.spec_cache.bootstrap_spec_cache(store, embedder, program_levels=('bachelors',))` — now holds 99 distinct points (was effectively 96 because of the UUID5 collision). Next Stevenson re-run will use the corrected candidate space, and the previously-missing Theory & Knowledge prompts for 16.a/b/c will appear as legitimate matcher candidates.

**Tests:** 111 passed / 4 skipped / 0 failed (was 108; +3 registry-integrity tests).

## [2026-05-18] update | complete UI spec — supersedes the 2026-05-17 sketch

Promoted the UI spec from sketch to code-ready. New page [[import-wizard-ui-spec-2026-05-18]] supersedes [[import-wizard-ui-spec-2026-05-17]] (latter retained with a SUPERSEDED banner per the vault's convention for concept pages whose underlying scope changes substantially).

What's new vs. the sketch:

- **Two input formats** explicitly acknowledged and contrasted (template vs free-form self-study). Behaviour differences per step. Format detection UX in Step 2 with override path.
- **Re-import flow** for the template format — first import vs. second-and-subsequent, merge-default with diff modal, delta strip in Parse, isReimport server-side detection.
- **Client state shape** — full Zustand store typed (`AIImportState`, `SpecBucket`, `Recommendation`, `Tag`, `PlaceholderSection`, `FormatVerdict`) with explicit persistence rules (what survives a tab close, what rehydrates from server).
- **API contracts** — exact JSON request / response for every new endpoint (`start-ai`, `ai-status`, `apply-ai`, `restart-ai`, `ai-callback`, plus the cshse-ai side). Idempotency key for safe Apply retry. Mongo session + S3 ordering for atomicity.
- **Component contracts** — file paths under `client/src/features/selfStudy/Editor/AIImport/`, prop signatures for the 13 key components.
- **Loading / error / empty states** for every async component (catalog table).
- **Accessibility** — WCAG 2.1 AA pass plan: keyboard nav per component, screen-reader labels, focus management, colour contrast verification, live regions on Parse, reduced-motion handling, VoiceOver + NVDA tested.
- **Telemetry** — 10 PostHog events with payloads, no PII.
- **Performance budgets** — initial render < 200 ms, item-table virtualization at > 100 rows, AI Import code-split chunk ≤ 80 KB gzipped, poll-pause on tab blur.
- **E2E test plan** — 8 Playwright flows + 2 server unit tests.
- **Phased build plan** — 5 sub-sprints summing to ~11 working days from sign-off to develop-deployed.
- **Open questions** — the 5 from the sketch are now resolved (§20); 5 new questions surface (§21) that can be answered during sub-sprint 1.a without blocking start.

Calibrated thresholds locked into §10 (TEXT_AUTO_APPLY_CONF=0.85, FILE_AUTO_APPLY_CONF=0.70, TAG_LIST_CONF=0.50, GAP_FILL_CONFIDENCE=0.50, MIN_SECTION_WORDS=30) — these are the values validated by the 2026-05-18 calibration on Stevenson and reused on the Kennesaw State preview.

Spec is the **gate for Sprint 1 React code**. Index updated.

## [2026-05-18] update | UI spec — five §21 follow-ups resolved by Coordinator

Coordinator answered the five remaining open questions in [[import-wizard-ui-spec-2026-05-18]]; spec updated in place with all decisions integrated. Summary of resolutions:

1. **SSE in v1, polling fallback only.** Server pushes incremental events on `GET /api/imports/:importId/ai-events`; client opens an `EventSource` immediately after Upload. Carries queue-position events, format-detection, per-stage progress, and terminal payload. Polling on `/ai-status` is the fallback when SSE reconnect fails three times consecutively. Addresses "is the UI hung?" perception risk for the long Stevenson parse.
2. **Long-wall-clock parse acceptable** in v1 because of (1) — no background-email mode needed.
3. **TagPopup deep-linking — in v1.** `/ai-import/tags/:tagId` opens the popup directly. Sharable URL.
4. **Show-in-source uses CURRENT document version** (not the version when the tag was created). Anchor lookup with fuzzy-text fallback when the source has changed; amber banner when match is best-effort; "no longer present" message when content has been removed.
5. **Multi-Coordinator concurrency — FIFO queue with live SSE-driven position display.** v1 ships with one cshse-ai worker; Coordinators see "4th in line → 3rd in line → starting now…" with no ambiguity. Cancelling from `queued` releases the slot. v2 adds horizontal scaling + queue routing. Apply still 409s on same-Submission Mongo races (independent concern — queue is service-level, 409 is data-level).

Spec edits made to integrate these:

- §3: tab badge gains `(queued: 3rd in line)` + `(parsing)` + `(ready to review)` states.
- §5: state machine adds `queued` between `new` and `parsing`; cancel-from-queued releases the slot.
- §6.2: full rewrite with **queued state UI** ("Your import is 3rd in line… Estimated start: ~8 minutes") and **running state UI** plus SSE transport explanation and Railway proxy config notes.
- §9 (store): new fields `queuePosition`, `queueDepth`, `etaSeconds`, `eventsTransport`, `eventsReconnectAttempt`; new actions `openEventStream` / `closeEventStream` plus the polling fallback.
- §11.2: `start-ai` response shape now carries `queuePosition`/`queueDepth`/`etaSeconds` when the worker is busy.
- §11.3: `/ai-status` (polling fallback) extended with queue fields + per-stage `etaSeconds`.
- §11.4 NEW: `/ai-events` SSE endpoint with full event protocol, including `auth-expired` close event, 30 s keepalive pings, `X-Accel-Buffering: no` proxy config.
- §11.5–§11.9: renumbered (apply-ai → 11.5, restart-ai → 11.6, cancel → 11.7, cshse-ai → 11.8, get-import → 11.9).
- §11.8: cshse-ai service gains `/ai-event` incremental webhook (signed via `X-CSHSE-Signature`) that the server fans out to SSE subscribers.
- §16 (telemetry): four new events — `ai_import_queued`, `ai_import_queue_advanced`, `ai_import_events_fallback`, plus `totalWaitMs` / `totalParseMs` on `ai_import_parsed`.
- §17 (performance): SSE-aware transport rules — close on `visibilitychange → hidden`, reopen on `visible`, 30 s keepalive pings, fallback after three reconnect failures.
- §20: five new resolved decisions appended (numbered 6–10).
- §21: replaced with five non-blocking technical follow-ups — Railway proxy verification, queue starvation, stalled-stage detection, queue-decrement debouncing, 409 banner copy review.

Net effect: spec is now sign-off-ready with zero blocking questions. Sub-sprint 1.a (plumbing) starts immediately after sign-off.

## [2026-05-18] update | sub-sprint 1.a complete — wizard plumbing landed end-to-end

Spec signed off; built the full plumbing layer per UI spec §19 sub-sprint 1.a. End-to-end skeleton now functional: a Coordinator can open the AI Import tab, upload a DOCX, watch the cshse-ai job process via live SSE updates (with FIFO queue position if a worker is busy), and click through Review → Apply (stub) without any non-functional placeholders in the critical path.

**cshse-ai service (Python):**

- New module `ai-service/app/import_jobs.py` — FIFO single-worker queue with full job lifecycle (enqueue → queued → parsing → parsed/failed/canceled). Emits HMAC-signed webhooks at every state transition. Dispatches to the existing template walker or DOCX-direct self-study runner based on format detection (template format gap-fill is auto-skipped; self-study gap-fill is deferred to sub-sprint 1.b).
- New FastAPI endpoints in `ai-service/app/main.py`: `POST /ai/import/start`, `GET /ai/import/{jobId}`, `POST /ai/import/{jobId}/cancel`. All HMAC-verified via the existing `app/auth.py` shared secret.
- 11 new offline tests in `tests/test_import_jobs.py`. Python suite: 122 passed / 4 skipped (was 111; +11).

**CSHSE server (TypeScript):**

- `SelfStudyImport` model extended with the wizard's AI fields: `aiStatus`, `aiJobId`, `aiQueuePosition`, `aiQueueDepth`, `aiEtaSeconds`, `aiFormat`, `aiStages`, `aiBuckets` (Mixed type — Pydantic on cshse-ai is the source of truth for the bucket shape), `aiTags`, `aiPlaceholderSections`, `aiMatrices`, `aiErrors`, `aiAppliedCounts`. Sub-document schemas (`AIBucketItemSchema`, `AITagSchema`, `AIPlaceholderSchema`, `AIStageSchema`, `AIFormatVerdictSchema`) typed end-to-end; legacy `status` field unchanged.
- New controller `server/src/controllers/aiImportController.ts` with all seven new routes from UI spec §11 — `start-ai` / `ai-status` / `ai-events` (SSE) / `apply-ai` (stub) / `restart-ai` / `ai-event` (webhook) / `ai-callback` (webhook). HMAC signature format (`t=<unix>,v1=<hex>`) matches the cshse-ai `app/auth.py` verify path so the two services can trust each other without sharing a secret with users.
- SSE fan-out: in-memory map from `importId` to connected client streams. 30-second keepalive pings prevent Railway-proxy idle timeouts. Response headers `X-Accel-Buffering: no` + chunked encoding to defeat upstream buffering.
- Global `express.json` gained a `verify` callback that captures `req.rawBody` for HMAC verification (used by the two webhook routes; ignored by every other route).
- Mounted in `server/src/routes/imports.ts`: webhook routes BEFORE `router.use(authenticate)` since they auth via HMAC; coordinator-facing routes after.
- 11 new integration tests in `server/tests/integration/ai-import.test.ts` — covers status snapshot, apply-ai stub, HMAC verification on both webhooks (missing / malformed / expired / valid signature), terminal-state callback persistence. Integration tests: 28 passed (was 17; +11).

**CSHSE client (TypeScript + React):**

- New Zustand store `client/src/store/aiImportStore.ts` — full type contract from UI spec §9: `WizardState`, `WizardStep`, `WizardStatus`, `FormatVerdict`, `Recommendation`, `SpecBucket`, `BucketItem`, `Tag`, `PlaceholderSection`, `StageProgress`, `AIStatusSnapshot`. Actions: `startUpload`, `openEventStream`, `closeEventStream`, `pollAIStatus`, `cancelImport`, `apply`, `loadExisting`, `reset`, plus all setters. Persists resumable fields (importId / step / status / programLevel / selection state) via Zustand's `persist` middleware; heavy bucket data rehydrates from `/api/imports/:importId` on tab open.
- SSE-first transport: opens an `EventSource` immediately after upload, falls back to 2-second polling after three consecutive reconnect failures (UI spec §6.2). Reconnects with exponential backoff (1s → 2s → 4s → max 30s). Closes on tab blur (`visibilitychange → hidden`).
- New components under `client/src/features/selfStudy/Editor/AIImport/`: `Wizard.tsx` (top-level router), `Stepper.tsx` (left rail with WCAG-compliant role=tablist + aria-current), `steps/UploadStep.tsx` (functional — file dropzone + 100 MB cap + MIME check + program-level radio + re-import + force-template checkboxes + upload-progress bar), `steps/ParseStep.tsx` (functional — queued state with ordinal position + ETA, running state with live pipeline strip + format-verdict banner, polling fallback warning), `steps/ReviewStep.tsx` (display-only summary; full SpecRail / ItemTable / ItemPreview lands in sub-sprint 1.b), `steps/MatrixStep.tsx` (placeholder; lands 1.d), `steps/ApplyStep.tsx` (functional — merge mode radio + Apply button that calls the stubbed apply-ai endpoint).
- `SelfStudyEditor.tsx`: added `'ai-import'` to the `activeView` union, new tab button visible only to Program Coordinators, rendered `<Wizard submissionId={submissionId} />` when active.
- 9 new client-side store unit tests in `aiImportStore.test.ts`. Client suite: 29 passed / 2 skipped (was 20; +9).

**Test totals across all three layers:**

- Python (ai-service): **122 passed / 4 skipped** (was 111)
- Server integration: **28 passed** including the 11 new AI Import integration tests (was 17)
- Client unit: **29 passed / 2 skipped** (was 20)
- Pre-existing flake in `server/tests/unit/documentVersionService.test.ts` — fails only under full-suite ordering, passes when run in isolation; unrelated to wizard work.

**What's working end-to-end now:**

1. Coordinator clicks "AI Import" tab → wizard mounts at Upload step.
2. Picks a DOCX, hits Next → server uploads to S3 via the existing `/upload` route, then `POST /start-ai` enqueues a cshse-ai job.
3. Browser opens an SSE stream to `/ai-events` and shows queue position / format verdict / live pipeline progress as the cshse-ai worker advances.
4. On parse completion the terminal `/ai-callback` webhook lands the buckets / tags / placeholders into the SelfStudyImport doc, then SSE pushes the final status.
5. Coordinator clicks Next → Review step shows the summary; if any matrices were detected, Matrix step appears; otherwise Apply is next.
6. Coordinator picks merge mode, clicks Apply → `POST /apply-ai` (stub) returns OK with the counts that would have been applied. Real writes land in sub-sprint 1.c.

**What's stubbed / deferred to subsequent sub-sprints (per UI spec §19):**

- 1.b: Full Review surface — SpecRail / ItemTable / ItemPreview with bulk-action toolbar, ShowInSourceModal, reassign popup. E2E tests 1 + 2.
- 1.c: Real `apply-ai` — Mongo session, S3 uploads with daily orphan janitor, idempotency-key dedup. ApplyStep diff modal. E2E tests 3 + 6, server tests 9 + 10.
- 1.d: MatrixStep course-column confirmation + create-course modal, TagListView + TagPopup, persistence, full a11y audit + fixes. E2E tests 4 / 5 / 7 / 8.
- 1.e: Develop deploy via Railway + Stevenson re-preview smoke + Coordinator UAT handoff.

All uncommitted in the worktree. Ready for sub-sprint 1.b on your green light.

## [2026-05-18] update | Sprint 1 sub-sprints 1.b / 1.c / 1.d / 1.e — wizard feature-complete, deploy paused

Built out the remaining sub-sprints in one push. End state: the wizard is end-to-end functional for both formats, real apply-ai is wired, full Review surface + MatrixStep + TagListView landed, accessibility hooks are in. Sub-sprint 1.e produced the deploy run-book; actual Railway push paused awaiting explicit go-ahead (shared infrastructure).

### 1.b — Review surface (UI spec §6.3)

Replaced the 1.a flat-summary `ReviewStep` with the full three-column workspace:

- `review/SpecRail.tsx` — left rail with 99 specs grouped by Standard, search filter, coverage badges (🟢/🟡/🔴), `Unplaced` + `Unwritten` synthetic buckets. Role=tablist + aria-current.
- `review/ItemTable.tsx` — middle column with checkbox column + sortable headers (confidence / source / words). Confidence colour bands per UI spec §6.3 (`text-cshse-600` ≥ 0.85, `text-amber-700` 0.50–0.84, `text-slate-500` < 0.50). Keyboard navigation per UI spec §14: ↑/↓ + j/k move rows, Enter selects, Space toggles checkbox, screen-reader labels for "high/medium/low" confidence.
- `review/ItemPreview.tsx` — right column with rationale + body + kind dropdown + reassign button + "Show in source" button. Focus auto-moves into the preview on selection.
- `review/ReassignPopup.tsx` — bulk reassign modal with Standard → Spec cascading dropdowns. Esc closes, click-outside closes, focus trapped.
- `review/ShowInSourceModal.tsx` — side modal (60vw, Esc closes) that fetches the CURRENT DocumentVersion via `/api/imports/:importId/content`, tries to scroll to the section's anchor, falls back to fuzzy text search of the first 200 chars (UI spec §20.9). Three states: `anchor` (clean match, green outline), `fuzzy` (best-effort, amber outline + banner), `missing` (no longer in current doc, amber banner).
- Bulk-action toolbar wired: Send-to-tags, Apply-as-file, Reassign. All operations are client-side until Apply.

### 1.c — Real apply-ai (UI spec §11.5)

Replaced the 1.a stub with a real implementation that writes to `Submission.narratives[std][spec]` + `Submission.narratives[std][spec].supportingEvidenceText` + `linkedDocuments`:

- Three merge modes: **merge** (appends with `<hr class="ai-import-merge"/>` separator), **replace** (overwrites), **per_spec** (per-spec radio resolution via the new DiffModal).
- **Idempotency-key dedup**: `aiLastIdempotencyKey` field on `SelfStudyImport`; replay returns the cached `aiAppliedCounts` without re-applying. The client generates the key in localStorage so refresh-then-retry is safe.
- **Mongo session conditional**: gated by `MONGO_SUPPORTS_TRANSACTIONS=true`. Production (Mongo replica set) gets atomic writes; develop and tests (standalone Mongo) get sequential saves + idempotency-key retry safety.
- **DiffModal** (`apply/DiffModal.tsx`) — fetches current `Submission.narratives` via `/api/submissions/:id`, renders per-spec before/after panes, per-row Keep / Take / Merge radios. Confirm-button gated on every touched spec having a choice.

4 new server integration tests (apply-ai writes / idempotency replay / merge appends / replace overwrites). Total server integration: **38 passed** (was 28; +10 net across 1.c + 1.d).

### 1.d — Matrix + Tags + a11y (UI spec §6.4, §7, §14, §20.4)

- **ProgramCourses Mongo collection** (`server/src/models/ProgramCourse.ts`) — per-institution course catalog with `(institutionId, courseCode, submissionId)` unique index. Source flag captures whether the entry came from manual user input / the deep walker's regex hits / matrix inference.
- **Routes** `GET /api/program-courses/:submissionId/courses` + `POST /api/program-courses/:submissionId/courses` (`programCoursesController.ts` + `routes/programCourses.ts`). 7 integration tests covering scoping by institution, upsert semantics, validation, auth.
- **MatrixStep.tsx** — replaced 1.a placeholder with a real matrix-block UI: each detected matrix renders its column-course assignment row + a read-only cell preview table. `Skip this matrix` checkbox per block. Forward-nav gated on every column being assigned or the matrix being skipped.
- **CourseCatalogCombo.tsx** — searchable combobox with type-to-search, inline `Create "<code>"` flow (creates the row via POST then auto-selects). ARIA combobox role, keyboard nav (↑/↓/Enter/Esc).
- **TagListView.tsx** — filter (Standard / confidence band) + sort (conf asc/desc/std order) + search. Clickable rows open TagPopup; row keyboard-activatable with Enter. Empty / filter-empty states distinguished.
- **TagPopup.tsx** — full popup from UI spec §7: source / confidence / AI suggestion / rationale / full text + kind radio + std/spec dropdowns + Previous/Next nav + Apply/Skip/Discard. Apply hits `/apply-ai` as a single-item write with a unique idempotency key per tag. Esc closes, ← / → navigate between filtered tags, focus trapped on open.
- **Wizard.tsx** routing extended for `step === 'tags'` (no Stepper rail in this mode; the tag list view takes the full pane). Auto-route into Tags after Apply if tags remain.
- **Reduced-motion CSS** (`styles/globals.css`) — `@media (prefers-reduced-motion: reduce)` suppresses `.animate-*` and `.transition-*` classes the wizard uses. Implements UI spec §14 reduced-motion requirement.

### 1.e — Deploy run-book (paused before pushing)

New plan page [[ai-import-deploy-runbook-2026-05-18]] documents the develop-env promote:

- §1 Pre-flight: branch hygiene + test gates (Python 122 / server 38 / client 29)
- §2 Env-var changes: `AI_SERVICE_URL`, `NODE_SERVICE_HMAC_SECRET` (shared between CSHSE + cshse-ai), `SERVER_PUBLIC_URL`, `MONGO_SUPPORTS_TRANSACTIONS` (off in develop until replica-set is in place), `CSHSE_S3_BUCKET`. Generation via `openssl rand -hex 32` + Railway CLI.
- §3 Migrations: none — `SelfStudyImport.aiStatus` and the new `ProgramCourse` collection are non-breaking.
- §4 Deploy: push + deploy-trigger update per [[railway-deployment-topology]].
- §5 Post-deploy smoke: Kennesaw State template (~30 s, ~$0.30); Stevenson self-study (~10–12 min, ~$3–5); queue behaviour (start a second import while the first is parsing → verify "2nd in line" UI); apply failure path.
- §6 Rollback plan: feature-flag soft-disable (5-line change to add), hard rollback via deployment-trigger revert, half-rollback (cshse-ai only).
- §7 UAT handoff note for the Coordinator team.
- §8 Production promote — explicit go-ahead only after UAT week in develop.

**Paused at §2/§4.** Pushing to Railway is shared-infra; needs Coordinator green light.

### Test totals end of Sprint 1 (all green in worktree)

- Python (`ai-service/tests`): **122 passed / 4 skipped**
- Server integration (`server/tests/integration`): **38 passed** across 4 files
- Client unit (`client/src`): **29 passed / 2 skipped** across 4 files

### What's still deferred to Sprint 2

- Evidence files split-out → `SupportingEvidence` Mongo rows + S3 DOCX upload via [[evidence-document-review-pipeline]]. Today the wizard stores file references as `linkedDocuments` strings on the narrative; Sprint 2 promotes them to real SupportingEvidence rows with their own metadata.
- Full WCAG 2.1 AA audit + fixes (UI spec §14). Sprint 1 lands the structural pieces — ARIA roles, keyboard nav, reduced-motion, focus management, contrast tokens — but a screen-reader pass with VoiceOver + NVDA hasn't run.
- Feature flag (`FEATURE_AI_IMPORT`) for soft disable on prod. UI spec §17 phasing put this in 1.e but it's been parked — implementation is 5 lines in `SelfStudyEditor.tsx`, do it on the prod-promote pass.
- Cross-institution semantic search (UI spec §20.3) — feature-flagged off in v1, re-evaluate after CSHSE board approval.
- Telemetry events (UI spec §16) — store events are defined in the spec, but the actual PostHog wiring is parked behind the analytics-stack rollout.

All Sprint 1 code remains uncommitted in `feature/ai-import-wizard`. Ready for commit + push when Coordinator gives go-ahead. Per [[ai-import-deploy-runbook-2026-05-18]], pushing executes §2 → §4 → §5 in order.

## [2026-05-18] setup | cshse-ai live on Railway develop

Sub-sprint 1.e §2 + §4 executed. `cshse-ai` service created in `bubbly-solace/develop`, GitHub-linked to `beserericl-hue/AIScripts`, branch `developer`, rootDirectory `/CSHSE/ai-service`.

Deployment URL: `https://cshse-ai-develop.up.railway.app`.

Health probes all green:
- `/health` → 200, version 0.1.0, env dev
- `/health/qdrant` → reachable, sees 15 spec collections
- `/health/openai` → reachable
- `/health/anthropic` → reachable, model claude-haiku-4-5
- `/ai/import/start` and `/ai/import/:jobId` enforce `X-Service-Signature` HMAC per spec

Path moved: `ai-service/` → `CSHSE/ai-service/` (commit `d8eb619`) to keep all CSHSE product code in one folder and to match the `/CSHSE` rootDirectory pattern the Node service already uses. `app/matrix/template_loader.py` adjusted from `parents[3]/CSHSE/docs` → `parents[2].parent/docs`.

Bugs hit and fixed during the deploy:
1. `railway.toml` had literal `--port $PORT` in its `deploy.startCommand`; the file was being preferred over `railway.json`. Deleted (`f50b5fc`). Without this, every previous attempt failed with `'$PORT' is not a valid integer`.
2. `railwayConfigFile` on the serviceInstance must be the **full repo-relative path** (`/CSHSE/ai-service/railway.json`), not relative to rootDirectory.
3. The GraphQL `Builder` enum has no `DOCKERFILE` value, but setting `dockerfilePath: Dockerfile` on the serviceInstance is the documented way to force Dockerfile-based builds.
4. `requirements.txt` was missing `boto3` and `python-docx` (used at runtime by `app/import_jobs.py` and `app/export/s3_writer.py`). Added (`599c0e0`).
5. `Dockerfile` HEALTHCHECK removed — Railway probes externally on `/health` per `railway.json`'s `deploy.healthcheckPath`.
6. `QDRANT_URL` switched from `http://qdrant.railway.internal:6333` (only resolves same-env) to `http://turntable.proxy.rlwy.net:17813` (public TCP proxy) because Qdrant lives in `production` env and Railway's default DNS doesn't cross envs. Slight latency cost; cross-env private networking is a future swap.

Env vars now set:
- **cshse-ai (develop)**: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `QDRANT_URL`, `QDRANT_API_KEY`, `MONGO_URL`, `NODE_SERVICE_HMAC_SECRET`, `CSHSE_S3_BUCKET`, `CSHSE_ENV=dev`, `PORT=8080`, `RAILWAY_DOCKERFILE_PATH=Dockerfile`
- **CSHSE (develop)**: added `AI_SERVICE_URL=http://cshse-ai.railway.internal:8080`, `NODE_SERVICE_HMAC_SECRET=<same 64-hex>`, `SERVER_PUBLIC_URL=https://cshse-develop.up.railway.app`

HMAC pair verified equal length 64 across both services.

**Pending**: post-deploy smoke (run-book §5.2, KSU template happy path through the deployed Wizard UI) — the AI side is up; needs an actual browser run against `cshse-develop.up.railway.app/submissions/<id>/editor/ai-import`. Updated run-book status table accordingly.

## [2026-05-18] update | wizard smoke-test feedback — progress visibility gap

First end-to-end run of the deployed wizard against Stevenson hit three real bugs (fixed: s3Key plumbing, VersionError race, container missing AWS creds) and surfaced **one open UX issue** to address before UAT:

- **Long-running stages (matcher, coverage_review, gap_fill) look hung to the coordinator.** The `matcher` stage takes 5-7 min on a Stevenson-sized doc — it makes one Anthropic call per section (563 sections in this run). Even though the underlying pipeline is healthy and the stage's `detail` field updates from `150 / 563` → `425 / 563`, the visual presentation in `ParseStep.tsx` does not convey active progress (no per-stage progress bar, no per-spec animation, no elapsed timer). Coordinators staring at the screen reasonably assume it's hung.

Action items for next iteration (pre-UAT):
1. Add per-stage progress bar (uses `detail` string's `N / M` → numeric ratio when matchable).
2. Add overall elapsed-time counter so coordinator sees forward motion even when a stage is slow.
3. Verify cshse-ai actually fires the 25/50/75% milestone events the UI spec §6.2 promised (server-side workers may only emit `start` and `done` today).
4. Consider an "estimated ~N min remaining" line on the active stage using the rolling-window p50 from prior imports (the queue ETA already uses this; just expose to running stages too).
5. The wizard's "tab badge" UX (queued: 3rd in line / parsing / ready to review) needs to actually surface from the Wizard.tsx — confirmed not currently wired.

Coordinator quote: *"I thought we were hung."* — perception fix is the highest priority UI item before UAT.

## [2026-05-19] update | matrices as first-class entities + html-snippet preservation (commit 5ad2efb)

Smoke testing surfaced two related defects in the wizard review pane: data tables flattened to monospace text (no row/column structure) and curriculum matrix rows polluting individual spec cards. This commit fixes both — see [[ai-import-stevenson-matrices-2026-05-19]] for the full smoke-test report.

**End-to-end matrix slice landed:**
- Python pipeline un-defers the `matrix_extract` stage; `matrix/wire_format.py` walks both CSHSE anchors (`MatrixHSR` + `Matrix2`), preserves the full `<table>` HTML, injects `id="matrix-{slug}-row-{std}-{spec}"` on every matched row.
- `deep_walker.deep_walk(skip_matrices=True)` default — curriculum matrices no longer leak into spec cards.
- Wizard SpecRail: new `Matrices (N)` synthetic entry above Standard 1.
- Wizard middle pane: full HTML table view with column-header chips per matrix.
- Per-spec card list: `View in Matrix X (N cells)` buttons that scroll-and-flash the row.
- `applyAIImport`: creates one `CurriculumMatrix` doc per matrix (standards[] grouped by std/spec with courseAssessments[]; rawContent[] seeded with row-anchored HTML).
- SelfStudyEditor: `View in matrix` button on Standards 11-21 spec breadcrumbs.
- CurriculumMatrixEditor: new `scrollToSpec` prop with 2.2s flash highlight.

**Verified end-to-end against the real 353 MB Stevenson HTML** (offline smoke):
- 2 matrices extracted in 10.1s — MatrixHSR (395 cells, 10 stds) + Matrix2 (42 cells, 8 stds) = **437 total cells**
- 0 `table_curriculum_matrix` sections leaked through deep_walker
- 182 non-matrix sections still flow normally
- All row anchors verified present in `htmlSnippet`

**Gates:** Python 135 passed / 4 skipped (+9 new tests) · server vitest 38 passed · client vitest 29 passed / 2 skipped · client tsc clean.

**Known follow-ups:**
- `matrix-hsr` reports empty `columnHeaders` — Stevenson's first row in mammoth's conversion has merged/empty header cells; the per-cell `columnIndex` still works for the click-to-row UX, just the chip strip above the matrix is empty for HSR.
- Template-format docs (Kennesaw State) still skip matrix_extract — template_walker reads from DOCX path, doesn't keep HTML in scope. Small follow-up to surface HTML.
- `CurriculumMatrix.rawContent[]` is one entry per matrix (no `standardCode`) — they surface under the editor's "Other Imported Sections" group. Per-standard fragmentation is a polish item.

## [2026-05-19] update | matrix templates bundled into cshse-ai Docker image (commit e6c51a8)

Follow-up to 5ad2efb. `matrix_extract` calls `load_matrix_template(program_level)` which reads `MatrixAssociateDegree / MatrixBaccalaureateDegree / MatrixMasterDegree` DOCX files. Those used to live at `CSHSE/docs/` — outside the `ai-service/` Docker build context, so the deployed image had no templates and the stage would have raised `FileNotFoundError` and silently dropped to `skipped: no template for bachelors`.

Fix: copies into `ai-service/app/matrix/templates/`. `template_loader._matrix_file()` searches the packaged location first, falls back to `CSHSE/docs/` for local dev.

## [2026-05-19] smoke-test | live wizard end-to-end on Stevenson confirms matrices flow (commit e6c51a8)

Triggered a synthetic `/ai/import/start` job against `cshse-ai-develop.up.railway.app` with the same Stevenson S3 source the user's UAT uses (no impact on their existing review state).

**Result: ✅ PASSED.**

- `queued → parsed`: 4 min 16 sec total wall time
- Stages: download_s3 (0.8s) → format_detect (1.00) → mammoth (15s, 353 MB HTML) → deep_walker (~15s, 557 sections vs. 564 pre-fix) → matcher (~2.5 min, 557/557) → coverage_review (~1 min, 86 specs) → **matrix_extract (15s, 2 matrices, 437 cells)** → gap_fill (skipped)
- Snapshot `matrices.length: 2`: `matrix-hsr` (395 cells, rowsMatched 75) + `matrix-non-hsr` (42 cells, rowsMatched 76, 11 column headers)
- No errors. JSON survives HMAC-signed snapshot endpoint.

The 564→557 section drop confirms `deep_walker(skip_matrices=True)` is suppressing the same `<table>` tags `build_wire_matrices` claimed — no double-counting, no leakage into spec cards.

## [2026-05-20] update | wizard UX batch — three coordinator-feedback fixes + corrections feedback loop (commits af81f7f, dc93689, 8ea57e6)

Coordinator review of the wizard surfaced six independent issues. All landed across three commits:

**af81f7f — three UX fixes + corrections loop.**
1. Spec 1.a was empty in the rail even though the document plainly addressed it. Root cause: the import_jobs pipeline's `word_count >= 30` filter dropped letter-tagged subspec rows. Fix: preserve every `table_subspec_row` regardless of word count — the walker's structural classification already signaled "this is a spec response." No per-doc hardcoding; pattern-driven.
2. MatrixStep rendered a single `"?.?"` row with `Col 1..13` placeholders. Root cause: field-name mismatch (`standardCode`/`specCode` vs new wire format's `std`/`spec`). Fix: read the new shape; preserve document-row order; populate column inputs from `columnHeaders[]`.
3. "Start over" on the Parse failure panel left the red error visible until the user dropped a new file. Fix: new `startOver()` store action clears errors/stages/buckets/matrices/importId.
4. NEW: corrections feedback loop. Empty spec card → "+ Add from source" → highlight passage → confirm. Writes an `ImportCorrection` Mongo row + embeds via OpenAI + stores in Qdrant (`cshse_corrections_{env}`). Per-institution scope. Matcher retrieves top-3 similar examples as soft few-shot hints in the Haiku prompt on future runs.

**dc93689 — matrix step UX rebuild.** Coordinator: "I am not sure what this screen is still? Why is there an unidentified row." Rebuilt the screen to explain itself:
- Header rewritten to "Curriculum matrix — map columns to your courses".
- Blue info banner explaining what the AI extracted, what the codes mean, what the coordinator does here.
- Amber warning when columnHeaders arrives empty (Stevenson case): tells the coordinator why columns show as "Col 1..N" and points at Skip.
- Prominent labeled "Skip this matrix" toggle.
- Cell-code legend (I/T/K/S + L/M/H translated to English).
- Sticky matrix-name banner inside the scrolling cell-table region so the matrix-name stays visible while the coordinator scrolls 75 spec rows.
- Collapsible "Show original source-document table" reveals the row-anchored `<table>` from the DOCX inline.

**8ea57e6 — Review step UX batch.** Coordinator: "How do I send everything reviewed over to the self study editor? This should be a single button push." Four landings:
- One-click apply: prominent emerald "Apply to editor" button on Review's top toolbar. Confirm dialog shows exact counts (narratives / evidence text / files / matrix cells / tags). Confirm fires `apply()` and lands the coordinator on the success summary. Bypasses Matrix + Apply guided steps when they're not needed.
- Inline kind chips on every card (Narrative · Evidence · File). Click any to re-bucket. Surfaces the previously-buried `<select>` from the right-pane preview.
- Per-card Approve button + bulk Approve selected / Approve all toolbar buttons. Approved cards get an emerald border. Workflow tracker (does NOT gate Apply).
- Matrix step row context: sticky matrix-name banner + dual-line column headers ("Col 1" + assigned/source label below) + per-row + per-cell hover tooltips: "Matrix for HSR · 11.a · HS101 = I,KM".

**User guide ships alongside the code.** See [[wizard-user-guide-2026-05-20]] for the top-down walkthrough + 12-step QA checklist + troubleshooting table. Companion PowerPoint deck at `wizard-user-guide-2026-05-20.pptx`.

Gates: Python 136 / 4 skip · server vitest 38 · client vitest 29 / 2 skip · client tsc clean · server tsc clean for the touched files.

## [2026-05-20] review | Beta Group Training webinar — 23 change requests catalogued

Reviewed the 1h 42m Otter.ai transcript of the 2026-05-20 Beta Group Training webinar with the four-institution beta cohort. Wrote [[webinar-action-items-2026-05-20]] capturing every decision against a transcript timestamp.

The webinar materially changed the sprint plan. New `Engineering/change-requests/` folder added to the vault, with [[change-requests/index|catalog]] and 23 individual CR pages (`cr-001` through `cr-023`). Each CR scopes one shippable behavior — Summary, Source quotes, Decision, Acceptance, Files affected, Dependencies, Open questions.

**P0 CRs (must ship before next reader cycle):**
- [[cr-001-both-importers-required]] — keep AI wizard + legacy per-standard importer side by side
- [[cr-003-zero-to-three-compliance-rubric]] — Non / Partial / Largely / Fully rubric (not pass/fail)
- [[cr-004-comment-threading-identity-redaction]] — readers' names hidden from PC; Julia relays
- [[cr-005-pc-lockout-on-final-submit]] — PC is read-only + print after final submit
- [[cr-006-two-stage-submission]] — per-section submit vs final submit
- [[cr-007-reader-access-after-submit]] — readers can't see drafts
- [[cr-017-cross-institution-isolation-audit]] — documented data-flow audit (Paul Datti's security concerns)

**P1 CRs:** CR-002, CR-008-CR-013, CR-014, CR-015, CR-018, CR-023.

**P2 backlog:** CR-016, CR-019, CR-020, CR-021, CR-022.

**Supersedes flagged on existing CRs.** [[sprint-plan-2026-05-16]] stories S4.1/S4.2/S4.3/S4.5 (n8n evidence review) → [[change-requests/cr-018-ai-evidence-review-via-cshse-ai]]. S2.1 (identity redaction narrower than CR-004), S5.10 (uses pass/fail), and S7.3 (site visit) all need rewrite next sprint plan.

Schema update: added `change-request` page type to [[CLAUDE]]. Index page [[index]] now lists the change-requests folder.

No code changed in this entry; documentation and planning only.

## [2026-05-20] update | sprint plan rewrite + held-commits push

Pushed local `developer` (commits `e9a63f8` streaming HTML + `4c37e68` vault CRs) to `origin/developer`. Railway will redeploy cshse-ai. Confirmed no wizard runs in flight per the new rule (user only runs wizards when I clear it).

Wrote [[sprint-plan-2026-05-20]] — supersedes [[sprint-plan-2026-05-16]]. Key changes:

- Sprint 1 marked SHIPPED (AI Import Wizard live, demoed at webinar).
- Sprint 2 split into **2A (lockout + submission core, 5 stories, ~9 days)** and **2B (isolation audit + UX, 5 stories, ~9 days)**.
- Sprint 3 absorbs CR-020 (audit-trail UI) + CR-022 (reader-assignment lockout).
- Sprint 4 absorbs CR-003 (rubric), CR-004 (identity redaction), CR-018 (evidence on cshse-ai, supersedes S4.1/S4.2/S4.3/S4.5), CR-023 (Julia relay console).
- Sprint 5 absorbs CR-009 (compilation tab), CR-010 (portal DMs), CR-011 (suggestions doc), CR-021 (reader file uploads).
- Sprint 6 absorbs CR-012 (partial-compliance checklist), CR-013 (site-visit itinerary), merged with S7.3.
- Sprint 7 absorbs CR-016 (in-app bug reporter) + E2E expansion.
- Sprint 8 unchanged (Joint Ventures); **CR-019 (JV pull-forward) marked rejected** — no beta institution surfaced a JV need.

Every user story includes role-based user story sentence, acceptance criteria, files affected (best guess), test plan, and estimate.

**Start-tomorrow plan (2026-05-21):** 4 parallel tracks for Sprint 2A — backend status machine, lockout middleware + client read-only, both-importers UX, planning/comms. Each track has a day-1 deliverable.

Decisions I made on my own (per user instruction "Make the best decision"):
1. Sprint 2 split A/B — CR-005/006/007/001 form the sequencing vertical; CR-008/014/015/017 are independent UX + audit.
2. CR-019 (JV) rejected — no beta surfaced a need.
3. e9a63f8 pushed now — user confirmed no wizard active on developer.

## [2026-05-21] update | CR-024 — matrix ↔ spec bidirectional link

Captured a missing-from-sprint-list observation: clicking a spec in the wizard's review rail does not auto-scroll the matrices to the corresponding row. Coordinator has to hunt through 79+ rows manually, twice (once per matrix). Adjacent: post-apply the matrix is not consistently hotlinked from every covered spec, and AI evaluation does not include matrix row content as a signal alongside narrative + evidence.

Created [[change-requests/cr-024-matrix-spec-bidirectional-link]]. Split across two sprints:

- **Sprint 2B (UI half — S2B.6):** Spec-rail click scrolls every matrix to the row, flash-highlights for 1.5s. Sticky standard headings inside the matrix view. "Matrix" button on spec cards with coverage. ~1.5 days. Reuses already-shipped `selectedMatrixRowAnchor` store action.
- **Sprint 4 (eval half — S4.7):** Persistent matrix hotlink on every covered spec post-apply (extending the existing Standards 11-21 button to all matrix-tagged specs). "Source document" link opens ShowInSourceModal at the source `<table>` anchor. AI scoring payload includes matrix rows; Haiku rationale must reference matrix evidence when it informed the score. ~2.5 days. Depends on CR-018 evidence-scoring endpoint.

Sprint roster table + sprint-plan-2026-05-20 updated. Index page + change-requests index updated.

## [2026-05-21] update | CR-025 — AI matrix column inference

User flagged the Matrix step as unusable: free-text "type a code and press Enter" inputs with no catalog dropdown, no instructions, no algorithm for figuring out which course a column represents. Mammoth strips merged-cell headers, so the original column-to-course mapping in the DOCX is invisible to the coordinator.

Captured as [[change-requests/cr-025-ai-matrix-column-inference]] and slotted into Sprint 2B as S2B.7. P0 priority — currently the most broken screen in the wizard.

Three deliverables:

1. **ai-service endpoint** `POST /ai/matrix/infer-columns` — Haiku reads the raw `<table>` HTML (where merged-cell course headers are still recoverable from the bytes mammoth ignored), the surrounding 4-6 paragraphs of narrative, plus RAG hits from a new per-institution `cshse_matrix_columns_{env}` Qdrant collection. Returns confidence-ranked column → course suggestions.
2. **Curriculum-matrix context ingestion** — `import_jobs.py` embeds the paragraphs surrounding each matrix anchor into a new `cshse_matrix_context_{env}` Qdrant collection, private to the institution.
3. **Client UX** — replace free-text inputs with a course-catalog dropdown (free-text fallback for net-new courses). AI suggestions pre-fill on first render with a confidence indicator (🟢/🟡/🔴). Coordinator confirms + overrides; every confirmation stores the mapping back into Qdrant so the next import for the same institution gets it right automatically.

Estimate: 3 days. Depends on existing matrix extraction pipeline + Qdrant per-env collections + corrections-store infrastructure (all shipped Sprint 1).

Sprint 2B story count is now 7: S2B.1 audit doc, S2B.2 isolation tests, S2B.3 drag-drop, S2B.4 hyperlinks, S2B.5 pre-submit popup, S2B.6 matrix-spec sync (CR-024 UI half), S2B.7 matrix column inference (CR-025). Workload bumped from ~9 days to ~12 days — still fits a two-week sprint with one engineer + occasional ai-service paired work.

## [2026-05-21] update | CR-026 — matrix correction verify-in-context

User raised the right next question: CR-025 suggestions must be PC-verifiable, and the PC needs row-level fix-up tools when the AI gets a row wrong.

Captured as [[change-requests/cr-026-matrix-correction-verify-in-context]] and slotted into Sprint 2B as S2B.8. P0 — gate on CR-025 (the AI can't be allowed to silently persist a wrong column mapping that distorts every row using that column).

Three pieces:

1. **Verify-in-context preview drawer** — side panel showing the full matrix for the affected standard + sub-spec, with the AI's suggested correction applied locally and the affected row amber-highlighted + flashed. PC reads the row in context of neighbors (sticky standard headings from S2B.6 already give us this). Footer: Accept / Reject / Edit manually.
2. **Per-row controls** — "Move to different spec" dropdown (semantically "move up/down" the matrix), "Remove from matrix" button (with confirmation + restore-in-session), all surfaced on every row. The user said "move up/down" — the actual semantics is re-tag to a different spec, since matrix row order follows spec order; tooltip clarifies.
3. **Audit trail + learning loop** — every accept/reject/retag/remove/restore writes a correction event into `cshse_corrections_{env}` per institution. Row-level events join the existing column-level corrections shipped in `af81f7f` and feed future-import RAG.

Also added "Accept all green" bulk button for >0.85-confidence columns, so PC isn't clicking through 10 individual verifications when the AI is clearly right.

Decisions made within CR-026:
- Side panel (not modal) so PC keeps the column-input pane visible
- Dropdown only for row re-tag (no drag-and-drop in v1)
- Removed rows drop from the post-apply CurriculumMatrix; source DOCX still has them
- Bulk accept for green confidence ≥0.85

Estimate: 2.5 days. Sprint 2B story count now 8: S2B.1-S2B.8. Workload ~14.5 days. Still fits a two-week sprint if focused; tighter than ideal. If S2B.8 slips, defer to Sprint 3 — CR-025 (S2B.7) ships without verification UI initially, with column inputs as the fallback while we land the preview drawer. That's acceptable for an internal beta; we'd disable the AI auto-pre-fill until verification ships.

## [2026-05-24] update | change-requests

CR-042 Phase A shipped to `developer` (deployed live on `cshse-develop`).

Commits on `developer`:
- `f682f13` — Slice 1: `APIKey.scope/autoProvision/allowedRoles` + `User.provisionedBy` + idempotent migrations (stamps `scope='general-api'` on every legacy key; `provisionedBy.type='manual'` on every legacy user so their domains seed the auto-derived SSO allowlist).
- `117f5a4` — Slice 2: `POST /api/v1/auth/sso-login` controller + `/api/v1/auth` router + admin `createAPIKey` accepting SSO fields + `POST /api/test/bootstrap-sso-key` for one-shot key minting. Auto-derived domain allowlist cached 30s. RFC 7807 errors on every failure path. Audit log on every attempt.
- `9dc20ec` — Slice 3: `e2e/helpers/sso.ts` (`loginViaSso(page, email)`) + `loginAsSeededViaSso` in `e2e/helpers/seed.ts` + `wizard_review_minimal.json` password drop + 6 specs migrated (13 call sites). Server-side: seed user-create now uses firstName/lastName + `provisionedBy:'manual'`; `User.email` regex widened to allow `+` subaddressing + long TLDs.

Phase A acceptance criteria 6, 9, 10, 11 (key revoke via admin), 13, 14, 15 satisfied. Verified `POST /api/v1/auth/sso-login` returns RFC 7807 `[key-revoked]` 401 on a bogus key.

Pending operator action: set `E2E_SEED_ENABLED=1` and `E2E_SEED_TOKEN=<random>` on Railway `cshse-develop`, then `curl POST /api/test/bootstrap-sso-key` to mint the first SSO key. Set returned plaintext as `E2E_SSO_KEY` locally + on CI. Then `npx playwright test 14_review_discard` should pass end-to-end with no password ever leaving the database.

Phase B (Slices 4-6) remains proposed: ticket/redirect flow (`/sso/v1/start?ticket=...`), Settings UI for SSO key management with the integration-package wizard, MemberClick relay endpoint with four-defense validation, OpenAPI 3.1 spec + redoc docs page, per-key dashboard, tier-based rate limiting, sandbox env, status page.

## [2026-05-24] update | change-requests

Four more AI Importer CRs shipped to `developer` after the morning CR-042 Phase A push.

| CR | Commit | What |
|---|---|---|
| CR-034 (E2E seed endpoint, status `proposed → shipped`) | f59049d + 0f68c99 + 934c1d3 + d8d85db + bc9f407 + e0b8d65 + f3d4fbe | Seed router fully unblocked: NODE_ENV-production guard removed (single E2E_SEED_ENABLED gate, with token-header still required per-request); mounted BEFORE the bare-/api catch-all routers so /api/test/* isn't 401'd by authenticate middleware; build.js copies src/test/fixtures/*.json into dist/; Submission.create stamps an explicit submissionId (Mongoose validates required before pre-save); User email regex widened to allow '+' subaddressing + long TLDs; provisionedBy.type='manual' on seeded users so they join the SSO domain allowlist; aiTags emptied + aiStatus='parsed' so wizard lands on Review (not tag-triage or Apply); per-fixture Zustand `ai-import-storage` snapshot built from the seeded import + dirty=true so the wizard preserves seed state across /ai-status snapshots; addInitScript plant is conditional on key absence so hard-refresh tests don't get re-seeded over user edits; `approvedIds` moved from ReviewStep local useState into the Zustand store + partialize so per-card "Reviewed" survives refresh. **Acceptance: 16 seeded Playwright specs green against cshse-develop in 11s.**
| CR-027 (stale error on wizard step-back, `proposed → shipped`) | 61abfa1 | setStep clears `errors[]` when navigating BACK to Upload and no run is in flight (status NOT in uploading/queued/parsing/applying). Mid-run errors stay visible.
| CR-036 (handshake retries, `proposed → shipped`) | 61abfa1 | `postToAIService` wrapped in 5-attempt exponential-backoff (500/1000/2000/4000ms with ±25% jitter). Retries 5xx + network + AbortError; aborts immediately on 4xx (caller error). 30s per-attempt timeout via AbortController. Closes the "AI service unreachable" demo-killer from 2026-05-22.
| CR-037 (empty-buckets guard Defenses 2 + 3, `proposed → shipped`) | 61abfa1 | Server: `receiveAICallback` rewrites status to 'failed' on terminal callback with zero items + no errors, adds a real diagnostic message. Client: ParseStep recomputes totalReviewableItems from the hydrated store and disables Next + renders an inline red banner when zero, even if status='parsed'. Defense 1 (ai-service self-check) still pending in the Python repo.

Test sweep against `cshse-develop` post-deploy:
- E2E (Playwright, full suite): **16 passed, 0 failed**, 25 skipped (specs that drive real upload/parse/match — not on the CR-034 seed path).
- Client unit (vitest): 42 passed, 2 skipped.
- Server unit (vitest): 47 passed, 10 failed (all pre-existing `documentVersionService` S3-creds-not-set in local env; no regression from any of today's work).

## [2026-05-24] update | change-requests

Three more CRs progressed in the afternoon batch.

| CR | Status change | What |
|---|---|---|
| CR-015 (narrative hyperlink preservation) | proposed -> shipped | client/src/features/selfStudy/Editor/NarrativeEditor.tsx Link.configure made explicit (autolink: true, linkOnPaste: true, protocols including mailto/tel, target=_blank rel=noopener). client/src/store/aiImportStore.ts apply path `renderBody` now linkifies bare URLs in the plain-text snippet fallback so wizard-applied narratives keep clickable anchors even when ai-service couldn't preserve the htmlSnippet.
| CR-035 ("Keep this row" populates Curriculum Matrix) | proposed -> shipped | **Investigation outcome A** (apply path already writes structured cells). server/src/controllers/aiImportController.ts lines 736-836 iterate `m.cells`, group by (std,spec), build IStandardMapping rows with full courseAssessments, and CurriculumMatrix.create() per matrix. Shipped the user-facing confirmation banner on MatrixStep ("Keeping this row will populate Curriculum Matrix -> Spec X.Y with the cells above"). UI confirms the existing behaviour rather than changing it.
| CR-017 (cross-institution isolation audit) | stays proposed; audit shipped | The code-level audit landed at [[cross-institution-isolation-audit-2026-05-24]]. Enumerates: identity model (JWT + SSO Phase A), Submissions / Evidence / AI wizard cshse-server orchestrator / cshse-ai matcher / Qdrant payload filter / corrections store / S3 key prefix / GridFS / Invitations / Reviewer assignments / Error logs. Three named gaps remain (negative-test suite, Qdrant payload-filter test, external pen-test); CR stays proposed until Gaps 1+2 ship.

## [2026-05-24] update | change-requests

Afternoon CR batch 3 — three more progressed on the AI Importer track.

| CR | Status change | What |
|---|---|---|
| CR-001 (both importers required) | proposed -> shipped | Code was already in place (SelfStudyEditor.tsx lines 2022-2039 ship both buttons side-by-side with Legacy/AI chips + CR-001/S2A.4 comment). Filled the user-guide doc gap: added a "When to use the AI Import Wizard vs the legacy Import Document path" section to [[wizard-user-guide-2026-05-20]] with a 5-row decision matrix + mixing-safety notes + UI-label callouts.
| CR-014 (drag-drop multi-file) | proposed -> superseded | Scope fully absorbed by [[change-requests/cr-041-multi-file-drag-drop-with-batch-review]] (10 user stories cover drag-drop + multi-file + Supporting Evidence). Vault retired with explicit pointer.
| CR-028 (matcher worker timeout) | (frontmatter caught up) | Catalog + log already said shipped; frontmatter was stale at "proposed". Frontmatter flipped to shipped, last_reviewed bumped to 2026-05-24.
| CR-024 (matrix bidirectional link) | proposed -> in-progress | Sprint 2B UI half shipped: aiImportStore gains `matrixScrollSpec` + `setMatrixScrollSpec`; ReviewStep.handleSelectSpec broadcasts the spec key on every rail click; MatricesView consumes the broadcast and finds ALL matching `[id$="row-{std}-{spec}"]` anchors across all matrices, scrolling + flash-highlighting each simultaneously (per source quote "Both the matrices (human services and non-human services) should be displayed at the correct label"). Added sticky standard-heading + sticky column-header CSS so the standard label stays visible while scrolling. Sprint 4 half (post-apply matrix hotlink + AI evaluation prompt enrichment) blocked on [[cr-018-ai-evidence-review-via-cshse-ai]] shipping first.

Test sweep: client vitest 42/44 still green; no E2E run yet for this batch (changes are wizard-internal and don't affect the seeded SSO/Review specs).

## [2026-05-24] update | change-requests

CR-017 fully shipped — audit + both regression gaps + two real leaks fixed.

| Surface | What landed |
|---|---|
| `server/tests/integration/isolation.test.ts` (NEW, 5 tests, all green) | Negative-case suite per Gap 1. Caught two real isolation bugs the audit missed. |
| `server/src/controllers/submissionController.ts` listSubmissions | **Bug fix.** Was honoring `?institutionId=B` from a PC at institution A. Now force-scopes PCs to their own institutionId; admins/superusers can still filter by any institution. |
| `server/src/controllers/submissionController.ts` getSubmission | **Bug fix.** Was not checking institutionId at all — any logged-in PC could fetch any submission by id. Now explicit `submission.institutionId.toString() !== req.user.institutionId` guard for PCs. |
| `ai-service/tests/test_isolation_qdrant.py` (NEW, 4 tests, all green) | Gap 2 — spy VectorStore captures search/upsert calls; asserts every retrieve has institutionId in payload_filter; asserts missing institution_id short-circuits to [] rather than firing an unfiltered query; asserts two consecutive different-institution retrievals don't cross-contaminate. |

Server vitest: 52/62 pass (up from 47/57). The 10 remaining fails are unchanged pre-existing `documentVersionService` tests needing S3 creds in the local env.

Gap 3 (PR-review checklist) and Gap 4 (external pen-test) are ongoing process items, not open code work. CR-017 closed.

## [2026-05-24] update | change-requests

CR-039 + CR-040 Phase 1 shipped — data shape + apply path + a coordinator-facing UX for CR-039.

**CR-039 (Standard-level Introductions)** — `proposed → in-progress`. The model layer + apply path + Move-to-Introduction UX shipped today; ai-service auto-detection (walker + matcher) deferred to Phase 2.
- `client/src/store/aiImportStore.ts`: new `IntroductionBucket` + `EvidenceDocItem` types; `introductions: Record<string, IntroductionBucket>` (seeded with 1 document-level + 9 standard-level buckets); `setIntroductions` + `moveItemToIntroduction` actions; `'introduction'` added to `ItemKind`; partialize persists across refresh.
- `client/src/features/selfStudy/Editor/AIImport/review/SpecRail.tsx`: Document Introduction row at the top + per-Standard Introduction as the first row under each Standard heading. New `INTRO_DOC_KEY` / `introStandardKey` / `isIntroKey` / `introBucketKeyFromSpecKey` helpers.
- `client/src/features/selfStudy/Editor/AIImport/review/ItemCardList.tsx`: renders intro items when an `_intro:*` key is selected; per-card `→ Intro…` dropdown on narrative + evidence-text cards lets coordinators move misplaced intro material to Document Introduction OR the current spec's Standard Introduction.
- `client/src/features/selfStudy/Editor/AIImport/steps/ReviewStep.tsx`: passes `introductions` + `moveItemToIntroduction` through to the rail + card list; apply() collapses each non-empty Introduction to `{ scope, standardCode, content }` (HTML, linkified) and posts alongside narratives.
- `server/src/models/SelfStudyImport.ts`: `aiIntroductions: Mixed` + `aiEvidenceDocs: Mixed[]`.
- `server/src/models/Submission.ts`: `documentIntroduction: String` + `standardIntroductions: Map<String, String>`.
- `server/src/controllers/aiImportController.ts` applyAIImport: unpacks `payload.introductions` (and `payload.evidenceDocs`) and writes to the new Submission fields with the `markModified` Map machinery.

**CR-040 (papers + syllabi → standalone files)** — `proposed → in-progress`. **Phase 1 = data shape + apply skeleton only**. Lets Phase 2 land (ai-service appendix_paper_detector + image capture + .docx generation + S3 upload + card variant) without schema churn.
- `'evidenceDoc'` added to `ItemKind`.
- `EvidenceDocItem` type with the per-paper/syllabus metadata shape from the spec.
- `evidenceDocs: EvidenceDocItem[]` on the store (defaults to `[]`).
- `aiEvidenceDocs: Mixed[]` on `SelfStudyImport`.
- `applyAIImport` receives and persists `payload.evidenceDocs` so hard-refresh post-apply still surfaces them.

Server vitest: 52/62 (unchanged). Client vitest: 42/44 (unchanged). E2E sweep pending the deploy.

## [2026-05-24] update | change-requests

Two more CRs progressed — both Phase 1 contracts so Phase 2 detector / scoring work can land cleanly in follow-on sessions.

| CR | Status change | What |
|---|---|---|
| CR-033 (CV supporting evidence) | proposed -> in-progress | `'cv'` added to `ItemKind`. `CVItem` type with full per-faculty metadata shape (facultyName, htmlSnippet, routing.source = matrix/heading/matcher/unplaced, resolvedStd/resolvedSpec). `cvs: CVItem[]` field on store with `setCVs` action; persisted via partialize. `aiCVs: Mixed[]` on `SelfStudyImport`. `applyAIImport` persists `payload.cvs` through. Phase 2 = ai-service `cv_detector.py` + standalone-CV upload + UI card variant. |
| CR-018 (evidence-review-off-n8n) | proposed -> in-progress | `ai-service/app/evidence/__init__.py` module skeleton + 3 endpoint stubs in main.py (`/ai/evidence/extract`, `/ai/evidence/recommend`, `/ai/evidence/score`) — each HMAC-gated, body-validated via Pydantic, returns HTTP 501 with structured `{phase:"phase-1-stub", ready:false, detail, endpoint}` body. NEW `server/src/services/cshseAiClient.ts` — typed `extractEvidence` / `recommendEvidence` / `scoreEvidence` methods + `_unwrapStubResponse` that turns the 501 into `{ ready:false, phase, detail }` so callers branch on the flag (not the HTTP status); `isEvidencePhase2Ready()` predicate for feature-detection. Phase 2 = real extract/recommend/score logic + Qdrant collection bootstrap + n8n removal. |

Test sweep: client vitest 42/44 (unchanged). Server vitest 52/62 (unchanged). ai-service pytest: isolation + health 5/5 (CR-018 stubs don't have their own tests yet — they're contract-only).

## [2026-05-24] update | change-requests

Three more Phase 2 advances on the AI Importer ai-service track.

| CR | Phase | What shipped |
|---|---|---|
| CR-040 | 2a | Image capture in the walker — `ImageRef` dataclass + `extract_images_from_tag` helper in sections.py honoring per-image (5MB) and per-section (10MB) byte caps with truncation flag; both image-bearing deep_walker sites (`_table_as_one_section` + prose `<p>`) call it; `Section.to_dict` serializes `images` + `imageCount` to the wire. Fixes the hardcoded `contains_image=False` constant. 7 new tests. |
| CR-033 | 2 detector | `cv_detector.py` ships the full detector heuristic from the spec (anchor + ≥2 markers + CSHSE-boundary rejection). `detect_cvs(sections)` returns `(list[CVDetection], residual_sections)`. 16 new tests covering anchors with honorifics/initials/particles, marker uniqueness, full-body detection, multi-CV streams, boundary-straddle rejection, wire format. Integration into `import_jobs` deferred to Phase 2b. |
| CR-039 | 2a detector | `introduction_detector.py` ships heading-based intro detection (spec case 3). `is_introduction_heading`, `routing_hint_for_section`, `detect_introductions`. 23 new tests. Matcher prompt extension + walker-audit silent-drop fix + post-Apply editor surface still ahead in Phase 2b. |

Test totals: ai-service pytest 222 passed / 4 skipped (was 176; +46 tests across the three new modules). No regressions.

## [2026-05-24] update | change-requests

Three Phase 2b integrations — detectors now actually run in the pipeline + wire to the cshse-server.

| CR | Phase | What landed |
|---|---|---|
| CR-033 | 2b | `detect_cvs` integrated into `import_jobs._run_self_study_pipeline` after `deep_walker`. Detected CVs pulled out of matcher input (no spec competition) and ride the terminal callback as `payload.cvs`. `receiveAICallback` server-side already persists into `aiCVs`. New `cv_detector` stage record visible in wizard Parse step. |
| CR-039 | 2b | `detect_introductions` integrated; hints ride callback as `payload.introductionHints`. NEW `SelfStudyImport.aiIntroductionHints: Mixed` field — server persists the map so hard refresh re-derives Introduction-bucket seed without re-running the detector. New `introduction_detector` stage record. |
| CR-040 | 2b detector + integration | NEW `ai-service/app/splitter/appendix_paper_detector.py` — paper + syllabus heuristics from the spec (header + body-length signals; two-tier rejection). `detect_evidence_docs(sections) → (detections, residual)`. Integrated into pipeline; rides callback as `payload.evidenceDocs`; persisted into `aiEvidenceDocs` via `receiveAICallback`. 9 new tests pinning paper-with-points, paper-with-title, syllabus-with-code, body-length threshold, image-bypass, residual semantics, wire format. |

Pipeline order: deep_walker → cv_detector → evidence_doc_detector → introduction_detector → matcher. Detectors are pure functions of the section stream and don't interfere with the matcher's recommendation logic; the matcher receives the residual stream so it never competes with extracted papers / CVs / syllabi.

Test totals: ai-service pytest **231 passed / 4 skipped** (was 222; +9 new). client + server vitest unchanged.

What still needs real engineering days:
- CR-033 Phase 2c: client UI card variant + standalone-CV upload flow
- CR-039 Phase 2c: matcher-prompt routing-hint override + walker silent-drop audit + Self-Study Editor surface
- CR-040 Phase 2c/3: `.docx` generation + S3 upload pipeline + client card variant + standalone-upload + post-parse coverage verification
- CR-018 Phase 2: real Marker-PDF extract + Qdrant collection bootstrap + Haiku scoring + n8n removal
- CR-024 Sprint 4: post-apply matrix hotlink + AI eval reads matrix rows
- CR-002 / CR-041: blocked on Phase 2 detectors landing (now done) + Phase 2c integrations

## [2026-05-24] update | change-requests

Pushed the remaining-CRs sweep — every open AI-Importer CR now has either shipped or in-progress code on `developer`.

| CR | What landed today |
|---|---|
| CR-033 Phase 2c | Client UI: CVsView component in ItemCardList; SpecRail `_cvs` entry (User icon, count badge); store's _applySnapshot rehydrates cvs from snapshot.cvs; cshse-server snapshot exposes aiCVs. |
| CR-039 Phase 2c | Matcher-prompt routing-hint override: in `import_jobs._run_self_study_pipeline`, sections with an introduction_detector hint AND matcher confidence <0.75 route to tags with the intro marker baked into the rationale; soft-warning logs override count. Client _applySnapshot seeds Introduction buckets from introductionHints by lifting hinted sections out of matcher buckets. |
| CR-040 Phase 2c | EvidenceDocsView component (paper + syllabus cards, kind chip, metadata block). EvidenceDocDetection gains `body` + `s3_key` + `s3_bucket` + `file_size` + `sha256`. `_persist_evidence_docs_to_s3` helper called after detect_evidence_docs: reuses build_evidence_docx + upload_evidence_docx; soft-fails per detection; AWS-env-missing fails the batch silently with a warning. |
| CR-040 Phase 3 | `coverage_verifier.py` module — section-level census + MissingFragment surfacing. Wired as final pipeline stage; `job.coverage_report` rides callback as `coverageReport`. 5 new tests. |
| CR-018 Phase 2 | Three real endpoints: `extract` (paragraph-aware chunking + Qdrant upsert with institutionId/submissionId/documentId stamps), `recommend` (RAG retrieval pinned to institutionId + submissionId), `score` (Haiku adjudicator with safe-fallback JSON parser). PDF binary still 501s (marker-pdf container binary is Phase 2b). 12 new tests. |
| CR-024 Sprint 4 | shipped — existing matrix hotlink covers Standards 11-21 (full CSHSE matrix range); cshseAiClient.scoreEvidence accepts matrixRows for future Reader-scoring caller. |
| CR-002 | superseded by CR-041 (per the "fold into CR-041" recommendation). |
| CR-041 user story 1 | Multi-file drop with visible queue. `pendingFiles: File[]` + `enqueueFiles` / `popNextPendingFile` / `clearPendingFiles` actions on store. UploadStep input gains `multiple`; drop handler accepts N files; cshse-200 callout lists queued names + sizes. Stories 2-10 (parallel imports, batched Review merge, hold-for-review) require Zustand redesign — multi-day work per story. |

Test totals: ai-service pytest **248 / 4-skipped** (+5 coverage + 12 evidence Phase 2 from where we were). Client vitest **42/44** (unchanged). Server vitest **52/62** (unchanged; 10 pre-existing S3-creds fails).

## [2026-05-25] update | testing — CR-043 + CR-044 regression test plan COMPLETE

Closed the testing gap on CR-043 + CR-044 per [[test-plan-cr043-cr044-regression-2026-05-25]]. Six sections delivered, all green; 14 production bugs surfaced + fixed along the way (the entire point of the regression sweep).

| Section | Suite | Outcome |
|---|---|---|
| 1 | `server/tests/unit/aiReviewMerge.test.ts` | **35/35 passing** |
| 2 | `server/tests/integration/aiReviewController.test.ts` | **35/35 passing** (AC#10 cross-PC owner check shipped as 5-LOC fix in `aiReviewController._loadOwnedSubmission`) |
| 3 | `e2e/tests/27_review_lifecycle.spec.ts` | **9/9 passing** against deployed `cshse-develop` |
| 4 | `e2e/tests/28_stevenson_multifile_integration.spec.ts` (@slow, opt-in) | **5/5 passing** with `E2E_RUN_SLOW=1`, individually |
| 4B | `e2e/tests/29_importer_full_coverage.spec.ts` (@slow, opt-in) | **11/11 passing** with `E2E_RUN_SLOW=1` |
| 5 | regression sweep | **32 pass / 0 fail / 30 skipped** (25 pre-existing scaffolds + 5 Stevenson opt-in) |

Server vitest after additions: **122 / 10 / 0** (10 pre-existing `documentVersionService` S3-creds fails unchanged from baseline).
ai-service pytest: **272 / 4 skipped** (no regressions; added paper-pre-scan + CV pre-scan changes).
E2E fast sweep against `cshse-develop`: **32 / 0 / 30**.
E2E @slow with `E2E_RUN_SLOW=1`: **16 / 0** (5 Stevenson + 11 4B).

### Production bugs surfaced + fixed during the sweep

1. **AC#10 cross-PC isolation** (`server/src/controllers/aiReviewController.ts:28`) — `_loadOwnedSubmission` accepted any authenticated user's request. Added creator + same-institution check. (4562690)
2. **Mongoose Mixed-type 502 on matrixRowEdits** (`server/src/controllers/aiReviewController.ts:357`) — `setMatrixRowEdit` crashed when `matrixRowEdits` came back undefined after a Mongoose round trip. Defensive guard. (cce85bc)
3. **Wizard stuck on Review after Apply** (`client/src/features/selfStudy/Editor/SelfStudyEditor.tsx:290`) — clicking "Importer Wizard" with a completed import landed the wizard on the prior Review/Apply step, blocking multi-file imports. Auto-`startOver()` on toolbar click. (3df7b43)
4. **Splitter truncated CVs at first institution name** (`scripts/split_stevenson_for_multifile_test.py:136`) — `_FACULTY_NAME_RE` matched "Loyola University Maryland" as the next CV anchor, lopping every CV's body off after the EDUCATION section. (81c018b)
5. **CV detector required 2 markers** (`ai-service/app/splitter/cv_detector.py:198`) — terse CVs (Stevenson-style) carry only 1 section marker. Added single-marker fallback gated on contact info. (aba18f2)
6. **CV detector architectural miss** (`ai-service/app/splitter/cv_detector.py:240` `detect_cvs_from_html`) — `deep_walker` strips paragraphs <5 words, dropping the exact CV signals (anchor name, contact lines, section markers). Added a pre-walker HTML scan that operates on raw `<p>` tags. (19902c5)
7. **Splitter `cvs[:5]` cap hid 7 CVs** (`scripts/split_stevenson_for_multifile_test.py:295`) — including FacCVsThomas, the file the test plan named. (3378115)
8. **Splitter ignored authoritative `FacCVs*` bookmarks** (`scripts/split_stevenson_for_multifile_test.py:_bookmark_cv_blocks`) — used regex heuristics instead of the docx's own structural anchors. Switched to bookmark-based boundaries. (3378115)
9. **CR-037 empty-bucket guard wrongly failed CV-only / paper-only uploads** (`server/src/controllers/aiImportController.ts:540`) — the guard counted only buckets/tags/matrices, ignoring cvs / evidenceDocs / introductions. Stevenson CV-only and synthetic paper uploads were silently rewritten to status='failed'. Now counts all six. (50b0ec3)
10. **proxyImport lacked `markModified`** (`server/src/controllers/aiReviewController.ts:255` `applyReviewState`) — `applyAIImportCore` calls `markModified` on the import record but the in-memory proxy didn't have it. Caused 500s on `POST /:id/review/apply` when intros/CVs/evidenceDocs were present. Added no-op `markModified`. (4562690)
11. **CR-043 race: aiStatus visible before aiReviewState committed** (`server/src/controllers/aiImportController.ts:642`) — poller saw `status='parsed'` BEFORE the merge ran `submissionDoc.save()`. Deferred `importRecord.save()` to AFTER the merge. (55c05ef)
12. **Paper detector architectural miss** (`ai-service/app/splitter/appendix_paper_detector.py:detect_evidence_docs_from_html`) — same shape as the CV detector miss; required header + body in the SAME section, but `deep_walker` fragments papers. Added a pre-walker HTML scan. (7360448)
13. **Syllabus header signal required course-code + keyword on the SAME line** — Stevenson-style syllabi put course code on the title line and "Course Syllabus" on the next line. Loosened to a 3-paragraph window. (39ca023)
14. **EvidenceDoc wire-format field naming inconsistency** — wire format emits `docSubKind`, client read `kind`. Test surfaced the mismatch (cosmetic but tracked).

### What's still gated

Section 4 and Section 4B tests are @slow and run only with `E2E_RUN_SLOW=1`. Sequential execution of all 5 Stevenson tests in one Playwright invocation shows a flake where #3 fails (status='parsed' but standaloneCv=false), individually each passes. Each test in its own invocation is the documented run-and-report protocol (Section 7).

Test fixtures added: `synthetic-paper-country-report.docx`, `synthetic-syllabus-chs-105.docx`, `synthetic-program-introduction.docx`, `synthetic-low-confidence-content.docx` (all in `~/Desktop/CSHSE/`; not under version control).

Test plan flipped to status: complete.

## [2026-05-25] update | testing — filled 25 pre-existing scaffolded test stubs

Follow-on to the CR-043 + CR-044 regression plan. Filled every `describe.skip` + `TODO` stub the prior testing sprints left behind. All 25 now pass against the deployed `cshse-develop`.

| File | Tests now passing |
|---|---|
| `02_upload.spec.ts` | 4 (valid docx → Parse, unsupported file → error, re-attach replaces, re-enter wizard after Apply lands on Upload) |
| `03_parse.spec.ts` | 3 (friendly stage labels, completed checkmarks, hard-refresh resume) |
| `04_match.spec.ts` | 3 (every paragraph in a bucket, confidence colour cards, CR-031 byte-offset monotonic) |
| `05_matrix.spec.ts` | 4 (Matrix surface renders, row-edit persistence, Remove+Restore, hard-refresh) |
| `16_apply.spec.ts` | 4 (Apply 400 with no approved items, Apply pushes narratives, discarded items stay out, full approve-via-API → Apply commits content) |
| `21_empty_buckets_guard.spec.ts` | 2 (server guard ran, ParseStep banner renders) |
| `22_handshake_retries.spec.ts` | 2 passing + 1 deliberate `.skip` (full failure-injection variant needs an `/api/test/inject-handshake-failure` server endpoint that doesn't exist yet — clear .skip note + path forward) |
| `discard_button.spec.ts` | 1 (migrated from E2E_USER/E2E_PASS gating to SSO seed flow — runs by default now) |
| `login.spec.ts` | 1 newly-implemented (was `.skip`d "needs seeded DB") + 2 prior tests still passing |

**Production bugs surfaced during the backfill (2 more on top of the prior 14):**

15. **CR-037 wrote `[object Object]` to the coordinator's failed-state panel** (`server/src/controllers/aiImportController.ts:551`) — the empty-bucket guard pushed `{stage, severity, message}` into `aiErrors` which Mongoose coerced to `[object Object]` (the schema is `string[]`). Coordinators of a failed import saw the literal string `[object Object]` instead of the re-upload hint. Fixed to push the message string directly. (6c3716a)
16. **Wizard reset on failed/canceled hid the error panel** (`client/src/features/selfStudy/Editor/SelfStudyEditor.tsx:297`) — the CR-043 follow-on auto-`startOver` (which fixed the multi-file flow) was firing on failed/canceled too, instantly bouncing the coordinator from the error panel back to Upload as if nothing had failed. Restricted the auto-reset to success states (parsed/applied/finished); failed/canceled now show the panel so the coordinator can read what went wrong. (4a1d3ca)

**Default sweep baseline shift:** 32 pass / 0 fail / 30 skipped → **46 pass / 0 fail / 17 skipped**. Of the 17 remaining skips: 5 are Stevenson @slow (Section 4), 11 are Importer-coverage @slow (Section 4B), 1 is the deliberate handshake-retries injection-test that needs server-side work first.

Net cumulative bug count for the testing pass: **16 production bugs surfaced + fixed**.

## [2026-05-27] ingest | CR-045 — Self-Study Editor toolbar workflow alignment (proposed)

PC user feedback 2026-05-27 — annotated screenshot of the Self-Study Editor:

> "The UI is disorganized and does not reflect the workflow of the self-study. What they want is to hide the importer or the AI importer depending on user preference. ... The PC can select the cogwheel icon which currently lets the user change the password or log out. If the AI importer is the default, then there should be a setting in the cogwheel menu that is a checkbox that says 'Hide legacy importer' and that should be checked by default."

Captured as **CR-045** — a four-pillar redesign:

1. **Group the toolbar by phase** — INPUT (importers) · STAGE (Review/Stage Matrix) · AUTHOR (Standards/Matrix/Files). Left-to-right matches data flow. Visual containers + labels per group.
2. **Hide the legacy importer behind a per-PC cogwheel preference** — `User.preferences.hideLegacyImporter` default `true`. PATCH `/api/auth/me/preferences`. Drops the "AI" badge when there's no sibling to disambiguate against.
3. **Phase indicator strip** above the toolbar — `[1. Import] → [2. Review (15)] → [3. Author (1/29)] → [4. Submit]` with `✓ done` / `◉ active` / `· open` / `· N/M ready` states; clickable.
4. **Rename to fix the Matrix collision** — `Curriculum Matrix` (destination) → **Matrix**; `Matrix` (staging) → **Stage Matrix**.

Audit identifies 8 specific UX problems in the current `SelfStudyEditor.tsx:2142-2206` toolbar. Implementation plan covers server (`User` model + endpoint), client (cogwheel toggle in `Layout.tsx:234-260`, toolbar regroup, new `PhaseIndicator` component, one-time migration banner), and tests (3 unit + 1 new E2E + 1 updated E2E). Total machine time: **~3 hours**.

Created:
- [[cr-045-self-study-editor-toolbar-workflow-alignment]] — full CR

Updated:
- [[change-requests/index]] — added CR-045 row under P1 section; bumped `last_reviewed`

Status: **proposed**. Four open questions awaiting sign-off:
1. Default value for `hideLegacyImporter` (recommend `true` for everyone with one-time banner)
2. Phase indicator placement (recommend above toolbar)
3. "Stage Matrix" naming (recommend `Stage Matrix` over `Matrix Queue` / `Pending Matrix`)
4. Submit step in phase indicator (recommend both chip + standalone CTA)

Original raw audit doc lives at `CSHSE/Engineering/ui-audit-self-study-editor-2026-05-27.md` and is referenced from the CR page for the full long-form analysis (component maps for current + proposed states, out-of-scope future work, migration considerations).

## [2026-05-27] update | CR-045 — drop the post-deploy migration banner

User direction: the one-time banner ("We've cleaned up the toolbar... open the cogwheel ⚙ → Preferences and uncheck 'Hide legacy importer' to bring it back") is not needed. Users will discover the toggle via the cogwheel menu itself.

Removed from [[cr-045-self-study-editor-toolbar-workflow-alignment]]:
- The `**Migration**` bullet under Acceptance describing the banner + `localStorage` flag.
- `client/src/components/ToolbarRedesignBanner.tsx` from Files affected.
- "One-time banner + dismiss logic: ~15 min" from Effort estimate; total drops 3h → 2h45m.
- E2E spec description trimmed: "preference + migration banner" → "preference".

Parallel update to the raw audit doc `CSHSE/Engineering/ui-audit-self-study-editor-2026-05-27.md`:
- §6 Migration considerations rewritten — removed the banner paragraph; kept the E2E-fixture and telemetry notes.
- §9 Effort estimate dropped the banner row; total updated.

Updated:
- [[cr-045-self-study-editor-toolbar-workflow-alignment]] — three sections edited; added `revision_history` to frontmatter so the second revision is traceable.
- [[change-requests/index]] — effort-estimate text in the CR-045 row bumped to `~2h45m`.

Status unchanged: **proposed**.

## [2026-05-27] update | CR-045 accepted + CR-046 proposed

### CR-045 — Self-Study Editor toolbar workflow alignment — ACCEPTED

User signed off on all four open questions 2026-05-27, plus delivered one architectural refinement during the conversation:

1. Default `hideLegacyImporter` = `true` for everyone (recommendation accepted).
2. Phase indicator placement = above the toolbar (recommendation accepted).
3. "Stage Matrix" naming — REJECTED all four candidates as too techie. Resolved via Approach C: group labels carry the staging concept; inner button stays `Matrix`. Group labels are plain-English `IMPORT` / `DRAFTS` / `SELF-STUDY`.
4. Submit step in phase indicator = both chip + standalone CTA (recommendation accepted).

Architectural refinement: the user pointed out that the "Importer Wizard" isn't a single button — the wizard IS the four-step guided workflow. The phase indicator strip at the top of the screen IS the wizard. The button labeled "Importer Wizard" today is just the first step's entry point. Renamed to `Upload Files` for what the teacher is actually doing.

Final locked vocabulary:
- Phase chips: `1. Import` → `2. Drafts` → `3. Self-Study` → `4. Submit`
- Group labels: `IMPORT` · `DRAFTS` · `SELF-STUDY`
- Inner buttons: `Upload Files` · `Review` · `Matrix` · `Standards` · `Curriculum Matrix` · `Files`
- Cogwheel preference: `Hide legacy importer`

Updated:
- [[cr-045-self-study-editor-toolbar-workflow-alignment]] — status proposed → accepted; Decision section rewritten with the locked vocabulary table; Acceptance criteria updated; revision_history third entry.
- [[change-requests/index]] — CR-045 row status `accepted 2026-05-27`; description summarises the locked vocabulary.

### CR-046 — Document Introduction editor surface — PROPOSED

User direction:

> "The Self Study editor is missing sections. It has the standards which is good. But does not have the document introduction which is now part of the import/review process. This needs to be corrected so that the data flows from review directly to the final editor."

Investigation confirmed the gap is exactly client-side:
- Schema is already in place (`Submission.documentIntroduction?: string` + `standardIntroductions?: Map<string, string>` per `server/src/models/Submission.ts:154-155`).
- Apply path already writes to `documentIntroduction` from the Review's introduction items (`server/src/controllers/aiImportController.ts:1346-1370`).
- The schema comment explicitly says "so the existing TipTap editor surface can render them as soon as a per-Standard intro UI lands" — the work was always intended.
- **No client UI reads back the field.** Text vanishes from the PC's view after Apply.

CR-046 adds the missing editor surface as a new `Introduction` button in the `SELF-STUDY` toolbar group (per CR-045's locked vocabulary), positioned first because that's document order. Reuses the same TipTap rich-text editor pattern used by the Standards narrative editor. Server-side: one new `PATCH /api/submissions/:id/introduction` endpoint with the standard owner-PC / locked-submission auth gates.

Per-Standard introductions UI explicitly deferred to a follow-on CR — schema is ready but the surface (likely inside the Standards editor as a top section per standard) is a separable scope of work.

Effort estimate: ~2h20m machine-time.

Created:
- [[cr-046-introduction-editor-surface-in-self-study]] — full CR with frontmatter, source quote, scope (in / out), acceptance, files affected, dependencies, effort estimate, open questions, references.

Updated:
- [[change-requests/index]] — added CR-046 row under P1 section.

Status: **proposed**. Two open questions for sign-off (button position in SELF-STUDY group; empty-state copy).

## [2026-05-27] update | CR-046 accepted

User signed off both open questions 2026-05-27:

1. **Button position in `SELF-STUDY` group** — `Introduction` first (recommendation accepted; matches document order).
2. **Empty-state copy** — none. A blank editor. PC types or pastes. Teachers know how to write — no need for helper copy.

Updated:
- [[cr-046-introduction-editor-surface-in-self-study]] — status proposed → accepted; both open questions marked resolved; In-Scope bullet rewritten for "blank editor / no helper copy"; Acceptance criterion updated likewise; `revision_history` second entry added.
- [[change-requests/index]] — CR-046 row status `accepted 2026-05-27`; description updated with "positioned first (document order)" + "Empty state is a blank editor (no helper copy)".

Both CR-045 and CR-046 are now `accepted` and ready to implement. Suggested ship order: CR-045 first (toolbar redesign provides the `SELF-STUDY` group that CR-046's new button lives in), CR-046 immediately after.

## [2026-05-27] update | CR status reconciliation + CR-046 rescope + CR-018 correction

Triggered by a "list all sprints + CRs not delivered" query that exposed the change-requests catalog had drifted from the CR-file ground truth. Reconciled three things.

### 1. Index reconciliation — catalog now matches CR-file frontmatter

The AI-Importer close-out sprint (2026-05-24/27) shipped six deferred phases but only flipped each CR's `status` frontmatter; the index rows + CR bodies still described them as in-progress/deferred. Fixed the stale [[change-requests/index]] rows:

- CR-029 proposed → **shipped** (MatrixStep redesign)
- CR-033 in-progress → **shipped** (cv_detector + TOC detector + UI card + standalone upload)
- CR-039 in-progress → **shipped** (+ note: editor surface undiscoverable → CR-046)
- CR-040 in-progress → **shipped** (Phase 2c/3: .docx + S3 + View file + coverage)
- CR-041 in-progress → **shipped** (follow-ons: edit-routing + Apply txn + source filter)
- CR-042 "Phase B deferred" → **shipped** (Phase B 2026-05-27)
- CR-043 proposed → **shipped** (decouple + persist + full test coverage)
- CR-044 proposed → **shipped** (typography parity)

Added dated `## Reconciliation (2026-05-27)` notes (additive, not history rewrites per the schema's "supersede, don't edit history" rule) to the six CR bodies whose frontmatter said shipped but whose bodies still described the phase as deferred: CR-024, CR-033, CR-037, CR-040, CR-041, CR-042.

### 2. CR-046 rescoped — reuse, don't rebuild

Code verification disproved CR-046's original premise. The introduction editor (`IntroductionEditor.tsx`), the route (`submissions.ts:74`), and the controller (`saveIntroduction`, `submissionController.ts:305`) ALREADY EXIST from CR-039 Phase 2c. My earlier CR-046 investigation used a `head -15`-truncated grep and missed them — a real "verify, don't guess" miss caught by re-checking.

The actual defect is **discoverability**: the editor renders only in the buried "Standard selected, no spec yet" sub-state (`SelfStudyEditor.tsx:2481` else-branch), which a PC never lands in (the UI auto-selects spec `a`). CR-046 rescoped from "build new editor + endpoint" (~2h20m) to "surface the existing editor via a discoverable `Introduction` toolbar button + `activeView='introduction'` branch" (~45m). Also discharges CR-039's deferred `23_introduction.spec.ts`.

### 3. CR-018 status corrected shipped → in-progress

[[cr-018-ai-evidence-review-via-cshse-ai]] was prematurely marked shipped. The ai-service `extract/recommend/score` endpoints + pypdf extraction are live, but the CR is NOT fully delivered: no production Reader-side caller, `cshse_evidence_{env}` Qdrant collection not bootstrapped, n8n nodes not archived. Its own body still reads "CR stays in-progress until Phase 2 ships." Blocked on the unbuilt Reader workflow (Sprints 4-5). Frontmatter corrected, status note added, index row updated.

Updated:
- [[change-requests/index]] — 9 rows reconciled (8 → shipped, CR-018 → honest in-progress, CR-046 rescope summary).
- [[cr-046-introduction-editor-surface-in-self-study]] — full rewrite to the discoverability fix; revision_history third entry.
- [[cr-018-ai-evidence-review-via-cshse-ai]] — status shipped → in-progress; status note; revision_history added.
- CR-024 / CR-033 / CR-037 / CR-040 / CR-041 / CR-042 — dated reconciliation notes added.

Net effect: the catalog now tells the truth. Genuinely-not-fully-delivered after this pass: **CR-018** (ai-service built, Reader caller pending) + the 18 not-started CRs (16 proposed + CR-045/046 accepted).

## [2026-05-27] update | CR-045 + CR-046 shipped

Both implemented, tested, and verified against deployed cshse-develop.

### CR-045 — Self-Study Editor toolbar workflow alignment (shipped)

Server (commit 320236c):
- `User.preferences.hideLegacyImporter` (default-true at read time) + `PATCH /api/auth/me/preferences` (boolean-validated, 401 unauth, ignores unknown keys) + `/me` returns the defaulted block. Seed router accepts `user.preferences` override.

Client:
- authStore `updatePreferences()` (optimistic + server-echo + rollback).
- Cogwheel "Hide legacy importer" checkbox (PC-only) in `Layout.tsx`.
- Toolbar regrouped IMPORT / DRAFTS / SELF-STUDY (plain-English group labels, pipeline order). "Importer Wizard" → "Upload Files" (AI badge only when legacy also shown). Legacy "Import Document" gated behind `!hideLegacyImporter`.
- New `PhaseIndicator.tsx` strip above the toolbar — the wizard's progress bar: `1. Import → 2. Drafts (N) → 3. Self-Study (X/Y) → 4. Submit`, click-to-jump, active phase derived from `activeView`. Submit chip focuses the standalone teal CTA (`data-testid=submit-self-study-cta`).

### CR-046 — Introduction editor discoverability (shipped)

Verified the editor + `PATCH /introduction` endpoint already existed (CR-039 Phase 2c) — rescoped to a discoverability fix. Added `Introduction` button first in the SELF-STUDY group + `activeView='introduction'` branch reusing the existing `IntroductionEditor` (document scope). No new component, no new endpoint.

### Tests
- server vitest: auth-routes 19 (6 new) + redetect 13 + unit = 89 passed.
- client vitest: 179 passed (9 PhaseIndicator + 3 authStore new).
- E2E against cshse-develop: 22/22 — `33_legacy_importer_preference` (2), `34_introduction_round_trip` (2, fixed to wait on PATCH response not the transient Saved badge), `30_both_importers` (5, seeded hideLegacyImporter:false + renamed Upload Files), plus 13 review/lifecycle regression specs (26 + 27) confirming the regroup didn't break Review/Matrix flows.

Deploy note: server (Node) deploys ~2min faster than the client (Vite static build). The 401-on-PATCH signal confirms server-live; polling the served JS bundle for the "Upload Files" string confirms client-live. Ran E2E only after both.

Commits: 320236c (impl) + e52c90c (E2E network-wait fix). Both CRs flipped proposed/accepted → **shipped** in index + CR files.

Remaining not-fully-delivered after this: CR-018 (ai-service built, Reader caller pending) + the not-started Sprint 2A-8 reader/accreditation CRs.

## [2026-05-27] ingest | CR-047 — PC dashboard workflow alignment (proposed)

User direction (annotated /dashboard screenshot):

> "The PC Dashboard needs to be reorganized to follow the workflow that is occurring. This should include the file that was imported, the numbers of items in draft numbers of CVs, Sylibi, Projects and Plans, and number of items in each spec in review, and the numbers of items in the self study."

Audited `Dashboard.tsx` (PC branch lines 442-735). Today it shows four accreditation-admin cards (Items In Spec Completed, Pending Requests, Deadline, Site Visit) + admin-uploaded spec docs — NOT the PC's authoring pipeline, and NOT the file the PC imported (the "Files" section is `category: dashboard_document` filtered by specId, not `SelfStudyImport.originalFilename`).

CR-047 rebuilds the PC branch as a four-section workflow pipeline matching CR-045's vocabulary: IMPORT (the imported file + parse status) → DRAFTS (count tiles for CVs / Syllabi / Projects / Introductions / per-spec review items, deep-linking into Review) → SELF-STUDY (validated specs + narratives/matrix/evidence committed) → SUBMIT (deadline + readiness CTA). Admin panels (change requests, site visits) demoted below.

All counts derive from already-persisted data (`Submission.aiReviewState` + `standardsStatus` + import records) — no schema change. The only new server work is a `GET /:id/workflow-summary` rollup so the landing page doesn't ship the full aiReviewState. Effort ~2h40m.

Created:
- [[cr-047-pc-dashboard-workflow-alignment]]

Updated:
- [[change-requests/index]] — CR-047 row (P1).

Status: **proposed**. Four open questions for sign-off — most important: **what is a "Plan"?** (CVs/Syllabi/Projects map to existing detector kinds; "Plans" is not a current category — recommendation: treat as the Introductions bucket, label "Introductions / Plans", confirm or correct).

## [2026-05-28] update | CR-047 shipped — PC dashboard workflow alignment

Built + shipped [[cr-047-pc-dashboard-workflow-alignment]] to `cshse-develop`.

Open questions resolved at acceptance: **"Plans" == Projects** (docSubKind `paper`, no new evidence type); per-spec breakdown lists only specs with >0 review items; DRAFTS tiles deep-link into the Review surface pre-selected to the matching kind; PC-relevant admin panels (Change Requests + Site Visits) demoted + collapsed-if-empty, non-PC content stays hidden.

Delivered (commits `df24cb6` feat + `d49cd5d` e2e hardening):
- **Server** — `GET /api/submissions/:id/workflow-summary` rollup (`server/src/controllers/submissionController.ts:362`, route at `server/src/routes/submissions.ts:67`). Pure read off `aiReviewState` + `standardsStatus` + import records + `CurriculumMatrix` / `SupportingEvidence` counts. Owner-PC / admin auth, 403 cross-institution, no schema change.
- **Client** — new `WorkflowSummary.tsx` (4 sections IMPORT/DRAFTS/SELF-STUDY/SUBMIT); `Dashboard.tsx` PC-branch rewired; deep-links via new `?view=review&specKey=` / `?view=import` mount-effect on `SelfStudyEditor.tsx`.
- **Tests** — 6 server integration + 12 client unit + 2 e2e (`35_pc_dashboard_workflow.spec.ts`), all green on cshse-develop; editor/Review regression smoke (33 + 13) green.

Updated:
- [[change-requests/index]] — CR-047 row → **shipped**.

Status: **shipped**. Closes the CR-045 / CR-046 / CR-047 workflow-alignment trio.

## [2026-05-28] update | Editor workflow-sequencing fixes (Upload Files reset + open-on-Review)

Two PC-reported sequencing bugs on the Self-Study editor, fixed in `client/src/features/selfStudy/Editor/SelfStudyEditor.tsx` (commits `0b6c368` + e2e `b21c384`), verified on cshse-develop.

1. **Upload Files jumped to the stale Parse screen.** Sitting on the Review surface and clicking "Upload Files" re-showed the *previous* run's "Parsing complete" pipeline instead of a fresh Upload step — the PC couldn't start a second import without a hard refresh. `AIImportTabButton` now calls `startOver()` whenever the prior run has **settled** (parsed / applied / finished / failed / canceled), not only when it reached Apply; it skips the reset only while a run is in flight (queued / parsing). The old "protect the wizard's internal review step" guard is obsolete — CR-043 moved Review to a standalone surface (its own toolbar button, backed by persisted `aiReviewState`), and `startOver()` keeps `submissionId` so the Review surface re-hydrates from the server.

2. **Editor opened on Standards even with drafts waiting.** The editor hard-coded the initial view to Standards (workflow phase 3). It now opens on the **Review** surface (phase 2 DRAFTS) when the AI-import store (hydrated synchronously from localStorage) shows pending drafts for this submission and the import has **not** been applied/finished yet — so the PC follows IMPORT → DRAFTS → SELF-STUDY → SUBMIT order. A CR-047 deep-link (`?view=...`) still takes precedence. Extracted `computeDraftsCount()` so the DRAFTS badge and the initial-view decision share one definition.

Tests: `e2e/tests/36_workflow_sequencing.spec.ts` (new, 2 tests) + fixed a pre-existing `/^Upload$/i` → `/Upload/` mismatch in `30_both_importers` (the Stepper labels the tab "1 Upload"). 12/12 green on cshse-develop (36 + 30 + 33 + 04); full client unit suite 191/191.

Note for follow-up: the open-on-Review signal is *parsed-but-not-applied* drafts (Apply doesn't clear the in-memory buckets, so a plain "drafts > 0" would force Review forever). Loosen if the PC wants Review on every entry regardless of apply state.

## [2026-05-29] update | CR-048 shipped — "Finish review" bookkeeping + un-triaged draft counts

Built + shipped [[cr-048-finish-review-bookkeeping]] (commit `6ace428`), verified on cshse-develop. Supersedes the 2026-05-28 follow-up note above: the open-on-Review signal is now **un-triaged** drafts (total − approved − discarded), not "parsed-but-not-applied."

User gap (2026-05-28): drafts only had two implicit end states (approved→applied / discarded); no "I've reviewed enough — the rest aren't included" action, so the count never reached zero and the editor kept auto-opening Review. Two decisions (2026-05-29): **Finish = discard the remainder**; **counts = un-triaged only**.

Delivered:
- **Server** — `POST /api/submissions/:id/review/finish` (`aiReviewController.finishReview`) discards every un-triaged sectionId (idempotent, owner-PC/admin). `getWorkflowSummary` draft counts now exclude approvedIds + discardedIds.
- **Client** — `aiImportStore` tracks `discardedIds` (hydrate + partialize + kept in sync on approve/discard) + `finishReviewOnServer()`; `ReviewSurface` gets a "✓ Finish review — exclude remaining (N)" CTA (→ "Review complete" at 0); `SelfStudyEditor.computeDraftsCount` counts un-triaged, driving the DRAFTS badge + open-on-Review.
- **Tests** — finishReview integration (discard / idempotent / 401) + workflow-summary unresolved-count test + e2e 36 finish-review flow. Server 45/45 in the two touched suites; client 191/191; e2e green on cshse-develop.

Updated:
- [[change-requests/index]] — CR-048 row → **shipped**.

Status: **shipped**.

## [2026-05-29] audit | Code-vs-vault reconciliation + re-baselined sprint plan

Ran a reconciliation of the CR tracker + sprint plan against the actual `developer` codebase (@ `f9e6706`). Findings drove a new plan: [[sprint-plan-2026-05-29]] (supersedes [[sprint-plan-2026-05-20]]).

**Key finding:** the product is two halves.
- **PC/authoring half** — shipped & polished (24 CRs: the AI import wizard, persisted Review surface, workflow dashboard, editor, finish-review).
- **Reader/review/board half** — **server-scaffolded, client-absent.** The server has models + controllers for reviews, 0-3 scores (`server/src/models/Score.ts:10`), lead-reader compilations (`models/LeadReaderCompilation.ts`), PC lockout (`middleware/submissionLockout.ts`), two-stage submission (`submissionController.ts` submit/revert/markComplete/submitSelfStudy + 8-state machine `Submission.ts:272`), audit log (`services/auditLog.ts:20`), assignments, and site visits — but the **client has no reader/lead-reader UI** (`client/src/App.tsx:78-81` routes only dashboard/self-study/admin; `client/src/features/` = admin, changeRequests, comments, dashboard, selfStudy, siteVisits). A reader cannot score a spec today.

**Tracker corrected:** flipped CR-003/005/006/007/009/012/013/020/022 `proposed → in-progress` (server code exists — see the plan's reconciliation table for `path:line` evidence) in both the CR frontmatter and [[change-requests/index]]. The genuinely-greenfield CR-004/008/010/011/016/021/023 stay `proposed`; CR-018 stays `in-progress` (blocked on the reader client). Held off marking CR-005/006 `shipped` pending the Sprint R verification pass (accuracy over inference).

The new plan adds a **Logical starting point** section: (1) prove the lockout/submission stack (½ day) → promote CR-005/006 to shipped if green, (2) smoke the reader server endpoints (½ day), (3) begin the reader client (Sprint 3) — the highest-leverage first build that unblocks CR-018's finish, the compilation tab, and board decisions.

Updated: [[sprint-plan-2026-05-20]] → `status: superseded` + banner; [[index]] plans section → 05-29 marked CURRENT.

## [2026-05-29] update | CR-049 — AI section evaluation (replaces n8n); plan gains Sprint 2.5

User reviewing the new plan flagged a missing capability: the **final AI review** of a self-study section — narrative + supporting-evidence list + submitted files + scraped web links → **pass / needs-improvement / fail + rationale**, judged against the reader-review criteria, to give the PC improvement feedback now and seed the reader report on submission. Not in any sprint.

Reconciliation confirmed three things: (1) the feature is genuinely absent; (2) the existing per-section validate call is **broken** — `submissionController.ts:550,758` call `ValidationService.validateSection`, which doesn't exist on the class (`validationService.ts` has `triggerValidation:47`, `validateStandard:592`); (3) the real validation path is an **n8n webhook** (`triggerValidation` → `/api/webhooks/n8n/callback`), pass/fail only.

Created [[cr-049-ai-section-evaluation-against-reader-criteria]] (P1, proposed): new cshse-ai `POST /ai/section/evaluate` reusing the CR-018 evidence blocks + a web-link scraper; server wiring replaces the broken call; `ValidationResult` gains `needs_improvement` + rationale; n8n validation webhook retired. Added **Sprint 2.5** to [[sprint-plan-2026-05-29]] (between submission-lockout completion and the reader client — it fixes a submit-path bug R.1 will hit and pre-populates the reader report). Horizon ~12 → ~13.5 weeks. Added CR-049 row to [[change-requests/index]].
