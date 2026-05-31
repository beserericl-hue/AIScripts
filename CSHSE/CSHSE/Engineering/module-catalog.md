---
name: Module Catalog
description: Every server route + controller + service + model + middleware, and every client page + feature folder + component + store + hook + service, with one-line descriptions and UI/backend cross-references.
type: concept
tags: [reference, modules, server, client, catalog]
last_reviewed: 2026-05-31
---

# Module Catalog

Quick lookup of every code module in the project. Pair with [[system-architecture]] for the layering view, [[import-pipeline]] / [[narrative-storage]] / [[evidence-document-review-pipeline]] for end-to-end flows.

Filename next to each entry is the path relative to repo root, with line counts indicating relative complexity.

> **2026-05-31 update.** The tables below through "Test infrastructure" are the **original 2026-05-10 inventory** and are still accurate for the modules they list. Sprints 4–9 added a large number of new modules (review/compilation, board decisions, site-visit checklist/itinerary, notifications, direct messages, joint ventures, audit trail, bug reports, the `cshse-ai` integration, SSO, the API v1 surface). Those are catalogued in the new **"Added since the 2026-05-10 baseline (Sprints 4–9)"** section near the bottom of this page, so the original tables read as a historical layer and the additions read as a clearly-dated delta. Current server totals: 32 models, 39 controllers, 21 services, 37 routes, 4 middleware.

## Server entry & infrastructure

| Module | Lines | Role |
|--------|-------|------|
| [server/src/index.ts](../../../../server/src/index.ts) | 204 | Express bootstrap, route mounting, healthcheck (`/health` always-200, `/ready` checks DB), SPA static serving from `/public`, global error handler. Skips `app.listen` + process error handlers under `NODE_ENV=test`. |
| [server/src/config/database.ts](../../../../server/src/config/database.ts) | — | Mongoose `connect()` with connection-pool tuning. |
| [server/src/middleware/auth.ts](../../../../server/src/middleware/auth.ts) | — | JWT verification, role gating, superuser `X-Impersonated-Role` interpretation. |
| [server/src/middleware/errorHandler.ts](../../../../server/src/middleware/errorHandler.ts) | — | `globalErrorHandler` (sanitizes errors before responding) + `setupProcessErrorHandlers` (uncaught/unhandled). |
| [server/src/services/migrations.ts](../../../../server/src/services/migrations.ts) | 134 | Idempotent boot-time data migrations. **No leader election** — concurrent on multi-replica deploy. |
| [server/src/services/superuserInit.ts](../../../../server/src/services/superuserInit.ts) | 155 | Creates the seed superuser from `SUPERUSER_EMAIL` / `SUPERUSER_PASSWORD` env at boot if absent. |

## Server: route ↔ controller mapping

Each `routes/*.ts` is a thin Express router; the heavy lifting is in the matching controller. Order below mirrors `index.ts` mount order.

