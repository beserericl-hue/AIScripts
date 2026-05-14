---
name: Storage Layer
description: How MongoDB documents, GridFS buckets, and AWS S3 split responsibility for storing structured data, large HTML, images, and evidence files.
type: concept
tags: [storage, gridfs, s3, mongodb, architecture]
last_reviewed: 2026-05-10
---

# Storage Layer

Three backends, each with a clear role.

| Backend | Holds | Why |
|---------|-------|-----|
| MongoDB documents | Submissions, users, reviews, validation results, evidence metadata | Structured, indexed, transactional. Hard 16MB BSON limit per doc. |
| GridFS `htmlContent` bucket | Imported document HTML (up to 370MB+) | Splits into 255KB chunks; bypasses BSON limit. |
| GridFS `images` bucket | Images extracted from imported docs | Persistent across container restarts (Railway filesystem is ephemeral). |
| AWS S3 | Evidence files (PDFs, Word, images) uploaded by program coordinators | Persistence + offload binary I/O from Mongo; presigned URLs for download. |

## GridFS service

[server/src/services/gridFsService.ts](../../../../server/src/services/gridFsService.ts) is the most complex service in the codebase (~1400 lines).

Key operations:

- **`storeHtmlContent(importId, html)`** — caches the entire string in memory before writing. Fine for <100MB.
- **`storeHtmlContentFromFile(importId, path)`** — streams from a temp file. **Required for 300MB+** to avoid OOM. Callers must choose; no auto-threshold.
- **`getHtmlContent(importId)`** — concatenates all chunks into a single Buffer, then `.toString('utf-8')`. **Peak memory ≈ 2× file size** (740MB for a 370MB doc). Should stream to client instead.
- **`insertHtmlMarker(importId, marker, textOffset, textLength)`** — replaces a section with an HTML comment marker, returns `removedHtml` for round-tripping. **Table-aware**: when a selection lands inside a `<table>`, expands to row-level boundaries, wraps split fragments in `TABLE_FRAG_START / TABLE_FRAG_END` comments so non-tagged rows stay visible on resume.
- **`restoreMarker(importId, sectionId, htmlContent)`** — two-pass stream: pass 1 finds marker byte offsets, pass 2 substitutes restored HTML, writes a new GridFS file, then deletes the old. **Not atomic** — if the delete fails after the new write, two files exist with no automatic cleanup. If the new write fails after the old was prepared for delete, restore is silently broken.
- **`cleanupOrphanedFiles(dryRun)`** — finds GridFS files whose `SelfStudyImport` no longer exists by regex on filenames (`/^([a-f0-9]{24})\.html$/`). **Brittle** — if the filename format ever changes, orphans go undetected.

### Memory pitfalls (V8 SlicedString / ConsString)

For very large HTML, `string.substring()` creates `SlicedString` that retains a reference to the full parent (preventing GC). String concatenation creates `ConsString` chains. Workaround used in the codebase: `Buffer.from(s, 'utf-8').toString('utf-8')` to force a flat copy. See [server/src/controllers/importController.ts:28-31](../../../../server/src/controllers/importController.ts) `flattenString()`. For final HTML output, the safer pattern is to write to a temp file and stream via `storeHtmlContentFromFile`.

## S3 service

[server/src/services/s3Service.ts](../../../../server/src/services/s3Service.ts), ~200 lines.

- **Lazy client init** via `getS3Client()` (line 16-39). Reads `AWS_ENDPOINT_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION`, `AWS_S3_BUCKET_NAME`. **None of these are in `.env.example`** — see [[documentation-gaps-2026-05-10]].
- `forcePathStyle: true` for Railway-compatible endpoints.
- **Bug:** `isS3Configured()` is called from [server/src/controllers/evidenceController.ts:309](../../../../server/src/controllers/evidenceController.ts) but is **not exported** from `s3Service.ts`. The check evaluates to `undefined` → falsy → S3 fallback path always selected (base64-in-Mongo). Tracked in [[incomplete-features-2026-05-10]].
- Presigned URL TTL not audited — see [[security-audit-2026-05-10]].

## Cross-cutting concerns

- **Storage routing logic lives in controllers**, not in a `StorageAdapter`. `evidenceController.ts` directly checks `file.storageType === 's3' | 'base64'` and branches.
- **No cross-store transactions.** A multi-step write (e.g., extract section → write GridFS marker → save MongoDB record) can leave inconsistent state on failure. There is no compensating-action log.
- **Indexes:** [server/src/models/SelfStudyImport.ts](../../../../server/src/models/SelfStudyImport.ts) lacks compound indexes on `(submissionId, status)`. [server/src/models/ValidationResult.ts](../../../../server/src/models/ValidationResult.ts) lacks `(submissionId, standardCode, specCode, validatedAt desc)` for the latest-first lookup in [server/src/services/validationService.ts:62-66](../../../../server/src/services/validationService.ts).

## Related

- [[import-pipeline]] — the top consumer of GridFS
- [[system-architecture]] — overall layering
- [[security-audit-2026-05-10]] — presigned URL TTL, S3 access controls
- [[incomplete-features-2026-05-10]] — `isS3Configured()` bug
