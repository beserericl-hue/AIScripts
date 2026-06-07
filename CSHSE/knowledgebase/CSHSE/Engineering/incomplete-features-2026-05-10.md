---
name: Incomplete Features — 2026-05-10
description: Snapshot of partially-built, stubbed, or wired-but-broken features as of 2026-05-10, with code citations.
type: review
tags: [tech-debt, incomplete, audit]
audit_date: 2026-05-10
auditor: claude
last_reviewed: 2026-05-10
---

# Incomplete Features — 2026-05-10

Inventory of code that looks done from the outside but isn't, ranked by user-facing impact.

## High impact

### 1. Email notifications are stubbed across multiple controllers
Empty recipient arrays + `// TODO: Send notification email` in:
- [server/src/controllers/siteVisitController.ts:181-296](../../../../server/src/controllers/siteVisitController.ts) (4 sites)
- [server/src/controllers/changeRequestController.ts:156-307](../../../../server/src/controllers/changeRequestController.ts) (3 sites)
- [server/src/controllers/institutionController.ts:143,263,303](../../../../server/src/controllers/institutionController.ts) (3 sites)
- [server/src/controllers/readerLockController.ts:239](../../../../server/src/controllers/readerLockController.ts) (1 site)

Effect: workflow-critical events (site visits, deadline changes, reader locks, invitations) silently succeed with no user notification. `nodemailer` is wired in but unused for these flows.

### 2. N8N Document Matcher is built but never invoked
- [server/src/controllers/importController.ts:3176](../../../../server/src/controllers/importController.ts) — `// TODO: Send sections to n8n for processing`. Code branch for `processWithAI: true` exists; no axios call.
- The [[n8n-integration|matcher workflow]] itself is fully built and tested — only the server caller is missing.

Effect: AI-assisted standard mapping for imported documents is not available. Users tag every section by hand.

### 3. `isS3Configured()` is called but not exported → S3 fallback always wins
- [server/src/controllers/evidenceController.ts:309](../../../../server/src/controllers/evidenceController.ts) calls `s3Service.isS3Configured()`.
- [server/src/services/s3Service.ts](../../../../server/src/services/s3Service.ts) does not export this function.

Effect: regardless of whether S3 is configured, the check evaluates to `undefined` → falsy → evidence files are stored as **base64 in MongoDB**. Defeats the whole point of the S3 work in the recent commit series. See also [[storage-layer]].

### 4. No retry logic on n8n webhook calls (despite docs)
- [server/src/services/validationService.ts:240-273](../../../../server/src/services/validationService.ts) `triggerValidation` → `callWebhook` (single POST, 30s timeout, no retry).
- [Readme.md:323-329](../../../../Readme.md) advertises max-retries 3 + exponential backoff + multiplier. None of those settings have effect.

Effect: transient n8n outage = validation stuck in `pending` forever; no surface for the user to retry.

### 5. No tests anywhere
No test directory; no Jest/Vitest config; zero coverage.

Effect: every recent fix commit (and the pattern is dense — see "Recent commit signals" below) is high-risk regression bait. Particularly fragile areas: auto-save, evidence permissions, n8n workflow contracts, file-download auth.

## Medium impact

### 6. PDF image extraction is a hardcoded zero
- `server/src/services/documentParser.ts` (~line 85): `imageCount: 0` with comment "PDF image extraction not implemented yet."

Effect: image-heavy PDFs lose figures during import. Tesseract.js is in `package.json` but unused.

### 7. Profile auto-save has no failure surface
- Recent commit `ac5cadd` added 2-second debounced auto-save for profile fields. No toast/banner when save fails.

Effect: user can think a change saved when the API was down or rejected the value.

### 8. Help Chat depends on three external services with no fallback
Supabase pgvector + OpenAI embeddings + n8n. If any are down, the chat bubble disappears. No cached / offline / static-FAQ fallback.

### 9. Reader role UI was added but RBAC is fragile
- Recent commits added "reviewer role UI"; subsequent commits added `isSuperuser` bypass workarounds in comments and scoring APIs ([commit `82f6df4`]).
- `authStore.canAccessAdminSettings()` ([client/src/store/authStore.ts:193-203](../../../../client/src/store/authStore.ts)) blends superuser + impersonation + effective role with no tests.

Effect: superuser-impersonation has become the de-facto path to test reviewer flows; signal that the role model isn't fully exercised end-to-end.

### 10. PDF/DOCX preview has no streaming or chunking
- File preview modal converts the whole file to HTML in memory. 50MB upload limit but no streaming → memory spike on large evidence files.

## Low impact / hardening

- No client-side currency / phone / zip validators despite forms showing those fields.
- ErrorLog MongoDB collection has no TTL or rotation.
- No graceful degradation when Redis (n8n chat memory) is unreachable.

## TODO/FIXME inventory (only the consequential ones)

| Path | Line | Comment |
|------|------|---------|
| `siteVisitController.ts` | 181–296 | Send notification emails to: (4 instances, empty recipients) |
| `changeRequestController.ts` | 156–307 | Send notification to admin and lead reader (3 instances) |
| `institutionController.ts` | 143, 263, 303 | Send invitation/notification email |
| `readerLockController.ts` | 239 | Send notification to program coordinator |
| `importController.ts` | 3176 | Send sections to n8n for processing |
| `documentParser.ts` | ~85 | PDF image extraction not implemented |

No `@ts-ignore` / `@ts-expect-error` / empty `catch {}` found.

## Recent-commit signals (where fragility lives)

Frequent fixes in the last 50 commits cluster around:

1. **Auto-save / state sync** — `ae798a8`, `ac5cadd`, `c33f0a5`. Race conditions between load and save.
2. **Evidence file handling** — `ccf1b02`, `870b738`, `f64f4a1`, `d00d4d3`, `55eec4e`, `34c2219`. Multiple permission / role / blob-auth bugs.
3. **N8N integration** — `911e302`, `e3340ba`, `f9254e5`, `e1abb64`. Crypto module, Redis sessions, Vector Store Tool churn.
4. **Import / file workflow** — `61a111a`, `8f50313`, `9e5570f`, `6b3d0a3`. Binary-field renames, deferred remount, persistence bugs.

If you're touching any of these areas, expect to encounter related bugs.

## Related

- [[security-audit-2026-05-10]] — security side of the same code
- [[documentation-gaps-2026-05-10]] — docs that would surface these
- [[n8n-integration]] — overlaps with #2 and #4
- [[storage-layer]] — overlaps with #3
