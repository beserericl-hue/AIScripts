# Test Report — localStorage → server-authoritative review state (2026-06-07)

**Directive:** "Nothing should live in localStorage except the document we are reading and comparing entry items for (for speed). Run a check against everything — every UI, every function, every role — to make sure nothing that should be persisted is stored on localStorage."

**Target:** live `developer` deploy → https://cshse-develop.up.railway.app

---

## 1. Audit — every localStorage user in the client

| Location | Stored | Verdict |
|---|---|---|
| `store/aiImportStore.ts` (`ai-import-storage`, Zustand persist) | **was** the entire review state: `buckets` (narratives), `tags`, `cvs`, `evidenceDocs`, `introductions`, `matrices`, `matrixRowEdits`, `approvedIds`, `discardedIds`, `coverageReport`, `placeholderSections`, `dirty` + resumable identity | **OFFENDER — fixed.** Heavy review content removed from `partialize`; now server-authoritative. |
| `store/authStore.ts` (`auth-storage`) | JWT `token`, `impersonation`, `needsImpersonationSelection` | **Keep.** Session credential, required for the app to stay logged in across reloads; not "data". |
| `services/api.ts` | reads the JWT from `auth-storage` to set the Authorization header | Keep (reads the credential above). |
| `features/tour/useOnceHint.ts` | per-hint "seen" boolean (`cshse:hint-seen:*`) | Tiny UX flag, not data. (Server `user.preferences.tours` already exists for tours.) |
| `components/bugReporterScreenshot.ts` | `cshse:bug-screenshot` opt-in flag | Tiny support flag, not data. |
| `aiImportStore` `ai-apply-${importId}` | apply idempotency key | Tiny, ephemeral. |

**Result:** the only place real persisted *data* lived in localStorage was the AI-import review state. That is the change below.

## 2. The fix (server is the single source of truth)

1. **`partialize` trimmed** (`ai-import-storage`) to only resumable identity — `importId`, `submissionId`, `jobId`, `step`, `status`, `programLevel`, `isReimport`, `selectedSpecKey`, `selectedSectionId`, `standaloneCv`, batch context. The review **content** is no longer written to the browser.
2. **Store-level autosave** — a `useAIImportStore.subscribe` debounces on every `dirty` edit and pushes the full review state to the server via the (serialized) `saveReviewStateToServer`, independent of which surface is mounted (the AI-Import wizard's `ReviewStep` **or** the standalone `ReviewSurface`). The "Saving…/Saved" chip now reads a shared store field (`reviewSaveState`), so two surfaces can't race duplicate writes. `ReviewSurface`'s local autosave effect was removed.
3. **Editor hydrates from the server on mount** — `SelfStudyEditor` now calls `loadPersistedReviewState()` on mount so the toolbar Review button + draft counts reflect the DB without first opening the Review surface (which previously relied on the localStorage cache).
4. **Recovery (already shipped)** — when the server has no buckets but the client does (a pre-existing submission whose narratives were stranded in localStorage), the store flags dirty so the autosave pushes them to the server. Self-heals on the next Review open.
5. **Dashboard `Papers` count fix (already shipped)** — counts every non-syllabus evidence doc (paper/project/untagged), matching the Review rail.

## 3. Total E2E — live, all roles (17/17 ✅)

Run: `--workers=2` against the develop deploy.

| Spec | Coverage | Role | ✅ |
|---|---|---|---|
| 37 | Review tour (28 stops) | PC | ✅ |
| 38 | Self-Study editor tour | PC | ✅ |
| 39 | Evidence assignment persists across reload | PC | ✅ |
| 40 | Move text between sub-specs persists | PC | ✅ |
| 41 | Approvals persist across reload (DB) | PC | ✅ |
| 43 | Change-kind (narrative→evidence) persists across reload | PC | ✅ |
| 44 | Approve auto-applies; no "Apply to editor" button | PC | ✅ |
| 45 | Approve-all → multi-spec + evidence file materialize | PC | ✅ |
| 46 | Approve → Python cshse-ai evaluation stored | PC | ✅ |
| 47 | Import-file drag/drop → auto-import + preview | PC | ✅ |
| 48 | Import → paste into narrative persists | PC | ✅ |
| 49 | Import → paste as evidence summary persists | PC | ✅ |
| 50 | Import → Introduction target persists | PC | ✅ |
| 51 | Legacy "Import Document" + setting removed | PC | ✅ |
| 52 | Reader 0–3 score persists + re-score upsert | **Reader** | ✅ |
| 53 | Lead final score persists + clears | **Lead Reader** | ✅ |
| **54** | **localStorage holds NO review content** (buckets/tags/cvs/evidenceDocs/introductions/matrices/approvedIds absent; only resumable identity) | PC | ✅ |

## 4. Server integration (no regressions) — 37/37 ✅
`set-approved`, `save-state`, `route-evidence`, `matrix-state`, `approve-autoapply`, `reader-endpoints-smoke`, `compilation-endpoint`. Plus the broader reader/lead-reader suite (75 tests) and review-surface suite (27 tests) remain green from this session.

## 5. Caveats (honest)
- **Wizard mid-import refresh** (Upload→Parse) can't be exercised against the live deploy (those specs need a full local stack: Mongo+S3+n8n). The store-level autosave + server hydration make the wizard's edits server-backed by design, but that specific resume path wasn't re-run live here.
- **Spec 43** retains a rare flake only under artificial 4×-concurrent load (UI-render timeout, not data loss); passes normally and under `--workers=2`.
- **Your existing submission (6986239a…):** its 207 narratives currently live in your browser's localStorage (server had 0 buckets). They migrate to the server automatically the next time you open the editor/Review on the refreshed build (the recovery pushes them). Do this once before clearing that browser's cache.
