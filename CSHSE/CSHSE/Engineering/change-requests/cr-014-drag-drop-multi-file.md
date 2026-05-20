---
name: CR-014 — Drag-and-drop multi-file upload
description: Supporting Evidence pickers accept multi-file drag-and-drop, replacing the single-file picker dialog.
type: change-request
cr_id: CR-014
status: proposed
priority: P1
source: [[webinar-action-items-2026-05-20#50-36]]
sprint_target: Sprint 2 or 3
tags: [evidence, upload, ux]
last_reviewed: 2026-05-20
---

# CR-014 — Drag-and-drop multi-file upload

## Summary

The current Supporting Evidence upload uses a point-and-select dialog that takes one file at a time. The webinar confirmed coordinators want drag-and-drop with multi-file selection — a long-standing user request.

## Source quotes

> **[50:36 — Eric]:** "you can upload multiple files a right now. This is point this can point and select a file in a folder, but we are going to change to drag and drop to allow multiple. This was a something that had been suggested."

## Decision

Drop zone on every evidence picker:

- Accepts drag-and-drop with full directory traversal.
- Accepts traditional click-to-browse with `multiple` attribute on the input.
- Per-file progress indicator.
- Server uploads as a chunked stream; resumable if connection drops.
- Each uploaded file is auto-attached to the current spec; a confirm step lets the PC move files between specs.

## Acceptance

- [ ] Drop zone on `EvidenceUploader` accepts multi-file drag + click-to-browse.
- [ ] Progress bar per file; failure isolated to that file.
- [ ] Server endpoint accepts batched/chunked upload; total payload size limit documented + enforced.
- [ ] Existing single-file upload paths still work (no regression).
- [ ] Reuse the AI Import wizard's S3 upload code where possible.
- [ ] E2E: drop 5 PDFs → all upload → all visible in spec evidence list.

## Files affected

- `client/src/features/selfStudy/Editor/EvidenceUploader.tsx`
- `server/src/controllers/evidenceController.ts`
- `server/src/services/s3Service.ts` (or GridFS equivalent)

## Dependencies

- None.

## Open questions

- Pre-flight virus scan for evidence uploads? Defer to security work.
