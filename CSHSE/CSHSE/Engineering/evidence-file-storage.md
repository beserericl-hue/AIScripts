---
name: Evidence File Storage
description: How supporting-evidence files are uploaded, indexed by Standard / Sub-standard, displayed in three different UI surfaces, and what "EC3 folders" maps to in the current code.
type: concept
tags: [evidence, files, upload, storage, ui, standards]
last_reviewed: 2026-05-10
---

# Evidence File Storage

This is the durable map of how a coordinator's evidence file gets from their disk into S3, indexed in MongoDB, and rendered back to them under the right Standard / Sub-standard. The user's "EC3 folders" concept is reconciled here against what the code actually does.

> **Read first if you are about to add AI evaluation of evidence files.** This page documents the data shape and the three UI surfaces. The pipeline that should *consume* the files is in [[evidence-document-review-pipeline]].

## What "EC3 folders" maps to

The user has referred to evidence being stored in "EC3 folders." There is **no `EC3` string anywhere** in the codebase, the standards PDFs, or the n8n workflows (verified 2026-05-10).

What the system *does* have, surfaced through the FileLibrary UI, is **per-Standard, per-Sub-standard accordion buckets** — each Standard (1–21) is an expandable section, and each Sub-standard (a–h) inside it is a sub-bucket holding the linked evidence files. Visually these *are* the "folders." The mapping:

| User's term | Code term | UI label | Storage |
|-------------|-----------|----------|---------|
| "Folder" / "EC3 folder" | `(standardCode, specCode)` pair | Standard accordion → Sub-standard section | `SupportingEvidence.standardCode + .specCode` |
| File inside folder | `SupportingEvidence` record | Row inside the Sub-standard section | S3 object at `{institutionId}/{versionId}/{filename}` |

If "EC3" specifically means "the folder for Standard E, Sub-standard C, item 3" or "Engineering Criteria 3" or "Evidence Class 3," none of those constructs exist as a first-class field — they would need a new `evidenceCategory` field on the model. But the most likely interpretation is the user's shorthand for *"the per-Standard / per-Sub-standard buckets where I drop my evidence files."*

## The three upload surfaces

There are three distinct UI surfaces in the client that all POST evidence to the same backend endpoint. Each represents a different coordinator workflow.

### 1. Inline `EvidencePanel` (most-used)

[client/src/features/selfStudy/Editor/EvidencePanel.tsx](../../../../client/src/features/selfStudy/Editor/EvidencePanel.tsx) (472 lines)

Embedded inside the Self-Study editor for the **currently-selected Spec**. The coordinator is writing the narrative for `Standard 11, Spec a`; this panel is right there to attach the supporting evidence for that exact Spec.

- **Reads** ([EvidencePanel.tsx:69-80](../../../../client/src/features/selfStudy/Editor/EvidencePanel.tsx)): `GET /api/submissions/:id/evidence?standardCode=&specCode=` — only the evidence linked to the active Spec.
- **Writes:**
  - Files: `POST /api/submissions/:id/evidence/upload` (multipart) at [EvidencePanel.tsx:96-100](../../../../client/src/features/selfStudy/Editor/EvidencePanel.tsx) — auto-fills `standardCode + specCode` from props, no picker.
  - URLs: `POST /api/submissions/:id/evidence/url` at [EvidencePanel.tsx:119-126](../../../../client/src/features/selfStudy/Editor/EvidencePanel.tsx).
- **UI flow:** Click "+ File" → file picker → staged-file appears in teal banner with description input → "Upload" commits ([EvidencePanel.tsx:264-303](../../../../client/src/features/selfStudy/Editor/EvidencePanel.tsx)). No drag-drop here.
- **No pickers for Standard/Spec** — the panel always uses the active Spec from props.
- **Versioning visible** — if `versionNumber > 1`, a `v{n}` blue badge renders next to the filename ([EvidencePanel.tsx:339-343](../../../../client/src/features/selfStudy/Editor/EvidencePanel.tsx)).
- **`storageType: 'base64' | 's3'` is in the type but not displayed** — coordinator can't tell which backend a file is on.

### 2. `EvidenceManager` (split-panel cross-Spec view)