| Mount path | Router | Controller | What it does |
|------------|--------|------------|--------------|
| `/api/auth` | [routes/auth.ts](../../../../server/src/routes/auth.ts) | (handlers inline / `userController`) | Login, `/me`, change-password, logout. Public. |
| `/api/invitations` | [routes/invitations.ts](../../../../server/src/routes/invitations.ts) | [invitationController.ts](../../../../server/src/controllers/invitationController.ts) (402) | Send + accept invitation tokens. Token-based; partly public (accept). |
| `/api/standards` | [routes/standards.ts](../../../../server/src/routes/standards.ts) | (inline) | Returns the static `CSHSE_STANDARDS` array from [data/standards.ts](../../../../server/src/data/standards.ts). Public. |
| `/api/imports` | [routes/imports.ts](../../../../server/src/routes/imports.ts) | [importController.ts](../../../../server/src/controllers/importController.ts) (3198 — the biggest in the repo) | Document upload, manual section tagging, marker insert/restore, finish-tagging, cancel. See [[import-pipeline]]. |
| `/api/webhooks` | [routes/webhooks.ts](../../../../server/src/routes/webhooks.ts) | [webhookController.ts](../../../../server/src/controllers/webhookController.ts) (400), [helpChatController.ts](../../../../server/src/controllers/helpChatController.ts) (278), [documentMatcherController.ts](../../../../server/src/controllers/documentMatcherController.ts) (344), [specLoaderController.ts](../../../../server/src/controllers/specLoaderController.ts) (261) | **Four unauthenticated** n8n callback endpoints + the help-chat proxy. See [[n8n-integration]]. |
| `/api/reviews` | [routes/reviews.ts](../../../../server/src/routes/reviews.ts) | [reviewController.ts](../../../../server/src/controllers/reviewController.ts) (678) | Reader assessments per Spec — Y/N/NA, comments, flags. |
| `/api/lead-reviews` | [routes/leadReviews.ts](../../../../server/src/routes/leadReviews.ts) | [leadReaderController.ts](../../../../server/src/controllers/leadReaderController.ts) (698) | Lead-reader compilation + final-determination capture. |
| `/api/reports` | [routes/reports.ts](../../../../server/src/routes/reports.ts) | [reportController.ts](../../../../server/src/controllers/reportController.ts) (251) | Generate PDF / aggregated reports. Calls `pdfGenerator` service. |
| `/api` (matrix) | [routes/matrix.ts](../../../../server/src/routes/matrix.ts) | [matrixController.ts](../../../../server/src/controllers/matrixController.ts) (634) | Curriculum matrix CRUD — courses × Specs × I/T/K/S × L/M/H. |
| `/api` (evidence) | [routes/evidence.ts](../../../../server/src/routes/evidence.ts) | [evidenceController.ts](../../../../server/src/controllers/evidenceController.ts) (1044) | Upload / download / delete / version evidence files. Routes between S3 and base64-in-Mongo per `file.storageType`. **Smell:** controller knows about both backends rather than going through a `StorageAdapter` (see [[storage-layer]]). |
| `/api/submissions` | [routes/submissions.ts](../../../../server/src/routes/submissions.ts) | [submissionController.ts](../../../../server/src/controllers/submissionController.ts) (777) | Create / list / read submissions, save narratives, trigger validation, status transitions. |
| `/api/admin` | [routes/admin.ts](../../../../server/src/routes/admin.ts) | [adminController.ts](../../../../server/src/controllers/adminController.ts) (460) | Webhook settings CRUD, user admin, system info. |
| `/api` (comments) | [routes/comments.ts](../../../../server/src/routes/comments.ts) | [commentController.ts](../../../../server/src/controllers/commentController.ts) (447) | Reader comments anchored to narrative spans. |
| `/api` (readerLock) | [routes/readerLock.ts](../../../../server/src/routes/readerLock.ts) | [readerLockController.ts](../../../../server/src/controllers/readerLockController.ts) (299) | Lock/unlock submissions during review, send-back-for-correction. |
| `/api/users` | [routes/users.ts](../../../../server/src/routes/users.ts) | [userController.ts](../../../../server/src/controllers/userController.ts) (372) | User CRUD; admin-only for most operations. |
| `/api/institutions` | [routes/institutions.ts](../../../../server/src/routes/institutions.ts) | [institutionController.ts](../../../../server/src/controllers/institutionController.ts) (313) | Institution CRUD + program-level config. |
| `/api/admin/api-keys` | [routes/apiKeys.ts](../../../../server/src/routes/apiKeys.ts) | [apiKeyController.ts](../../../../server/src/controllers/apiKeyController.ts) (306) | Programmatic API key management for n8n callbacks. |
| `/api/site-visits` | [routes/siteVisits.ts](../../../../server/src/routes/siteVisits.ts) | [siteVisitController.ts](../../../../server/src/controllers/siteVisitController.ts) (355) | Schedule + itinerary capture. Email notifications stubbed (see [[incomplete-features-2026-05-10]]). |
| `/api/change-requests` | [routes/changeRequests.ts](../../../../server/src/routes/changeRequests.ts) | [changeRequestController.ts](../../../../server/src/controllers/changeRequestController.ts) (424) | Reader → coordinator change requests on specific narratives/Specs. |
| `/api/admin/error-logs` | [routes/errorLogs.ts](../../../../server/src/routes/errorLogs.ts) | (inline + `errorLogger` service) | View `ErrorLog` collection. **No retention/TTL** — grows unbounded ([[system-architecture]]). |
| `/api/specs` | [routes/specs.ts](../../../../server/src/routes/specs.ts) | [specController.ts](../../../../server/src/controllers/specController.ts) (185) | Upload standards-source PDFs for AI vector loading. **Different from CSHSE Specifications** — see [[narrative-storage]] / [[glossary]]. |
| `/api/files` | [routes/files.ts](../../../../server/src/routes/files.ts) | [fileController.ts](../../../../server/src/controllers/fileController.ts) (409) | Generic file upload (used for spec PDFs, dashboard files, help docs). |
| `/api` (scores) | [routes/scores.ts](../../../../server/src/routes/scores.ts) | [scoreController.ts](../../../../server/src/controllers/scoreController.ts) (190) | Per-Spec scoring snapshots aggregated from reviews. |

## Server: services

