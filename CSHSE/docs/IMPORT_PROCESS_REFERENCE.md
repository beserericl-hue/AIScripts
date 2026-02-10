# Document Import Process — Technical Reference

> **Purpose:** Complete reference for the document import, resume, repair, and placeholder marker system.
> **Last Updated:** 2026-02-10
> **Use this document** when diagnosing import failures, repairing corrupted state, or modifying the import pipeline.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Process Flow Diagrams](#2-process-flow-diagrams)
3. [API Endpoint Reference](#3-api-endpoint-reference)
4. [Database Schema](#4-database-schema)
5. [Storage Architecture](#5-storage-architecture)
6. [Placeholder Marker System](#6-placeholder-marker-system)
7. [Resume Flow](#7-resume-flow)
8. [Repair Flow](#8-repair-flow)
9. [Diagnostics & Troubleshooting](#9-diagnostics--troubleshooting)
10. [Known Issues & Memory Constraints](#10-known-issues--memory-constraints)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│  CLIENT (React + TipTap)                                            │
│                                                                     │
│  SelfStudyEditor.tsx ─── DocumentViewer.tsx ─── SectionTagger.tsx   │
│       │                       │                      │              │
│  State management      HTML rendering +         Tag metadata        │
│  API orchestration     placeholder insertion    form + save         │
└──────────┬────────────────────┬──────────────────────┬──────────────┘
           │                    │                      │
           ▼                    ▼                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│  SERVER (Express)                                                    │
│                                                                     │
│  importController.ts ─── gridFsService.ts ─── tempFileService.ts   │
│       │                       │                      │              │
│  Business logic          GridFS CRUD +          /tmp/imports/       │
│  Section extraction      Marker insert/restore  {importId}/         │
└──────────┬────────────────────┬──────────────────────┬──────────────┘
           │                    │                      │
           ▼                    ▼                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│  STORAGE                                                            │
│                                                                     │
│  MongoDB                GridFS (htmlContent)    Filesystem (/tmp)   │
│  - SelfStudyImport      - {importId}.html       - content.html     │
│  - detectedSections[]   - 255KB chunks          - images/           │
│  - section metadata     - up to 370MB+                              │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Files

| File | Purpose |
|------|---------|
| `server/src/controllers/importController.ts` | All import API handlers (28 endpoints) |
| `server/src/services/gridFsService.ts` | GridFS operations, marker insert/restore, text offset mapping |
| `server/src/services/tempFileService.ts` | Temp file management (/tmp/imports/) |
| `server/src/services/documentParser.ts` | DOCX/PDF → HTML conversion (mammoth/pdf-parse) |
| `server/src/models/SelfStudyImport.ts` | Mongoose schema for import records |
| `client/src/features/selfStudy/Editor/SelfStudyEditor.tsx` | Client state management, API calls |
| `client/src/features/selfStudy/Editor/components/DocumentViewer.tsx` | HTML rendering, placeholder insertion (2 paths) |
| `client/src/features/selfStudy/Editor/components/SectionTagger.tsx` | Section metadata form |

---

## 2. Process Flow Diagrams

### 2.1 Initial Upload & Processing

```
User clicks "Import Document"
         │
         ▼
┌─────────────────────┐    POST /api/imports/upload
│  Upload .docx/.pdf  │───────────────────────────────┐
└─────────────────────┘                                │
                                                       ▼
                                            ┌─────────────────────┐
                                            │ Create SelfStudyImport│
                                            │ status: 'pending'    │
                                            └──────────┬──────────┘
                                                       │
                                            processDocumentForManualTagging()
                                                       │
                                            ┌──────────▼──────────┐
                                            │ Parse document       │
                                            │ (mammoth / pdf-parse)│
                                            │ Extract HTML + images│
                                            └──────────┬──────────┘
                                                       │
                                     ┌─────────────────┼─────────────────┐
                                     ▼                 ▼                 ▼
                              ┌─────────────┐  ┌─────────────┐  ┌──────────────┐
                              │ Store HTML   │  │ Save images  │  │ Save metadata│
                              │ in GridFS    │  │ to /tmp/     │  │ to MongoDB   │
                              │ ({id}.html)  │  │ imports/{id}/│  │ htmlStored   │
                              └─────────────┘  │ images/      │  │ InGridFS=true│
                                               └─────────────┘  └──────────────┘
                                                       │
                                            ┌──────────▼──────────┐
                                            │ status →             │
                                            │ 'awaiting_selection' │
                                            └──────────┬──────────┘
                                                       │
         ┌─────────────────────┐                       │
         │ Client polls        │◄──────────────────────┘
         │ GET /api/imports/{id}│
         │ Sees 'awaiting_      │
         │ selection' → loads   │
         │ manual_tagging view  │
         └─────────────────────┘
```

### 2.2 Manual Tagging (Section Extraction)

```
┌──────────────────────────────────────────────────────────────┐
│  MANUAL TAGGING SESSION                                       │
│                                                               │
│  ┌─────────────────────┐    ┌──────────────────────────────┐ │
│  │  DocumentViewer      │    │  SectionTagger               │ │
│  │                      │    │                              │ │
│  │  ┌────────────────┐  │    │  Section Type: [Standard ▼]  │ │
│  │  │ User selects   │──┼───▶│  Standard:     [Std 1   ▼]  │ │
│  │  │ text with mouse│  │    │  Spec:         [1.a     ▼]  │ │
│  │  └────────────────┘  │    │  Title:        [_________ ]  │ │
│  │                      │    │                              │ │
│  │  Stores Range in     │    │  [💾 Save Section]           │ │
│  │  lastCapturedRangeRef│    │         │                    │ │
│  └──────────────────────┘    └─────────┼────────────────────┘ │
│                                        │                      │
└────────────────────────────────────────┼──────────────────────┘
                                         │
                         handleSaveSection(metadata)
                                         │
                    ┌────────────────────┼────────────────────┐
                    │                    │                    │
                    ▼                    ▼                    ▼
          ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
          │ POST extract-   │  │ POST insert-    │  │ If applyDirectly│
          │ section         │  │ marker          │  │ → save to       │
          │                 │  │                 │  │ Submission      │
          │ Saves section   │  │ Inserts HTML    │  │ immediately     │
          │ to MongoDB      │  │ comment into    │  └─────────────────┘
          │ detectedSections│  │ GridFS HTML     │
          └────────┬────────┘  └────────┬────────┘
                   │                    │
                   │                    │ Returns: removedHtml,
                   │                    │ htmlContextBefore/After,
                   │                    │ wasTableExpanded
                   │                    │
                   │         ┌──────────▼──────────┐
                   │         │ Store marker metadata│
                   └────────▶│ on section record:   │
                             │ - removedHtml        │
                             │ - textStartOffset    │
                             │ - textLength          │
                             │ - htmlContextBefore   │
                             │ - wasTableExpanded    │
                             └──────────┬──────────┘
                                        │
                             ┌──────────▼──────────┐
                             │ Set lastSavedSection │
                             │ → triggers DOM       │
                             │ placeholder insertion│
                             │ in DocumentViewer    │
                             └─────────────────────┘
```

### 2.3 Placeholder Insertion (Two Paths)

```
═══════════════════════════════════════════════════════════════════
  PATH A: REAL-TIME (during current session)
═══════════════════════════════════════════════════════════════════

  lastSavedSection changes
         │
         ▼
  Retrieve stored Range from lastCapturedRangeRef
         │
         ├─── Is selection inside a <table>?
         │
    YES  │                              NO
    ▼    │                              ▼
  ┌──────┴──────────────────┐   ┌─────────────────────┐
  │ TABLE-AWARE REMOVAL     │   │ STANDARD REMOVAL     │
  │                         │   │                      │
  │ 1. Collect overlapping  │   │ 1. range.delete      │
  │    <tr> rows FIRST      │   │    Contents()        │
  │    (before mutation!)   │   │ 2. range.insertNode  │
  │ 2. Create placeholder   │   │    (placeholder)     │
  │ 3. Insert before table  │   └──────────────────────┘
  │ 4. row.remove() each    │
  │ 5. Remove table if empty│
  │                         │
  │ ⚠ NEVER use             │
  │   deleteContents()      │
  │   inside tables!        │
  └─────────────────────────┘
         │
         ▼
  onPlaceholderInserted(updatedHtml)
  → Parent updates documentHtml state


═══════════════════════════════════════════════════════════════════
  PATH B: RESUME (on page reload)
═══════════════════════════════════════════════════════════════════

  htmlContent loaded with embedded comment markers
         │
         ▼
  Check: any .extracted-section-placeholder in DOM?
         │
    YES  │ → Skip (already converted)
    NO   │
         ▼
  TreeWalker scans for HTML comments matching:
  <!-- EXTRACTED:{sectionId}:{type}:{title}:{length} -->
         │
         ▼
  For each marker:
         │
         ├── Section still in taggedSections?
         │
    YES  │                              NO
    ▼    │                              ▼
  Create normal           Create warning placeholder
  placeholder div         (red, "Content not restored")
  (green/purple/amber)
         │
         ▼
  Replace comment node with placeholder div
```

### 2.4 Section Deletion (Restore Marker)

```
  User clicks "Delete" on tagged section
         │
         ▼
  DELETE /api/imports/{importId}/tagged-sections/{sectionId}
         │
         ▼
  ┌─────────────────────────────────────────────┐
  │  restoreMarker (GridFS streaming approach)   │
  │                                              │
  │  PASS 1: Find marker byte position           │
  │  ┌────────────────────────────────────────┐  │
  │  │ Stream GridFS file chunk-by-chunk      │  │
  │  │ Search for: <!-- EXTRACTED:{id}:       │  │
  │  │ Use 512-byte carry-over buffer for     │  │
  │  │ markers spanning chunk boundaries      │  │
  │  │ Record markerByteStart, markerByteEnd  │  │
  │  └────────────────────────────────────────┘  │
  │                                              │
  │  PASS 2: Stream copy with replacement        │
  │  ┌────────────────────────────────────────┐  │
  │  │ Read old file → Write new file          │  │
  │  │ Before marker: pass through             │  │
  │  │ At marker: write restored HTML          │  │
  │  │ After marker: pass through              │  │
  │  │ Validate size → Delete old file         │  │
  │  └────────────────────────────────────────┘  │
  └─────────────────────────────────────────────┘
         │
         ├── Success: Remove section from detectedSections[]
         │
         └── Failure: Keep section metadata for retry
                      (marker stays in GridFS)
```

### 2.5 Repair Flow

```
  Document content missing from GridFS
  (OOM crash, corruption, etc.)
         │
         ▼
  "Error Loading Document" → User clicks "Repair Document"
         │
         ▼
  User re-uploads original .docx file
         │
         ▼
  POST /api/imports/{importId}/repair  (with file)
         │
         ▼
  ┌─────────────────────────────────────────────────────┐
  │  REPAIR: Re-parse document + re-insert all markers   │
  │                                                      │
  │  1. Parse .docx → HTML (mammoth)                     │
  │  2. For each section in detectedSections[]:           │
  │     │                                                │
  │     ├── TIER 1: Direct removedHtml match             │
  │     │   (exact byte match, non-table only)           │
  │     │                                                │
  │     ├── TIER 2: Text-offset matching                 │
  │     │   findSectionTextOffset() → findHtmlRange()    │
  │     │   with table-splitting (skipTableExpansion)    │
  │     │                                                │
  │     └── TIER 3: Sequential (for overlaps)            │
  │         Re-search in modified HTML after each         │
  │         insertion (positions shift)                   │
  │                                                      │
  │  3. Build final HTML with all markers                │
  │     - Flatten strings (break SlicedString refs)      │
  │     - Buffer.from().toString() after each T3 concat  │
  │                                                      │
  │  4. Write to temp file → Free memory                 │
  │  5. Stream from temp file → GridFS                   │
  │     (storeHtmlContentFromFile)                       │
  │                                                      │
  │  6. Update section.removedHtml with new values       │
  └─────────────────────────────────────────────────────┘
         │
         ▼
  Client reloads document content → markers converted to placeholders
```

---

## 3. API Endpoint Reference

### Core Import Flow

| Method | Path | Handler | Purpose |
|--------|------|---------|---------|
| `POST` | `/api/imports/upload` | `uploadDocument` | Upload document, start processing |
| `GET` | `/api/imports/check/:submissionId` | `checkExistingImport` | Check for in-progress import (resume) |
| `GET` | `/api/imports/:importId` | `getImport` | Get import status (used for polling) |
| `POST` | `/api/imports/:importId/cancel` | `cancelImport` | Cancel import |
| `DELETE` | `/api/imports/:importId/discard` | `discardImport` | Discard and start fresh |

### Manual Tagging

| Method | Path | Handler | Purpose |
|--------|------|---------|---------|
| `GET` | `/api/imports/:importId/content` | `getDocumentContent` | Get HTML from GridFS for viewer |
| `GET` | `/api/imports/:importId/images/:filename` | `getDocumentImage` | Serve extracted image |
| `POST` | `/api/imports/:importId/extract-section` | `extractSection` | Save tagged section to MongoDB |
| `POST` | `/api/imports/:importId/insert-marker` | `insertPlaceholderMarker` | Insert HTML comment marker into GridFS |
| `GET` | `/api/imports/:importId/tagged-sections` | `getTaggedSections` | List all tagged sections |
| `GET` | `/api/imports/:importId/tagged-sections/:sectionId` | `getTaggedSectionContent` | Get full section content |
| `PATCH` | `/api/imports/:importId/tagged-sections/:sectionId` | `updateTaggedSection` | Update section (e.g., mark applied) |
| `DELETE` | `/api/imports/:importId/tagged-sections/:sectionId` | `deleteTaggedSection` | Delete section, restore marker |
| `POST` | `/api/imports/:importId/finish-tagging` | `finishTagging` | Complete tagging → processing |

### Repair & Diagnostics

| Method | Path | Handler | Purpose |
|--------|------|---------|---------|
| `POST` | `/api/imports/:importId/repair` | `repairDocument` | Re-upload file, re-insert markers |
| `GET` | `/api/imports/:importId/debug` | `debugImport` | Section metadata inspection |

### Review & Apply

| Method | Path | Handler | Purpose |
|--------|------|---------|---------|
| `GET` | `/api/imports/:importId/sections` | `getExtractedSections` | Sections with mapping suggestions |
| `GET` | `/api/imports/:importId/sections/:sectionId` | `getSectionContent` | Full section content |
| `POST` | `/api/imports/:importId/map` | `mapSection` | Map section to standard |
| `POST` | `/api/imports/:importId/apply` | `applyMappings` | Apply all mappings |
| `GET` | `/api/imports/:importId/unmapped` | `getUnmappedContent` | Get unmapped content |
| `PUT` | `/api/imports/:importId/unmapped/:sectionId` | `handleUnmapped` | Assign/discard unmapped |

---

## 4. Database Schema

### SelfStudyImport (Main Document)

```typescript
{
  _id: ObjectId,
  submissionId: ObjectId,           // ref: Submission
  originalFilename: string,         // "2024 CSHSE Self-Study.docx"
  fileType: 'pdf' | 'docx' | 'pptx',
  uploadedAt: Date,
  uploadedBy: ObjectId,             // ref: User
  status: 'pending' | 'processing' | 'awaiting_selection' | 'completed' | 'failed',
  processingStartedAt: Date,
  processingCompletedAt: Date,
  error: string,

  parsingProgress: {
    step: string,                   // 'extracting_text' | 'storing_content' | 'section_selection' | ...
    stepDescription: string,
    sectionsFound: number,
    sectionsCount: number
  },

  extractedContent: {
    rawText: string,                // Empty when HTML in GridFS
    pageCount: number,
    metadata: {
      title: string,
      author: string,
      htmlStoredInGridFS: boolean,  // ← KEY FLAG: true = HTML is in GridFS
      htmlSize: number              // Character count of HTML
    },
    sections: IExtractedSection[]
  },

  detectedSections: IDetectedSection[],  // ← Tagged sections array
  mappedSections: IMappedSection[],
  unmappedContent: IUnmappedContent[],
  appendix: IAppendixInfo
}
```

**Indexes:** `submissionId`, `status`, `uploadedBy`

### IDetectedSection (Tagged Section)

```typescript
{
  id: string,                    // UUID
  level: 1 | 2 | 3,
  headerType: 'roman' | 'letter' | 'number' | 'standard' | 'appendix' | 'heading',
  headerText: string,            // Section title
  previewText: string,           // First 200 chars (for UI)
  fullContent: string,           // Complete plain text
  htmlContent: string,           // Raw HTML from client Range API
  startPosition: number,
  endPosition: number,
  isAppendix: boolean,
  isSelected: boolean,
  children: IDetectedSection[],

  // Section assignment
  standardCode: string,          // e.g., "Standard 1"
  specCode: string,              // e.g., "1.a"
  appliedDirectly: boolean,      // Already saved to Submission
  isMatrix: boolean,             // Curriculum matrix section

  // ═══ PLACEHOLDER MARKER METADATA ═══
  textStartOffset: number,       // Text offset in original document
  textLength: number,            // Text length for marker placement
  removedHtml: string,           // Exact HTML replaced by marker
  htmlContextBefore: string,     // 300 chars before marker (repair matching)
  htmlContextAfter: string,      // 300 chars after marker (repair matching)
  wasTableExpanded: boolean      // Table boundaries expanded during removal
}
```

### GridFS Collections

```
htmlContent.files        ← File metadata
htmlContent.chunks       ← 255KB chunks of HTML content

images.files             ← Image metadata
images.chunks            ← Image binary chunks
```

**File naming:** `{importId}.html` for HTML, `{importId}/{uuid}.png` for images

---

## 5. Storage Architecture

### Where Content Lives at Each Stage

```
STAGE 1: Upload & Parse
├── MongoDB: SelfStudyImport (metadata only, status='processing')
├── GridFS:  {importId}.html (full document HTML, up to 370MB+)
├── /tmp:    /tmp/imports/{importId}/content.html (same HTML)
└── /tmp:    /tmp/imports/{importId}/images/*.png

STAGE 2: Manual Tagging (In Progress)
├── MongoDB: SelfStudyImport.detectedSections[] (tagged sections accumulate)
├── GridFS:  {importId}.html (HTML with <!-- EXTRACTED:... --> markers)
├── /tmp:    content.html (original, may be stale)
└── Client:  documentHtml state (live HTML with visual placeholders)

STAGE 3: Tagging Complete (finishTagging)
├── MongoDB: SelfStudyImport.detectedSections[] (all tagged sections)
├── GridFS:  DELETED (cleanup in finishTagging)
├── /tmp:    DELETED (cleanup in finishTagging)
└── Content: Only in detectedSections[].htmlContent + fullContent

STAGE 4: Review & Apply
├── MongoDB: SelfStudyImport with mappedSections[]
└── Content: Sections applied to Submission standards
```

### Content Priority for Document Loading

`getDocumentContent` serves HTML using this priority:

```
1. Check extractedContent.metadata.htmlStoredInGridFS flag
   │
   ├── true  → gridFsService.getHtmlContent(importId)
   │           Returns GridFS HTML (with markers embedded)
   │
   └── false → extractedContent.rawText (legacy inline storage)
               Returns MongoDB-stored text
```

---

## 6. Placeholder Marker System

### Marker Format

```html
<!-- EXTRACTED:{sectionId}:{sectionType}:{title}:{contentLength} -->
```

**Example:**
```html
<!-- EXTRACTED:a1b2c3d4-e5f6:standard:1.a - Regional Accreditation:4567 -->
```

### How Markers Are Inserted (Server-Side)

`insertHtmlMarker` in gridFsService.ts:

1. **Read** full HTML from GridFS
2. **Walk** HTML character-by-character, counting only text characters (skip tags, decode entities)
3. **Map** `textStartOffset` → `htmlStartPos` (byte position in HTML)
4. **Map** `textStartOffset + textLength` → `htmlEndPos`
5. **Detect** if range is inside a `<table>`:
   - **YES:** Expand to full `<table>...</table>` boundaries
   - **NO:** Expand to nearest tag boundaries (`<p>`, `<div>`, etc.)
6. **Capture** `removedHtml` = HTML between expanded boundaries
7. **Replace** range with marker comment
8. **Store** updated HTML back to GridFS

### How Markers Are Restored (Section Deletion)

`restoreMarker` in gridFsService.ts — streaming two-pass approach:

1. **Pass 1:** Stream through GridFS file to find marker byte positions
2. **Pass 2:** Stream-copy file, replacing marker bytes with original HTML
3. **Validate** output size before deleting original file

### How Markers Become Placeholders (Client-Side)

DocumentViewer.tsx converts markers on resume:

```
TreeWalker(SHOW_COMMENT) → find all <!-- EXTRACTED:... --> nodes
    │
    ├── Section exists in taggedSections → Green/purple/amber placeholder div
    └── Section deleted but marker remains → Red warning placeholder
```

---

## 7. Resume Flow

```
User returns to import page
         │
         ▼
GET /api/imports/check/{submissionId}
         │
         ├── No existing import → Show upload UI
         │
         └── Found import with status='awaiting_selection'
                  │
                  ▼
         Show "Resume" option
                  │
                  ▼
         GET /api/imports/{importId}/content
         → Returns HTML from GridFS (with markers)
                  │
         GET /api/imports/{importId}/tagged-sections
         → Returns list of already-tagged sections
                  │
                  ▼
         DocumentViewer renders HTML
         useEffect detects <!-- EXTRACTED:... --> comments
         Converts to visual placeholder divs
                  │
                  ▼
         User continues tagging from where they left off
```

### What Makes Resume Work

1. **GridFS HTML** has markers embedded at exact positions of previously extracted content
2. **detectedSections[]** in MongoDB stores all section metadata
3. **Client** converts markers to visual placeholders without needing the original Range objects
4. **Text offsets** (`textStartOffset`, `textLength`) are stored but only used by server for marker placement — not needed for resume display

---

## 8. Repair Flow

### When Repair Is Needed

- GridFS HTML lost due to OOM crash during save
- GridFS content corrupted
- Document viewer shows "Error Loading Document — Document content not found in storage"

### How Repair Works

1. User clicks "Repair Document" → file picker opens
2. User uploads **same original .docx** file
3. Server re-parses document to get fresh HTML
4. Server re-inserts all markers using tiered matching:

```
TIER 1: Direct removedHtml match
├── Uses section.removedHtml (exact bytes stored from previous marker insertion)
├── Finds exact match in new HTML via indexOf()
├── SKIPS if removedHtml starts with <table (would corrupt other sections)
└── Most reliable, but only works for non-table content

TIER 2: Text-offset matching with table-splitting
├── extractTextFromHtml() → extracts plain text from both document and section
├── findSectionTextOffset() → finds section text in document text
│   ├── Normalizes whitespace
│   ├── Uses 150-char start anchor + 50-char end anchor
│   └── Prefers last match with end-anchor verification (skips TOC matches)
├── findHtmlRange() → maps text offset to HTML byte range
│   ├── skipTableExpansion: true → splits table into before/after fragments
│   └── Handles nested tables via depth-tracking close-tag matching
└── Result: expandedStart, expandedEnd, splitBefore, splitAfter

TIER 3: Sequential (for overlapping ranges)
├── Sections that overlapped in T2 are re-processed sequentially
├── Each insertion modifies the HTML, so positions must be re-found
├── Uses same findSectionTextOffset + findHtmlRange as T2
└── flattenString() after each concatenation to prevent OOM
```

### Memory Safety in Repair

For 370MB documents, repair must avoid OOM:

```
Problem:  V8 SlicedString/ConsString references keep old copies alive
          After 4 T3 iterations: 5 × 370MB × 2 bytes/char ≈ 3.7GB

Solution: flattenString() = Buffer.from(s, 'utf-8').toString('utf-8')
          Applied to:
          - T2 batch: sectionHtml, removedHtml, splitBefore, splitAfter
          - T2 join: Buffer.from(parts.join('')).toString()
          - T3 loop: sectionSpecificHtml, finalHtml after concatenation
          - GridFS store: write to temp file → stream to GridFS
            (storeHtmlContentFromFile avoids holding string during upload)
```

---

## 9. Diagnostics & Troubleshooting

### Check Import Status

```bash
# Get import details
curl -H "Authorization: Bearer $TOKEN" \
  https://your-server/api/imports/{importId}

# Debug endpoint (section metadata)
curl -H "Authorization: Bearer $TOKEN" \
  https://your-server/api/imports/{importId}/debug
```

### Check GridFS Content

```javascript
// In MongoDB shell
db.htmlContent.files.find({ filename: "{importId}.html" })
// Check: does file exist? What size?

db.htmlContent.chunks.count({ files_id: ObjectId("...") })
// Check: how many chunks? (370MB ÷ 255KB ≈ 1451 chunks)
```

### Check Section Markers

```javascript
// In MongoDB shell — see all sections and their marker metadata
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

### Common Failure Scenarios

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Document content not found in storage" | GridFS HTML missing (OOM crash, never stored) | Click "Repair Document", re-upload original file |
| "Failed to repair document" | OOM during repair | Check server memory limits; deploy SlicedString fix |
| Section appears in wrong location after repair | Text offset mismatch (TOC vs body) | `findSectionTextOffset` uses end-anchor to prefer body match |
| Table structure corrupted after extraction | `deleteContents()` used inside table | Client uses row-level removal; check DocumentViewer |
| Marker not found during restore | Section tagged before marker system | Safe: section deleted, original content assumed in document |
| "Unbalanced tables" warning in repair log | Table-splitting created mismatched tags | Check `splitTableAt` logic in findHtmlRange |

### Server Log Patterns

```
# Successful marker insertion
[GridFSService] insertHtmlMarker: scanned 25000 text chars, htmlStartPos=1988671, htmlEndPos=1999279
[GridFSService] Inserting marker at text offset 25426 (HTML pos 1988671-1999279), removed 10608 chars

# Table expansion
[GridFSService] Text range is inside a table — expanding to full table boundaries
[GridFSService] Full table expansion: 1988671-1999279

# Repair tiers
[Import] Repair T1: direct match "Section Title" at 12345-67890
[Import] Repair T1: skipping "Table Section" — removedHtml is full table, using T2
[Import] Repair T2: "Section" range 1000-2000 splitBefore=500ch splitAfter=800ch
[Import] Repair: overlap for "Section" (1000-2000 vs prevEnd 2000), moving to T3
[Import] Repair T3: "Section" at 1500-1800

# Memory tracking
[Import] Repair: memory before GridFS store — RSS=1200MB, heap=800MB/900MB
[Import] Repair: memory after free — RSS=800MB, heap=400MB/500MB
```

---

## 10. Known Issues & Memory Constraints

### V8 String Memory (SlicedString / ConsString)

- `string.substring()` creates a SlicedString referencing the FULL parent string
- String concatenation creates ConsString chains that prevent GC
- **Fix:** `Buffer.from(s, 'utf-8').toString('utf-8')` forces a flat copy
- Applied in repair T2 batch, T3 loop, and parts.join() result

### Railway Container Limits

- Default V8 heap limit: ~4GB
- 370MB HTML = ~740MB in V8 (UTF-16 internal encoding)
- Two copies = ~1.5GB; three = ~2.2GB
- Repair peak after fix: ~1-1.5GB (safe)
- Without fix: ~4.3GB (crashes)

### Temp File Persistence

- `/tmp/imports/{importId}/` is created during upload
- Persists until `finishTagging` or server restart
- Railway containers may lose `/tmp` on deploy
- GridFS is the durable store; temp files are ephemeral cache

### Entity Handling in Text Walker

- HTML entities (`&amp;`, `&lt;`, `&#39;`) count as 1 text character
- The text walker in `extractTextFromHtml` and `insertHtmlMarker` must stay synchronized
- Common entities decoded: `&amp;→& &lt;→< &gt;→> &nbsp;→(space) &quot;→" &apos;→' &#39;→'`
- Unknown entities decoded as space

---

*This document should be updated when the import pipeline changes. Key areas to watch: marker format, table expansion logic, and memory management patterns.*
