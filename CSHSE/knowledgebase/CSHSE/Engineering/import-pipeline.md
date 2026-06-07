---
name: Import Pipeline
description: End-to-end flow for importing a legacy self-study DOCX/PDF, manually tagging sections, and applying them to a submission's narratives.
type: concept
tags: [import, gridfs, tipTap, state-machine, async]
last_reviewed: 2026-05-10
---

# Import Pipeline

The hardest flow in the application. Turns a 370MB Word document into navigable HTML stored in GridFS, lets a program coordinator manually mark section boundaries in a visual UI, extracts each tagged section into a structured `IDetectedSection`, and (optionally) sends sections to the [[n8n-integration|n8n Document Matcher]] for AI-assisted standard mapping.

## State machine (`SelfStudyImport.status`)

```
pending  →  processing  →  awaiting_selection  →  completed
                                                ↘  failed
                                                ↘  cancelled (cleanup of GridFS)
```

There is **no explicit state** for "tagging in progress." The system relies on `detectedSections[]` accumulating on the import doc.

## End-to-end steps

1. **Upload** — `POST /api/imports/upload` (Multer, 50MB request limit) creates a `SelfStudyImport` record in `pending`, returns 202 with `importId`. Spawns `processDocumentForManualTagging()` **without awaiting** ([server/src/controllers/importController.ts:232](../../../../server/src/controllers/importController.ts)). If the worker crashes, the request has already returned 202 — frontend has to poll status.
2. **Parse** — `documentParserService` (DOCX via Mammoth, PDF via pdf-parse). Extracts inline images to GridFS via `storeImage()`. Saves resulting HTML to GridFS via `storeHtmlContentFromFile()` (streams to avoid OOM). Status flips to `awaiting_selection`.
3. **Manual tagging** — frontend ([client/src/features/selfStudy/Editor/components/DocumentViewer.tsx](../../../../client/src/features/selfStudy/Editor/components/DocumentViewer.tsx)) renders the raw HTML via `dangerouslySetInnerHTML`. User drag-selects, clicks "Capture Selection," picks a section type (Standard / Curriculum Matrix / Appendix / Skip), specifies a standard code (1–21) + optional spec letter (a–h).
4. **Extract section** — `POST /api/imports/:id/extract-section` calls `gridFsService.insertHtmlMarker()` which replaces the selection with an HTML comment marker, captures `removedHtml` into `SelfStudyImport.extractedSections[]`, and stores text offsets for resume. **Table-aware**: if the selection lands inside a `<table>`, expansion goes to whole rows, with `TABLE_FRAG_START / TABLE_FRAG_END` comment wrappers around split fragments so non-tagged rows stay visible.
5. **Visual placeholder** — client replaces the selection with a styled `<div>✓ Extracted: {title}</div>`. On resume, [DocumentViewer.tsx](../../../../client/src/features/selfStudy/Editor/components/DocumentViewer.tsx) reconstructs placeholders by scanning markers; falls back to a banner if markers are absent.
6. **Finish tagging** — `POST /api/imports/:id/finish-tagging` applies sections to `Submission.narratives` (a nested `Map<standardCode, Map<specCode, INarrativeContent>>` — requires `markModified('narratives')` on save, [server/src/controllers/submissionController.ts:228](../../../../server/src/controllers/submissionController.ts)). Status flips to `completed`.
7. **Optional N8N matching** — when called with `processWithAI: true`, the server is supposed to send sections to the Document Matcher webhook. **This is currently a TODO that was marked done but never implemented** ([server/src/controllers/importController.ts:3176](../../../../server/src/controllers/importController.ts)). See [[incomplete-features-2026-05-10]].

## Marker / restore round-trip

`insertHtmlMarker` returns the original HTML so a section can be restored. The restore path uses `restoreMarker()` (two-pass stream — find marker offsets, then substitute and write a new GridFS file). **Restore is not atomic**: if the new-file write succeeds but the old-file delete fails, both files exist with no GC. See [[storage-layer]].

## Memory shape

The 370MB-document scenario is the design driver:

- HTML is streamed in via temp file (not loaded into a single string) at upload time.
- HTML is read out via `getHtmlContent()` which concatenates chunks — **not streamed**. Peak memory ≈ 2× file size when the client requests full content.
- Marker insert/restore both call `getHtmlContent()` internally, so each tagging operation on a 370MB doc spikes ≈ 740MB heap.
- `flattenString()` workaround for V8 `SlicedString` retention is documented in [[storage-layer]].

## Known gaps

| Gap | Impact |
|-----|--------|
| **GridFS orphans on crash** between `storeHtmlContentFromFile` and `SelfStudyImport.save()` | HTML stays in GridFS forever; only swept by `cleanupOrphanedFiles(dryRun=false)` if filename pattern matches. |
| **No duplicate-upload guard** in `POST /api/imports/upload` | Two simultaneous uploads for the same submission both succeed; second silently competes for GridFS write. |
| **No SLA / timeout** on background parse worker | Frontend can't tell "still parsing" from "worker died." |
| **Restore non-atomic** | Old + new GridFS files can both exist after partial failure; no auto-cleanup. |
| **N8N auto-mapping never wired** | `processWithAI: true` is a no-op; manual tagging is the only path that produces matches. |
| **Marker corruption** | If a marker write partially commits, restore can't find it; section is lost from the doc with no recovery UI. |
| **Cancel mid-tag orphans** | Cancel only cleans up if status is `pending` / `processing`; cancel during `awaiting_selection` may leave GridFS files. |

## Related

- [[storage-layer]] — GridFS and the marker insertion mechanism in detail
- [[n8n-integration]] — Document Matcher contract (when finally wired)
- [[frontend-architecture]] — DocumentViewer component
- [[security-audit-2026-05-10]] — XSS via `dangerouslySetInnerHTML` of imported HTML
- [[incomplete-features-2026-05-10]] — N8N auto-mapping TODO
