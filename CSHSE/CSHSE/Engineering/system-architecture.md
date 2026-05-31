---
name: System Architecture
description: How the CSHSE portal's client, server, cshse-ai service, storage backends, and deploy target fit together.
type: concept
tags: [architecture, backend, frontend, deployment, ai-service]
last_reviewed: 2026-05-31
---

# System Architecture

> **2026-05-31 refresh.** This page now reflects the post-Sprint-9 architecture. The biggest shifts since the 2026-05-10 baseline: a **second deployable** (`cshse-ai`, a Python/FastAPI microservice) now owns all AI import + evaluation work; **n8n is demoted to a legacy help-chat-only path**; an **SSO** (MemberClick) browser ticket flow and an in-app **notification** subsystem were added; and the role identifiers are underscored (`program_coordinator`, `lead_reader`), not hyphenated. See [[module-catalog]] for the full module inventory and [[sprint-plan-2026-05-31]] for what remains.

## Tier diagram

```
React/Vite client  ─REST→  Express server (Node 20)  ─→  MongoDB Atlas
   (TipTap editor)              │                        + GridFS (htmlContent, images)
                                │
                                ├─HMAC→ cshse-ai (FastAPI, Python)  ─→ Qdrant (vector DB)
                                │        AI import wizard +              ─→ Anthropic Claude Haiku
                                │        section evaluation              ─→ OpenAI embeddings
                                ├──→  AWS S3 / Tigris  (evidence files; `dev/` prefix on develop)
                                ├──→  MemberClick SSO  (browser ticket exchange, /sso/v1/*)
                                ├──→  SMTP  (Nodemailer; most call sites still stubbed)
                                └──→  n8n  (LEGACY — help-chat RAG only; import/validation retired)
```

Two Railway services in the `bubbly-solace` project: the **Node server** (serves the API + built React assets from `/public`) and the **`cshse-ai` FastAPI service**. They share a Qdrant vector DB and authenticate to each other with **HMAC-SHA256** (`server/src/services/cshseAiClient.ts`, `ai-service/app/auth.py`). Two environments (production/`main`, develop/`developer`) with isolated MongoDBs and a shared Tigris S3 bucket — see [[railway-deployment-topology]]. Healthcheck: `GET /health` (always 200). Restart-on-failure up to 10 times.

## Layering on the server

```
routes/         thin Express router; mounts middleware + maps to controllers
  ↓
controllers/    request/response handling, auth checks, calls services
  ↓
services/       business logic, calls models + external APIs (S3, n8n, mail)
  ↓
models/         Mongoose schemas
```

This separation is mostly clean. **Smell:** controllers (especially [server/src/controllers/evidenceController.ts](../../../../server/src/controllers/evidenceController.ts)) know about all three storage backends rather than going through a `StorageAdapter`.

## Auth model

- **JWT** in `Authorization: Bearer …` (default 30d expiry — too long, see [[security-audit-2026-05-10]]).
- **bcrypt** password hashes with `$2b$` / `$2a$` prefix detection in `pre('save')` ([server/src/models/User.ts:135-138](../../../../server/src/models/User.ts)).
- **Roles (underscored):** `program_coordinator`, `reader`, `lead_reader`, `admin`. Plus a `superuser` flag. (The 2026-05-10 doc showed hyphenated names — the code uses underscores; see `server/src/models/APIKey.ts:17`.)
- **Impersonation:** Superusers send `X-Impersonated-Role` header to act as another role ([server/src/middleware/auth.ts:59-63](../../../../server/src/middleware/auth.ts)). Persisted in client `authStore` so impersonation survives refresh. No audit trail of who impersonated whom and when — see [[security-audit-2026-05-10]].
- **Service-to-service:** the Node server ↔ `cshse-ai` link is **HMAC-SHA256**, not JWT (`server/src/services/cshseAiClient.ts`, verified in `ai-service/app/auth.py`). The four legacy n8n callback endpoints use API keys (`server/src/middleware/apiKeyRateLimit.ts` rate-limits them).
- **SSO:** a MemberClick browser ticket flow is mounted at `/sso/v1/*` (`server/src/routes/ssoBrowser.ts`, controllers `ssoController.ts` + `ssoTicketController.ts`) for cshse.org member single sign-on.
- **Submission lockout:** `server/src/middleware/submissionLockout.ts` returns `403 LOCKED` for a PC writing to a submitted/locked submission (CR-005). **Known gap:** evidence-mutation routes are not yet behind it — see [[cr-005-pc-lockout-on-final-submit]] and [[sprint-plan-2026-05-31]] §2 BUG-B.