| Service | Lines | Role |
|---------|-------|------|
| [services/documentParser.ts](../../../../server/src/services/documentParser.ts) | 3042 | DOCX (Mammoth) + PDF (pdf-parse) → HTML, image extraction to GridFS, structural normalization. The single largest service in the repo. |
| [services/gridFsService.ts](../../../../server/src/services/gridFsService.ts) | 1415 | HTML & image storage in GridFS, marker insert/restore, table-aware row handling, `cleanupOrphanedFiles`. See [[storage-layer]]. |
| [services/pdfGenerator.ts](../../../../server/src/services/pdfGenerator.ts) | 775 | PDF report generation (final reports). |
| [services/validationService.ts](../../../../server/src/services/validationService.ts) | 681 | Builds + sends n8n validation payload, processes callbacks, drives `standardsStatus` updates. See [[narrative-storage]]. |
| [services/matrixHtmlParser.ts](../../../../server/src/services/matrixHtmlParser.ts) | 637 | Parses curriculum-matrix HTML out of imported docs into structured cell rows. |
| [services/errorLogger.ts](../../../../server/src/services/errorLogger.ts) | 513 | `logError()` writes `ErrorLog` documents — used by global error handler. |
| [services/sectionMapper.ts](../../../../server/src/services/sectionMapper.ts) | 445 | Heuristic mapping of imported sections → Standard/Spec codes (helper for [[import-pipeline]]). |
| [services/emailService.ts](../../../../server/src/services/emailService.ts) | 436 | Nodemailer wrapper. **Most call sites are stubbed** ([[incomplete-features-2026-05-10]]). |
| [services/tempFileService.ts](../../../../server/src/services/tempFileService.ts) | 259 | Temp-file lifecycle for streaming large uploads. |
| [services/s3Service.ts](../../../../server/src/services/s3Service.ts) | 201 | Presigned URLs, upload/download, key-name generator: `{institutionId}/{versionId}/{filename}` ([s3Service.ts:69-76](../../../../server/src/services/s3Service.ts)). **Bug:** `isS3Configured()` not exported but called from `evidenceController` ([[storage-layer]]). |
| [services/superuserInit.ts](../../../../server/src/services/superuserInit.ts) | 155 | Boot-time superuser creation. |
| [services/migrations.ts](../../../../server/src/services/migrations.ts) | 134 | Idempotent migration runner. |
| [services/index.ts](../../../../server/src/services/index.ts) | 22 | Re-exports. |

## Server: models (Mongoose schemas)

| Model | What it represents | Notable |
|-------|---------------------|---------|
| [User](../../../../server/src/models/User.ts) | Account with role + optional `superuser` flag | Bcrypt round-trip in `pre('save')`, prefix-aware to avoid double-hash. |
| [Institution](../../../../server/src/models/Institution.ts) | A college / university | One `Institution` may have multiple submissions across cycles. |
| [Submission](../../../../server/src/models/Submission.ts) | A single Self-Study cycle for an institution + program level | Holds `narratives: Map<std, Map<spec, INarrativeContent>>`, `standardsStatus`, lock state, decision. See [[narrative-storage]]. |
| [SelfStudyImport](../../../../server/src/models/SelfStudyImport.ts) | One uploaded legacy DOCX/PDF in tagging | State machine `pending → processing → awaiting_selection → completed`. See [[import-pipeline]]. |
| [SupportingEvidence](../../../../server/src/models/SupportingEvidence.ts) | One evidence file or URL linked to a Spec | Stores `storageType: 's3' | 'base64'`, version chain via `previousVersionId` / `replacedById`. Indexed by `(institutionId, submissionId, isDeleted)` and `(submissionId, standardCode, specCode, isDeleted)`. |
| [File](../../../../server/src/models/File.ts) | Generic file record (spec PDFs, dashboard files, help docs) | Distinct from `SupportingEvidence` — that one is per-Spec; this is generic. |
| [Spec](../../../../server/src/models/Spec.ts) | An uploaded **standards-source PDF** ready for n8n vector ingest | `aiLoadingStatus: 'not_loaded' | 'loading' | 'loaded' | 'error'`. Confusing name — this is NOT a Specification within a Standard. See [[glossary]]. |
| [CurriculumMatrix](../../../../server/src/models/CurriculumMatrix.ts) | Courses × Specs × I/T/K/S × L/M/H grid | Editable through `MatrixEditor` UI. |
| [Review](../../../../server/src/models/Review.ts) | One reader's per-Spec assessment | Y/N/NA + comments + flags. |
| [LeadReaderCompilation](../../../../server/src/models/LeadReaderCompilation.ts) | The aggregated multi-reader compilation | Built by `leadReaderController`. |
| [ValidationResult](../../../../server/src/models/ValidationResult.ts) | One n8n-validation attempt for a `(submission, std, spec)` | Chain of attempts via `previousValidationId`, latest-first by `validatedAt`. |
| [Score](../../../../server/src/models/Score.ts) | Per-Spec aggregate score snapshot from reviews | |
| [Comment](../../../../server/src/models/Comment.ts) | Inline comment anchored to narrative text | Used by `CommentSidebar`. |
| [ChangeRequest](../../../../server/src/models/ChangeRequest.ts) | Reader → coordinator request to revise a section | |
| [Assignment](../../../../server/src/models/Assignment.ts) | Reader → submission assignment | |
| [SiteVisit](../../../../server/src/models/SiteVisit.ts) | Site-visit schedule + itinerary | Email notifications stubbed. |
| [Invitation](../../../../server/src/models/Invitation.ts) | Single-use invitation token for new users | |
| [APIKey](../../../../server/src/models/APIKey.ts) | Programmatic API key (e.g. for n8n callbacks) | |
| [WebhookSettings](../../../../server/src/models/WebhookSettings.ts) | Per-`settingType` webhook config (URL, auth, headers, timeout) | Read by `validationService.callWebhook`. |
| [HelpDocument](../../../../server/src/models/HelpDocument.ts) | Member Handbook / Readme docs ingested into the help-chat RAG | Status tracked through n8n callback. |
| [ErrorLog](../../../../server/src/models/ErrorLog.ts) | Captured errors from `globalErrorHandler` | **No TTL.** |

