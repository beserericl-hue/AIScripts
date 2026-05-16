---
name: DB Migration Strategy
description: How schema changes from the sprint plan flow through develop → main → prod without affecting live prod data, and how develop stays current with prod writes.
type: concept
tags: [database, migrations, mongodb, deployment, ops]
last_reviewed: 2026-05-16
---

# DB Migration Strategy

How sprint-driven schema changes from [[sprint-plan-2026-05-11]] reach production safely while prod users continue writing, and how develop stays current with prod data during the sprint.

## Goals

1. **No production data is ever mutated by develop activity.** The develop env writes only to its own MongoDB and to a `dev/`-prefixed namespace in the shared S3 bucket.
2. **No schema change ever breaks a live production reader mid-deploy.** Every change ships as additive first; destructive cleanup follows in a later sprint.
3. **Develop is refreshable from prod in ~5 minutes.** Devs work against the real data shape, including writes that prod users made during the sprint.
4. **Every migration is forward-only, idempotent, and rerunnable.** No "we ran it but it half-failed" states.

## Inventory of sprint-driven DB changes

Walking [[sprint-plan-2026-05-11]] story by story. Classification: **additive** (zero risk), **index-only** (safe), **breaking** (needs expand-contract).

### New collections (9) — all additive

| Sprint | Story | Collection | Notes |
|---|---|---|---|
| S1.2 | Impersonation audit | `ImpersonationAudit` | superuser/role/target indexes |
| S1.7 | Webhook dedup | `WebhookCallback` | unique `executionId` + 7d TTL |
| S2.2 | Password reset | `PasswordResetToken` | TTL on `expiresAt` |
| S2.3 | JWT refresh | `RefreshToken` | TTL |
| S2.3 | JWT revoke | `RevokedToken` | TTL = JWT max lifetime |
| S2.7 | Admin audit trail | `AdminAction` | action enum + targetUserId |
| S3.x | Evidence AI cache | `EvidenceReviewResult` | compound + unique cache index |
| S6.2 | Accreditation cycle | `AccreditationCycle` | scheduler for 5/10-year cycles |
| S7.1 | Joint Ventures | `JointVenture` | unique `name`, indexed `institutionIds` |

### Field additions to existing collections (9) — all additive

| Sprint | Model | Fields | Default |
|---|---|---|---|
| S1.7 | `WebhookSettings` | `callbackSecret` (encrypted) | nullable |
| S2.1 | `User` | `failedLoginAttempts`, `lockedUntil?` | `0` / `null` |
| S3.9 | `Review` | `dueAt` | `assignedAt + 45d` at create |
| S4.10 | `Review` | `readerReportS3Key?`, `readerReportGeneratedAt?` | nullable |
| S6.1 | `Submission` | `decision.{informalSentAt, formalSentAt, webPostedAt}` | nullable |
| S7.1 | `Institution` | `jointVentureId?` | nullable |

### Index-only changes — safe

| Sprint | Model | Index |
|---|---|---|
| S6.9 | `ErrorLog` | TTL on `createdAt` (90d) — auto-deletes old rows |

### Breaking changes (2) — need expand → migrate → contract

These are the only changes in the entire sprint plan that can break prod readers if shipped naively.

| Sprint | Story | Change | Why breaking |
|---|---|---|---|
| **S2.10** | Multi-PC per Institution | `Institution.coordinatorId` (single ObjectId) → `coordinatorIds: ObjectId[]` | Every permission check in [evidenceController.ts](../../../../server/src/controllers/evidenceController.ts), [submissionController.ts](../../../../server/src/controllers/submissionController.ts), [changeRequestController.ts](../../../../server/src/controllers/changeRequestController.ts), [readerLockController.ts](../../../../server/src/controllers/readerLockController.ts) reads the old field. Mid-deploy, half the running pods read the old field, half the new — RBAC inconsistent. |
| **S4.6** | Two-description tech debt | Consolidate `SupportingEvidence.metadata.description` → top-level `description`; remove `imageMetadata.ocrText`, `linkedNarratives[]` | UI panels currently fall back to `metadata.description` when top-level is empty. Removing the fallback before the migration runs means missing descriptions in the UI. |

