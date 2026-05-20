---
name: CR-021 — Reader-uploaded files (partial relevant evidence)
description: Readers can attach files to comments / suggestions when they have additional context the PC didn't include.
type: change-request
cr_id: CR-021
status: proposed
priority: P2
source: implied by [[webinar-action-items-2026-05-20#1-04-19]] relay flow
sprint_target: Sprint 4 or 5
tags: [readers, evidence, uploads]
last_reviewed: 2026-05-20
---

# CR-021 — Reader-uploaded files

## Summary

The webinar discussed suggestions flowing back to the PC via Julia. In practice, readers sometimes have artifacts (a published CSHSE clarification memo, a model self-study from another institution, a reference rubric) that should travel with the suggestion. Today readers have no upload affordance on comments.

## Source quotes

Implied by Yvonne's "suggestions … need to go through the VP for accreditation, and back to the program."

## Decision

Comment-level file attachments:

- Reader UI: paperclip on the comment composer.
- Per-attachment ACL: Reader-tier visible always; PC-tier follows the comment's `relayed` state ([[cr-004-comment-threading-identity-redaction]]).
- File types: limit to PDF, DOCX, TXT for v1.
- Max size: 25 MB per file.
- Stored in S3 (same bucket as evidence) with `reader-attachments/` prefix.

## Acceptance

- [ ] `Comment` model has `attachments: [{ s3Key, filename, mimeType, sizeBytes }]`.
- [ ] Reader comment composer accepts files.
- [ ] Attachment visibility follows comment `relayed` state.
- [ ] Server rejects oversized + wrong-mime uploads.
- [ ] E2E: reader attaches file → lead reader sees → Julia relays comment → PC sees file.

## Files affected

- `server/src/models/Comment.ts`
- `server/src/controllers/commentController.ts`
- Reader comment UI

## Dependencies

- [[cr-004-comment-threading-identity-redaction]] — attachment ACL follows comment ACL
- [[cr-014-drag-drop-multi-file]] — reuse upload primitives

## Open questions

- Versioning if a reader replaces a file? Lean: new attachment, old one preserved.
