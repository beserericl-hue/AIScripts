---
name: CR-021 — Reader-uploaded files (partial relevant evidence)
description: Readers can attach files to comments / suggestions when they have additional context the PC didn't include.
type: change-request
cr_id: CR-021
status: shipped
priority: P2
source: implied by [[webinar-action-items-2026-05-20#1-04-19]] relay flow
sprint_target: Sprint 5.3
tags: [readers, evidence, uploads]
last_reviewed: 2026-05-31
shipped_notes: |
  Sprint 9.4 (2026-05-31) — the deferred composer paperclip UI shipped onto
  the already-live attachment backend. `client/src/features/comments/CommentableText.tsx`
  gains a "Attach file" paperclip in the comment modal: files are staged,
  validated client-side against the server allowlist (PDF/DOC/DOCX/TXT, 25 MB)
  via a new pure `attachmentValidation` helper, then uploaded to the new
  comment's id AFTER create (the endpoint is keyed by commentId, so create must
  come first). Staged-file list with size + remove; an upload failure keeps the
  modal open with an error so the user can retry (comment already saved). No
  backend changes — server stays source of truth. 5 client unit tests. Commit
  `4f1e89d`. Note: verified via unit tests + typecheck, not driven live in a
  browser (reader-auth + text-selection flow).
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

- [x] `Comment` model has `attachments: [{ s3Key, filename, mimeType, sizeBytes, uploadedBy, uploadedByName, uploadedAt }]`.
- [x] Reader composer is wired up via `POST /api/comments/:id/attachments` (multipart `file`). Reader UI button is the next deliverable (composer paperclip; out of scope for this server-first slice — pin with the next comment-pane refactor).
- [x] Attachment visibility follows comment `relayed` state — `_canReadAttachment` returns true for reader / lead_reader / admin / superuser; PC gates on `comment.relayed === true`.
- [x] Server rejects oversized (>25 MB) + wrong-mime uploads (allowlist: PDF / DOCX / TXT) — multer caps at `25 MB + 1 KB`, controller re-checks size for clear error message.
- [x] Tests pin the round-trip: 11 integration tests cover upload (assigned reader 201, PC 403, bad MIME 400, no file 400), download ACL (reader from unrelayed 200, PC from unrelayed 403, PC from relayed 200, admin from any 200), delete (uploader 200, non-uploader reader 403, lead_reader 200).

## Files affected (as shipped, Sprint 5.3, 2026-05-30)

- `server/src/models/Comment.ts` — `CommentAttachmentSchema` + `attachments[]` on Comment.
- `server/src/controllers/commentController.ts` — `uploadCommentAttachment`, `downloadCommentAttachment`, `deleteCommentAttachment` + `_canReadAttachment` helper + MIME allowlist + 25 MB cap.
- `server/src/routes/comments.ts` — multer memory storage; routes `POST | GET | DELETE /api/comments/:commentId/attachments[/:attachmentId]`.
- `server/tests/integration/comment-attachments.test.ts` — 11 integration tests (s3Service spied with `vi.spyOn` + `vi.restoreAllMocks` per the §6 vitest gotcha).

## Deferred for the next pass

- Composer paperclip in the reader comment UI — out of scope for this server-first slice; pins with the next comment-pane refactor. The endpoints are live and contract-stable.
- Reader-comment surface in the Sprint 3 client doesn't yet exist (per session_context — readers use the in-narrative comment surface from the legacy editor); attachment UI lands when that surface lands.

## Dependencies

- [[cr-004-comment-threading-identity-redaction]] — attachment ACL exactly mirrors the comment ACL (`comment.relayed === true` for PC).
- [[cr-014-drag-drop-multi-file]] — reuses multer pattern from `routes/evidence.ts`.

## Open questions

- Versioning if a reader replaces a file? Lean: new attachment, old one preserved (current behavior — DELETE is explicit).
