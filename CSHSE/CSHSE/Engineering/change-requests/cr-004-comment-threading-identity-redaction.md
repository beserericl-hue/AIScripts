---
name: CR-004 — Comment threading with identity redaction
description: PC sees reader comments only after Julia relays them; reader names are never shown to the PC.
type: change-request
cr_id: CR-004
status: proposed
priority: P0
source: [[webinar-action-items-2026-05-20#1-18-28]], [[webinar-action-items-2026-05-20#1-15-35]]
sprint_target: Sprint 2
tags: [readers, comments, security, identity-redaction]
last_reviewed: 2026-05-20
---

# CR-004 — Comment threading with identity redaction

## Summary

Today's flow assumes readers and the PC have a live thread. Julia clarified the actual workflow: readers comment freely among themselves and with the lead reader, the board discusses, irrelevant or conflicting comments are pruned, and **only the sanitized, relayed set** reaches the PC — with reader identities stripped. The PC never sees raw reader names or the raw thread.

## Source quotes

> **[1:15:35 — Eric]:** "the reader can see the coordinator can read and reply, but not see the real name of the person who's making comments. If this is truly locked to the user, the program coordinator won't be able to see the self-study until it is unlocked."

> **[1:18:15 — Eric]:** "they won't see the name of the reader, but they'll see the comments."
> **[1:18:28 — Julia]:** "Yeah, we don't want that."
> **[1:18:31 — Julia]:** "if readers disagree on the comments, we usually bring it before the board, and the board votes on what we think is appropriate moving forward… one of those comments may be irrelevant"

## Decision

Two-tier comment visibility:

1. **Reader tier** — readers + lead reader + Julia/board see all comments with full reader identity. Discussion happens here.
2. **PC tier** — PC sees **only the comments Julia (or the board) marks as "relayed"**. Names are stripped on the way out. The PC sees `Reader A`, `Reader B`, etc. — or no attribution at all if Julia chooses.

A `relayed: boolean` field gates visibility. A `pcLabel` field stores the optional pseudonym. The PC can reply; replies go back through the same relay mechanism.

## Acceptance

- [ ] Comment model has `relayed: boolean`, `pcLabel: string | null`, `originalReaderId` (server-only).
- [ ] PC's view of comments filters `relayed === true` and omits `originalReaderId`.
- [ ] Reader/lead-reader view shows full identity and unrelayed comments.
- [ ] Julia/board UI lets a comment be marked relayed/unrelayed and assign a `pcLabel`.
- [ ] Server-side ACL: PC requesting `originalReaderId` is denied (not just hidden in UI).
- [ ] Audit log entry on every relay/unrelay event.
- [ ] Security test: a PC cannot reach reader-identity data via the API, even with crafted query params.

## Files affected

- `server/src/models/Comment.ts` (new or existing)
- `server/src/controllers/commentController.ts` (new) — relay endpoints
- `server/src/middleware/auth.ts` — role-aware comment serialization
- Reader review UI — comment thread component
- Julia/board admin UI — relay toggle

## Dependencies

- [[cr-007-reader-access-after-submit]] — readers only enter the loop after final submit
- [[cr-023-julia-relay-workflow]] — Julia's relay panel UI
- [[cr-005-pc-lockout-on-final-submit]] — PC is read-only during the comment cycle

## Open questions

- Default `pcLabel` policy: anonymized ("Reader A") or fully stripped? Leaning fully stripped per Julia's emphasis.
- Are reader-to-reader DMs ([[cr-010-portal-direct-messaging]]) ever relayed to PC? Default: never.
