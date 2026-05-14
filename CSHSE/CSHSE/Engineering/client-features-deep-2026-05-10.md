---
name: Client Features Deep Dive 2026-05-10
description: Detailed module-by-module documentation of every file in client/src/features/, plus pages, components, hooks, services, store, and lib. Spotlights the file-upload critical path the user is about to modify.
type: review
audit_date: 2026-05-10
auditor: claude
tags: [client, frontend, modules, deep-dive, evidence]
last_reviewed: 2026-05-10
---

# Client Features Deep Dive — 2026-05-10

A file-by-file documentation of the client codebase, focused on the **`features/`** subfolders where the architecture lives. Triggered by the user's plan to add functionality around evidence file storage in the self-study screen — specifically around the per-Standard / per-Sub-standard "folders" they call "EC3 folders" (see [[evidence-file-storage]] for the terminology reconciliation).

The headline takeaway: **the file-upload critical path crosses three UI surfaces** ([[evidence-file-storage|EvidencePanel, EvidenceManager, FileLibrary]]) that all hit the same backend endpoint. Future evidence-AI-review work will touch all three.

This page goes deeper than [[module-catalog]] (one-liners) and complements [[frontend-architecture]] (durable summary).

## Top-level entry & routing

### `client/src/main.tsx`
- Vite entry; renders `<App />` inside `<BrowserRouter>`, `<QueryClientProvider>`, `<React.StrictMode>`.
- React Query defaults: `staleTime: 5 * 60 * 1000`, `retry: 1` ([main.tsx:8-15](../../../../client/src/main.tsx)).

### `client/src/App.tsx`
- Defines all routes:
  - `/login` (LoginPage), `/accept-invitation` (AcceptInvitationPage) — public.
  - `/impersonate` (ImpersonationSelector) — wrapped by `ImpersonationRoute` ([App.tsx:34-55](../../../../client/src/App.tsx)) — only superusers with `needsImpersonationSelection: true`.
  - `/dashboard`, `/self-study/:submissionId?`, `/admin/*` — wrapped by `ProtectedRoute` ([App.tsx:11-32](../../../../client/src/App.tsx)) — redirects unauthenticated users to `/login`; redirects superusers without active impersonation to `/impersonate`.
  - `*` → `/`.

### `client/src/vite-env.d.ts`
- Vite ambient types, no logic.

## Pages (top-level routed components)

### `pages/LoginPage.tsx`
- Pure form. State: `email`, `password`, `error`, `isLoading`. Calls `useAuthStore.login()` then navigates to `/dashboard`.

### `pages/AcceptInvitationPage.tsx`
- On mount: `GET /api/invitations/verify/:token` to fetch invitation. Form requires password ≥8 chars.
- Submit: `POST /api/invitations/accept` with `{token, password}`. On success, redirects to `/login` after 3s.
- Three screens: Loading → form → success card. Error card if no invite found.

### `pages/ImpersonationSelector.tsx`
- Three modes: `select` (Continue as SU / Impersonate Role / Impersonate User) → `role` (4 role cards) or `user` (search picker).
- "Impersonate User" fetches via `GET /api/users?limit=200` ([ImpersonationSelector.tsx:99](../../../../client/src/pages/ImpersonationSelector.tsx)), filters out SU and current user.
- On role/user select: `startImpersonation(role, userObj?)` then navigate to `/dashboard`.

### `pages/DashboardPage.tsx`
- Single-line wrapper: renders `<Dashboard />` from `features/dashboard/`.

### `pages/AdminPage.tsx`
- Guard: `canAccessAdminSettings()` from `authStore`; if false, "Access Denied" card.
- Routes `/admin/settings` → `<SettingsPage />`; other `/admin/*` redirect to settings.

### `pages/SelfStudyPage.tsx`
- Wrapper for the editor. Renders the dashboard list of submissions when no `submissionId` and the full `<SelfStudyEditor />` when one is selected. Owns the very-first import-modal state for users starting a brand-new self-study; the rich import workflow itself lives inside `SelfStudyEditor`.

## Shared components