## Subsystems added Sprints 4–9

The 2026-05-10 baseline predates most of the review/decision/notification machinery. Added since:

- **AI import + evaluation (`cshse-ai`).** FastAPI service: format auto-detection, section splitting, embedding, Claude-Haiku Standard/Spec tagging, matrix extraction, coverage verification, appendix gap-fill, evidence extract/recommend/score, and per-section 0–3 evaluation. Job-based (`POST /ai/import/start` → `GET /ai/import/{job_id}`). Node side: `aiImportController`, `aiReviewController`, `importBatchController`, `cshseAiClient`, `batchAdvancer`. See [[legacy-self-study-import]], [[import-wizard-ui-spec-2026-05-18]].
- **Reader review + lead compilation.** Per-Spec reader assessments now carry a **0–3 rubric score** (`reviewController`, client `reader/Score4LevelSelector`, `ReaderOverrideControl`); the lead reader stamps a **final 0–3** per spec (`compilationController`, `LeadFinalScore` model, `compilation/CompilationTab`).
- **Board decisions.** `boardDecisionController` + `BoardConsole` client record accept/table/deny/suspend/revoke with reconsider dates (CR-053).
- **Site visit.** Checklist (`checklistController`, `SiteVisitChecklistItem`, `siteVisitChecklistDocx`) + itinerary (`itineraryController`) with co-edit + DOCX export (CR-012/013).
- **Notifications.** In-app `Notification` model with a `dedupeKey` idempotency guard; `notificationService` fans out DM + board-cycle reminders (CR-010/053). Cron-driven reminders.
- **Direct messages & relay.** Reader↔admin DMs (`directMessageController`, `DirectMessage`); admin "Julia-as-relay" console (`commentController` relay endpoints, `admin/RelayConsole` — built but not yet mounted, see [[cr-023-julia-relay-workflow]]).
- **Joint ventures.** Multi-institution grouping (`jointVentureController`, `JointVenture` model, `admin/JointVentureManagement`) — CR-019.
- **Audit trail.** Append-only `AuditLogEntry` (pre-save/update/delete hooks throw) surfaced through `auditTrailController` + `admin/AuditTrail`. Action union spans submit/lock/relay/compilation/checklist/itinerary/board/jv/account events.
- **Bug reports & document versioning.** `bugReportController`/`BugReport`; `documentVersionService`/`DocumentVersion`.
- **Onboarding.** `tour/` feature + per-feature hints (CR-052).

## Build & deploy

- **Server build:** esbuild transpile-only (no bundling, packages external) via `server/build.js`. Outputs `dist/*.js`. Fast but no tree-shaking.
- **Client build:** `tsc && vite build`. No code-splitting; one big chunk (~500–700KB gzipped, dominated by TipTap + Radix).
- **Container:** multi-stage Dockerfile, `dumb-init` PID 1, runs as non-root `nodejs` user, max heap 8192MB.
- **Deploy:** Railway, single replica. Migrations run on every boot via `runMigrations()` in [server/src/index.ts:187](../../../../server/src/index.ts). **No leader election** — if Railway scales to >1 replica, two pods will run migrations simultaneously.

## Observability

- `console.log` everywhere with `[GridFSService]` / `[Evidence]` / `[ValidationService]` prefixes.
- `logError()` writes `ErrorLog` documents to MongoDB — useful but **the collection grows unbounded** (no TTL or rotation).
- No structured logs (JSON), no request IDs, no APM.

## Configuration

- All config via env vars loaded by `dotenv` at boot.
- **Not validated at startup.** Missing `JWT_SECRET` falls back to `'development-secret-key'` everywhere it's read (multiple sites — see [[security-audit-2026-05-10]]).
- S3 credentials read lazily on first call; missing creds throw at first upload, not at boot.

## Related

- [[storage-layer]] — the three storage backends in detail
- [[import-pipeline]] — the legacy manual-tagging flow
- [[legacy-self-study-import]] — the AI import redesign now served by `cshse-ai`
- [[module-catalog]] — full module inventory (current as of 2026-05-31)
- [[railway-deployment-topology]] — the two-env, two-service Railway layout
- [[n8n-integration]] — **legacy** help-chat path (import/validation retired)
- [[frontend-architecture]] — client structure and bundles
- [[sprint-plan-2026-05-31]] — what remains to finish the portal
