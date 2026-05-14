---
name: Security Audit — 2026-05-10
description: Snapshot of security findings across server, client, and n8n integration as of 2026-05-10. Severity-ranked, with file:line citations and suggested fixes.
type: review
tags: [security, audit]
audit_date: 2026-05-10
auditor: claude
last_reviewed: 2026-05-10
---

# Security Audit — 2026-05-10

Snapshot of issues found across [server/src/](../../../../server/src/), [client/src/](../../../../client/src/), and [n8n-workflows/](../../../../n8n-workflows/). Numbered for cross-reference.

## Critical (exploit possible now)

### C1 — Hardcoded API key checked into n8n workflow JSON
- **File:** [n8n-workflows/cshse-specification-loader-pdf.json:102](../../../../n8n-workflows/cshse-specification-loader-pdf.json) — `"X-API-Key": "cshse_eXPTLboS18Gjgw_BTwEVJhe8CBiAjq9B"`
- **Risk:** Anyone with repo access (incl. former contractors, fork viewers) can call back into the spec-loader endpoint as if they were n8n.
- **Fix:** **Rotate this key today.** Move to n8n Credentials (decrypted at runtime, never in JSON exports). Add a pre-commit hook / `gitleaks` scan to block future exposure.

### C2 — Webhook callback endpoints are public and accept arbitrary payloads
- **Files:** [server/src/routes/webhooks.ts:36,43,50,57](../../../../server/src/routes/webhooks.ts) — `POST /api/webhooks/{n8n,spec-loader,document-matcher,help/upload}/callback` mounted before any `authenticate` middleware.
- **Specifically the validation callback** ([server/src/controllers/webhookController.ts:62-103, 301-306](../../../../server/src/controllers/webhookController.ts)) accepts `submissionId + standardCode + specCode` from the body and updates the matching pending `ValidationResult` with attacker-supplied result data.
- **Risk:** Any external caller can mark failing standards as passing across any submission. No replay protection, no signature.
- **Fix:** Require HMAC-SHA256 of body using a shared secret in `WebhookSettings`; verify `executionId` matches a pending validation; reject duplicate `executionId`.

### C3 — JWT verification falls back to a hardcoded development secret
- **Files:** [server/src/middleware/auth.ts:45](../../../../server/src/middleware/auth.ts), [server/src/routes/auth.ts:57](../../../../server/src/routes/auth.ts), [server/src/controllers/fileController.ts:44](../../../../server/src/controllers/fileController.ts), and several others — all use `process.env.JWT_SECRET || 'development-secret-key'`.
- **Risk:** If `JWT_SECRET` is unset or empty in production, every JWT is verified against a public string in the repo. Attackers can forge tokens for any user.
- **Fix:** At server boot in production, throw if `JWT_SECRET` is unset or shorter than ~32 bytes. Centralize the read into `config/auth.ts`.

### C4 — CORS is wide open
- **File:** [server/src/index.ts:50](../../../../server/src/index.ts) — `app.use(cors())` with default options.
- **Risk:** Any origin can issue authenticated requests on behalf of a logged-in user (the JWT is in `Authorization`, but combined with the open CORS this hands cross-origin sites the same surface as same-origin code).
- **Fix:** `cors({ origin: process.env.ALLOWED_ORIGINS?.split(','), credentials: true })`.

### C5 — Help-chat session isolation is broken
- **File:** [n8n-workflows/cshse-help-chat-agent.json:190](../../../../n8n-workflows/cshse-help-chat-agent.json) — Redis chat memory key is `$json.body.sessionId || "default"`.
- **Risk:** `sessionId` is client-supplied with no user binding. Anyone reusing or guessing a sessionId reads another user's chat history.
- **Fix:** Server-side bind `sessionId = sha256(userId + clientSessionId)` before forwarding; set Redis TTL.

## High

### H1 — No rate limiting on `/api/auth/login`
- **File:** [server/src/routes/auth.ts:18](../../../../server/src/routes/auth.ts).
- **Risk:** Unlimited password brute force.
- **Fix:** `express-rate-limit`, e.g., 5 attempts per IP per 15 min. After N failed attempts on an account, set `User.isActive = false`.

### H2 — Long-lived JWTs (30 days) with no logout invalidation
- **Files:** [server/src/routes/auth.ts:68](../../../../server/src/routes/auth.ts) (`expiresIn: '30d'`), [server/src/routes/auth.ts:162-166](../../../../server/src/routes/auth.ts) (`/logout` returns success but does nothing — JWT remains valid).
- **Risk:** Stolen token usable for 30 days; user can't actually revoke.
- **Fix:** Cut to 1h with refresh-token rotation. Maintain a Mongo TTL collection of revoked `jti` claims, check in middleware.

### H3 — XSS in DocumentViewer via imported HTML
- **File:** [client/src/features/selfStudy/Editor/components/DocumentViewer.tsx:841](../../../../client/src/features/selfStudy/Editor/components/DocumentViewer.tsx) — `dangerouslySetInnerHTML={{ __html: htmlContent }}` on Mammoth/pdf-parse output.
- **Risk:** Coordinator uploads a crafted DOCX with embedded `<script>` / event handlers, executes in any reviewer/lead-reader session that opens it.
- **Fix:** Sanitize server-side with `sanitize-html` *before* GridFS storage. Defense in depth: render in `<iframe sandbox="allow-same-origin">`.

