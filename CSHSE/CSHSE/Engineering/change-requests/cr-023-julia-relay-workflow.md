---
name: CR-023 — Julia-as-relay workflow
description: Admin (Julia) has a dedicated screen for relaying reader comments back to the PC with redaction and editing.
type: change-request
cr_id: CR-023
status: in-progress
priority: P1
source: [[webinar-action-items-2026-05-20#1-11-35]], [[webinar-action-items-2026-05-20#1-18-31]]
sprint_target: Sprint 4 (S4.3) — server endpoints shipped 2026-05-30; admin/Julia RelayConsole UI is Sprint 4 follow-up.
tags: [admin, julia, relay, comments, identity-redaction]
last_reviewed: 2026-05-30
revision_history:
  - 2026-05-20 — proposed
  - 2026-05-30 — server endpoints shipped: POST /api/comments/:id/relay (with optional sanitized text + pcLabel + reason), DELETE /api/comments/:id/relay (un-relay), POST /api/comments/:id/escalate (board flag), GET /api/submissions/:id/comments/relay-queue (lead-reader inbox of unrelayed + escalated). Every transition writes a comment.relayed / comment.unrelayed audit entry. 6 integration tests pin role gating (reader/PC = 403; lead_reader = 200) and PC visibility flips on relay/unrelay.
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
