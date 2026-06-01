---
name: CR-058 — Impersonation audit logging
description: Record an append-only audit entry whenever a superuser starts/stops impersonating a role or specific user, and auto-flag every governance action taken while impersonating with the true actor. Surfaces in the admin Audit Trail. Closes the "no record of who acted behind an impersonation" gap found while verifying impersonation-log functionality.
type: change-request
cr_id: CR-058
status: shipped
priority: P1
source: [[security-audit-2026-05-10]], [[log]]
sprint_target: Post-V1 / dedicated CR (superuser accountability — surfaced during beta-walkthrough prep)
tags: [security, audit, impersonation, superuser, accountability]
last_reviewed: 2026-06-01
revision_history:
  - 2026-06-01 — proposed + shipped (branch `developer`). Discovered while verifying "impersonation log functionality" on the live develop env: there was NO impersonation logging at all. Server impersonation was role-override-only via the `X-Impersonated-Role` header; the impersonated *user* identity never reached the server; zero audit entries carried an impersonation action or flag. Built the full path (A–D below) + 9 server + 2 client tests.
---

# CR-058 — Impersonation audit logging

## Summary

A superuser (e.g. `eric@agileadtesting.com`) can impersonate any role or specific
user. Before this CR **nothing was recorded** when they did so, and any
governance action they took while impersonating was attributed solely to the
*impersonated* identity — there was no way to tell, from the audit trail, that
the real actor was a superuser wearing someone else's hat.

Concretely, the pre-CR state was:
- `authenticate` only honored the `X-Impersonated-Role` header to override the
  *effective role* (`server/src/middleware/auth.ts`). The impersonated **user**
  identity was never sent to the server.
- `AuditLogEntry` had no impersonation action and no impersonation field.
- The client side was purely local Zustand state + a visual banner; nothing was
  persisted.

This CR makes impersonation a first-class, auditable event.

## Decision

Four coupled pieces:

**A — Capture the true actor + impersonated identity server-side.**
- Client `api.ts` now also forwards `X-Impersonated-User-Id` and
  (URI-encoded) `X-Impersonated-User-Name` when a *specific* user is being
  impersonated (alongside the existing `X-Impersonated-Role`).
- `authenticate` builds an `ImpersonationContext { actualUserId, actualName,
  actualRole, impersonatedRole?, impersonatedUserId?, impersonatedUserName? }`
  when a superuser request carries impersonation headers, stashes it on
  `req.user.impersonation`, and binds it for the request's async lifetime via a
  new `AsyncLocalStorage` module (`server/src/middleware/requestContext.ts`).

**B — Auto-flag every action taken while impersonating.**
- `recordAuditEvent` reads the request-scoped `ImpersonationContext` and writes
  it into the new optional `impersonation` sub-document on `AuditLogEntry`.
  Because it reads from `AsyncLocalStorage`, **none of the ~9 existing audit
  callers had to change** — any governance action (lock, score, board decision,
  comment relay, …) performed during an impersonated request is flagged
  automatically with who really did it. The parent entry's
  `actorId`/`actorRole`/`actorName` still reflect the *effective* (impersonated)
  identity so existing dashboards read unchanged; the truth lives in the
  `impersonation` block.

**C — Dedicated start/stop events.**
- New `auth.impersonation_start` / `auth.impersonation_stop` `AuditAction`s.
- New superuser-only endpoints `POST /api/auth/impersonation/{start,stop}` (in
  the public auth router, inline `jwt.verify` like its siblings) write the
  append-only audit entry naming the true SU actor + the impersonated identity.
  On `start` an identity (role or user) is required (400 otherwise); a
  non-superuser is rejected (403); the impersonated user's name is resolved
  server-side from the id when not supplied.
- Client `startImpersonation` / `stopImpersonation` fire these fire-and-forget
  (a logging hiccup must never block the SU from assuming/leaving an identity).

**D — Surface in the admin Audit Trail.**
- The read endpoint already returns the full lean document, so the
  `impersonation` block flows through untouched.
- The admin AuditTrail table renders an amber "impersonated by <SU> as <role/
  user>" badge on any flagged row; the CSV export gains `impersonatedBy` +
  `impersonatedAs` columns.

## Acceptance

- [x] `POST /api/auth/impersonation/start` writes an `auth.impersonation_start`
  entry whose `impersonation.actualUserId` is the true superuser and whose
  `impersonatedRole` / `impersonatedUserId` / resolved `impersonatedUserName`
  name the assumed identity. `stop` writes `auth.impersonation_stop`.
- [x] A non-superuser calling either endpoint gets 403; an unauthenticated call
  gets 401; a `start` with neither role nor user gets 400.
- [x] An audit event recorded *inside* an impersonation context (via the
  `AsyncLocalStorage` binding) carries the `impersonation` block with the true
  actor, while its top-level `actorRole` stays the effective/impersonated role.
  An event recorded outside any impersonation context has **no** flag.
- [x] The admin Audit Trail UI renders the impersonation badge naming the true
  actor; ordinary entries render no badge. CSV export carries `impersonatedBy` /
  `impersonatedAs`.
- [x] Pinned by `server/tests/integration/cr058-impersonation-audit.test.ts`
  (9 tests), the updated `audit-trail.test.ts` CSV-header assertion, and
  `client/.../AuditTrail.test.tsx` (+2 tests) + `authStore.test.ts` (mock
  widened for the new fire-and-forget POST).

## Files affected

- `server/src/middleware/requestContext.ts` — **new**: `AsyncLocalStorage`
  impersonation context (`runWithRequestContext`, `getImpersonationContext`).
- `server/src/middleware/auth.ts` — capture impersonation headers → build
  `ImpersonationContext`, set `req.user.impersonation`, bind ALS around `next()`.
- `server/src/models/AuditLogEntry.ts` — `auth.impersonation_start|stop` actions
  + optional `impersonation` sub-document (`IAuditImpersonation`).
- `server/src/services/auditLog.ts` — read ALS context (or explicit) → write the
  `impersonation` block; `AuditWriteOptions.impersonation?`.
- `server/src/routes/auth.ts` — `POST /api/auth/impersonation/{start,stop}`
  (superuser-only, audited).
- `server/src/controllers/auditTrailController.ts` — CSV gains
  `impersonatedBy` / `impersonatedAs` columns.
- `client/src/services/api.ts` — forward `X-Impersonated-User-Id` / `-Name`.
- `client/src/store/authStore.ts` — start/stop call the audit endpoints.
- `client/src/features/admin/AuditTrail/AuditTrail.tsx` — impersonation badge +
  `AuditImpersonation` type.

## Dependencies

- [[cr-020-account-lock-unlock-audit-trail]] — provides the `AuditLogEntry`
  model + admin Audit Trail surface this CR extends.

## Open questions (resolved)

- ~~Thread impersonation context through every audit caller?~~ **No** — used
  `AsyncLocalStorage` so `recordAuditEvent` auto-reads it; zero caller churn.
- ~~Send the impersonated user identity how?~~ Request headers
  (`X-Impersonated-User-Id` + URI-encoded `-Name`), mirroring the existing
  `X-Impersonated-Role` mechanism; the server re-resolves the name from the id
  on the start/stop endpoints as defence against a stale/spoofed label.
