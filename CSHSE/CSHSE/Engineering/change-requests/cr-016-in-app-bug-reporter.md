---
name: CR-016 — In-app bug reporter
description: One-click "Report an issue" surface inside the portal — auto-captures screenshot, route, browser, user context.
type: change-request
cr_id: CR-016
status: shipped
priority: P2
source: [[webinar-action-items-2026-05-20#37-56]]
sprint_target: Sprint 7.2
tags: [observability, support, ux]
last_reviewed: 2026-05-30
shipped_notes: |
  Sprint 7.2 — landed as the friction-reduction MVP. Auto-screenshot
  (html2canvas) intentionally deferred to a follow-on CR to keep the
  bundle slim (~800 KB savings). Everything else from the original
  acceptance is in place:
    - server BugReport model + POST /api/bug-reports + admin GET/PATCH
    - client BugReporter floating trigger + modal + console-error
      capture (rolling buffer of last 10; window.onerror +
      unhandledrejection too)
    - server-side defence-in-depth scrub for Bearer / JWT / AWS keys /
      password|secret|api[_-]?key shapes
    - reporter receives a `reference` (the BugReport _id)
    - admin can list + triage (status: new / triaged / resolved / dismissed)
  7 server integration + 10 client unit tests.
---

# CR-016 — In-app bug reporter

## Summary

Today's bug reporting requires the user to screenshot, write a paragraph, and email. Eric described this in the webinar as the only path. An in-app reporter would auto-capture the screenshot + route + browser + user context and let the user describe the issue in one click, lowering the bar for actually reporting issues.

## Source quotes

> **[37:56 — Eric]:** "the way that we want you to do this is for you to screenshot the screen to copy the error, or what you think should be, instead of what is, and write a paragraph about that, what you were doing at the time"

## Decision

A floating "Report issue" button (or keyboard shortcut). Click opens a modal:

- Screenshot (auto-captured of current viewport via `html2canvas` or similar)
- Free-text description
- Auto-attached: route URL, browser UA, build SHA, user ID + role, recent client console errors (last 10 entries)
- Submit → creates a Github issue (via gh API token) or persists to a server-side `BugReport` collection that Eric can triage.

## Acceptance

- [ ] Report button visible from all signed-in routes (excluding print views).
- [ ] Modal captures screenshot client-side; user can redact before submit.
- [ ] Submit creates persistent record + sends notification to engineering.
- [ ] User receives confirmation with reference number.
- [ ] Sensitive data (auth tokens, JWTs) filtered from console error capture.

## Files affected

- `client/src/components/BugReporter/` (new)
- `server/src/controllers/bugReportController.ts` (new)
- `server/src/models/BugReport.ts` (new)

## Dependencies

- None.

## Open questions

- Github-issue integration vs internal-only collection? Lean internal for now (PII concerns).

## S13d Resolution (2026-05-31) — auto-screenshot follow-on shipped (flag-gated)

The one deferred acceptance item — "Modal captures screenshot client-side" — is now delivered, behind a flag so the original bundle-size concern is preserved.

### How it's gated (zero default bundle cost)

- **Off by default.** Enabled either at build time (`VITE_ENABLE_BUG_SCREENSHOT=true`) or per-browser via a localStorage opt-in (`cshse:bug-screenshot` = `"on"`) — support can ask a user to flip it without a redeploy.
- **Lazy chunk.** `html2canvas@1.4.1` is loaded with a dynamic `import()` inside `captureScreenshot()`, so Vite code-splits it into its own chunk. The main bundle pays nothing unless the flag is on AND the user opens the reporter. (`html2canvas` is now a client dependency, but it never enters the entry bundle.)
- **Fail-soft.** Any capture error (missing chunk, tainted canvas, disabled flag) returns `null`; the report still sends without a screenshot.
- **Bounded.** Capture is the visible viewport only (`scale: 1`, JPEG q0.7). The server accepts the `screenshot` only when it matches `data:image/(png|jpeg|webp);base64,` and is ≤ 3 MB; otherwise it's silently dropped and the report still saves.

### Acceptance delta

- [x] Modal captures screenshot client-side (flag-gated; off by default). The "redact before submit" sub-clause is **not** in this pass — capture is opt-in and viewport-only; a redaction editor stays deferred (would need a canvas-draw UI). Recorded here, not silently skipped.

### Files touched (S13d, additive)

- `client/src/components/bugReporterScreenshot.ts` (new) — `isScreenshotEnabled()` + `captureScreenshot()` (lazy html2canvas).
- `client/src/components/BugReporter.tsx` — calls `captureScreenshot()` in `onSubmit`, attaches `screenshot` when present.
- `client/package.json` — `html2canvas@1.4.1` dependency (lazy-loaded only).
- `server/src/models/BugReport.ts` — optional bounded `screenshot` field.
- `server/src/controllers/bugReportController.ts` — validates + stores the data-URL, drops malformed/oversized.
- `client/src/components/bugReporterScreenshot.test.ts` (new, 4) + `server/tests/integration/bug-reports.test.ts` (+3) — flag gating + accept/reject/oversize.

Admin triage remains out-of-band (no client admin list view exists by design); the stored screenshot is returned by the existing admin `GET /api/admin/bug-reports`.