[client/src/features/selfStudy/EvidenceManager/EvidenceManager.tsx](../../../../client/src/features/selfStudy/EvidenceManager/EvidenceManager.tsx) (418 lines) + sibling files [FileUpload.tsx](../../../../client/src/features/selfStudy/EvidenceManager/FileUpload.tsx) (373), [URLInput.tsx](../../../../client/src/features/selfStudy/EvidenceManager/URLInput.tsx) (219), [EvidenceViewer.tsx](../../../../client/src/features/selfStudy/EvidenceManager/EvidenceViewer.tsx) (330).

A standalone split-panel view — list of evidence on the left, preview pane on the right. Filter by type (documents / urls / images), search by name / description, filter by linked vs unlinked.

- **Reads:**
  - List: `GET /api/submissions/:id/evidence?evidenceType=&standardCode=&specCode=` ([EvidenceManager.tsx:94-96](../../../../client/src/features/selfStudy/EvidenceManager/EvidenceManager.tsx)).
  - Stats: `GET /api/submissions/:id/evidence/stats` ([EvidenceManager.tsx:106](../../../../client/src/features/selfStudy/EvidenceManager/EvidenceManager.tsx)) — returns `{byType, linkedCount, unlinkedCount, total}`.
- **Writes:**
  - Upload (drag-drop, multi-file, with progress bars): `POST /api/submissions/:id/evidence/upload` ([FileUpload.tsx:74-92](../../../../client/src/features/selfStudy/EvidenceManager/FileUpload.tsx)). Per-file progress reported via axios `onUploadProgress`. **50MB per-file cap** ([FileUpload.tsx:48](../../../../client/src/features/selfStudy/EvidenceManager/FileUpload.tsx)). Allowed types: PDF, Word, PowerPoint, Excel, image (JPEG/PNG/GIF/WebP/TIFF) — listed at [FileUpload.tsx:33-46](../../../../client/src/features/selfStudy/EvidenceManager/FileUpload.tsx).
  - URL: `POST /api/submissions/:id/evidence/url` ([URLInput.tsx:34-44](../../../../client/src/features/selfStudy/EvidenceManager/URLInput.tsx)) with auto-fill of title from URL hostname on blur.
  - Delete: `DELETE /api/submissions/:id/evidence/:eid` ([EvidenceManager.tsx:115-117](../../../../client/src/features/selfStudy/EvidenceManager/EvidenceManager.tsx)) — confirm dialog uses `window.confirm`.
  - Link / re-link: `POST /api/submissions/:id/evidence/:eid/link` with `{standardCode, specCode}` body ([EvidenceManager.tsx:136-139](../../../../client/src/features/selfStudy/EvidenceManager/EvidenceManager.tsx)). The viewer lets the user pick from a hardcoded `Array.from({length: 21})` standards dropdown and a hardcoded `['a'..'h']` specs dropdown ([EvidenceViewer.tsx:283-304](../../../../client/src/features/selfStudy/EvidenceManager/EvidenceViewer.tsx)). **Real bug, two faces (verified 2026-05-10):** (1) doesn't fetch standards from `/api/standards`, so won't auto-update if the standards definitions change; (2) **offers `g` and `h` options that don't map to any actual Spec** — `data/standards.ts` only defines `a`–`f`. Linking to `Standard 11.g` creates an evidence row keyed to a non-existent Spec.
- **Preview** ([EvidenceViewer.tsx:82-139](../../../../client/src/features/selfStudy/EvidenceManager/EvidenceViewer.tsx)): URL → external-link card; image → `<img>` with `max-h-96`; PDF → `<iframe>` to download URL; other → "Click download to view."
- **Smell:** This component is mostly redundant with FileLibrary (below). Two upload UIs covering the same backend, with slightly different validation and slightly different field shapes. Likely a candidate for consolidation.

### 3. `FileLibrary` (the canonical "evidence folders" view — what the user calls "EC3 folders")

[client/src/features/selfStudy/FileLibrary/FileLibrary.tsx](../../../../client/src/features/selfStudy/FileLibrary/FileLibrary.tsx) (955 lines) + [FilePreviewModal.tsx](../../../../client/src/features/selfStudy/FileLibrary/FilePreviewModal.tsx) (280).

The cross-Spec view that **groups every evidence file by Standard → Sub-standard accordion**. This is the visual "folders" the user is referring to.

