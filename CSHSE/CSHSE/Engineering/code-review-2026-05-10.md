---
name: Code Review 2026-05-10
description: Comprehensive code review pass — verifies the existing concept pages against current code, catalogs every module, traces the import → narrative → AI-evaluation flow, and identifies what must change to evaluate uploaded evidence files (the so-called "EC3 folders") alongside narratives.
type: review
audit_date: 2026-05-10
auditor: claude
tags: [review, comprehensive, evidence, narrative, modules]
last_reviewed: 2026-05-10
---

# Code Review 2026-05-10 — Comprehensive Pass

Triggered by user request: *"review all code in this system both client and backend; describe the functions; document the import file architecture; show how files are saved and indexed into standards and sub-standards; document how the narratives are stored and evaluated through AI; identify what needs to change to evaluate files stored in the EC3 folders."*

This review verifies the prior concept pages, fills two gaps (a per-module catalog and a focused narrative-storage page), and clarifies the "EC3 folders" question.

## What was already documented

These pages are accurate against the code as of 2026-05-10 and were spot-checked during this pass:

- [[overview]], [[system-architecture]], [[storage-layer]], [[import-pipeline]], [[n8n-integration]], [[frontend-architecture]], [[product-requirements]], [[evidence-document-review-pipeline]], [[security-audit-2026-05-10]], [[incomplete-features-2026-05-10]], [[documentation-gaps-2026-05-10]], [[sprint-plan-2026-05-10]].

No drift requiring concept-page edits was found in the architecture / import / storage / n8n pages. The `evidence-document-review-pipeline` page got a clarifying note about the "EC3 folders" terminology and a tighter line citation for the metadata-only evidence query.

## What this pass added

- [[narrative-storage]] — focused concept page on the doubly-nested `Map<standardCode, Map<specCode, INarrativeContent>>` shape, the Mongoose-8 Map persistence trap, the edit-lifecycle, and how `validationService` packages a Spec for AI evaluation.
- [[module-catalog]] — every server route ↔ controller ↔ service ↔ model and every client page ↔ feature ↔ component ↔ store ↔ hook, with one-line descriptions and file paths. Acts as the index for "where is X."

## Functions the system provides — synthesis

A short tour by user-visible feature, with the backing code paths. Each row points into [[module-catalog]] for line-cited detail.

### Account & access
- **Login / logout / change-password** — [server/src/controllers/userController.ts](../../../../server/src/controllers/userController.ts), [client/src/pages/LoginPage.tsx](../../../../client/src/pages/LoginPage.tsx). JWT in localStorage. 30-day expiry.
- **Invite + accept** — [invitationController.ts](../../../../server/src/controllers/invitationController.ts), [AcceptInvitationPage.tsx](../../../../client/src/pages/AcceptInvitationPage.tsx). Single-use tokens.
- **Role gating** — server middleware ([middleware/auth.ts](../../../../server/src/middleware/auth.ts)) + client `authStore.canAccessAdminSettings()`.
- **Superuser impersonation** — `X-Impersonated-Role` header; persisted in `authStore` so it survives refresh. Brittle, untested. See [[security-audit-2026-05-10]].

### Self-study authoring (Program Coordinator)
- **Document import** — DOCX/PDF upload → manual visual tagging → extract → finish-tagging populates narratives. See [[import-pipeline]].
- **Per-Spec narrative editing** — TipTap auto-saved to `Submission.narratives.get(std).get(spec).content`. See [[narrative-storage]].
- **Per-Spec evidence upload** — `SupportingEvidence` records, S3-backed (when configured), versioned via `previousVersionId` / `replacedById`. See [[storage-layer]] and [[module-catalog]].
- **Curriculum matrix editing** — courses × Specs × I/T/K/S × L/M/H. [matrixController.ts](../../../../server/src/controllers/matrixController.ts), [CurriculumMatrixEditor.tsx](../../../../client/src/features/selfStudy/MatrixEditor/CurriculumMatrixEditor.tsx).
- **Save and Validate** — triggers n8n self-study-standard-validation; UI surfaces the LLM result inline. See [[narrative-storage]] / [[n8n-integration]].
- **Submit** — flips `Submission.status` and notifies (mostly stubbed emails — [[incomplete-features-2026-05-10]]).