### `components/Layout.tsx`
- App shell: header (logo + nav tabs + user menu), optional impersonation banner (amber, with "Switch Role" button), `<Outlet />`, and floating `<HelpChat />`.
- Nav tabs: Home + Self-Study always; Settings shown only if `canAccessAdminSettings()`.
- Self-study editor routes bypass max-width constraint ([Layout.tsx:75, 173](../../../../client/src/components/Layout.tsx)).
- Impersonation banner uses `impersonation.impersonatedRole` else `user.role`.

### `components/HelpChat.tsx`
- Floating bubble bottom-right. On mount: `GET /api/webhooks/help/status`. If `available: false`, the component renders `null`.
- Send: `POST /api/webhooks/help/chat` with `{question, sessionId}`. Session ID is a client-generated timestamp ([HelpChat.tsx:20](../../../../client/src/components/HelpChat.tsx)) — **no user binding** ([[security-audit-2026-05-10]]).
- Auto-focus input on open, scroll-to-bottom on new messages.

### `components/HelpChat.test.tsx`
- Status-gating + happy/error round-trip tests. **Currently passing** (per [TESTING.md](../../../../TESTING.md)).

## Services

### `services/api.ts`
- Axios instance. Base URL `VITE_API_URL || ''`.
- **Request interceptor** ([api.ts:11-28](../../../../client/src/services/api.ts)): reads token from localStorage `auth-storage` (the persisted Zustand slice), adds `Authorization: Bearer {token}`. If impersonating, also adds `X-Impersonated-Role` (line 21).
- **Response interceptor** ([api.ts:31-43](../../../../client/src/services/api.ts)): on 401 (unless URL contains `/api/auth/`), clear localStorage and redirect `window.location.href = '/login'`. Auth routes handle their own 401s.
- No token refresh.

### `services/api.test.ts`
- Bearer + X-Impersonated-Role interceptor tests pass. **Two 401-interceptor tests `.skip`-ped** — the `Object.defineProperty(window, 'location')` stub interferes with the localStorage shim. Recommended fix in [TESTING.md](../../../../TESTING.md).

## Store

### `store/authStore.ts`
- Zustand + persist. Persisted slice: `token`, `impersonation`, `needsImpersonationSelection` only — user object is NOT persisted, refetched on `checkAuth()` ([authStore.ts:205-213](../../../../client/src/store/authStore.ts)).
- State: `user`, `token`, `isAuthenticated`, `isLoading`, `impersonation: { isImpersonating, originalUser, impersonatedRole, impersonatedUser }`, `needsImpersonationSelection`.
- Selectors: `getEffectiveRole()`, `getEffectiveUser()`, `isSuperuser()` (true only when SU and **not** impersonating), `canAccessAdminSettings()` (SU not impersonating, OR effective role is `admin`).
- Mutations: `login()`, `logout()`, `checkAuth()`, `startImpersonation()`, `stopImpersonation()`, `skipImpersonation()`, `openImpersonationSelector()`.
- `checkAuth()` runs at module load ([authStore.ts:217](../../../../client/src/store/authStore.ts)) — boots auth state on first import.
- **Brittle:** role-derived flags untested; `canAccessAdminSettings()` tested but the impersonation interactions aren't exhaustive.

### `store/authStore.test.ts`
- Role gating + impersonation start/stop tests pass.

## Hooks

### `hooks/useAutoSave.ts`
- Debounced save. Public API: `triggerAutoSave(data)`, `saveNow(data)` (cancels pending debounce), `isSaving`, `hasUnsavedChanges`, `lastSavedAt`, `error`, `cancelAutoSave()`.
- Default `debounceMs = 2000`.
- Wraps a `useMutation`. **`beforeunload` listener warns if unsaved changes** ([useAutoSave.ts:106-118](../../../../client/src/hooks/useAutoSave.ts)).
- Used by `NarrativeEditor` for both narrative + supporting-evidence text bodies (two instances per Spec).

