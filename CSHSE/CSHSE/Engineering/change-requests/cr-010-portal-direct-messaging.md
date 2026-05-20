---
name: CR-010 — Portal direct messaging (replaces reader email)
description: Lead reader and readers communicate inside the portal rather than via email back-and-forth.
type: change-request
cr_id: CR-010
status: proposed
priority: P1
source: [[webinar-action-items-2026-05-20#1-25-35]], [[webinar-action-items-2026-05-20#1-25-52]]
sprint_target: Sprint 5
tags: [messaging, readers, lead-reader, communication]
last_reviewed: 2026-05-20
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

- [ ] `DirectMessageThread` + `DirectMessage` models with `selfStudyId`, `participantIds[]`.
- [ ] Reader UI: Messages tab listing threads; click → reads + composes.
- [ ] Lead reader can start a thread from the Compilation tab (pre-fills the spec context).
- [ ] PC role has no API access to any DM thread; security test verifies.
- [ ] Email + in-app notification on new message.
- [ ] Audit log preserves DM content (compliance — readers are CSHSE volunteers, the conversation is a record).
- [ ] E2E: lead reader DMs reader → reader replies → conversation persists.

## Files affected

- `server/src/models/DirectMessageThread.ts` (new)
- `server/src/models/DirectMessage.ts` (new)
- `server/src/controllers/messageController.ts` (new)
- `client/src/features/reader/Messages/` (new folder)
- `client/src/features/reader/CompilationTab/SidePanel.tsx` — DM thread inline

## Dependencies

- [[cr-009-compilation-tab-lead-reader]] — primary entry point for DMs
- [[cr-004-comment-threading-identity-redaction]] — DMs are never PC-visible

## Open questions

- Group DMs vs strictly 1:1? Lean: support 1-to-many in the same thread for board discussion.
- File attachments? Defer — text-only for v1.