## Client entry

| Module | Role |
|--------|------|
| [client/src/main.tsx](../../../../client/src/main.tsx) | Vite entry — renders `App` into `#root`. |
| [client/src/App.tsx](../../../../client/src/App.tsx) | React Router routes, `ProtectedRoute`, superuser → `/impersonate` redirect. |
| [client/src/vite-env.d.ts](../../../../client/src/vite-env.d.ts) | Vite ambient types. |

## Client: pages

| Page | Route | Backed by |
|------|-------|-----------|
| [LoginPage.tsx](../../../../client/src/pages/LoginPage.tsx) | `/login` | `POST /api/auth/login` |
| [AcceptInvitationPage.tsx](../../../../client/src/pages/AcceptInvitationPage.tsx) | `/accept-invitation/:token` | `POST /api/invitations/accept` |
| [ImpersonationSelector.tsx](../../../../client/src/pages/ImpersonationSelector.tsx) | `/impersonate` | superuser-only role-picker that sets `X-Impersonated-Role` for subsequent requests |
| [DashboardPage.tsx](../../../../client/src/pages/DashboardPage.tsx) | `/` | `Dashboard` feature; per-role landing |
| [SelfStudyPage.tsx](../../../../client/src/pages/SelfStudyPage.tsx) | `/submission/:id/...` | `SelfStudyEditor` (3480 lines) — the main coordinator workspace |
| [AdminPage.tsx](../../../../client/src/pages/AdminPage.tsx) | `/admin/...` | Settings + WebhookSettings features |

## Client: features (feature-scoped folders under `client/src/features/`)

### `selfStudy/Editor/` — narrative editing + import tagging

| File | Lines | Role |
|------|-------|------|
| [SelfStudyEditor.tsx](../../../../client/src/features/selfStudy/Editor/SelfStudyEditor.tsx) | 3480 | The mega-component for the coordinator workspace. Wires together standards nav + narrative editor + evidence panel + validation modal. Heaviest single file in the client. |
| [NarrativeEditor.tsx](../../../../client/src/features/selfStudy/Editor/NarrativeEditor.tsx) | 1261 | TipTap editor instance, toolbar, paste handlers, validation modal, comment-highlight. See [[frontend-architecture]]. |
| [NarrativeEditorWithComments.tsx](../../../../client/src/features/selfStudy/Editor/NarrativeEditorWithComments.tsx) | 389 | NarrativeEditor + sidebar comment overlay for the reviewer view. |
| [EvidencePanel.tsx](../../../../client/src/features/selfStudy/Editor/EvidencePanel.tsx) | 472 | Per-Spec evidence list inline in editor. |
| [StandardsNavigation.tsx](../../../../client/src/features/selfStudy/Editor/StandardsNavigation.tsx) | 268 | Left-rail tree of standards 1–21 with completion / validation pills. |
| [components/DocumentViewer.tsx](../../../../client/src/features/selfStudy/Editor/components/DocumentViewer.tsx) | 857 | Renders raw imported HTML; visual section tagging UI. **`dangerouslySetInnerHTML`** — XSS risk ([[security-audit-2026-05-10]]). Table-aware row removal. See [[import-pipeline]]. |
| [components/SectionTagger.tsx](../../../../client/src/features/selfStudy/Editor/components/SectionTagger.tsx) | 415 | Modal that captures the current selection + lets user pick Standard + Spec for a section. |
| [components/SubExtractionViewerModal.tsx](../../../../client/src/features/selfStudy/Editor/components/SubExtractionViewerModal.tsx) | 495 | Preview of an extracted section's content before commit. |
| [components/TaggedSectionsList.tsx](../../../../client/src/features/selfStudy/Editor/components/TaggedSectionsList.tsx) | 494 | Sidebar list of all tagged sections; restore / delete actions. |

