---
name: Frontend Architecture
description: React/Vite client structure — routing, role gating, state, the TipTap editor, the document viewer, bundle shape.
type: concept
tags: [frontend, react, tiptap, vite, accessibility]
last_reviewed: 2026-05-10
---

# Frontend Architecture

React 18 + Vite + TipTap + Tailwind + Radix + Zustand + TanStack Query + React Router. Single SPA, served as static assets from the same Railway container as the API.

## Layout

```
client/src/
  App.tsx                # routing, ProtectedRoute, impersonation redirect
  main.tsx               # entry
  pages/                 # top-level routes
  features/              # feature-scoped components (selfStudy, admin, etc.)
  components/            # shared UI primitives
  store/                 # zustand stores (auth, etc.)
  services/              # API client (axios)
  hooks/                 # shared hooks (useAutoSave, etc.)
```

## Routing & role gating

`ProtectedRoute` wraps everything except `/login` and `/accept-invitation` ([client/src/App.tsx](../../../../client/src/App.tsx)). Superusers without an active impersonation are redirected to `/impersonate`.

Role gating happens at three layers:

1. **Route** — `ProtectedRoute` checks auth.
2. **Page** — e.g., `AdminPage.tsx` calls `canAccessAdminSettings()`.
3. **API** — server-side middleware is the authoritative check.

Logic for "is this superuser currently impersonating? what's the effective role?" lives in `authStore.canAccessAdminSettings()` ([client/src/store/authStore.ts:193-203](../../../../client/src/store/authStore.ts)). Correct, but brittle and untested.

## Auth & API client

- **JWT stored in `localStorage`** via Zustand `persist()` middleware ([authStore.ts:206-211](../../../../client/src/store/authStore.ts)). XSS would leak the token. Should migrate to httpOnly cookie.
- **Axios interceptor** ([client/src/services/api.ts:11-43](../../../../client/src/services/api.ts)) attaches `Bearer ${token}` and on 401 clears storage + redirects to `/login`. **Unsaved form data is dropped silently** on 401 — no `beforeunload` warning.
- No token refresh — expired token = forced re-login.

## TipTap NarrativeEditor

[client/src/features/selfStudy/Editor/NarrativeEditor.tsx](../../../../client/src/features/selfStudy/Editor/NarrativeEditor.tsx).

Extensions: StarterKit + Underline, Placeholder, TextAlign, TextStyle, Color, Highlight, Link (no-click), Subscript/Superscript, full Table set. Tables get + Row / + Col / – Row / – Col toolbar buttons.

- **Auto-save:** `useAutoSave` hook, 2-second debounce. Two editors per page (main narrative + supporting evidence accordion).
- **Word paste:** `handlePaste` returns false → TipTap handles paste; table + alignment + color extensions preserve most Word formatting.
- **Comment highlight:** `findAndHighlightText()` walks the DOM via TreeWalker, wraps a match in `<mark>`, fades over 3s. Fails silently if the text spans multiple DOM nodes.
- **Validation modal:** "Save and Validate" hits `/api/submissions/{id}/validation` and shows the n8n result (status, score, feedback, suggestions, missing elements).
- **External-update conflict:** When server-side content changes and the editor has unsaved local changes, the local version wins with no merge UI.

## DocumentViewer (manual tagger)

[client/src/features/selfStudy/Editor/components/DocumentViewer.tsx](../../../../client/src/features/selfStudy/Editor/components/DocumentViewer.tsx). Renders the imported HTML directly (not via TipTap) so the user can drag-select arbitrary boundaries.

- **`dangerouslySetInnerHTML` on imported HTML** (line 841). **No DOMPurify or sandboxing.** If a Word/PDF parse produces `<script>` / event handlers, they execute in the user's session. See [[security-audit-2026-05-10]].
- **Table-aware row removal** — when a selection includes table rows, code finds overlapping rows via `compareBoundaryPoints()` and `row.remove()`s them directly rather than `range.deleteContents()` (which corrupts table structure). Memory note: `range.deleteContents()` must never be used inside tables.
- **Placeholder reconstruction on resume** — scans for marker comments ([[import-pipeline]]) and replaces them with `✓ Extracted` divs. Falls back to an info banner if markers are absent.
- **Large-doc warning** — detects HTML >10MB, shows a badge, bumps conversion delay to 1s.

## Other surfaces

- **EvidenceManager** — split panel (list + preview), TanStack Query for fetching. **Delete mutation does not show error toast** on failure.
- **HelpChat bubble** — gated by `GET /api/webhooks/help/status`. Returns `null` if not configured. Renders bot reply with raw inner HTML — low risk if the n8n response is trusted, but the whole pipeline is unauthenticated.
- **Admin WebhookSettings** — API key field uses password input + show/hide toggle. Server is responsible for never returning the saved key back; on load, the field initializes to empty string. Save POSTs the new key.

## Bundle & build

- **Vite config:** no manual code-splitting, no dynamic imports. One big chunk.
- **Estimated bundle:** ~500–700 KB gzipped. Heaviest: TipTap (~200KB), Radix (~100KB), React/Router (~150KB), TanStack Query (~40KB).
- Acceptable for an institutional admin tool, but route-level lazy-loading would noticeably speed first paint.
- Sourcemaps disabled in production.

## Accessibility

Limited.

- **Three** `aria-label` attributes app-wide (all in `HelpChat.tsx`).
- Toolbar icon-only buttons (Bold, Italic, etc.) have `title` tooltips but no `aria-label`.
- No custom keyboard shortcuts beyond TipTap defaults.
- Recent root font-size bump (15%) and `#1a1a1a` body color help contrast; `whitespace-nowrap` was added on menus/tabs/sidebar to prevent wrap-induced layout breakage.

## Concrete issues

1. **XSS via imported HTML** — `DocumentViewer.tsx:841` (critical, see [[security-audit-2026-05-10]]).
2. **JWT in localStorage** — `authStore.ts:206-211`.
3. **Silent failure on highlight** — `NarrativeEditor.tsx:414`.
4. **No code-splitting** — entire bundle on every page load.
5. **Silent delete failure** — `EvidenceManager.tsx:173-183`.
6. **Unsaved data lost on 401** — `api.ts:38`.
7. **Brittle role-gating logic** — `authStore.ts:193-203`, no tests.

## Related

- [[security-audit-2026-05-10]] — XSS, token storage, missing aria
- [[import-pipeline]] — DocumentViewer is the primary consumer
- [[system-architecture]] — auth model and impersonation