### Review (Reader / Lead Reader)
- **Reader assessment per Spec** — Y/N/NA + comments. [reviewController.ts](../../../../server/src/controllers/reviewController.ts), comment thread feature folder.
- **Reader lock** — prevents coordinator edits during review. [readerLockController.ts](../../../../server/src/controllers/readerLockController.ts), [ReaderLockedBanner.tsx](../../../../client/src/features/comments/ReaderLockedBanner.tsx).
- **Lead-reader compilation** — aggregates multiple readers' Y/N/NA + comments + final determination. [leadReaderController.ts](../../../../server/src/controllers/leadReaderController.ts).
- **Change requests** — reader-initiated requests for coordinator revision. [changeRequestController.ts](../../../../server/src/controllers/changeRequestController.ts).

### Site visit
- Schedule + itinerary capture. Email notifications stubbed. [siteVisitController.ts](../../../../server/src/controllers/siteVisitController.ts).

### Reports
- PDF generation via [services/pdfGenerator.ts](../../../../server/src/services/pdfGenerator.ts).

### Admin
- Webhook settings (n8n endpoints + auth + headers + timeout per `settingType`).
- User / institution / API-key CRUD.
- Standards-source PDF upload + AI-load to Supabase pgvector ([specController.ts](../../../../server/src/controllers/specController.ts), [specLoaderController.ts](../../../../server/src/controllers/specLoaderController.ts), n8n `cshse-specification-loader-pdf`).
- Help-doc upload to RAG, dashboard pinned files, error-log viewer.

### Help chat
- Floating bubble in client gated by `GET /api/webhooks/help/status`. Chat proxied through `/api/webhooks/help/chat` to the n8n LangChain agent. Session isolation broken — see [[n8n-integration]].

## Import file architecture — verified end-to-end

The flow ([[import-pipeline]] is the durable doc; this is the current spot-check):

1. `POST /api/imports/upload` (Multer, 50MB request limit) creates `SelfStudyImport` in `pending`, returns 202, **fires `processDocumentForManualTagging()` without awaiting**. Confirmed at [importController.ts:232](../../../../server/src/controllers/importController.ts).
2. `documentParser` (Mammoth or pdf-parse) → HTML, with images extracted to GridFS via `storeImage()`. HTML written via `storeHtmlContentFromFile()` (streaming) to avoid OOM. State → `awaiting_selection`.
3. Coordinator opens [DocumentViewer.tsx](../../../../client/src/features/selfStudy/Editor/components/DocumentViewer.tsx), drag-selects, `SectionTagger` modal asks Standard + Spec.
4. `POST /api/imports/:id/extract-section` calls `gridFsService.insertHtmlMarker()` — table-aware row-boundary expansion + `TABLE_FRAG_START/END` comment wrappers. `removedHtml` captured into `SelfStudyImport.extractedSections[]`.
5. Resume reconstructs visual placeholders by scanning markers; falls back to a banner if markers absent.
6. `POST /api/imports/:id/finish-tagging` applies sections to `Submission.narratives` via the loop at [importController.ts:1502-1556](../../../../server/src/controllers/importController.ts). **Behavior on collision: append, not overwrite** ([line 1531-1533](../../../../server/src/controllers/importController.ts)). `markModified('narratives')` then `saveWithRetry()`.
7. Optional `processWithAI: true` is supposed to forward sections to the n8n Document Matcher. **Still a no-op** as of this pass ([importController.ts:3176](../../../../server/src/controllers/importController.ts)).

## How files are saved & indexed into Standards / Specs