- **Reads:**
  - Standards: `GET /api/standards` ([FileLibrary.tsx:95](../../../../client/src/features/selfStudy/FileLibrary/FileLibrary.tsx)) — pulls the live `CSHSE_STANDARDS` array (so dropdowns auto-update).
  - All evidence: `GET /api/submissions/:id/evidence` (no filter) ([FileLibrary.tsx:104-106](../../../../client/src/features/selfStudy/FileLibrary/FileLibrary.tsx)).
- **Grouping** ([FileLibrary.tsx:114-124](../../../../client/src/features/selfStudy/FileLibrary/FileLibrary.tsx)):
  ```ts
  evidenceByStandard[standardCode][specCode] = Evidence[]
  // unassigned files bucket under "unassigned" / "general"
  ```
- **Layout** ([FileLibrary.tsx:914-933](../../../../client/src/features/selfStudy/FileLibrary/FileLibrary.tsx)):
  - **Part I: General Standards (1–10)** — accordion list.
  - **Part II: Curriculum Standards (11–21)** — accordion list.
  - Each Standard accordion expands to show one section per Sub-standard (a–h) that has files.
  - Per-Standard file count badge ([FileLibrary.tsx:507-511](../../../../client/src/features/selfStudy/FileLibrary/FileLibrary.tsx)).
  - "Expand All" / "Collapse All" controls ([FileLibrary.tsx:889-902](../../../../client/src/features/selfStudy/FileLibrary/FileLibrary.tsx)).
- **Writes:**
  - Upload (single file at a time, with Standard + Sub-standard pickers): `POST /api/submissions/:id/evidence/upload` ([FileLibrary.tsx:169-172](../../../../client/src/features/selfStudy/FileLibrary/FileLibrary.tsx)). The Sub-standard dropdown is dependent on the Standard pick ([FileLibrary.tsx:649-661](../../../../client/src/features/selfStudy/FileLibrary/FileLibrary.tsx)) and pulls live spec letters from the standards endpoint. **This is the only upload UI that uses the live standards list rather than hardcoded dropdowns.**
  - **Version vs Replace toggle** ([FileLibrary.tsx:680-714](../../../../client/src/features/selfStudy/FileLibrary/FileLibrary.tsx)): radio buttons. "Keep as new version" (default) sends nothing; "Replace existing file" sends `replaceExisting=true` in form data.
  - URL: same as elsewhere.
  - Delete: same as elsewhere.
- **Download** ([FileLibrary.tsx:298-318](../../../../client/src/features/selfStudy/FileLibrary/FileLibrary.tsx)): blob fetch + `URL.createObjectURL` + click-to-download anchor — works around browser auth cookie issues on direct `<a download>` links.
- **Preview** ([FilePreviewModal.tsx](../../../../client/src/features/selfStudy/FileLibrary/FilePreviewModal.tsx)): inline preview for PDF, DOCX (rendered via Mammoth in the modal), images.
- **The accordion buckets ARE the "folders."** Each accordion section is one Standard. Each nested sub-section is one Sub-standard. This is the only view in the app where evidence files visibly *live in folders organized by accreditation taxonomy*.

## Server contract — what every upload UI hits

A single backend handles all three frontends.

**Multipart upload** (`POST /api/submissions/:id/evidence/upload`):

```
multipart/form-data
  file:                 <binary>
  standardCode:         "11"
  specCode:             "a"
  title:                file.name
  description:          (optional)
  replaceExisting:      "true" | (omitted)
```

Handled by [server/src/controllers/evidenceController.ts](../../../../server/src/controllers/evidenceController.ts) (1044 lines). Flow:

1. Resolve `institutionId` — prefer the institution linked to the coordinator, fall back to `submission.institutionId` ([evidenceController.ts:249-250](../../../../server/src/controllers/evidenceController.ts)).
2. Look up existing current-version file with same originalName for this `(institutionId, standardCode, specCode)` ([evidenceController.ts:265-272](../../../../server/src/controllers/evidenceController.ts)).
3. If `replaceExisting` and an existing S3 file exists, delete the old S3 object ([evidenceController.ts:286-289](../../../../server/src/controllers/evidenceController.ts)).
4. Generate the new `versionId` (`{institutionId}-{n}`) and the S3 key via `s3Service.generateS3Key(instIdStr, newVersionId, file.originalname)` → `{institutionId}/{versionId}/{filename}` ([evidenceController.ts:313, s3Service.ts:69-76](../../../../server/src/services/s3Service.ts)).
5. `s3Service.uploadFile(key, buffer, mimeType)` ([evidenceController.ts:314](../../../../server/src/controllers/evidenceController.ts)).
6. Persist `SupportingEvidence` row with `storageType: 's3'`, `s3Key`, `s3Bucket`, `versionNumber`, `isCurrentVersion: true`, plus `previousVersionId` linkage and `replacedById` set on the prior row.

