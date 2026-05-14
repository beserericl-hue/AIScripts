---
name: Import Marker Mechanism
description: How the import flow physically shortens the uploaded document by replacing extracted text with HTML comment markers, the table-aware variant for split rows, the restore round-trip, and exactly how all this lives in the database.
type: concept
tags: [import, markers, gridfs, mongodb, tables, memory]
last_reviewed: 2026-05-10
---

# Import Marker Mechanism

This is the deep mechanical companion to [[import-pipeline]]. That page covers the user-facing flow and state machine. This page covers **what happens to the actual bytes** when a coordinator captures a section — how the original file is annotated with placeholder markers, how the extracted text is physically removed from the GridFS HTML so the document gets shorter as you tag, how tables are handled specially, what's stored in MongoDB vs GridFS, and how restore puts it all back.

> **The single most important concept on this page:** the file shortens because every extracted region is replaced with a tiny `<!-- EXTRACTED:... -->` HTML comment. A 50KB tagged paragraph becomes ~80 bytes of marker. Across a 370MB document, this is the difference between an unmanageable workspace and one that loads.

## The two-step extract operation

Tagging a section is **two separate API calls** from the client. They are deliberately decoupled so that very large documents don't OOM the server.

### Step 1: `POST /api/imports/:id/extract-section`
[server/src/controllers/importController.ts:2423-2513](../../../../server/src/controllers/importController.ts)

Stores the section metadata + the captured HTML in MongoDB. **Does NOT touch GridFS.**

Request body (from [DocumentViewer](../../../../client/src/features/selfStudy/Editor/components/DocumentViewer.tsx) → [SectionTagger](../../../../client/src/features/selfStudy/Editor/components/SectionTagger.tsx)):
```ts
{
  htmlContent: string,        // exact HTML the user selected (range.cloneContents → outerHTML)
  sectionType: 'standard' | 'matrix' | 'appendix' | 'skip',
  standardCode?: '1'..'21',
  specCode?: 'a'..'h',
  title: string,
  appliedDirectly?: boolean,  // if true, skip the "tagged" stage and write straight to Submission.narratives
  textStartOffset: number,    // plain-text character offset (server's text walk, not DOM)
  textLength: number          // plain-text character length
}
```

Server actions ([importController.ts:2455-2491](../../../../server/src/controllers/importController.ts)):

1. Generate `sectionId = uuidv4()`.
2. Push a new `IDetectedSection` onto `SelfStudyImport.detectedSections[]` with the captured HTML, the text offsets, and the user's tag metadata.
3. `markModified('detectedSections')` then `save()`.
4. Reply `{ success: true, sectionId, ... }`.

The block comment at [importController.ts:2494-2500](../../../../server/src/controllers/importController.ts) is load-bearing — read it:

> *"NOTE: We intentionally DO NOT update the GridFS HTML to remove extracted content. Reasons: (1) For large documents (300MB+), this operation consumes too much memory and crashes the server. (2) The client already shows placeholders in the DOM via DocumentViewer. (3) Tagged sections are tracked in MongoDB and shown in the Tagged Sections list. (4) When user reloads, content is visible but clearly tracked as 'extracted' in the list. This is a deliberate trade-off: slight visual inconsistency on reload vs server stability."*

Step 1 alone produces no GridFS shrinkage. The visual placeholder the user sees is purely DOM-side (see "Client-side placeholder swap" below). Until step 2 runs, a page reload would re-render the original HTML.

### Step 2: `POST /api/imports/:id/insert-marker`
[server/src/controllers/importController.ts:2520-2574](../../../../server/src/controllers/importController.ts)

This is what physically modifies the GridFS HTML and shortens it. It is a separate request because the GridFS read+write is the expensive operation — separating allows the client to update its UI immediately on step 1's response, then fire step 2 asynchronously.

Request body:
```ts
{
  sectionId: string,          // from step 1's response
  title: string,
  sectionType: string,
  contentLength: number,      // number of plain-text chars being replaced
  textStartOffset: number,    // SAME values as step 1
  textLength: number
}
```

Server actions:

1. Build the marker string ([importController.ts:2535](../../../../server/src/controllers/importController.ts)):
   ```ts
   const safeTitle = (title || 'Untitled').replace(/-->/g, '—>').replace(/--/g, '—');
   const marker = `<!-- EXTRACTED:${sectionId}:${sectionType || 'standard'}:${safeTitle}:${contentLength || 0} -->`;
   ```
   `--` and `-->` in the title get rewritten to `—` (em dash) so the title can never accidentally close the comment.
2. Call `gridFsService.insertHtmlMarker(importId, marker, textStartOffset, textLength)` ([importController.ts:2539](../../../../server/src/controllers/importController.ts)).
3. On success, write `removedHtml`, `htmlContextBefore`, `htmlContextAfter`, and `wasTableExpanded` back onto the `IDetectedSection` ([importController.ts:2547-2564](../../../../server/src/controllers/importController.ts)) — these are the keys to **accurate restore later**.

If the offset can't be resolved in the current HTML the server replies 422 ([importController.ts:2543-2545](../../../../server/src/controllers/importController.ts)). The client can decide whether to retry (e.g., after a `repair-document` round trip).

## How the marker is built

```
<!-- EXTRACTED:{sectionId}:{sectionType}:{safeTitle}:{contentLength} -->
```

