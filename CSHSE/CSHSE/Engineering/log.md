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