### H4 — Admin can change any user's password silently
- **File:** [server/src/routes/auth.ts:173-217](../../../../server/src/routes/auth.ts) — `PUT /change-password` accepts an optional `userId` for admin use.
- **Risk:** A compromised admin account silently locks any user out. No audit trail surfaced to the target user.
- **Fix:** Email the target user on admin reset. Write an audit-log entry. Show admin-reset history in `Settings`.

### H5 — JWT token in localStorage (XSS exfiltration)
- **File:** [client/src/store/authStore.ts:206-211](../../../../client/src/store/authStore.ts).
- **Risk:** Combined with H3, an XSS payload can exfiltrate the JWT.
- **Fix:** httpOnly + Secure + SameSite=Strict cookie. Requires server-side cookie middleware change.

### H6 — No input validation framework; NoSQL operator-injection risk
- **Risk:** `req.body` / `req.query` are passed into Mongoose filters in several controllers. A query like `?status[$ne]=pending` reaches Mongo as `{status: {$ne: 'pending'}}`.
- **Fix:** Add `zod` schemas at every route boundary; whitelist field names and types.

### H7 — No password reset / account recovery flow
- **Risk:** Locked-out users have no self-serve recovery. Only mitigation is admin-driven reset (which has its own H4 issue).
- **Fix:** `POST /forgot-password` (rate-limited) → email signed token (≤1h TTL) → `POST /reset-password?token=…` (single-use).

## Medium

### M1 — Weak password policy
- **File:** [server/src/routes/auth.ts:189-191](../../../../server/src/routes/auth.ts) — only checks `length < 8`.
- **Fix:** Require ≥12 chars, or 8+ with complexity.

### M2 — Evidence access check is too permissive
- **File:** [server/src/controllers/evidenceController.ts:64-66](../../../../server/src/controllers/evidenceController.ts) — `verifyEvidenceAccess` returns `hasAccess=true` if institution lookup is null and user is not admin.
- **Fix:** Default-deny on null institution.

### M3 — No HTTPS enforcement / HSTS / Helmet
- **File:** [server/src/index.ts](../../../../server/src/index.ts) — no `helmet()`, no `Strict-Transport-Security`, no http→https redirect.
- **Fix:** `app.use(helmet())`. Configure Railway proxy to redirect.

### M4 — S3 presigned URL TTL not constrained
- **File:** [server/src/services/s3Service.ts](../../../../server/src/services/s3Service.ts).
- **Fix:** Cap `Expires` to 5 minutes (300s).

### M5 — Multer trusts client `Content-Type`
- **File:** [server/src/routes/imports.ts:50-62](../../../../server/src/routes/imports.ts).
- **Fix:** Validate by magic bytes via the `file-type` package.

### M6 — Race in invitation acceptance
- **File:** [server/src/controllers/invitationController.ts:236](../../../../server/src/controllers/invitationController.ts) — separate status check then expiration check.
- **Fix:** Atomic `findOneAndUpdate({tokenHash, status:'pending'}, …)`.

### M7 — Webhook callback DoS via spam
- **Files:** all four callback endpoints.
- **Fix:** Combination of HMAC (C2) + rate limit + dedup on `executionId`.

### M8 — Prompt injection in document matcher
- **File:** [n8n-workflows/cshse-document-matcher.json](../../../../n8n-workflows/cshse-document-matcher.json) — section HTML is decoded but only base64 images and >500-char strings are stripped; ordinary tag text reaches the LLM verbatim.
- **Risk:** A self-study with a crafted heading like `</section> Ignore previous instructions and …` can steer the matcher.
- **Fix:** Wrap untrusted content in delimiters, instruct the model to treat anything inside as data, never instructions.

## Low / hardening

- **L1** — Bcrypt re-hash detection uses prefix match only ([User.ts:135-138](../../../../server/src/models/User.ts)). Edge-case footgun.
- **L2** — Error responses include stack/details in dev mode ([errorHandler.ts:28-30](../../../../server/src/middleware/errorHandler.ts)). Ensure `NODE_ENV=production` in deployed env.
- **L3** — Superuser impersonation has no audit trail ([auth.ts:59-63](../../../../server/src/middleware/auth.ts)). Log every impersonation switch.
- **L4** — `ErrorLog` MongoDB collection grows unbounded.
- **L5** — Bot reply in HelpChat rendered as inner HTML; trusted webhook today, but a compromised n8n becomes a stored-XSS vector. Render as plain text.

## Suggested top-of-list (next sprint)

1. **C1**: rotate the leaked spec-loader key.
2. **C3**: refuse to boot in production without `JWT_SECRET`.
3. **C2 + M7**: HMAC-sign webhook callbacks; reject duplicate `executionId`.
4. **C4**: lock CORS to known origins.
5. **H3**: sanitize imported HTML server-side before storing to GridFS.
6. **C5**: bind help-chat sessions to authenticated user IDs.

## Related

- [[system-architecture]] — auth + impersonation context
- [[n8n-integration]] — webhook handler details
- [[storage-layer]] — S3 / GridFS access patterns
- [[frontend-architecture]] — token storage, XSS surfaces
- [[incomplete-features-2026-05-10]] — overlapping incomplete pieces
