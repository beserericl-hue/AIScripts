---
name: System Architecture
description: How the CSHSE portal's client, server, storage backends, n8n workflows, and deploy target fit together.
type: concept
tags: [architecture, backend, frontend, deployment]
last_reviewed: 2026-05-10
---

# System Architecture

## Tier diagram

```
React/Vite client  ─REST→  Express server  ─→  MongoDB Atlas
   (TipTap editor)         (Node 20)         + GridFS (htmlContent, images)
                              │
                              ├──→  AWS S3  (evidence files)
                              ├──→  n8n     (5 workflows, AI processing)
                              └──→  SMTP    (Nodemailer; mostly stubbed)

         n8n  ─→  Supabase pgvector  (help-chat RAG embeddings)
         n8n  ─→  OpenAI (gpt-4o-mini, text-embedding-ada-002 / -3-small)
```

Single Railway container serves both API and the built React assets from `/public`. Healthcheck: `GET /health` (always 200). Restart-on-failure up to 10 times.

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
- **Roles:** `program-coordinator`, `reader`, `lead-reader`, `admin`. Plus a `superuser` flag.
- **Impersonation:** Superusers send `X-Impersonated-Role` header to act as another role ([server/src/middleware/auth.ts:59-63](../../../../server/src/middleware/auth.ts)). Persisted in client `authStore` so impersonation survives refresh. No audit trail of who impersonated whom and when — see [[security-audit-2026-05-10]].

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
- [[import-pipeline]] — the most complex flow in the system
- [[n8n-integration]] — outbound triggers and inbound callbacks
- [[frontend-architecture]] — client structure and bundles
