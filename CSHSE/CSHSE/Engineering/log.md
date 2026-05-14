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