**URL evidence** (`POST /api/submissions/:id/evidence/url`):

```
JSON body
  url, title, description, standardCode, specCode
```

Persists a `SupportingEvidence` with `evidenceType: 'url'`, no `file`, with `url: { href, title, description }`.

**Other endpoints** (called from the UIs above):

- `GET /api/submissions/:id/evidence?evidenceType=&standardCode=&specCode=` — filtered list.
- `GET /api/submissions/:id/evidence/stats` — aggregate counts (consumed only by EvidenceManager).
- `GET /api/submissions/:id/evidence/:eid/download` — streams from S3 (when `storageType === 's3'`) or returns base64 bytes (legacy).
- `POST /api/submissions/:id/evidence/:eid/link` — patches `standardCode + specCode` to re-bucket an existing record.
- `DELETE /api/submissions/:id/evidence/:eid` — soft delete (`isDeleted: true`).

## Data model recap

[server/src/models/SupportingEvidence.ts](../../../../server/src/models/SupportingEvidence.ts) — every uploaded evidence file (or URL) is one row.

Fields the UIs care about:

- `institutionId, submissionId, uploadedBy` (access control — required, indexed).
- `standardCode?, specCode?` (the "folder" key — optional in the schema; unlinked rows show as "Unlinked" / "Unassigned").
- `evidenceType: 'document' | 'url' | 'image'`.
- `file: { filename, originalName, mimeType, size, s3Key?, s3Bucket?, storageType: 'base64' | 's3', uploadedAt, uploadedBy }`.
- `url: { href, title, description?, addedAt, addedBy, lastVerified?, isAccessible? }`.
- `imageMetadata: { sourceType, dateOnDocument?, description, ocrText? }` — shape exists, not yet populated by upload flow.
- `versionNumber, isCurrentVersion, previousVersionId, replacedById` (versioning chain).
- `description?, metadata: { description?, notes? }` (two description fields — see "Quirks" below).
- `linkedNarratives: string[], tags: string[]`.
- `isDeleted, deletedAt, deletedBy`.

Indexes ([SupportingEvidence.ts:228-259](../../../../server/src/models/SupportingEvidence.ts)):

- `idx_access_control` — `(institutionId, submissionId, isDeleted)`.
- `idx_submission_standard` — `(submissionId, standardCode, specCode, isDeleted)` — the "list files for this folder" query.
- `idx_uploader`, `idx_evidence_type`, `idx_tags`.
- `idx_file_versioning` — `(institutionId, standardCode, specCode, file.originalName, isCurrentVersion, isDeleted)` — the "is there an existing same-named file" query.

## Quirks worth knowing before changing this code

1. **Two description fields.** `description` (top-level) and `metadata.description` (nested). UI uses [`description || metadata?.description`](../../../../client/src/features/selfStudy/Editor/EvidencePanel.tsx) at [EvidencePanel.tsx:215-217](../../../../client/src/features/selfStudy/Editor/EvidencePanel.tsx). Pick one; the dual-field state is dead-tech-debt.
2. **Hardcoded standards in EvidenceManager's link dropdown.** [EvidenceViewer.tsx:283-304](../../../../client/src/features/selfStudy/EvidenceManager/EvidenceViewer.tsx) generates `Array.from({length: 21})` and `['a'..'h']` instead of fetching from `/api/standards`. Won't auto-update if the standards definitions change. **FileLibrary does this correctly.**
3. **No silent error toast on delete.** `deleteMutation` in `EvidenceManager` doesn't surface failures (smell flagged in [[frontend-architecture]]).
4. **The `imageMetadata.ocrText` field is dead.** The upload flow never populates it. Would need OCR pre-processing.
5. **`linkedNarratives: string[]` is dead.** The actual narrative-linkage is via `(standardCode, specCode)`.
6. **No file-content evaluation today.** When a coordinator triggers Save and Validate, the n8n payload includes only `{filename, type, size}` of each evidence file — never the bytes. See [[narrative-storage]] / [[evidence-document-review-pipeline]].
7. **`unassigned` bucket** ([FileLibrary.tsx:117-118](../../../../client/src/features/selfStudy/FileLibrary/FileLibrary.tsx)). Files without `standardCode` are grouped under literal string `"unassigned"` → `"general"`. The UI renders Standards 1–21 accordions but does NOT render an "Unassigned" accordion anywhere — so unassigned files are *invisible* in FileLibrary. They only show in EvidenceManager's "Unlinked" filter.
8. **50MB cap is enforced client-side only** in `EvidenceManager/FileUpload.tsx:48`. `EvidencePanel` and `FileLibrary` rely on the server-side Multer limit (also 50MB, set in [server/src/index.ts:55-56](../../../../server/src/index.ts)) — the user only learns the file is too big after the upload completes uploading bytes.

