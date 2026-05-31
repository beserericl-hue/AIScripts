---
name: CR-052 — Contextual in-app Help + Welcome Tour + Hint system
description: First-time guided walkthrough of the main surfaces with auto-start + re-run from a Help dropdown, plus a programmatic Hint system anchored to UI elements with auto-dismiss / click-outside behavior. Two cooperating-but-independent React contexts (TourProvider + HintProvider) on top of react-joyride.
type: change-request
cr_id: CR-052
status: shipped
priority: P2
source: user direction 2026-05-30 ("Create a CR and implement a contextual in-app Help feature for this application.")
sprint_target: Sprint 7
tags: [ux, onboarding, help, tour, hints, accessibility]
last_reviewed: 2026-05-31
shipped_notes: |
  Sprint 9.3 (2026-05-31) — first real per-feature Hint wirings on top of the
  Sprint 7 HintProvider. HintProvider is in-memory and dedupes only within a
  session, so added `client/src/features/tour/useOnceHint.ts`: a localStorage
  "seen" ledger (`cshse:hint-seen:{id}`, fail-soft on quota/private-mode) that
  fires a hint once-ever per browser. Wired two nudges: first time a lead reader
  opens the Final-score editor (CompilationTab — fired from an effect on
  `editingKey` so the Save-button anchor is committed before the balloon
  measures it), and first time a visit-team member marks a checklist item
  verified (not un-verify). Real `id` attributes added to both anchor buttons
  (getElementById needs a true id, not just data-testid). Two new strings in the
  `hint.*` namespace (five-year-old voice). 4 client unit tests. Commit `de5da94`.
---

# CR-052 — Contextual in-app Help + Welcome Tour + Hint system

## Problem statement

The CSHSE Self-Study Portal has accumulated a non-trivial surface area (Program-Coordinator authoring + Self-Study editor + AI Import Wizard + Reader review + Lead-Reader CompilationTab + Site-visit checklist + Admin Settings). New users — especially Program Coordinators going through accreditation for the first time, and volunteer Readers staffing a board cycle — have **no in-app onboarding**. Today they are pointed at out-of-band PDFs and webinar recordings; the portal itself never volunteers context.

Two related gaps:

1. **First-run orientation.** A first-time PC who lands on `/dashboard` after accepting the invitation sees a single "Create Self-Study" button and no signposting toward Drafts / Self-Study / Settings / the Help chat. They click around to find the import wizard, miss the Curriculum Matrix entirely, and email Julia to ask "where do I…?" — exactly the questions the [[wizard-user-guide-2026-05-20]] PDF was meant to answer but cannot, because nobody reads PDFs.

2. **Contextual nudges.** Several features ship behavior the user can't easily discover (e.g. Sprint 5.1 CompilationTab's "click Final to set score", Sprint 6.1 Checklist's verify toggle, the in-progress AI Review panel's "Run AI Review" button). These would benefit from a programmatic Hint affordance — a small balloon anchored to a UI element with auto-dismiss + click-outside dismissal + dedup-by-id — that any feature can fire when it lands.

The two gaps share UI plumbing (tooltip rendering, click-outside, anchor-to-element) but **not state semantics** (tour status is per-user persistent; hints are transient in-memory). They should be two independent React contexts that can be used together (tour-completion fires a hint) or apart (any feature fires hints without touching the tour system).

## Source quotes

> "New users get a guided walkthrough of the app's main surfaces the first time they reach the home screen — and the walkthrough can always be re-run on demand." — CR direction, 2026-05-30

> "The same Help surface gives users access to support docs, live chat (or equivalent), and the tour restart trigger." — CR direction, 2026-05-30

> "Contextual nudges ('hints') can be programmatically surfaced anchored to any UI element, with auto-dismiss and click-outside behavior." — CR direction, 2026-05-30

## Repo-vs-spec deltas (flagged for confirmation)

The CR direction assumed several existing primitives that the repo does NOT actually have. I'm capturing these here so the implementation choice is auditable later:

1. **No i18n system exists.** Every string in `client/src/` is hardcoded English (`grep useTranslation` returns nothing relevant; `react-i18next` / `next-intl` / `react-intl` are not in `package.json`). The spec language ("use the project's existing i18n system") cannot be honored literally. **This CR introduces a minimal in-house typed string registry at `client/src/i18n/strings.ts`** exporting a `t(key, vars?)` function reading from namespaced object literals (`tour.*`, `help.*`). No library. Centralized + swappable so a future migration to a real library is a drop-in.

2. **No UI primitive library is in use.** Radix is declared in `client/package.json` but **never imported** anywhere in `client/src/`. The app uses raw HTML + Tailwind + `lucide-react` + custom CSS classes (`.app-header`, `.nav-tab`) defined in `index.css`. The Help dropdown + tooltip + hint balloon are implemented as Tailwind-styled `<div>`s with manual focus trap + click-outside hooks, matching `Layout.tsx:237-296` (the existing Settings cog dropdown) and `HelpChat.tsx` (the existing chat widget).

3. **Home route is `/dashboard`, not `/home`.** `App.tsx:80` redirects `/` → `/dashboard`. TOUR_EXCLUDED_ROUTES references `/dashboard`; the auto-start redirect targets `/dashboard`.

4. **`HelpChat` already exists.** A floating chat widget is mounted in `Layout.tsx:395` and self-manages its open state. The new Help **dropdown** orchestrates it — "Chat with us" item programmatically opens `HelpChat` via a tiny new store hook; we do not replace or duplicate the widget.

5. **`react-joyride` is added** as the only new third-party dependency permitted by the spec (no existing tour library).

6. **The E2E suite hits `https://cshse-develop.up.railway.app`** via the existing `/api/test/seed` endpoint (CR-034). The new tour E2E uses the same seed-driven pattern.

## Decision

Two cooperating-but-independent React contexts plus a Help dropdown trigger, layered on top of `react-joyride`. Tour completion persists in the user's existing `User.preferences` blob (CR-045) under a new `tours: { [tourName]: true }` key; the server widens its allowlist to accept it. Hints are transient in-memory. Tour-completion fires a hint anchored to the Help button telling the user "you can re-run this from Help anytime."

### TourProvider

Lives at `client/src/features/tour/TourProvider.tsx`. Exposes via `useTour()`:

```ts
interface TourContextValue {
  activeTour: TourName | null;
  tourStatus: Record<TourName, boolean>;
  isLoading: boolean;
  wasAutoStarted: boolean;
  startTour(name: TourName, opts?: { autoStarted?: boolean }): void;
  endTour(): void;
  completeTour(name: TourName): Promise<void>;
  skipTour(name: TourName): Promise<void>;
  shouldAutoStartWelcomeTour(): boolean;
}
type TourName = 'welcome'; // string-literal union; widen for future tours
```

State semantics:

- `activeTour`, `wasAutoStarted`, `isLoading` are `useState` in-memory.
- `tourStatus` derives from `useAuthStore().user?.preferences?.tours` so completion follows the user across devices.
- `completeTour` / `skipTour`:
  1. set in-memory `activeTour = null`,
  2. call `authStore.updatePreferences({ tours: { ...existing, [name]: true } })`,
  3. The existing `updatePreferences` (CR-045 pattern) reads the local user blob, merges, optimistic-updates, PATCHes the server, and rolls back on failure with a toast (server is the merge authority — `PATCH /me/preferences` only validates known keys and never overwrites siblings).
  4. On persistence failure, surface an error toast via the new `useToast()` hook (see "Toast" below) and close the tour cleanly — no UI strand.

Auto-start behavior:

- On mount in a child component (`<WelcomeTourAutoStart />`) — NOT in the provider effect, so SSR-safe and so test mounts don't auto-fire:
  - If `isAuthenticated` and `user.preferences` is loaded (not `undefined`) and `!tourStatus.welcome` and `location.pathname` is not in `TOUR_EXCLUDED_ROUTES` (`/login`, `/accept-invitation`, `/impersonate`):
    - If `location.pathname !== '/dashboard'`, navigate to `/dashboard` once.
    - Once on `/dashboard`, call `startTour('welcome', { autoStarted: true })`.
- `shouldAutoStartWelcomeTour()` is a pure function returning the above predicate; callable by tests + the auto-start mounter.

### HintProvider

