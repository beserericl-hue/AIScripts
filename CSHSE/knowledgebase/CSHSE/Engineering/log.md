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