### `hooks/useValidationStatus.ts`
- Polling validation hook. Public API: `triggerValidation({...})`, `getStandardValidationStatus()`, status fields (`status`, `feedback`, `suggestions`, `missingElements`, `score`), control flags.
- Polls `/api/webhooks/validation/standard/:submissionId/:standardCode` every **3 s** while waiting; **60 s timeout** ([useValidationStatus.ts:37-38, 79-99](../../../../client/src/hooks/useValidationStatus.ts)).
- Used by `NarrativeEditor`'s validation modal.

## lib

### `lib/utils.ts`
- Just `cn(...inputs)` — clsx + tailwind-merge.

## Features — `features/dashboard/`

### `Dashboard.tsx` (1286 lines)
Two completely different dashboards in one file:

- **Program Coordinator dashboard** ([lines 420-735](../../../../client/src/features/dashboard/Dashboard.tsx)):
  - Header with institution + spec name.
  - 4 stat cards: items completed, pending requests, deadline, site visit.
  - Two-col grid: My Change Requests + Scheduled Site Visits.
  - Collapsible "Files" section, grouped by institution if multiple specs.
  - "Unassigned" empty state if no `institutionId`.

- **Admin / Lead Reader / Reader dashboard** ([lines 739-1282](../../../../client/src/features/dashboard/Dashboard.tsx)):
  - 5-control filter panel (institutionType, institutionId, leadReaderId, readerId, search).
  - 4 stat cards (institutions, requests, deadlines, visits).
  - Pending Change Requests + Upcoming Site Visits.
  - Full-width Files section.
  - Table of institutions with upcoming deadlines (urgency colors: red <14d, amber <30d), 10-row limit.

API calls (all `useQuery`):
- `GET /api/institutions`, `GET /api/submissions`, `GET /api/standards`, `GET /api/change-requests/pending`, `GET /api/site-visits`, `GET /api/users`, `GET /api/files?category=dashboard_document&limit=100`, `GET /api/specs?status=active`, `GET /api/files/:id` (blob download).

PC-only filtering: my-institution match for change-requests / site-visits ([lines 326-331](../../../../client/src/features/dashboard/Dashboard.tsx)). Spec-document filtering: only files where `relatedEntityId` matches `mySpecIds` ([lines 263-272](../../../../client/src/features/dashboard/Dashboard.tsx)).

Smell: `window.location.reload()` hardcoded refresh button at line 473.

## Features — `features/selfStudy/Editor/`

### `SelfStudyEditor.tsx` (3480 lines — biggest file in the client)

The mega-orchestrator. Owns **40+ useState slices** for the import workflow alone.

**Major state buckets:**
- *Editor view*: `selectedStandard`, `selectedSpec`, `activeView ('standards'|'curriculum'|'files')`, `sidebarCollapsed`.
- *Import — upload phase*: `selectedFile`, `isUploading`, `uploadError`.
- *Import — processing phase*: `importId`, `importStatus`, `importStep` (6-state: 'upload' | 'processing' | 'manual_tagging' | 'section_selection' | 'review' | 'applying').
- *Import — resume*: `existingImportInfo`, `showResumeDialog`.
- *Import — manual tagging*: `documentHtml`, `documentError`, `taggedSections`, `currentSelection`, `lastSavedSection` (triggers DOM placeholder insertion in DocumentViewer).
- *Import — review*: `extractedSections`, `unmappedAssignments`, `selectedSectionIds`, `batchAssignment`.
- *Narrative & evidence*: `submission` (with `narrativeContent[]`, `standardsStatus`, `readerLock`), save mutations.
- *Comments*: `highlightedComment`, `editorSelection`, `commentSummary`.
- *Validation*: `scoreMutation`, `scoreDeleteMutation`, `scoresData`, `validationProgress`.
- *Editor refresh*: `editorRefreshKey` — version counter to force `<NarrativeEditor>` remount after external content updates.