Lives at `client/src/features/tour/HintProvider.tsx`. Exposes via `useHint()`:

```ts
interface Hint {
  id: string;
  message: string;
  targetId?: string; // id of the DOM element to anchor to; if absent, balloon centers
}
interface HintContextValue {
  activeHints: Hint[];
  showHint(hint: Hint): void;
  dismissHint(id: string): void;
  hasHint(id: string): boolean;
  getHint(id: string): Hint | undefined;
}
```

- `showHint` is a no-op if a hint with the same `id` is already active (dedup).
- Pure in-memory; not persisted.
- A `<HintLayer />` component (mounted near the app root) walks `activeHints`, finds each `targetId` via `document.getElementById`, and renders a `<HintBalloon>` next to it. Falls back to centered overlay if `targetId` is unset or unmounted.

### HintBalloon

- 300ms enter/exit transitions (Tailwind classes `transition-opacity duration-300`).
- Auto-dismiss after 8s via `setTimeout` in the balloon's `useEffect` (cleared on unmount).
- Click-outside dismisses via a single document-level mousedown listener (matches the pattern at `Layout.tsx:66-73`).
- Opening the Help dropdown also dismisses any hint targeting it (the dropdown calls `dismissHint(HINT_ID)` on open).
- Accessibility: `role="status"`, `aria-live="polite"`.

### Tour engine: `WelcomeTour` component

Lives at `client/src/features/tour/WelcomeTour.tsx`. Wraps `react-joyride`'s `<Joyride>`:

- Reads `activeTour`, `wasAutoStarted`, `completeTour`, `skipTour`, `endTour` from `useTour()`.
- Reads tour steps from `getWelcomeTourSteps(t)` (see below).
- `run={activeTour === 'welcome'}`.
- On mount, sets `document.body.style.overflow = 'hidden'`; on unmount + on FINISHED/SKIPPED, restores to the previous value (captured before mount). Restoration is guaranteed on unmount-mid-tour via cleanup function.
- Callback `(data) => …`:
  - On status FINISHED → `await completeTour('welcome')`; if `wasAutoStarted` then `showHint({ id: 'welcome-tour-completed', message: t('tour.welcome.postCompletedHint'), targetId: TOUR_TARGET_IDS.help })`.
  - On status SKIPPED → `await skipTour('welcome')`; same hint.
  - On X-close (action === 'close') → same as SKIPPED.
  - On status ERROR → close the tour cleanly + toast.

### Tour steps + targets

Lives at `client/src/features/tour/welcomeTourSteps.tsx`:

```ts
export const TOUR_TARGETS = {
  home: '[data-tour-step="home"]',
  selfStudy: '[data-tour-step="self-study"]',
  reviewQueue: '[data-tour-step="review-queue"]',
  compilations: '[data-tour-step="compilations"]',
  settings: '[data-tour-step="settings"]',
  help: '[data-tour-step="help"]',
} as const;

export const TOUR_TARGET_IDS = {
  help: 'cshse-help-trigger', // also set as the id= attribute on the trigger
} as const;

export function getWelcomeTourSteps(t: TFn): Step[] {
  return [
    { target: 'body', placement: 'center', disableBeacon: true,
      content: t('tour.welcome.intro') },
    { target: TOUR_TARGETS.home, placement: 'bottom',
      content: t('tour.welcome.home') },
    // ... self-study, review queue (reader/lead), compilations (lead/admin),
    //     settings (admin), help (final)
  ];
}
```

The Layout nav adds `data-tour-step="<name>"` attributes to each `<Link>` so the tour can spotlight them. Role-conditional nav items (Compilations is lead/admin-only) only render — and only attach the attribute — when the role gate passes. The tour's step array filters out steps whose target doesn't resolve at mount time, so a PC's tour skips the reader/lead-only steps.

### Custom tooltip component

Passed to `<Joyride tooltipComponent={CshseTooltip}>`. Implements:

- Thin progress bar at the top: `<div style={{ width: ${((index + 1) / size) * 100}% }} />` over a 4px-tall slate-200 background; fill is teal-600 (matches `.nav-tab-active`).
- Body content slot (renders `step.content`).
- Footer row:
  - **Back** button: hidden on `index === 0`; otherwise `← Back`.
  - **Skip** button: hidden on last step; otherwise the dim "Skip tour" label.
  - **Next / Finish** primary button: label is "Finish" on last step, else "Next →". Uses the existing teal-600 button style.