### `selfStudy/EvidenceManager/` — per-Spec evidence files

| File | Role |
|------|------|
| [EvidenceManager.tsx](../../../../client/src/features/selfStudy/EvidenceManager/EvidenceManager.tsx) | Split-panel list + preview, TanStack Query data layer. **Delete mutation has no error toast.** |
| [EvidenceViewer.tsx](../../../../client/src/features/selfStudy/EvidenceManager/EvidenceViewer.tsx) | PDF / image inline preview. |
| [FileUpload.tsx](../../../../client/src/features/selfStudy/EvidenceManager/FileUpload.tsx) | File picker + multipart POST to `/api/evidence/upload`. |
| [URLInput.tsx](../../../../client/src/features/selfStudy/EvidenceManager/URLInput.tsx) | URL evidence input + reachability check. |

### `selfStudy/FileLibrary/`

| File | Role |
|------|------|
| [FileLibrary.tsx](../../../../client/src/features/selfStudy/FileLibrary/FileLibrary.tsx) | Cross-Spec view of all evidence files for a submission. |
| [FilePreviewModal.tsx](../../../../client/src/features/selfStudy/FileLibrary/FilePreviewModal.tsx) | Preview for the library view. |

### `selfStudy/MatrixEditor/`

| File | Role |
|------|------|
| [CurriculumMatrixEditor.tsx](../../../../client/src/features/selfStudy/MatrixEditor/CurriculumMatrixEditor.tsx) | Spreadsheet-like editor for the courses × Specs × I/T/K/S × L/M/H grid. |

### `selfStudy/SubmissionWorkflow/`

| File | Role |
|------|------|
| [ProgressTracker.tsx](../../../../client/src/features/selfStudy/SubmissionWorkflow/ProgressTracker.tsx) | Visual progress meter from `Submission.selfStudyProgress`. |
| [FailedValidations.tsx](../../../../client/src/features/selfStudy/SubmissionWorkflow/FailedValidations.tsx) | List of `getFailedSections()` results, jump-to-Spec links. |

### `admin/Settings/`

| File | Role |
|------|------|
| [SettingsPage.tsx](../../../../client/src/features/admin/Settings/SettingsPage.tsx) | Tab container for all admin settings panels. |
| [UserManagement.tsx](../../../../client/src/features/admin/Settings/UserManagement.tsx) | Invite / list / suspend users. |
| [InstitutionManagement.tsx](../../../../client/src/features/admin/Settings/InstitutionManagement.tsx) | Institution CRUD. |
| [SpecManagement.tsx](../../../../client/src/features/admin/Settings/SpecManagement.tsx) | Upload + AI-load standards-source PDFs. Calls `/api/specs`. |
| [APIKeySettings.tsx](../../../../client/src/features/admin/Settings/APIKeySettings.tsx) | Programmatic API keys for n8n callbacks. |
| [DashboardFileUpload.tsx](../../../../client/src/features/admin/Settings/DashboardFileUpload.tsx) | Pinned dashboard files (handbooks, templates). |
| [HelpDocumentUpload.tsx](../../../../client/src/features/admin/Settings/HelpDocumentUpload.tsx) | Upload Member Handbook / Readme to n8n RAG. |
| [DataManagement.tsx](../../../../client/src/features/admin/Settings/DataManagement.tsx) | Bulk operations, exports. |

### `admin/WebhookSettings/`

| File | Role |
|------|------|
| [WebhookSettings.tsx](../../../../client/src/features/admin/WebhookSettings/WebhookSettings.tsx) | Configure each `settingType` (validation, doc-matcher, spec-loader, help-upload) — URL, auth, headers, timeout. |

### `comments/` — reader inline-comment system

| File | Role |
|------|------|
| [CommentSidebar.tsx](../../../../client/src/features/comments/CommentSidebar.tsx) | Right-rail thread list. |
| [CommentNavigation.tsx](../../../../client/src/features/comments/CommentNavigation.tsx) | Jump-to-comment in the editor. |
| [CommentableText.tsx](../../../../client/src/features/comments/CommentableText.tsx) | Wraps narrative text with comment-anchor handlers. |
| [ReaderLockedBanner.tsx](../../../../client/src/features/comments/ReaderLockedBanner.tsx) | Banner shown to coordinators while a reader holds the lock. |

