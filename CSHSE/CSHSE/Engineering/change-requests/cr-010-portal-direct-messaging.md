---
name: CR-010 — Portal direct messaging (replaces reader email)
description: Lead reader and readers communicate inside the portal rather than via email back-and-forth.
type: change-request
cr_id: CR-010
status: shipped
priority: P1
source: [[webinar-action-items-2026-05-20#1-25-35]], [[webinar-action-items-2026-05-20#1-25-52]]
sprint_target: Sprint 5.4
tags: [messaging, readers, lead-reader, communication]
last_reviewed: 2026-05-31
shipped_notes: |
  Sprint 9.1 (2026-05-31) — notification pass. The deferred email/in-app
  mirror landed as a shared notification foundation that several CRs build
  on: new in-app `Notification` model (recipient inbox, `read`/`readAt`,
  `dedupeKey` partial-unique index for idempotent producers) +
  `notificationService` (`notify`/`notifyMany`: in-app row + fail-soft email
  twin via the existing emailService) + per-recipient inbox controller/routes
  (list / unread-count / mark-read / mark-all-read) + client `NotificationBell`
  in the Layout user-menu (unread badge, 30s poll, click marks read + navigates).
  DM `createThread` + `postMessage` now fan out to every OTHER participant
  (never the sender), in-app + email. 10 server integration + 8 client view-unit
  tests. Commits `6496aba` (core + DM) / `ca35031` (server inbox suite).
---

# CR-010 — Portal direct messaging (replaces reader email)

## Summary

Today readers email each other to clarify scoring decisions. Julia confirmed Vera (the previous platform) was supposed to enable in-portal conversations and never did. We need 1:1 (or small-group) direct messages, scoped to a self-study, so the lead reader can ask a reader for clarification without leaving the workflow.

## Source quotes

> **[1:25:35 — Julia]:** "when we did Vera, when we did the previous program, that's that was supposed to be what we could do, is be able to have the conversations through the [portal], as opposed to emailing each other back and forth, which is what we do now, to be able to have that conversation online"

> **[1:25:52 — Eric]:** "that's direct messaging through the portal action item, and then the lead reader will generate the compilation report."

## Decision

Conversation-scoped, threaded DMs:

- Participants: lead reader + 1 or more readers + (optional) admin (Julia).
- Scope: one self-study. A DM thread cannot span multiple self-studies.
- Visibility: participants only. **PC never sees DMs.** ([[cr-004-comment-threading-identity-redaction]] applies — DMs are never relayed by default.)
- Surface: a "Messages" tab in the reader workspace + a Compilation-tab side panel.
- Notification: email + in-app badge.

## Acceptance

- [x] `DirectMessageThread` + `DirectMessage` models with `submissionId`, `participantIds[]`, optional `contextStandardCode`/`contextSpecCode` (lead reader can start a thread from the Compilation tab with the spec context pre-filled).
- [x] Reader UI: `features/reader/Messages/` — pure `MessagesView` (sidebar of threads + inline thread reader + composer) + container wiring queries/mutations to `/api/submissions/:id/messages` and `/api/messages/:threadId`.
- [x] PC role has no API access to any DM thread — `_denyIfPC` short-circuits every endpoint to 403; tests pin: list 403, create 403, read-by-id 403, post-by-id 403. Adding a PC as a `participantId` is rejected at create time (400).
- [ ] Email + in-app notification on new message. **Deferred** — v1 server slice ships the storage + ACL; notifications land alongside the broader notification work.
- [ ] Audit log preserves DM content. **Deferred** — `DirectMessage` itself is append-only (no update endpoint) which gives the same compliance property; an explicit AuditLogEntry mirror can land later if needed.
- [x] Tests pin the round-trip: 9 server integration (PC 403 everywhere; PC rejected as participant; lead creates with another reader; both can read; non-participant reader 403; admin bypass; lastMessageAt bumps; per-participant list filter for non-elevated) + 7 client view-unit tests.

## Files affected (as shipped, Sprint 5.4, 2026-05-30)

- `server/src/models/DirectMessage.ts` (new) — both `DirectMessageThread` + `DirectMessage`.
- `server/src/controllers/directMessageController.ts` (new) — `listThreads` / `createThread` / `getThread` / `postMessage` with PC 403 + non-participant 403 + admin bypass + creates the first message in `createThread` for one-shot start.
- `server/src/routes/directMessages.ts` (new).
- `server/src/index.ts` — mounts the router at `/api`.
- `client/src/features/reader/Messages/Messages.tsx` (new) — pure `MessagesView` + container.

## Dependencies

- [[cr-009-compilation-tab-lead-reader]] — natural entry point for spec-context threads (CompilationTab integration is a follow-on).
- [[cr-004-comment-threading-identity-redaction]] — DMs are even stricter (never PC-visible at all).

## Open questions

- Group DMs vs strictly 1:1? Shipped: 1-to-many in one thread (participantIds is an array).
- File attachments? Still deferred — text-only for v1. CR-021's attachment primitives are reusable when needed.
- Reader page integration — the Messages component is reusable; the next pass mounts it as a tab on the Reader review screen and a side panel on CompilationTab.