- Tailwind only; no new component library.

### Help button + dropdown

Lives at `client/src/components/HelpMenu.tsx`. Replaces / supplements the existing Layout user-menu's cogwheel. Renders a trigger button with `data-tour-step="help"` + `id="cshse-help-trigger"`:

- Trigger icon: `lucide-react` `HelpCircle`.
- Click opens a dropdown styled exactly like the existing user-menu (`Layout.tsx:245-296`).
- Items:
  1. **Support page** — external anchor `target="_blank" rel="noopener noreferrer"`; URL is read from `import.meta.env.VITE_HELP_DOCS_URL` with a sensible default (`https://cshse.org/portal-help`); icon `ExternalLink`.
  2. **Chat with us** — opens `HelpChat` programmatically. Wires through a new tiny store (`client/src/store/helpChatStore.ts`: `{ isOpen, open(), close() }`); `HelpChat` reads `isOpen` from the store and existing-state migration is one-line. When `HelpChat.isAvailable === false`, the menu item is disabled with a tooltip "Chat is not configured for this environment."
  3. **Start / Restart Welcome Tour** — visible only when `location.pathname === '/dashboard'`. Label flips based on `tourStatus.welcome`: "Start the welcome tour" vs "Restart the welcome tour." Calls `startTour('welcome', { autoStarted: false })` + closes the dropdown.
- Opening the dropdown dismisses any active hint anchored to the trigger (the dropdown calls `dismissHint('welcome-tour-completed')` on open).

### Toast (light addition)

The CR direction calls for an error toast on persistence failure. The app has no global toast system today. **Minimal addition:** `client/src/components/Toast.tsx` — a tiny self-mounting bottom-right notification component backed by a `useToast()` zustand store (`{ items, push(message, variant), dismiss(id) }`). Auto-dismiss after 5s. This is NOT a new component library — it's one ~80 LOC component matching the existing Tailwind style. Reusable for future features (the spec for Sprint 6.1 already wanted error feedback that I had to omit).

### String registry (the i18n substitute)

`client/src/i18n/strings.ts`:

```ts
const STRINGS = {
  'tour.welcome.intro': 'Welcome to the CSHSE Self-Study Portal. Take a 60-second tour?',
  'tour.welcome.home': 'This is your home. From here you reach every part of the portal.',
  // ... one entry per UI key, namespaced
  'help.menu.supportPage': 'Support page',
  'help.menu.chatWithUs': 'Chat with us',
  'help.menu.startTour': 'Start the welcome tour',
  'help.menu.restartTour': 'Restart the welcome tour',
} as const;

type StringKey = keyof typeof STRINGS;
export type TFn = (key: StringKey, vars?: Record<string, string | number>) => string;
export function t(key: StringKey, vars?: Record<string, string | number>): string {
  let s: string = STRINGS[key];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}
```

Typed `StringKey` union prevents typos at compile time. Future migration to `react-i18next` (or similar) is a drop-in: replace `t` with the real `useTranslation().t` and keep call sites unchanged.

### Theme constant

`client/src/features/tour/tourTheme.ts` exports a single `TOUR_THEME` constant — colors (`teal-600` primary, `slate-200` progress track, `slate-900` text), button styles, z-index (`60`, above the existing modal layer at `50`). Used by both `<CshseTooltip>` and `<HintBalloon>`. The Joyride `styles` prop reads from the same constant.

## Server changes

**`server/src/models/User.ts`** — widen `IUserPreferences`:

```ts
export interface IUserPreferences {
  hideLegacyImporter?: boolean;
  tours?: Record<string, boolean>; // CR-052; values must be booleans
}
```

Schema adds `tours: { type: Map, of: Boolean }` to the preferences subdoc (Mongoose Map; keys are tour names; values are booleans). Tours follows the existing `markModified('preferences')` pattern.

**`server/src/routes/auth.ts`** — widen `PATCH /me/preferences`:

```ts
if ('tours' in body) {
  if (typeof body.tours !== 'object' || body.tours === null || Array.isArray(body.tours)) {
    return res.status(400).json({ error: 'tours must be an object' });
  }
  for (const [k, v] of Object.entries(body.tours)) {
    if (typeof v !== 'boolean') return res.status(400).json({ error: `tours.${k} must be a boolean` });
  }
  user.preferences.tours = { ...(user.preferences.tours ?? {}), ...body.tours };
}
```

Merge-in-place — never overwrite. Response echoes the full preferences blob with defaults applied (mirrors `hideLegacyImporter` behavior).

## Acceptance criteria

1. **First-time PC on `/dashboard`** with `preferences.tours.welcome` absent sees the welcome tour auto-start within 500ms of `/dashboard` rendering. Persistence verified via `User.preferences.tours.welcome === true` after FINISHED.
2. **Persistence is cross-device** — log out, log in on a different browser → tour does NOT auto-start.
3. **Help dropdown's "Restart Welcome Tour"** runs the tour on demand after completion. Visible only on `/dashboard`; label flips between "Start" / "Restart" based on `tourStatus.welcome`.
4. **Tour spotlight** correctly targets each `data-tour-step` element. Steps with `target: 'body'` + `placement: 'center'` render as centered modals (Joyride's built-in center placement; we verify the tooltip's bounding box is centered horizontally and vertically in a unit test).
5. **Body scroll is locked** during the tour; restored on FINISHED / SKIPPED / mid-tour unmount (verified by a test that mounts → starts tour → unmounts → asserts `document.body.style.overflow === ''` or the captured pre-mount value).
6. **Persistence failure** (server 500 or network drop) — the optimistic local update rolls back per the CR-045 pattern; `useToast().push(t('tour.persistenceFailed'), 'error')` fires; tour closes cleanly; the UI is not stranded.
7. **Post-completion hint** anchored to the Help button:
   - auto-dismisses after 8s (timer test),
   - dismisses when the Help dropdown opens (dispatch + assert),
   - dismisses on outside click (synthetic mousedown + assert).
8. **All tour + help copy uses `t()`**. Grep on the implementation finds no English string literals outside `client/src/i18n/strings.ts` (lint rule + manual review).
9. **Tooltip progress bar** width = `((currentStep + 1) / totalSteps) * 100%`. Pinned by a test that renders the tooltip with `index: 2, size: 5` and reads the `style.width` of the progress fill.
10. **Provider tree does not crash** when a user without a profile (`user.preferences === undefined`) hits a protected route. `shouldAutoStartWelcomeTour` returns `false`; the auto-start mounter is a no-op; rendering completes normally.
11. **HintProvider is independent** — a test mounts `<HintProvider>` WITHOUT `<TourProvider>` and `showHint` / `dismissHint` / `hasHint` work normally.
12. **`react-joyride`** is the only new third-party runtime dependency. Verified by `git diff package.json` showing exactly one added dep.

## Test plan

### Unit / component (vitest + @testing-library/react)

