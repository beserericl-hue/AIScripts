---
name: CR-016 — In-app bug reporter
description: One-click "Report an issue" surface inside the portal — auto-captures screenshot, route, browser, user context.
type: change-request
cr_id: CR-016
status: proposed
priority: P2
source: [[webinar-action-items-2026-05-20#37-56]]
sprint_target: Backlog
tags: [observability, support, ux]
last_reviewed: 2026-05-20
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