**API endpoints** — all listed in [[code-review-2026-05-10|module-catalog supplement]], grouped here:
- *Submission*: `GET /api/submissions/:id`, `PATCH /api/submissions/:id/narrative` (twice — narrative + supportingEvidenceText), `POST /api/submissions/:id/standards/:code/submit`, `POST /api/submissions/:id/submit`.
- *Standards*: `GET /api/standards`.
- *Comments*: `GET /api/submissions/:id/comments/summary` (twice — by-section + global), `POST /api/submissions/:id/comments`.
- *Scores*: `GET /api/submissions/:id/scores`, `PUT /api/submissions/:id/scores`, `DELETE /api/submissions/:id/scores/:id`.
- *Import lifecycle*: `POST /api/imports/upload`, `GET /api/imports/:id` (poll, 2s interval), `GET /api/imports/:id/content`, `GET /api/imports/:id/tagged-sections`, `GET /api/imports/check/:submissionId`, `POST /api/imports/:id/apply`, `POST /api/imports/:id/cancel`, `DELETE /api/imports/:id/discard`, `POST /api/imports/:id/repair`, `POST /api/imports/:id/extract-section`, `POST /api/imports/:id/insert-marker`, `DELETE /api/imports/:id/tagged-sections/:sid`, `GET /api/imports/:id/tagged-sections/:sid`, `POST /api/imports/:id/tagged-sections/:sid` (apply), `POST /api/imports/:id/finish-tagging`, `POST /api/imports/:id/select-sections`, `POST /api/imports/:id/confirm-selections`, `GET /api/imports/:id/sections`, `PUT /api/imports/:id/unmapped/:sid`.
- *Matrix*: `GET /api/submissions/:id/matrix`, `POST /api/submissions/:id/matrix/:mid/raw-content`.

**Conditional rendering modes** (top-level branches):
1. Loading spinner.
2. Error card.
3. Standards View (default): Left=`<StandardsNavigation>`, Right=`<NarrativeEditor>` (or `<NarrativeEditorWithComments>` for reviewers), Right-rail comments for reviewers.
4. Curriculum Matrix View: `<CurriculumMatrixEditor>`.
5. File Library View: `<FileLibrary>`.
6. Import Panel overlay (variable width 420px → 85vw depending on step).

**Smells:**
- 40+ useState slices for the import workflow → strong candidate for `useReducer` or a state-machine library.
- 2-second polling hardcoded ([line 548-607](../../../../client/src/features/selfStudy/Editor/SelfStudyEditor.tsx)); no exponential backoff.
- `editorRefreshKey` remount workaround for external-update conflicts in TipTap.
- `submission.refetchQueries` MUST run before navigating to a newly-applied Spec or the editor reads stale narrative.

### `NarrativeEditor.tsx` (1261 lines)

TipTap rich-text editor for one Spec. Two TipTap instances per page: main narrative + supporting-evidence rich-text (collapsible).

**Extensions** ([lines 151-202](../../../../client/src/features/selfStudy/Editor/NarrativeEditor.tsx)): StarterKit, Underline, Placeholder, TextAlign (4 dirs), TextStyle, Color, Highlight (multi-color), Link (`text-teal-600 underline`), Subscript, Superscript, Table + TableRow + TableHeader (resizable).

**Auto-save** ([lines 101-126](../../../../client/src/features/selfStudy/Editor/NarrativeEditor.tsx)): two `useAutoSave` hooks. 2s debounce. Disabled when `readOnly`.

**Validation** ([lines 128-140, 1102-1152](../../../../client/src/features/selfStudy/Editor/NarrativeEditor.tsx)): `useValidationStatus` hook. "Save and Validate" button triggers a save then fires the validation. Modal renders with status (pass/fail), feedback, suggestions, missingElements.

**Comment highlight** ([lines 382-468](../../../../client/src/features/selfStudy/Editor/NarrativeEditor.tsx)): `findAndHighlightText()` walks the DOM via `TreeWalker` (SHOW_TEXT), wraps a substring match in `<mark>` with yellow background + 3.5s fade. **Fails silently if the text spans multiple DOM nodes** (a known limitation noted in [[frontend-architecture]]).

**Toolbar** ([lines 530-819](../../../../client/src/features/selfStudy/Editor/NarrativeEditor.tsx)): two rows. Primary has Bold/Italic/Underline/Strikethrough/Sub/Sup/Highlight/Headings 1-3/Lists/Align (4)/Link/Insert-Table/Undo/Redo. Secondary has table-cell controls + save status + Clear/Cancel/Save/"Save & Validate".