| Suite | What it pins |
|---|---|
| `features/tour/TourProvider.test.tsx` | (a) `tourStatus` derives correctly from `useAuthStore` user.preferences.tours mock. (b) `startTour` sets `activeTour`. (c) `endTour` clears `activeTour` without persisting. (d) `completeTour` calls `updatePreferences({ tours: { welcome: true } })` AND merges (mock prior `tours: { other: true }` → asserts the call is `{ tours: { other: true, welcome: true } }` so siblings survive). (e) `skipTour` same as (d). (f) Persistence rejection rolls back + closes + toast fires. (g) `shouldAutoStartWelcomeTour` returns false for excluded routes (`/login`, `/accept-invitation`, `/impersonate`). |
| `features/tour/HintProvider.test.tsx` | (a) `showHint` adds; second `showHint` with same id is a no-op (dedup). (b) `dismissHint` removes. (c) `hasHint(id)` + `getHint(id)` reflect state. (d) Works without TourProvider mounted (independence). |
| `features/tour/HintBalloon.test.tsx` | (a) Auto-dismisses after 8s (fake timers). (b) Click-outside dismisses (synthetic mousedown on document.body). (c) Anchors to `getElementById(targetId)` when the element is present; falls back to centered overlay when absent. |
| `features/tour/CshseTooltip.test.tsx` | (a) Progress bar width matches `((index + 1) / size) * 100%`. (b) Back hidden at `index === 0`. (c) Skip hidden on last step. (d) Primary button label flips Next ↔ Finish. (e) Each button calls the right callback. |
| `features/tour/WelcomeTour.test.tsx` | (a) Body scroll locked on mount; restored on unmount mid-tour. (b) FINISHED triggers `completeTour('welcome')` + (when `wasAutoStarted`) `showHint`. (c) SKIPPED + X both call `skipTour('welcome')` + fire the hint. (d) Persistence-failure path closes cleanly + toasts. |
| `components/HelpMenu.test.tsx` | (a) Dropdown items render based on route (`'Restart…'` only on `/dashboard`). (b) Label flips between "Start" and "Restart" based on `tourStatus.welcome`. (c) Clicking "Restart" calls `startTour('welcome', { autoStarted: false })`. (d) Clicking the trigger dismisses any anchored hint. (e) Chat item disabled + tooltip when `HelpChat.isAvailable === false`. |
| `features/tour/strings.test.ts` | (a) Every key referenced in `getWelcomeTourSteps` exists in `STRINGS`. (b) `t('key', { name: 'Eric' })` interpolates correctly. |

### Server integration

| Suite | What it pins |
|---|---|
| `server/tests/integration/preferences-tours.test.ts` | (a) PATCH `{ tours: { welcome: true } }` persists + returns the merged blob. (b) PATCH preserves `hideLegacyImporter` siblings. (c) PATCH `{ tours: 'bad' }` → 400. (d) PATCH `{ tours: { welcome: 'yes' } }` → 400. (e) Repeat PATCH merges (second PATCH with `{ tours: { newer: true } }` keeps `welcome: true`). (f) GET `/me` returns the persisted tours map. |

### E2E (Playwright, seed-driven on develop)

`e2e/tests/18_welcome_tour.spec.ts`:

- Seed a fresh user via `/api/test/seed` (CR-034) with `preferences.tours === undefined`.
- Log in; assert redirect to `/dashboard`.
- Assert the Joyride beacon appears within 2s.
- Walk every step via "Next"; final step's button label is "Finish".
- Click Finish; assert `GET /api/auth/me` returns `preferences.tours.welcome === true`.
- Assert the post-completion hint appears anchored to the Help button.
- Wait 9s; assert the hint is gone (auto-dismiss).
- Click the Help trigger; assert the "Restart Welcome Tour" item is visible with label "Restart…".
- Skip-path variant: in a second `test()`, click Skip after step 1; same persistence check (skip is also a completion for the auto-start gate).

## Files affected

### Server (additive)

- `server/src/models/User.ts` — widen `IUserPreferences.tours?: Record<string, boolean>` + schema Map.
- `server/src/routes/auth.ts` — widen `PATCH /me/preferences` allowlist; merge `tours` into existing.
- `server/tests/integration/preferences-tours.test.ts` (new).

### Client (additive)

- `client/package.json` — add `react-joyride`.
- `client/src/i18n/strings.ts` (new) — typed in-house string registry.
- `client/src/store/authStore.ts` — `UserPreferences` widens to include `tours?: Record<string, boolean>`. The existing `updatePreferences` already accepts arbitrary `Partial<UserPreferences>`; no behavioral change there.
- `client/src/store/helpChatStore.ts` (new) — tiny store exposing `{ isOpen, open(), close() }` so the Help dropdown can open the existing chat widget.
- `client/src/components/HelpChat.tsx` — replace local `useState(isOpen)` with `useHelpChatStore().isOpen`; keep behavior identical otherwise.
- `client/src/components/Toast.tsx` (new) + `client/src/store/toastStore.ts` (new) — minimal global toast.
- `client/src/components/HelpMenu.tsx` (new) — the dropdown trigger.
- `client/src/components/Layout.tsx` — mount `<HelpMenu />` next to the existing cogwheel; mount `<Toast />` at the bottom of the layout shell; add `data-tour-step` attributes to nav links; pull in `<HintLayer />` + `<WelcomeTour />` + `<WelcomeTourAutoStart />` from `<TourProvider>`.
- `client/src/features/tour/TourProvider.tsx` (new).
- `client/src/features/tour/HintProvider.tsx` (new) + `HintBalloon.tsx` + `HintLayer.tsx`.
- `client/src/features/tour/WelcomeTour.tsx` (new) + `CshseTooltip.tsx`.
- `client/src/features/tour/welcomeTourSteps.tsx` (new) — exports `TOUR_TARGETS`, `TOUR_TARGET_IDS`, `getWelcomeTourSteps(t)`.
- `client/src/features/tour/tourTheme.ts` (new).
- `client/src/features/tour/WelcomeTourAutoStart.tsx` (new) — small effect-only component that reads `useTour()` + `useLocation()` and dispatches the auto-start once per session.
- `client/src/App.tsx` — wrap the `<Layout>` route subtree in `<TourProvider><HintProvider>…</HintProvider></TourProvider>`.
- All new test files mirror the suites in the test plan.