### `siteVisits/`

| File | Role |
|------|------|
| [SiteVisitScheduler.tsx](../../../../client/src/features/siteVisits/SiteVisitScheduler.tsx) | Schedule + itinerary capture UI. |

### `changeRequests/`

| File | Role |
|------|------|
| [ChangeRequestForm.tsx](../../../../client/src/features/changeRequests/ChangeRequestForm.tsx) | Reader-side form to request a narrative change. |
| [ChangeRequestsList.tsx](../../../../client/src/features/changeRequests/ChangeRequestsList.tsx) | Coordinator-side inbox + status. |

### `dashboard/`

| File | Role |
|------|------|
| [Dashboard.tsx](../../../../client/src/features/dashboard/Dashboard.tsx) | Per-role landing page (PC: own submissions; Reader: assigned submissions; Lead: compilations; Admin: system overview). |

## Client: shared

| Module | Role |
|--------|------|
| [components/Layout.tsx](../../../../client/src/components/Layout.tsx) | Top nav + sidebar shell. |
| [components/HelpChat.tsx](../../../../client/src/components/HelpChat.tsx) | Floating chat bubble; gated by `GET /api/webhooks/help/status`. |
| [services/api.ts](../../../../client/src/services/api.ts) | Axios instance, `Bearer` interceptor, 401 → clear+redirect. |
| [store/authStore.ts](../../../../client/src/store/authStore.ts) | Zustand+persist; user, token, impersonation, role-derived flags. |
| [hooks/useAutoSave.ts](../../../../client/src/hooks/useAutoSave.ts) | 2-second debounced save hook used by `NarrativeEditor`. |
| [hooks/useValidationStatus.ts](../../../../client/src/hooks/useValidationStatus.ts) | Polls latest `ValidationResult` for the active Spec. |
| [lib/utils.ts](../../../../client/src/lib/utils.ts) | Tailwind `cn()` etc. |

## Test infrastructure (uncommitted as of 2026-05-10)

| Module | Role |
|--------|------|
| [server/tests/setup.ts](../../../../server/tests/setup.ts) | mongodb-memory-server + collection-wipe between tests. |
| [server/tests/helpers/factories.ts](../../../../server/tests/helpers/factories.ts) | `createUser()` (bcrypt-aware), `signTokenFor()` (test JWT). |
| [server/tests/unit/user-model.test.ts](../../../../server/tests/unit/user-model.test.ts) | bcrypt round-trip, no double-hashing, JSON serialization, email validation. |
| [server/tests/integration/auth-routes.test.ts](../../../../server/tests/integration/auth-routes.test.ts) | login + `/me` + change-password + logout. **3 change-password tests currently failing** (404) — see [[code-review-2026-05-10]]. |
| [server/tests/integration/webhook-callback-security.test.ts](../../../../server/tests/integration/webhook-callback-security.test.ts) | **Regression guard** for the unauth callback finding (C2). |
| [client/src/test/setup.ts](../../../../client/src/test/setup.ts) | jsdom + MSW boot. |
| [client/src/test/msw-server.ts](../../../../client/src/test/msw-server.ts) | MSW handlers for `/api/*`. |
| [client/src/store/authStore.test.ts](../../../../client/src/store/authStore.test.ts) | Role-gating logic, impersonation start/stop. |
| [client/src/services/api.test.ts](../../../../client/src/services/api.test.ts) | Bearer/impersonation interceptors. **Two 401-interceptor tests `.skip`-ped** — see [[testing-state-2026-05-10]] (TODO if/when made). |
| [client/src/components/HelpChat.test.tsx](../../../../client/src/components/HelpChat.test.tsx) | Status gating + happy/error round-trip. |
| [e2e/tests/health.spec.ts](../../../../e2e/tests/health.spec.ts) | `/health` 200 + `/api/auth/me` no-token 401. |
| [e2e/tests/login.spec.ts](../../../../e2e/tests/login.spec.ts) | Login renders + bad creds error; happy-path `.skip`-ped pending seed endpoint. |

## Added since the 2026-05-10 baseline (Sprints 4–9)

Modules introduced after the original inventory above. Grouped by layer. CR references point at the driving change request.

### New `cshse-ai` integration (Node side)