### Narrative content (the prose half)
- **Where:** inside `Submission.narratives` — the doubly-nested `Map`. Indexed by `standardCode` (string `"1"`–`"21"`) → `specCode` (`"a"`–`"h"`).
- **Schema:** [server/src/models/Submission.ts:33-39](../../../../server/src/models/Submission.ts), [Submission.ts:218-225](../../../../server/src/models/Submission.ts).
- **Standards source-of-truth:** static array in [server/src/data/standards.ts](../../../../server/src/data/standards.ts). 21 standards, each with title/description/`part: 'I' | 'II'`/`specifications[]`.
- **Per-Standard rollup:** `Submission.standardsStatus: Map<standardCode, IStandardStatusInfo>` — completion %, latest validation status, timestamps.
- **Persistence trap:** `Map.set` + `save` requires `markModified('narratives')`, OR you must use atomic `$set` with dotted path keys. See [[narrative-storage]] for the full rule.

### Evidence files (the documents half)
- **Storage:** S3 (when configured) or base64-in-Mongo (legacy / fallback). Decided per-record by `file.storageType: 's3' | 'base64'` ([SupportingEvidence.ts:106-120](../../../../server/src/models/SupportingEvidence.ts)).
- **S3 key convention:** `{institutionId}/{versionId}/{filename}` ([s3Service.ts:69-76](../../../../server/src/services/s3Service.ts)). `versionId` is `{institutionId}-{versionNumber}`.
- **Mongo indexes for retrieval** ([SupportingEvidence.ts:228-259](../../../../server/src/models/SupportingEvidence.ts)):
  - `idx_access_control` — `(institutionId, submissionId, isDeleted)` — every list/lookup hits this.
  - `idx_submission_standard` — `(submissionId, standardCode, specCode, isDeleted)` — the per-Spec evidence list.
  - `idx_uploader`, `idx_evidence_type`, `idx_tags`, `idx_file_versioning`.
- **Versioning:** new uploads bump `versionNumber`, set `isCurrentVersion: true` on the new doc, point `previousVersionId` back, and set `replacedById` on the old one. The old S3 file is deleted ([evidenceController.ts:286-289](../../../../server/src/controllers/evidenceController.ts)).
- **Soft delete:** `isDeleted: true` + `deletedAt` + `deletedBy`. Indexes include `isDeleted` so soft-deleted rows are filtered out cheaply.

### "EC3 folders" — what the user is referring to