**Bubble menu** ([lines 884-918](../../../../client/src/features/selfStudy/Editor/NarrativeEditor.tsx)): dark popup on selection — Bold/Italic/Underline/Highlight/Link.

**Conflict policy:** if external `initialContent` changes while there are no unsaved changes, sync to editor ([lines 365-369](../../../../client/src/features/selfStudy/Editor/NarrativeEditor.tsx)). Otherwise keep local. **No merge UI** — local always wins.

### `NarrativeEditorWithComments.tsx` (389 lines)

Wrapper composing `NarrativeEditor` + `CommentSidebar` for reviewer view. Three mutually exclusive layouts:

1. PC + locked: `ReaderLockedBanner` + read-only `CommentableText` + `CommentSidebar` (read-only).
2. Reader / Lead Reader: toggle between "View Content" (CommentableText for adding comments) and the full `<NarrativeEditor>`.
3. PC + unlocked: `<NarrativeEditor>` (editable) + `<CommentSidebar>` (read-only for coordinator).

Reads `GET /api/submissions/:id/comments?standardCode=&specCode=` ([lines 74-94](../../../../client/src/features/selfStudy/Editor/NarrativeEditorWithComments.tsx)).

`handleCommentClick` highlights the comment text in the editor (via the `highlightedCommentId` prop into `NarrativeEditor`), scrolls into view, auto-clears after 3s.

### `StandardsNavigation.tsx` (268 lines)

Left-rail tree.

- Splits standards by `parseInt(s.standardCode) <= 10` → Part I / Part II ([lines 45-49](../../../../client/src/features/selfStudy/Editor/StandardsNavigation.tsx)).
- Each `StandardItem`: expand chevron + status icon + code + title + per-Standard progress bar. Expanded → list of `SpecificationItem` rows (a–h) with status icons.
- `StatusIcon` mapping ([lines 244-266](../../../../client/src/features/selfStudy/Editor/StandardsNavigation.tsx)):
  - `validationStatus='fail'` → red AlertCircle.
  - `validationStatus='pass'` → green CheckCircle2.
  - `status='complete'/'submitted'` → teal CheckCircle2.
  - `status='in_progress'` → amber Clock.
  - `status='not_started'` → gray Circle.

## Features — `features/selfStudy/Editor/components/`

### `DocumentViewer.tsx` (857 lines)

Renders raw imported HTML with `dangerouslySetInnerHTML` — XSS risk ([[security-audit-2026-05-10]]). User drag-selects, the parent (`SelfStudyEditor`) captures the selection, opens `<SectionTagger>`. After tag commit, this component reconstructs visual placeholders by scanning the HTML for marker comments. Has table-aware row removal so DOM-mutations during marker insert/remove don't corrupt table structure (memory: `range.deleteContents()` MUST NOT be used inside tables — see project memory).

### `SectionTagger.tsx` (415 lines)

Modal capturing the current selection. Form: section type (Standard / Curriculum Matrix / Appendix / Skip) + standardCode (1-21) + specCode (a-h) + "apply directly" toggle. Posts `POST /api/imports/:id/extract-section` then `POST /api/imports/:id/insert-marker`.

### `SubExtractionViewerModal.tsx` (495 lines)

Modal preview of an extracted section's full HTML before commit. Used after manual tagging to review what was captured.

### `TaggedSectionsList.tsx` (494 lines)

Sidebar list of all tagged sections. Per-section actions: View (open SubExtractionViewerModal), Apply (commit to a Spec), Apply-to-Matrix, Delete (restore marker).

## Features — `features/selfStudy/EvidenceManager/`

See [[evidence-file-storage]] for the canonical write-up. Brief here:

### `EvidenceManager.tsx` (418 lines)
Split-panel cross-Spec view. Tabs (all/documents/urls/images), search, linked-vs-unlinked filter. Right pane = `<EvidenceViewer>`. Spawns `<FileUpload>` and `<URLInput>` modals.

### `FileUpload.tsx` (373 lines)
Drag-drop modal, multi-file with per-file progress bars, 50MB client-side cap. Allowed types listed at [FileUpload.tsx:33-46](../../../../client/src/features/selfStudy/EvidenceManager/FileUpload.tsx).