| Module | Role |
|--------|------|
| [services/cshseAiClient.ts](../../../../server/src/services/cshseAiClient.ts) | HMAC-SHA256 client to the FastAPI `cshse-ai` service — start import jobs, poll status, evidence extract/recommend/score, section evaluate. See [[system-architecture]], [[legacy-self-study-import]]. |
| [controllers/aiImportController.ts](../../../../server/src/controllers/aiImportController.ts) | Drives the AI import wizard: kicks off jobs, surfaces detection/coverage/gap results. |
| [controllers/aiReviewController.ts](../../../../server/src/controllers/aiReviewController.ts) | AI-assisted review actions on the reader side. |
| [controllers/importBatchController.ts](../../../../server/src/controllers/importBatchController.ts) | Batch import orchestration (`ImportBatch` model). |
| [services/batchAdvancer.ts](../../../../server/src/services/batchAdvancer.ts) | Advances import batches through their states. |
| [services/aiReviewMerge.ts](../../../../server/src/services/aiReviewMerge.ts) | Merges AI suggestions into reader review state. |

The Python service itself lives in `ai-service/` (FastAPI). Key packages: `app/splitter`, `app/matcher`, `app/matrix`, `app/coverage`, `app/gap_filling`, `app/evidence`, `app/section_eval`, `app/corrections`, `app/vector`, `app/embeddings`, `app/export`, `app/standards`. Entry `app/main.py` exposes `/ai/import/*`, `/ai/matrix/*`, `/ai/evidence/*`, `/ai/section/evaluate`, `/ai/corrections/ingest`, and `/health/*`.

### New server models

| Model | What it represents | CR |
|-------|---------------------|----|
| [AuditLogEntry](../../../../server/src/models/AuditLogEntry.ts) | Append-only audit event. Pre-save/update/delete hooks throw to enforce immutability. `AuditAction` union covers submit/lock/relay/compilation/checklist/itinerary/board/jv/account. | CR-006/050/009/012/013/053/019 |
| [LeadFinalScore](../../../../server/src/models/LeadFinalScore.ts) | Lead reader's final 0–3 score per Spec. | CR-009 |
| [Notification](../../../../server/src/models/Notification.ts) | In-app notification with `dedupeKey` idempotency. Types: `dm.new_message`, `board.cycle_reminder`, `board.reconsider_reminder`. | CR-010/053 |
| [DirectMessage](../../../../server/src/models/DirectMessage.ts) | Reader ↔ admin threaded DM. Participant roles `reader \| lead_reader \| admin`. | CR-010 |
| [SiteVisitChecklistItem](../../../../server/src/models/SiteVisitChecklistItem.ts) | Per-item site-visit verification entry. | CR-012 |
| [JointVenture](../../../../server/src/models/JointVenture.ts) | Multi-institution accreditation grouping; auto-archives below 2 members. | CR-019 |
| [BugReport](../../../../server/src/models/BugReport.ts) | In-app user bug report. | — |
| [DocumentVersion](../../../../server/src/models/DocumentVersion.ts) | Versioned document snapshot. | — |
| [ImportBatch](../../../../server/src/models/ImportBatch.ts) | A batch of AI import work. | — |
| [ImportCorrection](../../../../server/src/models/ImportCorrection.ts) | Captured user corrections fed back to `cshse-ai`. | — |
| [ProgramCourse](../../../../server/src/models/ProgramCourse.ts) | Course in the program's curriculum (matrix rows). | — |

### New server controllers

| Controller | Route(s) | What it does | CR |
|------------|----------|--------------|----|
| [compilationController.ts](../../../../server/src/controllers/compilationController.ts) | `/api` (compilation) | Lead-reader final 0–3 stamping, `compilation.final_*` audit. | CR-009 |
| [boardDecisionController.ts](../../../../server/src/controllers/boardDecisionController.ts) | `/api` (boardDecisions) | Record accept/table/deny/suspend/revoke + reconsider date. | CR-053 |
| [checklistController.ts](../../../../server/src/controllers/checklistController.ts) | `/api` (checklist) | Site-visit checklist verify/unverify + DOCX. | CR-012 |
| [itineraryController.ts](../../../../server/src/controllers/itineraryController.ts) | `/api` (itinerary) | Co-edited site-visit agenda. | CR-013 |
| [notificationController.ts](../../../../server/src/controllers/notificationController.ts) | `/api` (notifications) | List/mark-read in-app notifications. | CR-010/053 |
| [directMessageController.ts](../../../../server/src/controllers/directMessageController.ts) | `/api` (directMessages) | Reader ↔ admin DM threads. | CR-010 |
| [jointVentureController.ts](../../../../server/src/controllers/jointVentureController.ts) | `/api/joint-ventures` | JV CRUD + membership + archive. | CR-019 |
| [auditTrailController.ts](../../../../server/src/controllers/auditTrailController.ts) | `/api` (auditTrail) | Read-only audit-log query surface. | — |
| [bugReportController.ts](../../../../server/src/controllers/bugReportController.ts) | `/api` (bugReports) | Submit/list bug reports. | — |
| [evidenceRecommendationsController.ts](../../../../server/src/controllers/evidenceRecommendationsController.ts) | `/api` (evidenceRecommendations) | AI evidence recommendations for a Spec. | — |
| [programCoursesController.ts](../../../../server/src/controllers/programCoursesController.ts) | `/api/program-courses` | Curriculum course CRUD feeding the matrix. | — |
| [ssoController.ts](../../../../server/src/controllers/ssoController.ts) + [ssoTicketController.ts](../../../../server/src/controllers/ssoTicketController.ts) | `/sso` | MemberClick browser SSO ticket exchange. | — |
| Comment relay endpoints in [commentController.ts](../../../../server/src/controllers/commentController.ts) | `/api/comments/:id/relay`, `/escalate`, `/relay-queue` | Admin relay/escalate (`comment.relayed`). UI not yet mounted. | CR-023 |