All other 18 sprint-driven changes are zero-risk and can ship in a single PR each.

## The three-layer strategy

### Layer 1 — Forward-only migration runner

**Status:** does not exist yet. Add as the first Sprint 1 infrastructure work, **before any DB-touching story merges**.

**Add `server/src/migrations/`** with:

```
server/src/migrations/
├── runner.ts              — boot-time applier, reads _migrations collection
├── 001_create_migration_log.ts
├── 002_convert_coordinator_to_array.ts    (S2.10 expand step)
├── 003_backfill_supporting_evidence_description.ts  (S4.6 expand step)
├── …
```

Each migration file exports:

```typescript
export const name = '002_convert_coordinator_to_array';
export const description = 'S2.10 expand step: ...';
export async function up(db: Db): Promise<void> { /* idempotent */ }
// No `down()`. Forward-only. To reverse: write a new numbered migration.
```

Boot-time call in [server/src/index.ts](../../../../server/src/index.ts), **before `app.listen`**, gated `NODE_ENV !== 'test'`:

```typescript
await runPendingMigrations(db);
```

`_migrations` collection tracks `{ name, appliedAt, ranBy: <hostname>, durationMs }`. The runner skips any name already in the log. Migrations are **applied in lexical order** of filename, which is why the `NNN_` prefix matters.

**Idempotency rules:**
- Read state first. Write only if needed.
- Use `$setOnInsert` / `findOneAndUpdate(..., { upsert: true })`, never `insertMany` without a unique key.
- Index creation uses `createIndex` (no-op if exists).
- Field additions to documents check `$exists: false` filter first.

### Layer 2 — Expand-migrate-contract for breaking changes

**S2.10 — multi-PC (three PRs):**

1. **PR-A (expand):**
   - Schema: add `coordinatorIds: ObjectId[]`; keep `coordinatorId` as deprecated-but-present.
   - Migration `002_convert_coordinator_to_array`: for each Institution where `coordinatorIds` is empty/missing and `coordinatorId` is set, copy to a one-element array.
   - Controllers: every permission check reads `coordinatorIds` first, falls back to `coordinatorId === userId` if array is empty.
   - Writers: continue writing both fields (the legacy field gets the *first* coordinator for back-compat).
   - **Deploy to prod. Verify migration ran. Both schemas now coexist.**

2. **PR-B (migrate writers):**
   - Add/remove endpoints (`POST /api/institutions/:id/coordinators`, `DELETE …`) — these only mutate the array.
   - Stop writing the legacy singular field on new creates.
   - Permission checks no longer fall back to singular (the migration has guaranteed populated arrays).
   - UI updates: chip list, picker, etc.
   - **Deploy to prod.**

3. **PR-C (contract):**
   - Remove `coordinatorId` from the schema.
   - Optional cleanup migration `004_drop_legacy_coordinator_field` runs `$unset: { coordinatorId: '' }` on all institutions.
   - **Deploy to prod.**

Total: 3 sprints. At every point, prod readers and writers are in a consistent state.

**S4.6 — description consolidation (two PRs):**

1. **PR-A (expand + backfill):**
   - Migration `003_backfill_supporting_evidence_description`: for each row where top-level `description` is empty/missing and `metadata.description` exists, copy down.
   - UI: read top-level `description` only (no more fallback).
   - Writers: write to top-level only.
   - Drop the schema declarations for `imageMetadata.ocrText`, `linkedNarratives[]` — Mongoose stops persisting them on save; existing values remain harmlessly on old documents.
   - **Deploy to prod.**

2. **PR-B (contract, optional):**
   - Cleanup migration `005_drop_legacy_description_field`: `$unset: { 'metadata.description': '' }` and `$unset: { imageMetadata.ocrText: '', linkedNarratives: '' }`.
   - Saves disk space; not required for correctness.

### Layer 3 — Develop-from-prod refresh script

**Add `server/scripts/sync-from-prod.ts`** invoked as:

```bash
NODE_ENV=development MONGO_PROD_URL='mongodb://…' npm run db:sync-from-prod
```