### `URLInput.tsx` (219 lines)
URL form modal. Auto-fills title from URL hostname on blur ([URLInput.tsx:83-93](../../../../client/src/features/selfStudy/EvidenceManager/URLInput.tsx)).

### `EvidenceViewer.tsx` (330 lines)
Right pane: preview (PDF iframe / image / external-link card) + metadata + Link/Unlink/Download/Open actions. **Bug-prone:** standards dropdown hardcodes `Array.from({length: 21})` and `['a'..'h']` instead of fetching from `/api/standards` ([EvidenceViewer.tsx:283-304](../../../../client/src/features/selfStudy/EvidenceManager/EvidenceViewer.tsx)).

## Features — `features/selfStudy/FileLibrary/`

### `FileLibrary.tsx` (955 lines)
The cross-Spec accordion view — **the canonical "evidence folders" UI** the user calls "EC3 folders." See [[evidence-file-storage]] for the deep dive. Key facts:

- Groups all submission evidence by Standard → Sub-standard ([lines 114-124](../../../../client/src/features/selfStudy/FileLibrary/FileLibrary.tsx)).
- Renders Part I (1–10) + Part II (11–21) accordions, with per-Standard file counts.
- Upload form has dependent dropdowns: Standard picker → Sub-standard picker (filtered by chosen Standard).
- "Version vs Replace" toggle on the upload form ([lines 680-714](../../../../client/src/features/selfStudy/FileLibrary/FileLibrary.tsx)).
- Download via blob fetch + `URL.createObjectURL` (works around browser auth-cookie weirdness on direct anchor links).
- **Files without `standardCode` are bucketed under `"unassigned" / "general"` but never rendered** — invisible in this view.

### `FilePreviewModal.tsx` (280 lines)
PDF iframe / image / DOCX (Mammoth-rendered) / "non-previewable" inline preview. Description-edit form too.

## Features — `features/selfStudy/Editor/EvidencePanel.tsx` (472 lines)

The third upload surface — embedded inline in the editor for the active Spec only. Pre-fills `standardCode + specCode` from props. See [[evidence-file-storage]] for full flow.

## Features — `features/selfStudy/MatrixEditor/CurriculumMatrixEditor.tsx` (261 lines)

Read-only accordion display of imported curriculum-matrix sections (Standards 11–21). Renders `rawContent[].content` HTML via `dangerouslySetInnerHTML` (XSS risk for imported content). Delete action calls `DELETE /api/submissions/:id/matrix/:mid/raw-content/:rid`.

**Important:** the matrix is *display-only* in this component. Edit logic happens server-side via the import flow — there is no spreadsheet-style cell editor today, despite the file name suggesting otherwise.

## Features — `features/selfStudy/SubmissionWorkflow/`

### `ProgressTracker.tsx` (334 lines)
Real-time progress display with **30-second auto-refetch** ([line 56](../../../../client/src/features/selfStudy/SubmissionWorkflow/ProgressTracker.tsx)). Reads `GET /api/submissions/:id/progress`. Renders 4 status cards (completed / submitted / validated / failed) + validation summary + per-Standard pill grid (Part I / Part II) + legend.

### `FailedValidations.tsx` (218 lines)
Lists failed validations from `GET /api/submissions/:id/failed?standardCode=`. "Revalidate All" → `POST /api/submissions/:id/revalidate`. Per-failure: feedback, missing elements, suggestions, edit-jump button.

## Features — `features/comments/`

### `CommentSidebar.tsx` (451 lines)
Per-Spec comment thread list. Reads `GET /api/submissions/:id/comments?standardCode=&specCode=`. Mutations for reply / delete-reply / resolve / delete-comment. Smell: `canDeleteComment()` allows lead_reader to delete ANY comment, which may not be intended ([CommentSidebar.tsx:177-178](../../../../client/src/features/comments/CommentSidebar.tsx)).

### `CommentNavigation.tsx` (251 lines)
Global comment count + paginated nav strip. `GET /api/submissions/:id/comments/summary` + `GET /api/submissions/:id/comments/navigate?page=&limit=10`. Inline-preview buttons to jump to comments.

