---
name: CR-023 — Julia-as-relay workflow
description: Admin (Julia) has a dedicated screen for relaying reader comments back to the PC with redaction and editing.
type: change-request
cr_id: CR-023
status: shipped
priority: P1
source: [[webinar-action-items-2026-05-20#1-11-35]], [[webinar-action-items-2026-05-20#1-18-31]]
sprint_target: Sprint 4 (S4.3) — server endpoints + admin RelayConsole client both shipped 2026-05-30.
tags: [admin, julia, relay, comments, identity-redaction]
last_reviewed: 2026-05-30
revision_history:
  - 2026-05-20 — proposed
  - 2026-05-30 — server endpoints shipped: POST /api/comments/:id/relay (with optional sanitized text + pcLabel + reason), DELETE /api/comments/:id/relay (un-relay), POST /api/comments/:id/escalate (board flag), GET /api/submissions/:id/comments/relay-queue (lead-reader inbox of unrelayed + escalated). Every transition writes a comment.relayed / comment.unrelayed audit entry. 9 integration tests pin role gating (reader/PC = 403; lead_reader = 200) and PC visibility flips on relay/unrelay.
  - 2026-05-30 — client shipped: `client/src/features/admin/RelayConsole/RelayConsole.tsx` — pure `RelayConsoleView` (loading/empty/error states; one card per queue item with sanitized-text + pcLabel + reason inputs + Relay/Un-relay/Escalate buttons + state chips) + container with TanStack-Query mutations targeting the four CR-023 endpoints. 7 unit tests on the view.
---

# CR-023 — Julia-as-relay workflow

## Summary

The whole lockout + identity-redaction system ([[cr-004-comment-threading-identity-redaction]], [[cr-005-pc-lockout-on-final-submit]]) hinges on Julia (admin) actively triaging reader comments and relaying selected ones back to the PC. We need a dedicated relay screen that supports this workflow.

## Source quotes

> **[1:11:35 — Yvonne]:** "the application itself, I assume, is locked once they submit it, so a reader would need to go back through Julia to actually let them know what they needed to add at any point, is that correct?"
> **[1:12:10 — Eric]:** "That's absolutely correct."

> **[1:18:31 — Julia]:** "if readers disagree on the comments, we usually bring it before the board, and the board votes on what we think is appropriate moving forward… one of those comments may be irrelevant"

## Decision

Admin Relay Console, per self-study in `in-review` status:

- Left pane: all reader comments + DMs + lead-reader-flagged items, grouped by standard.
- Right pane: relay editor for the selected comment.
  - Toggle: relay / hold.
  - Edit text (sanitize PII, anonymize, summarize for board-relay).
  - Set `pcLabel` (e.g., "Reader A" or blank).
  - "Send to PC" button — triggers PC notification + makes the comment visible in PC tier.
- Top pane: filter by reader, by status (held / relayed / board-pending), and search.

A "Send to Board" flag separately escalates a comment to the board's review queue.

## Acceptance

- [ ] Admin Relay Console route + access guard (admin only).
- [ ] All reader-tier comments visible on the left pane.
- [ ] Relay editor saves both original (immutable) and relayed (editable) versions.
- [ ] Audit-log entry per relay/unrelay/board-escalation.
- [ ] PC notification on first relay per standard.
- [ ] E2E: 3 readers comment → Julia opens console → sees all 3 → relays 2 (anonymized) → board-escalates 1 → PC sees the 2 relayed comments anonymously.

## Files affected

- `client/src/features/admin/RelayConsole/` (new)
- `server/src/controllers/relayController.ts` (new)
- `server/src/models/Comment.ts` — `relayed`, `relayedText`, `pcLabel`, `boardEscalated`

## Dependencies

- [[cr-004-comment-threading-identity-redaction]] — defines the data model
- [[cr-005-pc-lockout-on-final-submit]] — PC must be in read-only state during relay
- [[cr-007-reader-access-after-submit]] — readers must be commenting in the first place
- [[cr-009-compilation-tab-lead-reader]] — lead-reader-flagged items feed in

## Open questions

- Should Julia be able to bulk-relay? Probably yes for efficiency.
- Does the board need its own console, or does Julia handle board actions on their behalf? Lean: dedicated board view in v2, Julia-only for v1.

## Verification (2026-05-31) — PARTIAL

Code-verified during the 2026-05-31 sweep. **Backend + UI both built:** relay / un-relay / escalate / relay-queue endpoints exist (`server/src/controllers/commentController.ts:480-606`, `routes/comments.ts:111-133`, mounted `index.ts:187`), each writes an audit event; and a full `RelayConsole` client is wired to all of them (`client/src/features/admin/RelayConsole/RelayConsole.tsx`). **Gap:** `RelayConsole` is **never imported or mounted** anywhere (a repo-wide search finds no reference outside its own file/test) — it is dead UI, so Julia cannot reach the relay workflow in the running app. Also: suggestions only flow through relay at the **comment** level; the consolidated suggestions DOCX gates reader override notes / AI suggestions by `mode` rather than an explicit per-suggestion relay step. Remaining work: mount `RelayConsole` into an admin/lead route; decide whether suggestions need their own relay control. Scheduled Sprint 11 in [[sprint-plan-2026-05-31]]. (Note: relay role gate is admin OR lead_reader OR superuser — confirm lead readers relaying matches CR-004's "admin/Julia" intent.)

## Resolution (2026-05-31, Sprint 11 / S11.2) — SHIPPED

The orphaned-UI gap is closed: `RelayConsole` is now reachable in the running app.
- **Host page** `client/src/pages/RelayConsolePage.tsx` (new) — two modes: `/relay` shows a picker that lists submissions in review statuses (`submitted | under_review | readers_assigned | review_complete`; drafts/in-progress hidden), and `/relay/:submissionId` embeds the existing `RelayConsole` queue with a back link. Access is gated in-page (`admin || lead_reader || superuser`); PCs and plain readers get an Access Denied card — mirrors the server relay role gate (`commentController.ts:480-606`).
- **Routes** `client/src/App.tsx` — `<Route path="relay">` and `<Route path="relay/:submissionId">` mounted inside the protected `Layout` subtree.
- **Nav** `client/src/components/Layout.tsx` — a "Relay" inbox link surfaces for lead-reader/admin (`isLeadOrAdmin`).
- Tests: `client/src/pages/RelayConsolePage.test.tsx` (5) — access guard (PC + plain reader denied, lead_reader allowed), picker filters to review statuses (draft hidden), per-submission route renders the embedded queue and hits `/api/submissions/:id/comments/relay-queue`. Existing `RelayConsole.test.tsx` (7) still green.
- Open question (lead-reader relay vs CR-004 "admin/Julia" intent): kept lead_reader in the gate to match the pre-existing server gate; no behavior change. Bulk-relay / suggestion-level relay remain deferred to v2 per Open questions above.