I searched the entire codebase, both standards PDFs (Associate, Baccalaureate, Master's), the Member Handbook, and every n8n workflow JSON. **"EC3" appears nowhere** (only an unrelated SHA in `package-lock.json`).

Best interpretation: the user has an external organizing convention for evidence — probably "Evidence Class 3" or "Educational Component 3" — that the system today does not represent explicitly. What the system *does* have is per-Spec evidence grouping via `SupportingEvidence.standardCode + .specCode`. If "EC3" is a real CSHSE construct (e.g. an evidence-class layer above the Spec), the model needs:

- A new field, say `evidenceClass: string` on `SupportingEvidence`, indexed and exposed in the EvidenceManager UI.
- A migration that classifies existing rows (likely by parsing the spec/standard mapping).
- An admin-configurable taxonomy for valid `evidenceClass` values.

But the most likely intent is: *"please make the AI actually read the files I'm uploading per Spec, not just the narrative."* That is exactly the work documented in [[evidence-document-review-pipeline]] — see "What must change" below.

## How narratives are evaluated through AI

Verified against [server/src/services/validationService.ts](../../../../server/src/services/validationService.ts):

1. UI invokes `POST /api/submissions/:id/validation` (or per-Spec endpoint) on **explicit "Save and Validate"** — never on auto-save (cost discipline).
2. `triggerValidation()` ([line 47-273](../../../../server/src/services/validationService.ts)):
   - Looks up most-recent `ValidationResult` for `(submissionId, standardCode, specCode)`, increments `attemptNumber`, links via `previousValidationId`.
   - Creates a new `ValidationResult` in `pending`.
   - Pulls the narrative from `submission.narratives.get(std).get(spec).content`.
   - Pulls Standard + Spec text from the static [data/standards.ts](../../../../server/src/data/standards.ts).
   - Pulls evidence metadata (filename + type only — **not contents**) and URL evidence by `(submissionId, standardCode, specCode, isDeleted: false)`.
   - Posts a single payload to the configured `WebhookSettings(settingType='n8n_validation').webhookUrl` with up to 30s timeout. **No retry** despite Readme claims.
3. n8n (`cshse-self-study-standard-validation`) scores 0–100 with GPT-4o-mini. If `evidenceUrls` are present, optionally fetches each (15s timeout, truncates body to 10K chars) and concats into the prompt.
4. n8n posts back to **public, unauthenticated** `POST /api/webhooks/n8n/callback`.
5. `processCallback()` finds the pending `ValidationResult` by `n8nExecutionId`; falls back to `(submissionId, standardCode, specCode, status: 'pending')` — **the fallback is the C2 attack vector** ([[security-audit-2026-05-10]]).
6. Sets `validationStatus` on `Submission.standardsStatus.{std}_{spec}` via atomic `$set`, then re-fetches and calls `recalculateProgress()`.

## What must change to evaluate uploaded evidence files (the "EC3" question, answered as a code task)

Today: validation never opens an uploaded PDF/DOCX. Only filename + type are sent. URL evidence is best-effort fetched & 10K-truncated; failed fetches silently dropped.

Required changes — sequenced. The full design lives in [[evidence-document-review-pipeline]]; this is the spot-check from this pass.

### Server
- **New trigger endpoint** `POST /api/submissions/:id/standards/:code/specs/:spec/review-evidence` that:
  - Pulls `SupportingEvidence` records for the Spec, filtered to `isCurrentVersion: true, isDeleted: false`.
  - For each `file.storageType === 's3'` record, mints a short-TTL presigned URL (≤5 min — see [[security-audit-2026-05-10|M4]]).
  - For each `file.storageType === 'base64'` record (legacy), inlines the bytes (rarer path, accept the size cost).
  - Packages with the existing narrative + Standard + Spec + URL evidence and POSTs to a new n8n workflow `cshse-evidence-document-review`.
- **New callback endpoint** `POST /api/webhooks/evidence-review/callback` — **must be HMAC-signed** (do NOT replicate the C2 finding). Updates a new `EvidenceReviewResult` model.
- **New `EvidenceReviewResult` model** with `(submissionId, standardCode, specCode)` index and an `(evidenceId, evidenceVersionId)` index for cache lookups. Fields: `relevance: 'supports' | 'partial' | 'not_relevant'`, `quotedPassage`, `confidence`, `reviewedAt`.
- **Update `validationService`** to surface the latest evidence-review summaries alongside narrative scoring.
- **Fix prerequisite:** `isS3Configured()` not exported from [s3Service.ts](../../../../server/src/services/s3Service.ts) ([[storage-layer]]) — without this, evidence is forced to base64-in-Mongo and presigned URLs are impossible.
- **Fix prerequisite:** harden `callWebhook()` with retry + timeout ([[incomplete-features-2026-05-10]]) so the new workflow doesn't inherit the same single-shot fragility.

### n8n
- **New workflow** `cshse-evidence-document-review`. For each evidence file in payload: HTTP GET presigned URL → MIME-detect → text-extract (pdf-parse / mammoth / pptx-parser / Tesseract OCR for images) → chunk if >32K tokens → per-chunk relevance pass (gpt-4o-mini) → aggregate → final structured JSON judgment → POST callback. Stream a `file_result` callback per file so the UI can render progressively (mirror the Document Matcher streaming pattern).

### Client
- **EvidenceManager** ([client/src/features/selfStudy/EvidenceManager/EvidenceManager.tsx](../../../../client/src/features/selfStudy/EvidenceManager/EvidenceManager.tsx)) — per-file row gains a status pill (✓ supports / ◐ partial / ✗ not relevant / pending) clickable to a panel showing the AI's quoted passage and rationale.
- **NarrativeEditor** validation modal ([client/src/features/selfStudy/Editor/NarrativeEditor.tsx](../../../../client/src/features/selfStudy/Editor/NarrativeEditor.tsx)) — extend with an "Evidence" tab listing per-file findings + gap analysis alongside today's narrative-only feedback.
- **Reviewer workspace** — surface the same evidence-review pills so readers can see what the AI thought before they form their own opinion.

### Cost / safety
- Per-Spec, per-revalidation: cost scales linearly with evidence count. Cache by `(evidenceId, evidenceVersionId, standardCode, specCode)` so re-running validation only re-evaluates files that changed.
- Trigger only on explicit "Save and Validate" + on submission. **Never on auto-save** — that's the obvious money pit.
- Untrusted content: evidence is uploaded by the people being assessed. Wrap file content in delimiters and instruct the LLM to treat anything inside as data, never instructions ([[security-audit-2026-05-10|M8]]).
- Confidentiality: evidence content goes to OpenAI. Surface this in admin UI with an opt-out per institution; if disabled, fall back to manual-review-only.

## Module-by-module functional summary

For the full per-module roster, see [[module-catalog]]. Headlines:

- **Server controllers** — 22 files, ~12 700 lines. The largest by far is [importController.ts](../../../../server/src/controllers/importController.ts) (3198 LOC) — it carries the import state machine, marker insert/restore wiring, and finish-tagging. [evidenceController.ts](../../../../server/src/controllers/evidenceController.ts) (1044 LOC) is the second-heaviest and the one that smells most: it knows about both S3 and base64 storage backends rather than going through a `StorageAdapter`.
- **Server services** — 14 files, ~8 700 lines. [documentParser.ts](../../../../server/src/services/documentParser.ts) (3042 LOC) and [gridFsService.ts](../../../../server/src/services/gridFsService.ts) (1415 LOC) are the engine of the import pipeline. [validationService.ts](../../../../server/src/services/validationService.ts) (681 LOC) is the AI-evaluation surface.
- **Server models** — 22 schemas. The data-shape pages to read first: [Submission](../../../../server/src/models/Submission.ts) (narratives), [SupportingEvidence](../../../../server/src/models/SupportingEvidence.ts) (evidence), [SelfStudyImport](../../../../server/src/models/SelfStudyImport.ts) (import state), [ValidationResult](../../../../server/src/models/ValidationResult.ts) (AI result).
- **Client features** — `selfStudy/Editor/SelfStudyEditor.tsx` (3480 LOC) is the mega-component for the coordinator workspace; `NarrativeEditor.tsx` (1261 LOC) is its TipTap heart; `DocumentViewer.tsx` (857 LOC) is the manual import tagger.

## Test state at the time of this review

Server tests run; **3 of 23 failing** in `auth-routes.test.ts > PUT /api/auth/change-password` — all return 404 instead of expected 200/403/400. Investigation needed: probably a route mounting / path mismatch ([routes/auth.ts](../../../../server/src/routes/auth.ts) → controller). Tracked in [[incomplete-features-2026-05-10]] (TODO when next updated).

The webhook-callback regression guard ([server/tests/integration/webhook-callback-security.test.ts](../../../../server/tests/integration/webhook-callback-security.test.ts)) **passes today, asserting the C2 vulnerability still exists** — invert when the fix lands.

Client tests not run in this pass; two `.skip`-ped 401-interceptor tests remain (see [TESTING.md](../../../../TESTING.md)).

## Findings carried forward

No NEW security or correctness findings beyond those captured in [[security-audit-2026-05-10]] and [[incomplete-features-2026-05-10]]. The drift this pass found:

| Drift | Where | Action |
|-------|-------|--------|
| 3 change-password integration tests fail with 404 | [server/tests/integration/auth-routes.test.ts:110,132,142](../../../../server/tests/integration/auth-routes.test.ts) | Investigate route mounting; record fix in next [[incomplete-features-2026-05-10|incomplete-features review]]. |
| User asks about "EC3 folders"; term not in codebase | n/a | Documented in [[evidence-document-review-pipeline]]; ask user whether evidence-class taxonomy is required, or just AI-read-the-files. |

## Related

- [[narrative-storage]] — new this pass
- [[module-catalog]] — new this pass
- [[evidence-document-review-pipeline]] — updated this pass
- [[import-pipeline]] / [[storage-layer]] / [[n8n-integration]] / [[frontend-architecture]] / [[system-architecture]] — verified accurate
- [[security-audit-2026-05-10]] / [[incomplete-features-2026-05-10]] — open findings still authoritative
- [[sprint-plan-2026-05-10]] — sequencing for the changes above