Steps the script performs, in order:

1. **Sanity guard.** Refuse to run unless `NODE_ENV !== 'production'` and `MONGO_URL` resolves to the develop env's host. Hard abort otherwise.
2. **mongodump from prod** to `/tmp/prod-snapshot-{timestamp}/` using `MONGO_PROD_URL` (read-only credential — see "Required prod read-only role" below).
3. **mongorestore --drop** into the develop Mongo. The `--drop` ensures stale develop-only docs don't linger.
4. **Run all pending migrations** against the freshly-restored data. This is critical: prod's snapshot has prod's schema; develop is ahead, so its migrations need to apply forward to bring the restored DB up to the develop branch's expected shape.
5. **Optional: scrub PII** (emails → `dev-{n}@example.invalid`, password hashes → known dev value via `bcrypt.hashSync('devpass', 4)`, regenerate webhook callbackSecrets, blank `User.lastLogin`). Gated by `--scrub`.
6. **Does NOT touch S3.** Develop already reads the shared prod bucket (per [[railway-deployment-topology#s3--tigris-shared-bucket]]); file data is naturally current.
7. Log the operation to a local `_dev_sync_log` collection in develop with `{ syncedAt, prodSnapshotTimestamp, migrationsRunCount, scrubbedPII }`.

**Cadence:**
- Manually after every PR merge to `main` (recommended).
- Optional nightly cron via Railway scheduled job if drift becomes an issue.
- Anyone can run it on demand when they need fresh data.

**Critical invariant:** the script is one-directional. There is no inverse function. Any developer who needs to push fixture data to prod does it via a real migration in `server/src/migrations/`, reviewed via PR, applied at the next prod deploy.

**Required prod read-only role:** create a `cshse-dev-readonly` MongoDB user in the prod cluster with `read` on the prod database only. Store the connection string in the developer's local `.env` as `MONGO_PROD_URL`. **Do not** store this in any Railway env var or commit it — it's a per-developer secret.

## Shared S3 bucket — `dev/` prefix isolation

[[railway-deployment-topology]] documents that prod and develop share the Tigris S3 bucket `cshse-filestorage-qlyj5pn`. This is fine for *reads* but creates a write-collision risk: develop code uploading to the same keyspace as prod can overwrite prod files.

**Mitigation: `S3_KEY_PREFIX` env var.**

- `server/src/services/s3Service.ts` reads `process.env.S3_KEY_PREFIX` (default empty string).
- Every upload prepends the prefix: `uploadFile(key, body)` writes to `${S3_KEY_PREFIX}${key}`.
- Every download / list / delete operates within the prefix.

Env values:
- **prod:** `S3_KEY_PREFIX=""` (no prefix — existing keys still resolve).
- **develop:** `S3_KEY_PREFIX="dev/"`.

Effect:
- Develop writes `dev/submissions/abc/evidence/foo.pdf` — invisible to prod.
- Develop reads can see prod files (no prefix on read fallback) OR can be locked to the `dev/` namespace, depending on policy.

Recommended policy: **develop sees only `dev/` keys**. Forces devs to seed dev-specific test files via a dedicated upload path, never accidentally relying on prod data being present. Less surprising failure modes than "works in develop, fails in prod because the file was actually a prod file."

**This is a sprint-zero infra change, not a sprint story.** Add it before any S3-writing sprint story (S1.10, S3.x, S4.10) ships.

## The full PR workflow

```
                      ┌─────────────────────────┐
                      │  prod (main branch)     │
                      │  • live users writing   │
                      │  • mongoDB-prod         │
                      │  • S3 (no prefix)       │
                      └────────┬────────────────┘
                               │
                               │ (1) PR merge to main triggers prod deploy
                               │     Railway builds Dockerfile, restarts container
                               │     boot-time runner applies pending migrations
                               │     in `server/src/migrations/` in lexical order
                               │
        PR ─────────────────── ┼ ────────────────── npm run db:sync-from-prod
        review                 │                    (whenever develop wants fresh
                               │                     data — usually after every
                               │                     prod deploy)
                               ↑                            │
                               │                            ↓
                      ┌────────┴────────────────┐
                      │  develop env            │
                      │  • developers working   │
                      │  • mongoDB-develop      │
                      │  • S3 (dev/ prefix)     │
                      └─────────────────────────┘
```

What happens at each step:

1. **Dev work on `developer` branch.** Add new collections, fields, indexes via numbered migrations in `server/src/migrations/`. Code reviews include "is this expand-contract for breaking changes?"
2. **Manual or scheduled `db:sync-from-prod`.** Refreshes develop's Mongo with prod's latest data. Reapplies all develop-branch migrations on top.
3. **PR opened: `developer` → `main`.** Reviewer checks every migration is idempotent and additive (or correctly staged for expand-contract).
4. **PR merge.** Railway auto-deploys main. Container boots, runs pending migrations against prod data in order, then `app.listen`. If a migration throws, the boot fails — the previous container keeps serving. Operator pages on, fixes the migration, re-deploys.
5. **Post-deploy refresh.** Sync develop from prod again so develop now matches the post-migration prod state.

## Failure modes and how to handle them

### Migration throws on prod boot

- Old container keeps serving (Railway's deploy is a swap, not a stop-then-start).
- New container exits with non-zero; Railway marks deploy `FAILED`.
- Fix the migration (most common cause: forgot idempotency check), push a new commit, redeploy.
- **Never** mutate `_migrations` directly to "skip" a broken migration — write a follow-up correction migration instead.

### Develop accidentally writes to prod S3

If `S3_KEY_PREFIX` is missing, prevented by the env-var check at service init: throw on startup if `NODE_ENV === 'production' && S3_KEY_PREFIX !== ''` *or* `NODE_ENV !== 'production' && S3_KEY_PREFIX === ''`. Forces explicit setup per env.

### Develop refresh stomps on a developer's local fixtures

Sync is destructive — drops the develop DB before restore. Document this: anything you want preserved across syncs must be in a seed script or a migration, not in develop-only one-off writes.

### Two PRs both add migrations with the same number

Lexical sort collides; one or both might not run, depending on iteration order. Mitigation: PR template asks "did you bump the migration number to be greater than any existing PR on this branch?" and CI lints for duplicate prefixes.

### Long-running migration locks the DB

Most migrations are millisecond-scale (index creation on the small CSHSE dataset is fast; field-add via `$set` with an `$exists: false` filter is cheap). If a future migration needs to touch every row in a large collection: add `--maintenance-window` flag, set `READ_ONLY=true` on the app for the duration, and run the migration as a one-off CLI invocation rather than at boot.

## What to do before any sprint story merges

1. **Build the migration runner** (`server/src/migrations/runner.ts` + `001_create_migration_log.ts`). Land in a single PR. ~half a day.
2. **Add `S3_KEY_PREFIX` env-var support** in `s3Service.ts`. Set `dev/` on develop, leave empty on prod. ~1 hour.
3. **Add `server/scripts/sync-from-prod.ts`.** Test against develop, document the prod read-only role setup in [[railway-deployment-topology]]. ~half a day.
4. **Create the prod read-only Mongo user** for sync access. One-time admin action.

After that, every DB-touching sprint story slots into the framework cleanly.

## Open items

- Decide PII scrubbing policy: always scrub on sync, only when sharing the dev env, or never. The CSHSE Handbook flags reader identity as protected; we should scrub at minimum the `Comment.authorName` and reader emails in synced data.
- Confirm the Tigris bucket's lifecycle policy. Develop's `dev/` keys should auto-delete after, say, 30 days — but only if Tigris supports prefix-scoped lifecycle rules.
- The migration runner runs at boot. If a migration takes >Railway's healthcheck timeout (30s in [CSHSE/railway.json](../../../../CSHSE/railway.json)), the deploy is marked unhealthy. For longer migrations, run them out-of-band before deploy.

## Related

- [[storage-layer]] — three-backend (Mongo / GridFS / S3) split.
- [[railway-deployment-topology]] — two-env Railway setup with shared S3.
- [[sprint-plan-2026-05-11]] — the source of every DB change cataloged above.
- [[system-architecture]] — overall layering.
