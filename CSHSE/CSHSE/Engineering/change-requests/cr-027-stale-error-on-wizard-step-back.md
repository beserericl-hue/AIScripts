---
name: CR-027 — Stale error persists when navigating back to wizard Upload step
description: When the coordinator clicks back from Review to the Upload step, the prior session's matcher / pipeline error stays visible on the fresh upload screen. The error should be cleared the moment the user lands on Upload with no active run.
type: change-request
cr_id: CR-027
status: proposed
priority: P1
source: User observation 2026-05-21 (smoke test of `423eaf7` wizard build)
sprint_target: Sprint 2B / Sprint 3 polish
tags: [wizard, errors, ux, state-management]
last_reviewed: 2026-05-21
---

# CR-027 — Stale error persists when navigating back to wizard Upload step

## Summary

When the coordinator is on the Review (or any later) step of the Importer Wizard and clicks back to **Upload**, the prior session's error string (e.g. `matcher job-118f83ae722b:prose:868db34d: Server disconnected without sending a response.`) stays displayed in a red panel at the bottom of the upload form. The screen otherwise looks completely fresh — empty drop zone, default radio selections, no file selected — so the error message reads as if it applies to the new upload that hasn't even started yet. Customers will assume the system is broken, file support tickets, or not know whether to proceed.

The error was correctly suppressed in flight by [`ad88514`](../change-requests/cr-024-matrix-spec-bidirectional-link.md) (matcher transient errors no longer surface as banner errors mid-run), but a **historical** error from a prior import attempt still sticks in `aiImportStore.errors[]` and renders on every screen until manually cleared. The "Start over" path on the Parse step (`startOver()` action) clears errors correctly — the gap is that simply *navigating backwards* (without "Start over") does not.

## Source quotes

User, 2026-05-21:

> "I went from the review tab to the first tab. All of this should have been cleared and the screen is starting fresh. Having this error message showing like that will cause issues with customers."

(Screenshot attached to the conversation thread shows the empty Upload step with the red banner reading `matcher job-118f83ae722b:prose:868db34d: Server disconnected without sending a response.`)

## Decision

Two-pronged fix, both in `client/src/store/aiImportStore.ts`:

### 1. Clear errors when entering Upload with no active run

When the user lands on the Upload step (`step === 'upload'`) AND there's no active job (`status` is `idle | applied | finished | canceled | failed`), the store should automatically clear `errors` and the matcher's transient `warnings` carry-over.

Implementation options:

- **Option A (preferred):** add a clearing branch to `setStep('upload')`: if the current status isn't `'queued'` or `'parsing'`, clear `errors`. Surgical.
- **Option B:** mount-time clear in `UploadStep.tsx` via `useEffect` keyed on `[step]`. Component-coupled but more discoverable.
- **Option C:** always clear errors on every `setStep()` call regardless of direction. Simplest but loses error visibility when the user transiently moves between steps mid-failure.

Go with Option A — Upload is the canonical "fresh start" surface.

### 2. Re-arm errors visibility when a new upload kicks off

`startUpload()` already does `set({ ..., errors: [] })` (line 373). Confirm this isn't being overwritten by an SSE snapshot that re-injects the stale message.

A sub-bug: `_applySnapshot` (line 362) maps `snap.errors ?? current.errors`. If the server replays the prior job's snapshot once during the new upload's SSE handshake, the stale errors come back. Fix: when the local `importId` mismatches the snapshot's `importId`, drop `snap.errors` entirely.

## Acceptance

- [ ] Click "Back" from Review (or Matrix / Apply) → land on Upload → no red error panel visible.
- [ ] Wizard previously errored → close the browser tab → reopen the editor → the saved last-step state is restored, but no stale red banner appears on Upload.
- [ ] Mid-run errors still render (regression guard): cause a hard 4xx from cshse-ai during a fresh upload → the red banner shows as it does today.
- [ ] An SSE snapshot from a prior job (different `importId`) cannot inject errors into the current session's store.

## Files affected

- `client/src/store/aiImportStore.ts` — `setStep` branch + `_applySnapshot` importId filter
- Possibly `client/src/features/selfStudy/Editor/AIImport/steps/UploadStep.tsx` — if a UI-level clear-on-mount is preferred over the store branch

## Test plan

- **Client unit:** dispatch `setStep('review')` after a `failed` status with an error in `errors[]`; then `setStep('upload')`; assert `errors` is `[]`.
- **Client unit:** dispatch `_applySnapshot({ importId: 'A', errors: ['old'] })` after the store has `importId: 'B'`; assert `errors` remains `[]`.
- **E2E (Playwright):** wizard fails → coordinator clicks Back → upload screen empty + no red banner.

## Dependencies

- None. This is a polish fix; the underlying transient-error suppression shipped in `ad88514` already covers the in-flight case.

## Open questions

- Should the cleared errors be preserved anywhere (e.g. a "View prior errors" link) for the coordinator to read later? **Decision: no.** If they care about the cause they can see it during the failed run; once they navigate away the error has served its purpose. Audit-log entries on the server side are the durable record.
