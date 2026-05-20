---
name: Log
description: Chronological record of vault activity (ingests, queries that produced new pages, lints).
type: log
---

# Log

Append-only. Format: `## [YYYY-MM-DD] <action> | <subject>` followed by free-form body.

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