| Field | Source | Used by |
|-------|--------|---------|
| `sectionId` | `uuidv4()` from step 1 | Restore lookup; placeholder data attribute |
| `sectionType` | `'standard' \| 'matrix' \| 'appendix'` (skip never produces a marker) | Placeholder color class on the client |
| `safeTitle` | User-supplied title with `--` neutralised | Placeholder label visible on resume |
| `contentLength` | Plain-text chars removed (for display) | Placeholder "(N chars)" subtitle |

Concrete example:
```html
<!-- EXTRACTED:5b8a4c2f-1e7d-4f9a-8b3c-9d7e5a6f1234:standard:Standard 11.a Curriculum Overview:18342 -->
```

The marker is **~80–200 bytes** regardless of how much text it replaces. Replacing a 50,000-character paragraph saves ~50KB of GridFS storage and ~50KB on every subsequent `getHtmlContent()` call.

## Walking text vs. walking HTML — the offset model

`insertHtmlMarker` needs to map the **plain-text character offset** the client sent into the **HTML byte position** in GridFS. They are different — HTML has tags, comments, and entities that don't exist in the plain text.

The walker in [gridFsService.ts:705-751](../../../../server/src/services/gridFsService.ts) implements one consistent rule:

- `<` opens a tag → skip until `>`. Tag bytes don't advance `textPos`.
- `<!--` opens a comment → skip to `-->`. (Important: **markers count as comments** so subsequent extractions don't see prior markers as text.)
- `&...;` is one HTML entity → counts as **one** text character (browser renders it as one).
- Everything else = one text character; `textPos++` and stop when you hit `textStartOffset` (and again at `textStartOffset + textLength`).

The same walker is exported as `extractTextFromHtml()` ([gridFsService.ts:502-539](../../../../server/src/services/gridFsService.ts)) so the **client-side text offset and the server-side text offset always agree** if the client uses the same logic. (The client computes offsets from the rendered DOM with a `TreeWalker` that skips placeholder elements — see [DocumentViewer.tsx:472-498](../../../../client/src/features/selfStudy/Editor/components/DocumentViewer.tsx).)

After locating the text range, the walker expands to **HTML tag boundaries**:

- Non-table content ([gridFsService.ts:805-823](../../../../server/src/services/gridFsService.ts)): nudge the start back to the nearest `<` and the end forward to the nearest `>` so the marker doesn't land mid-tag.
- Table content ([gridFsService.ts:782-803](../../../../server/src/services/gridFsService.ts)): expand all the way out to `<table` … `</table>` boundaries (see "Tables get special treatment" below).

The expanded HTML range is then captured as `removedHtml` ([gridFsService.ts:826](../../../../server/src/services/gridFsService.ts)), used both for restore and for the row-fragment computation. `htmlContextBefore` and `htmlContextAfter` (300 chars each) are also captured for fuzzy repair matching ([gridFsService.ts:830-831](../../../../server/src/services/gridFsService.ts)).

## Tables get special treatment

Tables are the hardest thing in this pipeline. The naive approach — dropping a comment in the middle of `<tr><td>...</td></tr>` — corrupts the table on the next render. Two layers of defense:

### Layer 1 — full-table boundary expansion (server, GridFS)

When the requested range is inside a table, the marker replaces the **entire `<table>...</table>`**, not just the selected rows ([gridFsService.ts:782-803](../../../../server/src/services/gridFsService.ts)). This guarantees symmetric round-tripping: `restoreMarker` does a clean 1:1 substitution of bytes back into the table's slot.

### Layer 2 — `TABLE_FRAG_START` / `TABLE_FRAG_END` wrappers (server, GridFS)

But replacing the whole table makes the **non-tagged rows disappear**. So `insertHtmlMarker` also computes two side fragments ([gridFsService.ts:836-901](../../../../server/src/services/gridFsService.ts)):

- `splitBefore` — a synthesized `<table>` containing the rows above the tagged content (with `<colgroup>`/`<col>`/`<thead>` structural header preserved).
- `splitAfter` — a synthesized `<table>` containing the rows below.

These are wrapped around the marker with comment delimiters:

```
<!-- TABLE_FRAG_START:{sectionId} -->
<table>...rows above the tag...</table>
<!-- EXTRACTED:{sectionId}:standard:My Section:18342 -->
<table>...rows below the tag...</table>
<!-- TABLE_FRAG_END:{sectionId} -->
```

The end result on the user's screen: the tagged rows are gone, replaced by a "✓ Extracted" placeholder, while the non-tagged rows stay visible above and below — *as if* you had only removed those specific rows.

The wrappers are critical for restore — see "Restore prefers `TABLE_FRAG`, falls back to `EXTRACTED`" below.

### Layer 3 — table-aware DOM removal (client, in-memory)

Independent of the GridFS write, the client also has to update its in-memory DOM after a successful tag so the user sees the placeholder immediately without a round trip. This uses a **completely different mechanism** because `range.deleteContents()` corrupts table structure ([DocumentViewer.tsx:130-174](../../../../client/src/features/selfStudy/Editor/components/DocumentViewer.tsx)):

- Find the ancestor `<table>`.
- Iterate `table.rows`, identify rows that overlap the range using `range.compareBoundaryPoints(Range.START_TO_END, rowRange) > 0 && range.compareBoundaryPoints(Range.END_TO_START, rowRange) < 0`. Note the use of `compareBoundaryPoints` rather than `range.intersectsNode` — the latter returns true for boundary touches at offset 0.
- **Collect rows BEFORE any DOM mutation.** DOM changes invalidate Range objects, so you cannot iterate-and-delete in one pass.
- Insert the placeholder before the table, then `row.remove()` each collected row.
- If the table ends up empty, remove the table too.

This rule is documented in the project's auto-memory and re-stated in [DocumentViewer.tsx:131-138](../../../../client/src/features/selfStudy/Editor/components/DocumentViewer.tsx) as a comment to keep future contributors out of the trap.

## Client-side placeholder swap

After the user clicks Save in [SectionTagger](../../../../client/src/features/selfStudy/Editor/components/SectionTagger.tsx), [SelfStudyEditor](../../../../client/src/features/selfStudy/Editor/SelfStudyEditor.tsx) sends step 1, then step 2 in parallel. Then it sets `lastSavedSection` state, which trips a `useEffect` in [DocumentViewer.tsx:116-195](../../../../client/src/features/selfStudy/Editor/components/DocumentViewer.tsx). That effect:

1. Reads the captured Range from `lastCapturedRangeRef`.
2. Builds a `<div class="extracted-section-placeholder">` element with type-coloured styling and the section title.
3. Replaces the captured DOM range with it (using table-aware row removal if needed).
4. Calls `onPlaceholderInserted(updatedHtml)` so the parent gets the post-mutation HTML.

The placeholder is **purely visual** — it's not what step 2 inserts into GridFS. The two systems converge on resume: the comment markers in GridFS get rendered as identical-looking placeholders by a different code path.

## Resume: marker-to-placeholder reconstruction

When the user reloads the page or returns to a partly-tagged import, the server returns the GridFS HTML *as it currently is* — already shortened, with markers embedded. The client doesn't need to know which sections were extracted; it just scans the rendered DOM for marker comments.

[DocumentViewer.tsx:201-324](../../../../client/src/features/selfStudy/Editor/components/DocumentViewer.tsx):

1. After the HTML mounts (200 ms delay; 1000 ms for documents > 10 MB to give the browser time to paint).
2. Skip if `.extracted-section-placeholder` elements already exist (current session, no resume needed).
3. Walk the DOM with `document.createTreeWalker(root, NodeFilter.SHOW_COMMENT)`.
4. For each comment matching `/^EXTRACTED:([^:]+):([^:]+):(.+):(\d+)$/`, build a placeholder div and `replaceChild` the comment with it.
5. **Cross-reference against `taggedSections`** (the `SelfStudyImport.detectedSections[]` list from MongoDB):
   - If the marker's `sectionId` is in the active list → render a **green/teal/amber/gray "✓ Extracted" placeholder** ([line 281-287](../../../../client/src/features/selfStudy/Editor/components/DocumentViewer.tsx)).
   - If the marker is NOT in the active list → render a **red "Content not restored: X" warning placeholder** ([lines 288-309](../../../../client/src/features/selfStudy/Editor/components/DocumentViewer.tsx)). This means the section was deleted but `restoreMarker` failed — the user knows there's an unrecoverable gap and can attempt repair.
6. Fallback for **pre-marker imports** ([lines 238-260](../../../../client/src/features/selfStudy/Editor/components/DocumentViewer.tsx)): if there are tagged sections in MongoDB but no markers in the HTML (extracted before the marker system was deployed), show one amber banner at the top of the document. Future extractions on the same import will use the new system.

The placeholder element format is:

```html
<div class="extracted-section-placeholder"
     data-section-id="..."
     data-section-type="standard">
  <div class="flex items-center gap-2 px-3 py-2 bg-teal-100 border-l-4 border-teal-400 ...">
    <svg>✓ icon</svg>
    <span>✓ Extracted: {title}</span>
    <span>(N chars)</span>
  </div>
</div>
```

Crucially, the placeholder element is **excluded from text-offset calculations** in subsequent tagging operations ([DocumentViewer.tsx:472-498](../../../../client/src/features/selfStudy/Editor/components/DocumentViewer.tsx)) — when the user makes another selection, the offset walker skips inside-placeholder text nodes so the offsets sent to the server remain consistent with the post-extraction HTML the server holds.

## Restore: the round trip back

When the user deletes a tagged section ([importController.ts:2706-2774](../../../../server/src/controllers/importController.ts)), the section's `removedHtml` (preferred) or `htmlContent` (legacy fallback) is passed to `gridFsService.restoreMarker(importId, sectionId, restoreContent)`.

The challenge: documents are big and Node should never load 300+MB into a single Buffer. So restore is **two-pass streaming** ([gridFsService.ts:1187-1394](../../../../server/src/services/gridFsService.ts)):

### Pass 1 — find positions
Stream the file from GridFS chunk by chunk, looking for both:
- `<!-- TABLE_FRAG_START:{sectionId} -->` … `<!-- TABLE_FRAG_END:{sectionId} -->` (new-style, table extractions).
- `<!-- EXTRACTED:{sectionId}:` … `-->` (old-style, non-table or pre-TABLE_FRAG extractions).

The two are searched in parallel; **`TABLE_FRAG` wins if present** ([gridFsService.ts:1288-1300](../../../../server/src/services/gridFsService.ts)) so the entire fragment region (including the synthesized `splitBefore` / `splitAfter` tables) gets replaced by the restored content. Falling back to `EXTRACTED` only kicks in for documents tagged before the table-frag mechanism shipped.

The pass tracks `carryOver` between chunk boundaries ([gridFsService.ts:1270-1277](../../../../server/src/services/gridFsService.ts)) so a marker that spans two GridFS chunks (255 KB chunks) is still found.

### Pass 2 — copy + substitute
Open a new GridFS upload stream. Re-stream the source file. For each chunk:
- Entirely before or after the replacement region → write through unchanged.
- Overlaps the replacement region → write the prefix bytes, then write the restored content (once), then the suffix bytes ([gridFsService.ts:1338-1368](../../../../server/src/services/gridFsService.ts)).

When the upload finishes, `Math.abs(totalWritten - expectedSize) > 1` triggers a **size-mismatch abort** ([gridFsService.ts:1378-1383](../../../../server/src/services/gridFsService.ts)) — the new file is rejected, the old file is preserved, and the caller gets an error so it doesn't delete the section's metadata. Only after a successful new-file write does the old file get deleted ([gridFsService.ts:1390](../../../../server/src/services/gridFsService.ts)).

This ordering — **write new, then delete old** — is documented at [gridFsService.ts:1313-1316](../../../../server/src/services/gridFsService.ts) as the protection against data loss if a restore is interrupted partway through.

### Atomicity caveat
Despite the careful ordering, the restore is **not transactional**. If the new-file write completes but the subsequent delete of the old file fails (e.g., transient Mongo error), **two GridFS files exist for the same `importId.html` filename**. GridFS allows duplicate filenames keyed by `_id`, so subsequent reads `bucket.find({filename: importId+'.html'})` may return either one. The orphan eventually gets caught by `cleanupOrphanedFiles()` only if the parent `SelfStudyImport` is deleted — there is no GC for half-completed restores. This is flagged in [[storage-layer]] and [[incomplete-features-2026-05-10]].

## What lives where in the database

There are **two databases at play** for a single import:

### MongoDB document — `selfstudyimports` collection

One `SelfStudyImport` record per upload. Schema in [server/src/models/SelfStudyImport.ts](../../../../server/src/models/SelfStudyImport.ts).

Holds:

| Field | Purpose |
|-------|---------|
| `submissionId, originalFilename, fileType, uploadedAt, uploadedBy` | identity / audit |
| `status: 'pending' \| 'processing' \| 'awaiting_selection' \| 'completed' \| 'failed'` | state machine |
| `processingStartedAt, processingCompletedAt, error` | parse lifecycle |
| `parsingProgress: { step, stepDescription, ... }` | UI progress feedback during the parse phase |
| `extractedContent.rawText` | full plain-text extracted by the parser (small) |
| `extractedContent.metadata.htmlStoredInGridFS: boolean` | flag for whether the heavy HTML went to GridFS |
| `extractedContent.metadata.htmlSize: number` | latest size of the HTML in GridFS (changes as markers are inserted!) |
| `extractedContent.sections[]` | AI-derived `IExtractedSection` array (used by the unimplemented Document Matcher path) |
| `mappedSections[]` | the `extractedSection → (standard, spec, fieldType)` decisions |
| `unmappedContent[]` | sections the AI couldn't classify |
| **`detectedSections[]`** | **the manually-tagged sections — the heart of this mechanism** |
| `appendix?` | appendix capture path |

Each `IDetectedSection` ([SelfStudyImport.ts:50-79](../../../../server/src/models/SelfStudyImport.ts)) holds:

| Field | Notes |
|-------|-------|
| `id` | UUID, also embedded in the GridFS marker |
| `headerText` | user-supplied title; surfaces in placeholder + Tagged Sections list |
| `previewText, fullContent, htmlContent` | text snapshots from when the user tagged |
| `standardCode?, specCode?, isMatrix, isAppendix, appliedDirectly` | tag metadata used at finish-tagging time |
| **`textStartOffset, textLength`** | **plain-text offsets — the bridge between client DOM and GridFS HTML** |
| **`removedHtml`** | **exact HTML removed by `insertHtmlMarker`** (after table-boundary expansion); the canonical input for `restoreMarker` |
| `htmlContextBefore, htmlContextAfter` | 300 chars on each side; used by `repairDocument` to fuzzy-match if the HTML changed under a marker |
| `wasTableExpanded: boolean` | true iff the marker replaced a full `<table>` (controls TABLE_FRAG branch on restore) |

Index hits ([SelfStudyImport.ts:291-293](../../../../server/src/models/SelfStudyImport.ts)): `submissionId`, `status`, `uploadedBy`. **No compound index** on `(submissionId, status)` — flagged in [[storage-layer]].

### MongoDB GridFS — `htmlContent.files` + `htmlContent.chunks` + `images.files` + `images.chunks`

Two GridFS buckets in the same MongoDB database, both managed by [gridFsService.ts](../../../../server/src/services/gridFsService.ts):

#### Bucket `htmlContent`
- One file per import: filename `{importId}.html`.
- Metadata: `{ importId, contentType: 'text/html', uploadedAt, size }`.
- Chunked into 255 KB pieces by GridFS automatically.
- **This is the file that progressively shortens** as the user tags sections. Each `insertHtmlMarker` call rewrites it via `storeHtmlContent(importId, newHtml)` ([gridFsService.ts:38-70](../../../../server/src/services/gridFsService.ts)) — which deletes the existing file ([line 42-46](../../../../server/src/services/gridFsService.ts)) and creates a new one with the same filename. **GridFS has no in-place edit; every marker insertion is a full file rewrite.** This is the dominant cost on a 370 MB document — flagged in [[import-pipeline]] under "memory shape."
- For the initial upload from the parser, the file goes in via `storeHtmlContentFromFile()` (streaming, [gridFsService.ts:77-117](../../../../server/src/services/gridFsService.ts)) to avoid holding the entire HTML in a single string.

#### Bucket `images`
- One file per image extracted by the parser, filename `{importId}/{imageName}` ([gridFsService.ts:273-312](../../../../server/src/services/gridFsService.ts)).
- Survives container restart; Railway's filesystem is ephemeral so this is required.

#### Orphan cleanup
`cleanupOrphanedFiles(dryRun)` ([gridFsService.ts:391-495](../../../../server/src/services/gridFsService.ts)) regex-matches filenames against `^([a-f0-9]{24})\.html$` and `^([a-f0-9]{24})/`, looks up which `_id`s still exist in `selfstudyimports`, and deletes the rest. Brittle in two ways: (1) only catches orphans whose parent `SelfStudyImport` is gone (NOT half-completed restores that left two files for the same live import); (2) any change to the filename format silently disables the sweep.

## Sequence diagrams

### Tagging a normal (non-table) section

```
client                           server                          GridFS
------                           ------                          ------
[user drags selection]
[SectionTagger modal opens]
[user fills metadata + Save]

  POST /imports/:id/extract-section
  { htmlContent, type, title,
    standardCode, specCode,
    textStartOffset, textLength }
  ─────────────────────────────►   detectedSections.push(IDetectedSection)
                                    save()
  ◄─── { sectionId, ... }

[lastSavedSection state set]
[useEffect runs:
   range.deleteContents()
   range.insertNode(placeholder)]
[user sees ✓ Extracted card immediately]

  POST /imports/:id/insert-marker
  { sectionId, title, type,
    contentLength,
    textStartOffset, textLength }
  ─────────────────────────────►   insertHtmlMarker(importId, marker, off, len)
                                     ─── getHtmlContent(importId)  ─────►  read full HTML
                                     ◄─── (HTML string)               ─── streamed back
                                     [walk text→html offsets]
                                     [expand to tag boundaries]
                                     [build newHtml = before + marker + after]
                                     ─── storeHtmlContent(importId, newHtml) ─►  delete old file
                                                                                  write new file
                                    section.removedHtml = result.removedHtml
                                    section.htmlContextBefore/After = ...
                                    save()
  ◄─── { success: true, marker }
```

### Tagging a section inside a table

Same as above, with two extra effects on the server:

1. `insertHtmlMarker` detects the range is in a table → expands `expandedStart`/`expandedEnd` to the full `<table>...</table>` ([gridFsService.ts:790-797](../../../../server/src/services/gridFsService.ts)).
2. Computes `splitBefore` and `splitAfter` synthetic tables ([gridFsService.ts:861-891](../../../../server/src/services/gridFsService.ts)).
3. Wraps marker as `<!-- TABLE_FRAG_START -->splitBefore + marker + splitAfter<!-- TABLE_FRAG_END -->` ([gridFsService.ts:894-901](../../../../server/src/services/gridFsService.ts)).
4. Sets `wasTableExpanded: true` on the section so restore knows to look for TABLE_FRAG wrappers first.

### Resuming after reload

```
client                           server                          GridFS
------                           ------                          ------
  GET /imports/:id/content
  ─────────────────────────────►   getHtmlContent(importId)
                                     bucket.find({filename: importId+'.html'})
                                     [stream → concat → toString('utf-8')]
  ◄─── (full HTML, with markers
        and TABLE_FRAG wrappers)

[DocumentViewer mounts HTML
  via dangerouslySetInnerHTML]

  GET /imports/:id/tagged-sections
  ─────────────────────────────►   findById(importId).select('detectedSections...')
  ◄─── [{ id, title, type, ... }]

[useEffect with delay:
   TreeWalker SHOW_COMMENT
   for each EXTRACTED comment:
     if id in tagged → green placeholder
     else            → red "not restored" warning
   replaceChild(comment, placeholder)]
```

### Deleting a tagged section (restore)

```
client                           server                          GridFS
------                           ------                          ------
  DELETE /imports/:id/tagged-sections/:sid
  ─────────────────────────────►   findById(importId)
                                    section = detectedSections.find(...)
                                    restoreContent = section.removedHtml
                                                  || section.htmlContent
                                    restoreMarker(importId, sid, restoreContent)
                                       ── Pass 1: stream + scan ──►
                                          searches: TABLE_FRAG_START:sid,
                                                    TABLE_FRAG_END:sid,
                                                    EXTRACTED:sid:
                                          choose TABLE_FRAG if both found,
                                          else EXTRACTED, else FAIL
                                       ── Pass 2: stream + substitute ──►
                                          new GridFS upload
                                          for each chunk:
                                            write before-region bytes
                                            (once) write restoreContent
                                            write after-region bytes
                                          [size validation]
                                          delete old file
                                    detectedSections.splice(idx, 1)
                                    save()
  ◄─── { success, contentRestored: true/false }

[client refetches tagged-sections,
 the placeholder vanishes from
 the Tagged Sections list]
```

## Performance characteristics

| Operation | Cost | Notes |
|-----------|------|-------|
| Initial parse → GridFS upload | One streaming write | `storeHtmlContentFromFile` keeps memory bounded. |
| `extract-section` (step 1) | Push onto `detectedSections[]` + Mongo save | No GridFS I/O. Cheap. Synchronous from client's perspective. |
| `insert-marker` (step 2) | One full GridFS read + one full GridFS rewrite | **Dominant cost.** Read concatenates all chunks into a single Buffer; write deletes + recreates the file. For a 370 MB doc, peak heap ≈ 2× file size. The walker is O(n) over the HTML. |
| Resume read (`getHtmlContent`) | One full read | Same memory pattern as `insertHtmlMarker`'s read leg. |
| `restoreMarker` | Two streaming passes | Bounded memory. Slowest operation in the pipeline because it touches every byte twice and writes a new file. |
| `cleanupOrphanedFiles` | Two `bucket.find({})` scans + per-orphan delete | Linear in total GridFS file count. |

The big optimization the codebase already does:
- HTML *upload* via streaming (`storeHtmlContentFromFile`).
- HTML *restore* via streaming (`restoreMarker` two-pass).
- HTML *write after marker insert* — **NOT streamed**. Goes through the full-string `storeHtmlContent`. This is the next obvious target if memory becomes a bottleneck.

## Where this code lives — quick map

| Concern | File | Lines |
|---------|------|-------|
| `SelfStudyImport` schema (incl. `IDetectedSection`) | [server/src/models/SelfStudyImport.ts](../../../../server/src/models/SelfStudyImport.ts) | full file (296) |
| GridFS bucket setup, store, get | [server/src/services/gridFsService.ts](../../../../server/src/services/gridFsService.ts) | 20-251 |
| Image bucket | [gridFsService.ts](../../../../server/src/services/gridFsService.ts) | 253-389 |
| `cleanupOrphanedFiles` | [gridFsService.ts](../../../../server/src/services/gridFsService.ts) | 391-495 |
| `extractTextFromHtml`, `findSectionTextOffset` | [gridFsService.ts](../../../../server/src/services/gridFsService.ts) | 502-670 |
| **`insertHtmlMarker` (the heart)** | [gridFsService.ts](../../../../server/src/services/gridFsService.ts) | 683-917 |
| `findHtmlRange` (pure helper for repair) | [gridFsService.ts](../../../../server/src/services/gridFsService.ts) | 928-... |
| **`restoreMarker` (two-pass streaming)** | [gridFsService.ts](../../../../server/src/services/gridFsService.ts) | 1187-1394 |
| `extractSection` controller (step 1) | [server/src/controllers/importController.ts](../../../../server/src/controllers/importController.ts) | 2423-2513 |
| `insertPlaceholderMarker` controller (step 2) | [importController.ts](../../../../server/src/controllers/importController.ts) | 2520-2574 |
| `deleteTaggedSection` controller (restore) | [importController.ts](../../../../server/src/controllers/importController.ts) | 2706-2774 |
| Marker-to-placeholder reconstruction (resume) | [client/src/features/selfStudy/Editor/components/DocumentViewer.tsx](../../../../client/src/features/selfStudy/Editor/components/DocumentViewer.tsx) | 201-324 |
| Live placeholder swap after tag | [DocumentViewer.tsx](../../../../client/src/features/selfStudy/Editor/components/DocumentViewer.tsx) | 116-195 |
| Table-aware row removal | [DocumentViewer.tsx](../../../../client/src/features/selfStudy/Editor/components/DocumentViewer.tsx) | 130-174 |
| Routes mounted | [server/src/routes/imports.ts](../../../../server/src/routes/imports.ts) | 204, 218, 246 |

## Failure modes & gotchas

| Failure | Where | Symptom | Mitigation today |
|---------|-------|---------|------------------|
| Step 1 succeeds, step 2 fails (server crash, network drop) | between `extract-section` and `insert-marker` | DB has the section, GridFS is unmodified — placeholder visible *only* in current DOM, gone on reload | None automated. User has to re-tag the section. |
| `insertHtmlMarker` returns `success: false` (offset not found) | [gridFsService.ts:756](../../../../server/src/services/gridFsService.ts) | 422 to client | Client may invoke `repairDocument` (re-uploads file, re-inserts markers using `removedHtml` / `htmlContextBefore`/`After` for fuzzy match). |
| `insertHtmlMarker` overwrites with corrupted `newHtml` (e.g., bug in walker) | [gridFsService.ts:904-913](../../../../server/src/services/gridFsService.ts) | Subsequent reads return malformed HTML; placeholder reconstruction may break | No checksum / pre-write validation. The full HTML rewrite is the most dangerous single operation in the system. |
| `restoreMarker` size mismatch | [gridFsService.ts:1378-1383](../../../../server/src/services/gridFsService.ts) | Restore aborts; old file kept; section NOT deleted from DB | Correct fail-closed behavior. Surfaces as "Content restoration failed — section not deleted" 500 to the client ([importController.ts:2750-2753](../../../../server/src/controllers/importController.ts)). |
| `restoreMarker` writes new file, delete of old fails | [gridFsService.ts:1390](../../../../server/src/services/gridFsService.ts) | Two GridFS files for `{importId}.html`; `bucket.find({filename})` order undefined | Manual cleanup. `cleanupOrphanedFiles` does NOT cover this case. |
| Marker title contains literal `--` | sanitized at [importController.ts:2534](../../../../server/src/controllers/importController.ts) | Would close the comment early | Title is rewritten: `--` → `—` (em dash); `-->` → `—>`. |
| User tags a section, then before step 2 lands, re-loads | timing race | Browser re-fetches HTML → no marker yet → server-side text offsets in subsequent tags still match | Fine, by design — step 1 is just a metadata write. |
| User tags two sections inside the same table | both extractions hit the same `<table>...</table>` boundary | Only the first one's `removedHtml` exactly matches the original table; second extraction's offsets are based on the *post-first-extraction* HTML | Works because `textStartOffset/Length` are recomputed by the client against the post-extraction DOM. The walker on the server sees the same shortened HTML. |
| Two simultaneous tags (race) | Mongo + GridFS concurrent writes for same `importId` | Latest write wins on GridFS (delete + create); detectedSections push is atomic per Mongo update | No application-level locking. UI prevents simultaneous tags by disabling the modal during save, but server-side has no protection. |

## Parallel ephemeral storage: `/tmp/imports/{importId}/`

This is the third storage location, in addition to MongoDB and GridFS — easy to miss if you only look at controllers. Documented in [docs/IMPORT_PROCESS_REFERENCE.md §5](../../../../docs/IMPORT_PROCESS_REFERENCE.md) and managed by [server/src/services/tempFileService.ts](../../../../server/src/services/tempFileService.ts) (259 lines).

```
/tmp/imports/{importId}/
├── content.html          ← copy of the parsed HTML, written during upload
└── images/
    └── {uuid}.png        ← extracted images (also in GridFS bucket `images`)
```

Lifecycle:

| Stage | Status of `/tmp/imports/{importId}/` |
|-------|--------------------------------------|
| Upload + parse | Created. Both `content.html` and `images/*.png` written. |
| Manual tagging in progress | Stale. `content.html` is NOT updated when markers are inserted into GridFS — only GridFS reflects shortenings. |
| `finishTagging` runs | **Deleted** (per IMPORT_PROCESS_REFERENCE §5 STAGE 3). Both `/tmp` *and* the GridFS HTML are cleaned up. |
| After `finishTagging` | Source content lives only in `SelfStudyImport.detectedSections[].htmlContent + fullContent` and (if applied) in `Submission.narratives`. |
| Server restart / Railway redeploy | `/tmp` is wiped. GridFS is durable and survives. |

Implication: `/tmp` is a fast cache for the parser's output; **GridFS is the durable store for the in-progress document**. Repair re-uploads the file and re-parses to populate GridFS — `/tmp` is never relied on for restoration.

## Repair flow — three-tier matching

When the GridFS HTML is missing or corrupt (OOM crash during `insertHtmlMarker`'s rewrite, container killed mid-write), the user gets "Error Loading Document — Document content not found in storage." Clicking **Repair Document** opens a file picker; the user re-uploads the **same original `.docx`** and POSTs to `/api/imports/:id/repair`.

The repair handler re-parses the file via `documentParser`, then re-inserts a marker for **every existing `IDetectedSection`** using a tiered matching strategy. From [docs/IMPORT_PROCESS_REFERENCE.md §8](../../../../docs/IMPORT_PROCESS_REFERENCE.md):

### Tier 1 — direct `removedHtml` match
- Looks for the section's stored `removedHtml` byte-for-byte in the freshly-parsed HTML using `indexOf()`.
- **Skips when `removedHtml` starts with `<table`** — replacing a full table at index of first match would corrupt other table-based sections that share the same opening bytes.
- Most reliable when it works. Handles 100% of non-table sections that didn't have whitespace drift.

### Tier 2 — text-offset matching with table-splitting
For sections T1 couldn't handle:
- `extractTextFromHtml()` extracts plain text from both the freshly-parsed HTML and the section's stored `htmlContent`.
- `findSectionTextOffset()` ([gridFsService.ts:551-...](../../../../server/src/services/gridFsService.ts)) finds the section text in the document text, with normalized whitespace and a **150-char start anchor + 50-char end anchor**. Prefers the *last* match with end-anchor verification — this is the trick that skips false-positive matches against the document's table of contents.
- `findHtmlRange()` ([gridFsService.ts:928-...](../../../../server/src/services/gridFsService.ts)) maps the text offset back to an HTML byte range. With `skipTableExpansion: true`, returns precise text boundaries plus computed `splitBefore` / `splitAfter` table fragments. Handles nested tables via depth-tracking close-tag matching.

### Tier 3 — sequential re-find for overlapping ranges
For sections whose T2 ranges overlapped each other (each insertion shifts subsequent positions):
- Process serially; after each marker insertion, re-find positions in the modified HTML.
- Same `findSectionTextOffset` + `findHtmlRange` machinery, but called once per remaining section against an HTML string that grows on every iteration.

### Memory discipline during repair
For 370MB documents, naive concatenation OOMs the server. The repair code uses `flattenString()` ([importController.ts:28-31](../../../../server/src/controllers/importController.ts)) — `Buffer.from(s, 'utf-8').toString('utf-8')` — to break V8's `SlicedString`/`ConsString` reference chains:

| Operation | Without flatten | With flatten |
|-----------|-----------------|--------------|
| Initial HTML | 370MB × 2 (UTF-16) ≈ 740MB | same |
| After 4 T3 iterations | 5 copies retained ≈ 3.7GB → **CRASH** | each iteration's intermediate freed → ~1-1.5GB peak |
| Final write to GridFS | Holds full string in memory | Writes to `/tmp` first, then `storeHtmlContentFromFile()` streams to GridFS |

Applied at three points:
- T2 batch: `sectionHtml`, `removedHtml`, `splitBefore`, `splitAfter` — each `Buffer.from().toString()`-flattened after capture.
- T2 join: `Buffer.from(parts.join('')).toString()` after assembly.
- T3 loop: `sectionSpecificHtml` and the growing `finalHtml` after each concatenation.

The `tmp file → stream to GridFS` pattern at the end of repair frees the giant string before the upload begins, so peak memory during the GridFS write is bounded by chunk size (255KB).

**Repair updates `removedHtml` for each section** with the new values from the freshly-parsed HTML, so subsequent restores will use the post-repair byte ranges.

## Diagnostics & operational queries

From [docs/IMPORT_PROCESS_REFERENCE.md §9](../../../../docs/IMPORT_PROCESS_REFERENCE.md). Useful when an import is stuck or a section won't restore:

```bash
# Section metadata for diagnostic inspection (no GridFS load)
curl -H "Authorization: Bearer $TOKEN" /api/imports/{importId}/debug

# Full import status (used internally by the polling)
curl -H "Authorization: Bearer $TOKEN" /api/imports/{importId}
```

```javascript
// MongoDB shell — does the GridFS HTML file exist? how many chunks?
db.htmlContent.files.find({ filename: "{importId}.html" })
db.htmlContent.chunks.count({ files_id: ObjectId("...") })
// 370MB ÷ 255KB ≈ 1451 chunks expected for a max-size doc

// MongoDB shell — quick view of all sections + marker metadata
db.selfstudyimports.findOne(
  { _id: ObjectId("{importId}") },
  { "detectedSections.id": 1,
    "detectedSections.headerText": 1,
    "detectedSections.textStartOffset": 1,
    "detectedSections.textLength": 1,
    "detectedSections.removedHtml": { $substr: ["$detectedSections.removedHtml", 0, 100] },
    "detectedSections.wasTableExpanded": 1 }
)
```

### Server log signatures

These prefixes show in `console.log` output ([gridFsService.ts](../../../../server/src/services/gridFsService.ts)) and are useful as grep targets:

```
[GridFSService] insertHtmlMarker: scanned N text chars, htmlStartPos=X, htmlEndPos=Y
[GridFSService] Inserting marker at text offset N (HTML pos X-Y), removed N chars, tableExpanded=true|false
[GridFSService] Text range is inside a table (startInTable=, endInTable=)
[GridFSService] Full table expansion: X-Y (table=N chars, original text range was ...)
[GridFSService] Computing table split fragments for section {id}
[GridFSService] splitBefore: N chars (...)
[GridFSService] splitAfter: N chars (...)
[GridFSService] TABLE_FRAG wrappers: prefix=N chars, suffix=N chars
[GridFSService] restoreMarker: scanning N bytes for section {id}
[GridFSService] restoreMarker: using TABLE_FRAG boundaries X-Y (... includes split table fragments)
[GridFSService] restoreMarker: using EXTRACTED marker boundaries X-Y (... no TABLE_FRAG wrappers found — old-style marker)
[Import] Repair T1: direct match "Section Title" at X-Y
[Import] Repair T1: skipping "Table Section" — removedHtml is full table, using T2
[Import] Repair T2: "Section" range X-Y splitBefore=N splitAfter=N
[Import] Repair T3: "Section" at X-Y
```

### Common failure → diagnostic table

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Document content not found in storage" | GridFS HTML missing (OOM mid-rewrite, never stored) | "Repair Document" with the original `.docx`. |
| "Failed to repair document" | OOM during repair | Check container memory; deploy `flattenString` fix if not present. |
| Section appears at wrong location after repair | Text offset matched a TOC instance instead of body | `findSectionTextOffset`'s end-anchor preference for body match — verify the section has 50+ chars after the matched text. |
| Table corrupted after extraction | `range.deleteContents()` was used inside a table | Client-side bug; row-level removal via [DocumentViewer.tsx:130-174](../../../../client/src/features/selfStudy/Editor/components/DocumentViewer.tsx) is the only correct path. |
| Marker not found during restore | Pre-marker-system extraction | Section deleted; original assumed still in document. Acceptable. |
| "Unbalanced tables" warning in repair log | Table-splitting created mismatched tags | Bug in `splitTableAt` / depth-tracking in `findHtmlRange`. |

## What this enables — and what it doesn't

The marker mechanism enables:

- ✅ Visually shortening a 370 MB document as the user tags it, without paging or virtualization.
- ✅ Resuming a partly-tagged document on a different session / device.
- ✅ Reversible tagging — delete a section and the original content comes back.
- ✅ Table extractions that don't break the visible non-tagged rows.

It does NOT enable:

- ❌ Atomic multi-section tagging (each tag is independent, no all-or-nothing).
- ❌ Streaming reads to the client (the client receives the full HTML, just shorter than the original).
- ❌ True undo of an extraction (`restoreMarker` puts content back, but only if it was successfully removed in the first place; nothing protects against bad walker output).
- ❌ Cross-document reuse of markers (markers are scoped to one `importId`; cleanup deletes them with the import).

## Related

- [[import-pipeline]] — user-facing flow + state machine
- [[storage-layer]] — GridFS basics, S3, the broader storage map
- [[narrative-storage]] — what happens after `finish-tagging` writes sections to `Submission.narratives`
- [[evidence-file-storage]] — the *other* file-storage flow in the system (uploaded supporting evidence; entirely separate code)
- [[client-features-deep-2026-05-10]] — DocumentViewer and surrounding components in detail
- [[security-audit-2026-05-10]] — `dangerouslySetInnerHTML` on imported HTML (XSS concern relevant to placeholder rendering)
- [[incomplete-features-2026-05-10]] — restore atomicity gap, missing compound indexes
- [[code-review-2026-05-10]] — overview pass that pointed at this mechanism as "the most intricate code in the repo"