### New server services & middleware

| Module | Role | CR |
|--------|------|----|
| [services/notificationService.ts](../../../../server/src/services/notificationService.ts) | Fan-out for DM + board-cycle reminders; honours `dedupeKey`. | CR-010/053 |
| [services/auditLog.ts](../../../../server/src/services/auditLog.ts) | Append-only audit writer. | — |
| [services/documentVersionService.ts](../../../../server/src/services/documentVersionService.ts) | Document version snapshots. | — |
| [services/siteVisitChecklistDocx.ts](../../../../server/src/services/siteVisitChecklistDocx.ts) | Renders the checklist to DOCX. | CR-012 |
| [services/suggestionsDocx.ts](../../../../server/src/services/suggestionsDocx.ts) | Consolidated suggestions DOCX export. | — |
| [services/commentSerializer.ts](../../../../server/src/services/commentSerializer.ts) | Serializes comment threads for relay/PC views. | CR-023 |
| [middleware/submissionLockout.ts](../../../../server/src/middleware/submissionLockout.ts) | `403 LOCKED` for PC writes on submitted/locked submissions. **Gap:** not yet on evidence routes — [[sprint-plan-2026-05-31]] §2 BUG-B. | CR-005 |
| [middleware/apiKeyRateLimit.ts](../../../../server/src/middleware/apiKeyRateLimit.ts) | Rate-limits the API-key callback surface. | — |

### New routes (mounts in `index.ts`)

`authV1` (`/api/v1/auth`), `openapi` (`/api/v1` — OpenAPI/Swagger surface), `programCourses` (`/api/program-courses`), `compilation`, `directMessages`, `checklist`, `evidenceRecommendations`, `itinerary`, `boardDecisions`, `bugReports`, `auditTrail`, `notifications` (all mounted at `/api`), `jointVentures` (`/api/joint-ventures`), `ssoBrowser` (`/sso`), and a `test` router mounted only under `NODE_ENV=test`.

### New client features

| Folder | Files | Role | CR |
|--------|-------|------|----|
| `reader/` | `ReaderDashboard`, `ReaderReviewScreen`, `ReaderSpecRow`, `Score4LevelSelector`, `ReaderOverrideControl`, `EvidenceRecommendations`, `Messages/` | The full reader review workspace: assignment-gated dashboard, per-Spec 0–3 scoring + AI-override, evidence recommendations, DMs. | CR-003/007/010 |
| `leadReader/` | `LeadReaderDashboard`, `CompilationTab/` | Lead-reader dashboard + final-score compilation. | CR-009 |
| `admin/BoardConsole/` | — | Record board decisions. | CR-053 |
| `admin/AuditTrail/` | — | Browse the audit log. | — |
| `admin/JointVentureManagement/` | — | JV CRUD UI. | CR-019 |
| `admin/RelayConsole/` | `RelayConsole.tsx` | Julia-as-relay console. **Built but not mounted** — dead UI, see [[cr-023-julia-relay-workflow]]. | CR-023 |
| `siteVisit/` | `Checklist/`, `Itinerary/` | Site-visit checklist + itinerary. | CR-012/013 |
| `tour/` | — | Onboarding overlay + per-feature hints. | CR-052 |

## Related

- [[system-architecture]] — layering view of the same modules
- [[import-pipeline]] / [[narrative-storage]] / [[evidence-document-review-pipeline]] — flow-oriented views
- [[legacy-self-study-import]] — the `cshse-ai` AI import redesign
- [[sprint-plan-2026-05-31]] — remaining work, with file:line gaps
- [[security-audit-2026-05-10]] — flagged modules
- [[incomplete-features-2026-05-11]] — module-by-module gaps (supersedes the 2026-05-10 audit)