### `CommentableText.tsx` (360 lines)
Renders narrative text with inline `<mark>` highlights anchored to comments. Right-click context menu offers Add or Delete (depending on whether selection overlaps an existing comment). Comment positions are stored as `selectionStart, selectionEnd` integer offsets; re-render slices the content string by those offsets ([lines 209-249](../../../../client/src/features/comments/CommentableText.tsx)). Smell: `getRangeAt(0)` without bounds check; no handling of overlapping selections.

### `ReaderLockedBanner.tsx` (330 lines)
Lock state UI. **Polls `GET /api/submissions/:id/lock` every 30 s** ([line 56](../../../../client/src/features/comments/ReaderLockedBanner.tsx)). Different rendering per role: reader/lead-reader get Lock/Unlock + "Send Back for Correction" buttons; PC sees amber banner if locked or orange "Submit Corrections" if sent back.

## Features — `features/changeRequests/`

### `ChangeRequestForm.tsx` (338 lines)
Modal to request a deadline change or site-visit reschedule. `POST /api/change-requests`. Dual-approval workflow described inline. Smell: 2-second `setTimeout` on success before close (line 79) — feels too long.

### `ChangeRequestsList.tsx` (540 lines)
Filter / list / approve / deny. `GET /api/change-requests?status=&type=&submissionId=`. `POST /api/change-requests/:id/approve` (optional comments) and `POST /api/change-requests/:id/deny` (required reason). Dual approval tracked via `approval.admin` and `approval.leadReader` keys — fragile typo-prone string keys.

## Features — `features/dashboard/Dashboard.tsx`

See dedicated section above.

## Features — `features/siteVisits/SiteVisitScheduler.tsx` (704 lines)

Modal form for scheduling / editing site visits. CRUD via `/api/site-visits`. Team-member assignment with role dropdown (lead / team_member / observer). Status badges (scheduled/confirmed/completed/cancelled/rescheduled).

## Features — `features/admin/Settings/`

### `SettingsPage.tsx` (249 lines)
Tabbed container for 8 sections. Role gate: SU sees Webhook + API Keys + Data Management; admin sees the others. Impersonating-as-admin SU does NOT see the SU-only tabs (correct).

### `UserManagement.tsx` (529 lines)
Users / Pending Invitations / Readers Committee tabs. CRUD plus invite-resend. Soft-delete via `status: 'disabled'`. **No edit-roles UI.**

### `InstitutionManagement.tsx` (672 lines)
Institution CRUD + spec assignment + lead-reader assignment + accreditation deadline + auto-phone-formatting + program-coordinator invitation on create only.

### `SpecManagement.tsx` (829 lines)
Standards-source PDF management. Upload via `POST /api/files` (`category=spec_document`). Trigger AI loading via `POST /api/specs/:id/load-to-ai` → polls `GET /api/specs/:id/ai-status` every 2 s while `aiLoadingStatus === 'loading'` ([SpecManagement.tsx:645](../../../../client/src/features/admin/Settings/SpecManagement.tsx)). Reset via `POST /api/specs/:id/reset-ai-status`.

### `APIKeySettings.tsx` (406 lines)
Secure key generation (full key shown ONCE in modal, then masked everywhere). Rotation creates new key without showing old. Categories: webhook_callback, webhook_outbound, api_access, integration.

### `DashboardFileUpload.tsx` (315 lines)
Pinned dashboard files. `POST /api/files` with `category=dashboard_document, relatedEntityId={specId}, relatedEntityType=Spec`. Files grouped by spec on display.

### `HelpDocumentUpload.tsx` (292 lines)
Upload PDF/MD/TXT to n8n RAG via `POST /api/webhooks/help/upload` (multipart with `source` enum: `handbook|user_guide|reference`). **Polls every 3 s while any document is in `processing` state** ([lines 47-52](../../../../client/src/features/admin/Settings/HelpDocumentUpload.tsx)). Removal does not delete from the vector DB ([line 286-288 note](../../../../client/src/features/admin/Settings/HelpDocumentUpload.tsx)).