### E2E (additive)

- `e2e/tests/18_welcome_tour.spec.ts` (new) — seed-driven.

## Dependencies

- [[cr-045-pc-ui-preferences]] — preferences storage mechanism; this CR widens the schema following the same pattern.
- [[cr-034-e2e-seed-endpoint]] — E2E seed-driven fresh-user setup.
- HelpChat (existing) — programmatically opened by the new Help dropdown.

## Open questions — RESOLVED 2026-05-30

- **Auto-start for all roles** — ✅ confirmed YES. Same `welcome` tour for everyone; `getWelcomeTourSteps` accepts a `role` and filters role-specific steps (Self-Study only for PC/admin/superuser; Review queue only for reader/lead/admin/superuser; Compilations only for lead/admin/superuser; Settings only for admin/superuser). Core steps (intro, home, help, last) always shown.
- **Support page** — ✅ DROPPED. There is no "Support Page" menu item. The Help RAG agent (existing `HelpChat`) IS the help; the dropdown has exactly two items: "Chat with us" + "(Re)start the welcome tour". This means **no `VITE_HELP_DOCS_URL` env var was added.**
- **Hint API public** — ✅ confirmed YES; this CR ships the plumbing; per-feature wirings land in follow-on CRs. All hint copy must follow the five-year-old voice rule.
- **Impersonation tour status** — ✅ DROPPED ("not needed"). The provider reads `user.preferences.tours` directly off the authenticated user with no special-casing for impersonated sessions.
- **Five-year-old voice** — ✅ enforced. Every tour + hint string in `client/src/i18n/strings.ts` is plain English describing what each surface IS, not what to do. A lint-style test (`strings.test.ts`) checks the tour namespace for common computer-jargon tokens.

## Resolution (2026-05-31, Sprint 12 / S12.3) — additional first-time hints wired

Two more high-traffic surfaces now fire a once-ever `useOnceHint` nudge (joining `compilation-first-final` and `checklist-first-verify` from S9.3). All copy follows the five-year-old voice rule.

- **Reader scoring** — `reader-first-score`, fired from `client/src/features/reader/ReaderReviewScreen.tsx` (container effect, gated on `canScore` + loaded submission), anchored to the first spec's score selector. The anchor is a new optional `anchorId` on `Score4LevelSelector` (`client/src/features/reader/Score4LevelSelector.tsx`), passed by `ReaderSpecRow` as `score-selector-<std>-<spec>`. String `hint.reader.firstScore` in `client/src/i18n/strings.ts`.
- **Relay queue** — `relay-first-queue`, fired from `client/src/features/admin/RelayConsole/RelayConsole.tsx` (container effect, gated on the queue having ≥1 comment), anchored to the new `#relay-queue-header`. String `hint.relay.firstQueue`.
- **Tests:** structural anchors pinned — `ReaderReviewScreen.test.tsx` (`#score-selector-1-a` present when scorable) and `RelayConsole.test.tsx` (`#relay-queue-header` present). The `useOnceHint` fire-once/persist/reset/fail-soft behavior remains covered by `useOnceHint.test.tsx`. All green (25 across the touched suites).
- The hint primitive is the reusable point; further surfaces can be wired the same way without new infrastructure.