## What changes are required to evaluate these files with AI

This is a re-statement of [[evidence-document-review-pipeline]] keyed to the UI surfaces above so future work knows where to wire it in.

### Server (most of the work)
1. **Fix `isS3Configured()`** ([[storage-layer]]) so newly-uploaded files actually live in S3 (today many fall back to base64 silently).
2. **New endpoint** `POST /api/submissions/:id/standards/:code/specs/:spec/review-evidence`:
   - Pull `SupportingEvidence` rows for that `(submissionId, standardCode, specCode)` where `isCurrentVersion: true, isDeleted: false`.
   - Mint short-TTL presigned S3 URLs (≤5 min — see [[security-audit-2026-05-10|M4]]).
   - POST to a new `cshse-evidence-document-review` n8n workflow with narrative + standard/spec text + per-file presigned URLs.
3. **New callback** `POST /api/webhooks/evidence-review/callback` — **HMAC-signed** (do NOT replicate the C2 unauth issue).
4. **New `EvidenceReviewResult` model** keyed by `(submissionId, standardCode, specCode, evidenceId, evidenceVersionId)` so re-validation only re-evaluates files that changed.

### Client (per-surface)
1. **EvidencePanel** ([EvidencePanel.tsx](../../../../client/src/features/selfStudy/Editor/EvidencePanel.tsx)) — per-row pill: `pending` / `✓ supports` / `◐ partial` / `✗ not relevant`. Click → modal showing the AI's quoted passage and rationale. This is the most-trafficked surface; do this first.
2. **FileLibrary** ([FileLibrary.tsx](../../../../client/src/features/selfStudy/FileLibrary/FileLibrary.tsx)) — per-row pill in the Sub-standard accordion sections (the "EC3 folder" view). Roll up an aggregate pill on the Standard accordion header (e.g., "5 ✓ / 1 ◐ / 2 ✗"). Show an "Unassigned" accordion so unlinked files become visible — they can't be evaluated without a Standard/Spec assignment.
3. **EvidenceManager** ([EvidenceManager.tsx](../../../../client/src/features/selfStudy/EvidenceManager/EvidenceManager.tsx)) — same pills in the row, plus the right-pane preview gets an "AI Review" tab. Long-term, consider deprecating EvidenceManager in favor of FileLibrary (the redundancy is real).
4. **NarrativeEditor validation modal** ([NarrativeEditor.tsx](../../../../client/src/features/selfStudy/Editor/NarrativeEditor.tsx)) — extend with an "Evidence" tab listing per-file findings + gap analysis alongside today's narrative-only feedback.

### N8N
- New workflow `cshse-evidence-document-review`. For each file: HTTP GET presigned URL → MIME-detect → text-extract (pdf-parse / mammoth / pptx-parser / Tesseract OCR) → chunk if >32K tokens → per-chunk relevance pass (gpt-4o-mini) → aggregate → final structured JSON judgment → POST callback. Stream a `file_result` per file (mirror Document Matcher pattern) so the UI can render progressively.

## Related

- [[evidence-document-review-pipeline]] — the AI side of this story
- [[narrative-storage]] — the narrative side; the two pair up at validation time
- [[storage-layer]] — S3 + GridFS + Mongo split, isS3Configured bug
- [[frontend-architecture]] — wider client architecture
- [[client-features-deep-2026-05-10]] — every client component documented in detail
- [[module-catalog]] — full server + client module list
- [[security-audit-2026-05-10]] — XSS via `dangerouslySetInnerHTML` in import view, presigned URL TTL, callback HMAC