### `DataManagement.tsx` (504 lines)
Two surgical bulk operations:
1. Delete all institution self-study data — confirmation modal requires typing "Delete."
2. GridFS orphaned-file cleanup — dry-run preview → delete (mirrors the server-side `cleanupOrphanedFiles()`).

## Features — `features/admin/WebhookSettings/WebhookSettings.tsx` (528 lines)

Accordion for the 5 n8n webhook types: validation, spec_loader, document_matcher, help_chat, help_upload. Per-type form: URL, auth (none / API key / bearer), retry config, timeout, active toggle, save, test. **Test calls `POST /api/webhooks/settings/:settingType/test`** and shows success / response time. Callback URLs are determined server-side, not configurable.

## Test infrastructure (uncommitted as of 2026-05-10)

- [`client/vitest.config.ts`](../../../../client/vitest.config.ts) — extends `vite.config.ts`, runs in jsdom.
- [`client/src/test/setup.ts`](../../../../client/src/test/setup.ts) — MSW server with `onUnhandledRequest: 'error'` so any unmocked `/api/*` call fails the test loudly.
- [`client/src/test/msw-server.ts`](../../../../client/src/test/msw-server.ts) — MSW handlers.
- See [TESTING.md](../../../../TESTING.md) for the layered test approach (server / client / E2E) and the 2 currently-skipped 401-interceptor tests.

## What this pass found that wasn't already documented

| Finding | Where | Implication |
|---------|-------|-------------|
| Three independent upload UIs share one backend | EvidencePanel + EvidenceManager + FileLibrary all `POST /api/submissions/:id/evidence/upload` | Add evidence-AI-review pills in all three. Long-term, deprecate EvidenceManager (redundant with FileLibrary). |
| FileLibrary IS the "EC3 folders" view | [FileLibrary.tsx:914-933](../../../../client/src/features/selfStudy/FileLibrary/FileLibrary.tsx) — Part I / Part II accordions of Standards, each containing Sub-standard sections | The user's "folders" = the per-(Standard, Sub-standard) accordion sections. |
| Unassigned files are invisible in FileLibrary | Bucketed under `"unassigned"/"general"` but no accordion ever renders for them | Add an "Unassigned" accordion or block uploads without Standard/Spec assignment. |
| EvidenceViewer hardcodes 21 standards + a-h | [EvidenceViewer.tsx:283-304](../../../../client/src/features/selfStudy/EvidenceManager/EvidenceViewer.tsx) | Will silently lag if standards definitions change. FileLibrary does it correctly. |
| Two description fields | `description` (top-level) + `metadata.description` (nested) | Pick one. UI fallback at [EvidencePanel.tsx:215-217](../../../../client/src/features/selfStudy/Editor/EvidencePanel.tsx). |
| `imageMetadata.ocrText` is dead | Not populated by any upload flow | Would be required for OCR-based AI evaluation of scanned images. |
| `linkedNarratives: string[]` is dead | Actual narrative linkage is via `(standardCode, specCode)` | Safe to remove from schema in a cleanup pass. |
| 50MB cap is client-only in EvidenceManager | [FileUpload.tsx:48](../../../../client/src/features/selfStudy/EvidenceManager/FileUpload.tsx) | Other UIs only learn after upload completes. Move check upstream or add header-size negotiation. |
| Many components poll | Lock 30s, validation 3s/60s timeout, AI loading 2s, help-doc processing 3s, progress 30s | No coordination — all independent intervals. |
| `dangerouslySetInnerHTML` in two places | DocumentViewer (imported HTML) + CurriculumMatrixEditor (rawContent.content) | Both are XSS risks ([[security-audit-2026-05-10]]). Sanitize on render OR on import. |

## Related

- [[evidence-file-storage]] — durable concept page on the file-upload critical path (read alongside this)
- [[narrative-storage]] — the prose half
- [[evidence-document-review-pipeline]] — the AI-review work this catalog enables
- [[module-catalog]] — one-line index of every module in server + client
- [[frontend-architecture]] — the durable summary page
- [[code-review-2026-05-10]] — prior comprehensive review (this is the deeper client-only follow-up)
- [[security-audit-2026-05-10]] — flagged issues
