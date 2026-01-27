# Claude Code Prompt: CSHSE Document Matcher Web Interface

## Task Overview

Build a web interface for the CSHSE Document Matcher system. This system uses n8n workflows to:
1. **Load specification PDFs** into a Supabase vector store
2. **Match document sections** against loaded specifications using AI

The interface needs to support two main user flows:
1. Admin: Upload CSHSE specification PDFs to populate the vector database
2. User: Upload Word documents to match sections against specifications

---

## n8n Workflow API Specifications

### Workflow 1: Specification Loader (PDF Upload)

**Purpose**: Upload CSHSE specification PDF documents to be parsed, chunked, and stored in the vector database.

#### Endpoint
```
POST {N8N_BASE_URL}/webhook/load-specifications
Content-Type: multipart/form-data
```

#### Request Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | Binary (PDF) | **Yes** | The PDF specification document to load |
| `specName` | string | No | Name of the specification (default: "CSHSE Standards") |
| `specVersion` | string | No | Version identifier (default: "1.0") |
| `specId` | string | No | Your internal specification ID for tracking |
| `callbackUrl` | string | No | URL to receive completion notification |

#### Immediate Response (HTTP 200)
```json
{
  "status": "accepted",
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "PDF processing started. Specifications will be loaded to vector store."
}
```

#### Callback Response (POST to callbackUrl)
```json
{
  "status": "completed",
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "specName": "CSHSE Standards 2024",
  "specVersion": "2024.1",
  "specId": "spec-123",
  "documentsLoaded": 47,
  "fileName": "CSHSE-Standards-2024.pdf",
  "processedAt": "2024-01-15T10:30:00.000Z",
  "message": "Successfully loaded 47 document chunks from CSHSE-Standards-2024.pdf"
}
```

#### Error Callback
```json
{
  "status": "failed",
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "error": {
    "code": "PDF_PARSE_ERROR",
    "message": "Failed to parse PDF: Invalid or corrupted file"
  }
}
```

---

### Workflow 2: Document Matcher

**Purpose**: Upload Word documents (as pre-converted HTML) to match sections against CSHSE specifications.

#### Endpoint
```
POST {N8N_BASE_URL}/webhook/match-document
Content-Type: application/json
```

#### Request Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `callbackUrl` | string | **Yes** | URL to receive matching results |
| `documentId` | string | No | Your internal document ID for tracking |
| `htmlContent` | string | **Yes** | HTML content of the document (pre-converted from Word) |
| `options.batchSize` | number | No | Sections per batch (default: 10) |
| `options.confidenceThreshold` | number | No | Min confidence 0-100 (default: 50) |
| `options.maxRetries` | number | No | Retry attempts (default: 3) |

#### Request Example
```json
{
  "callbackUrl": "https://your-app.com/api/n8n/document-callback",
  "documentId": "doc-12345",
  "htmlContent": "<h1>Program Overview</h1><p>Our human services program was established...</p><h2>Accreditation</h2><p>We maintain regional accreditation through...</p>",
  "options": {
    "batchSize": 10,
    "confidenceThreshold": 50
  }
}
```

#### Immediate Response (HTTP 200)
```json
{
  "status": "accepted",
  "jobId": "660e8400-e29b-41d4-a716-446655440001",
  "message": "Document processing started. Results will be sent to callbackUrl."
}
```

#### Success Callback (POST to callbackUrl)
```json
{
  "status": "completed",
  "jobId": "660e8400-e29b-41d4-a716-446655440001",
  "documentId": "doc-12345",
  "results": {
    "jobId": "660e8400-e29b-41d4-a716-446655440001",
    "documentId": "doc-12345",
    "processedAt": "2024-01-15T10:35:00.000Z",
    "processingDuration": 245000,
    "status": "completed",
    "summary": {
      "totalSections": 25,
      "matchedSections": 22,
      "unmatchedSections": 2,
      "failedSections": 1
    },
    "sections": [
      {
        "sectionIndex": 0,
        "heading": "Program Overview",
        "richTextContent": "<p>Our human services program was established...</p>",
        "match": {
          "status": "matched",
          "standard": {
            "code": "1",
            "title": "Program Identity"
          },
          "subspecification": {
            "code": "d",
            "title": "Program History"
          },
          "confidence": 92,
          "rationale": "This section describes the program's history and establishment, directly addressing Standard 1d requirements for documenting program history."
        }
      },
      {
        "sectionIndex": 1,
        "heading": "Accreditation",
        "richTextContent": "<p>We maintain regional accreditation through...</p>",
        "match": {
          "status": "matched",
          "standard": {
            "code": "1",
            "title": "Program Identity"
          },
          "subspecification": {
            "code": "a",
            "title": "Regional Accreditation"
          },
          "confidence": 98,
          "rationale": "This section explicitly discusses regional accreditation status, directly addressing Standard 1a."
        }
      },
      {
        "sectionIndex": 2,
        "heading": "Miscellaneous Notes",
        "richTextContent": "<p>Administrative information...</p>",
        "match": {
          "status": "unmatched",
          "standard": null,
          "subspecification": null,
          "confidence": 32,
          "rationale": "This section contains general administrative content that does not align with any specific CSHSE standard."
        }
      }
    ],
    "errors": []
  }
}
```

#### Partial Success Callback
Same structure as success, but with `"status": "partial_success"` and populated `errors` array.

#### Error Callback
```json
{
  "status": "failed",
  "jobId": "660e8400-e29b-41d4-a716-446655440001",
  "documentId": "doc-12345",
  "error": {
    "code": "PROCESSING_ERROR",
    "message": "Failed to process document: No sections found in HTML content",
    "details": {
      "failedAt": "Split into Sections",
      "timestamp": "2024-01-15T10:35:00.000Z"
    }
  }
}
```

---

## Web Interface Requirements

### Technology Stack
- React with TypeScript (or Next.js)
- Tailwind CSS for styling
- React Query or SWR for data fetching
- mammoth.js for Word-to-HTML conversion (client-side)

### Environment Variables
```env
NEXT_PUBLIC_N8N_BASE_URL=https://your-n8n-instance.com
NEXT_PUBLIC_API_BASE_URL=https://your-api.com
```

---

## Pages and Components to Build

### 1. Specification Management Page (`/admin/specifications`)

**Features:**
- Upload PDF specification documents
- List loaded specifications with metadata
- View chunk count and loading status
- Delete/reload specifications

**UI Components:**
```tsx
// SpecificationUploader.tsx
interface SpecUploadForm {
  file: File;
  specName: string;
  specVersion: string;
}

// SpecificationList.tsx
interface Specification {
  id: string;
  name: string;
  version: string;
  documentsLoaded: number;
  loadedAt: string;
  status: 'loading' | 'completed' | 'failed';
}
```

**Upload Flow:**
1. User selects PDF file
2. User enters spec name and version
3. Form submits to `/api/specifications/upload`
4. Backend forwards to n8n webhook with callbackUrl
5. n8n processes and calls back
6. UI updates via polling or WebSocket

### 2. Document Matching Page (`/documents/match`)

**Features:**
- Upload Word document (.docx)
- Real-time conversion to HTML preview
- Submit for matching
- Display matching results with confidence scores
- Export results to CSV/JSON

**UI Components:**
```tsx
// DocumentUploader.tsx
interface DocumentUploadProps {
  onUpload: (file: File) => void;
  onHtmlGenerated: (html: string) => void;
}

// MatchingResults.tsx
interface MatchingResultsProps {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  results?: MatchingResult;
}

interface MatchingResult {
  summary: {
    totalSections: number;
    matchedSections: number;
    unmatchedSections: number;
    failedSections: number;
  };
  sections: SectionMatch[];
}

interface SectionMatch {
  sectionIndex: number;
  heading: string;
  richTextContent: string;
  match: {
    status: 'matched' | 'unmatched' | 'error';
    standard?: { code: string; title: string };
    subspecification?: { code: string; title: string };
    confidence?: number;
    rationale?: string;
    error?: string;
  };
}
```

### 3. Results Dashboard (`/documents/:documentId/results`)

**Features:**
- Display all matched sections
- Filter by match status (matched/unmatched/error)
- Filter by confidence level
- Filter by standard code
- Section-by-section view with rationale
- Summary statistics

---

## Backend API Endpoints to Implement

### Specifications API

```typescript
// POST /api/specifications/upload
// Handles PDF upload and forwards to n8n
interface UploadSpecRequest {
  file: File;
  specName: string;
  specVersion: string;
}

interface UploadSpecResponse {
  jobId: string;
  status: 'accepted';
}

// GET /api/specifications
// Lists all loaded specifications
interface SpecificationListResponse {
  specifications: Specification[];
}

// DELETE /api/specifications/:id
// Removes specification from vector store
```

### Documents API

```typescript
// POST /api/documents/match
// Submits document for matching
interface MatchDocumentRequest {
  documentId?: string;
  htmlContent: string;
  options?: {
    batchSize?: number;
    confidenceThreshold?: number;
  };
}

interface MatchDocumentResponse {
  jobId: string;
  documentId: string;
  status: 'accepted';
}

// GET /api/documents/:documentId/results
// Gets matching results for a document
interface DocumentResultsResponse {
  jobId: string;
  documentId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  results?: MatchingResult;
  error?: {
    code: string;
    message: string;
  };
}
```

### Callback Endpoints (for n8n)

```typescript
// POST /api/n8n/spec-callback
// Receives specification loading completion
interface SpecCallbackPayload {
  status: 'completed' | 'failed';
  jobId: string;
  specName: string;
  specVersion: string;
  documentsLoaded?: number;
  error?: { code: string; message: string };
}

// POST /api/n8n/document-callback
// Receives document matching results
interface DocumentCallbackPayload {
  status: 'completed' | 'partial_success' | 'failed';
  jobId: string;
  documentId?: string;
  results?: MatchingResult;
  error?: { code: string; message: string };
}
```

---

## Implementation Code Examples

### Word to HTML Conversion (Client-Side)

```typescript
// lib/documentConverter.ts
import mammoth from 'mammoth';

export async function convertWordToHtml(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });

  if (result.messages.length > 0) {
    console.warn('Conversion warnings:', result.messages);
  }

  return result.value;
}
```

### n8n API Client

```typescript
// lib/n8nClient.ts
const N8N_BASE_URL = process.env.NEXT_PUBLIC_N8N_BASE_URL;

export async function uploadSpecification(
  file: File,
  specName: string,
  specVersion: string,
  callbackUrl: string
): Promise<{ jobId: string }> {
  const formData = new FormData();
  formData.append('data', file);
  formData.append('specName', specName);
  formData.append('specVersion', specVersion);
  formData.append('callbackUrl', callbackUrl);

  const response = await fetch(`${N8N_BASE_URL}/webhook/load-specifications`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }

  return response.json();
}

export async function matchDocument(
  htmlContent: string,
  documentId: string,
  callbackUrl: string,
  options?: { batchSize?: number; confidenceThreshold?: number }
): Promise<{ jobId: string }> {
  const response = await fetch(`${N8N_BASE_URL}/webhook/match-document`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      callbackUrl,
      documentId,
      htmlContent,
      options,
    }),
  });

  if (!response.ok) {
    throw new Error(`Match request failed: ${response.statusText}`);
  }

  return response.json();
}
```

### Callback Handler (Next.js API Route)

```typescript
// pages/api/n8n/document-callback.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { updateDocumentResults } from '@/lib/database';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = req.body;

    // Store results in your database
    await updateDocumentResults(payload.jobId, {
      status: payload.status,
      documentId: payload.documentId,
      results: payload.results,
      error: payload.error,
      completedAt: new Date().toISOString(),
    });

    // Optionally notify connected clients via WebSocket/SSE
    // await notifyClient(payload.jobId, payload);

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Callback processing error:', error);
    res.status(500).json({ error: 'Failed to process callback' });
  }
}
```

### Results Display Component

```tsx
// components/MatchingResults.tsx
import React from 'react';

interface SectionMatchProps {
  section: SectionMatch;
}

function SectionMatchCard({ section }: SectionMatchProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'matched': return 'bg-green-100 border-green-500';
      case 'unmatched': return 'bg-yellow-100 border-yellow-500';
      case 'error': return 'bg-red-100 border-red-500';
      default: return 'bg-gray-100 border-gray-500';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className={`border-l-4 p-4 mb-4 rounded ${getStatusColor(section.match.status)}`}>
      <div className="flex justify-between items-start">
        <h3 className="font-semibold text-lg">{section.heading}</h3>
        {section.match.confidence && (
          <span className={`font-bold ${getConfidenceColor(section.match.confidence)}`}>
            {section.match.confidence}% confidence
          </span>
        )}
      </div>

      {section.match.status === 'matched' && section.match.standard && (
        <div className="mt-2">
          <span className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm mr-2">
            Standard {section.match.standard.code}: {section.match.standard.title}
          </span>
          {section.match.subspecification && (
            <span className="inline-block bg-purple-100 text-purple-800 px-2 py-1 rounded text-sm">
              {section.match.subspecification.code}: {section.match.subspecification.title}
            </span>
          )}
        </div>
      )}

      {section.match.rationale && (
        <p className="mt-2 text-gray-600 text-sm italic">
          {section.match.rationale}
        </p>
      )}

      <details className="mt-2">
        <summary className="cursor-pointer text-sm text-gray-500">View section content</summary>
        <div
          className="mt-2 p-2 bg-white rounded text-sm prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: section.richTextContent }}
        />
      </details>
    </div>
  );
}

export function MatchingResults({ results }: { results: MatchingResult }) {
  return (
    <div>
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-100 p-4 rounded text-center">
          <div className="text-2xl font-bold">{results.summary.totalSections}</div>
          <div className="text-sm text-gray-600">Total Sections</div>
        </div>
        <div className="bg-green-100 p-4 rounded text-center">
          <div className="text-2xl font-bold text-green-600">{results.summary.matchedSections}</div>
          <div className="text-sm text-gray-600">Matched</div>
        </div>
        <div className="bg-yellow-100 p-4 rounded text-center">
          <div className="text-2xl font-bold text-yellow-600">{results.summary.unmatchedSections}</div>
          <div className="text-sm text-gray-600">Unmatched</div>
        </div>
        <div className="bg-red-100 p-4 rounded text-center">
          <div className="text-2xl font-bold text-red-600">{results.summary.failedSections}</div>
          <div className="text-sm text-gray-600">Failed</div>
        </div>
      </div>

      {/* Section Results */}
      <div>
        {results.sections.map((section) => (
          <SectionMatchCard key={section.sectionIndex} section={section} />
        ))}
      </div>
    </div>
  );
}
```

---

## Database Schema (if storing results)

```sql
-- Jobs table to track all processing jobs
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id VARCHAR(255) UNIQUE NOT NULL,
  job_type VARCHAR(50) NOT NULL, -- 'spec_load' or 'document_match'
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  error_message TEXT
);

-- Specifications table
CREATE TABLE specifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id VARCHAR(255) REFERENCES jobs(job_id),
  name VARCHAR(255) NOT NULL,
  version VARCHAR(50) NOT NULL,
  file_name VARCHAR(255),
  documents_loaded INTEGER DEFAULT 0,
  loaded_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Documents table
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id VARCHAR(255) REFERENCES jobs(job_id),
  external_id VARCHAR(255),
  file_name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  total_sections INTEGER,
  matched_sections INTEGER,
  unmatched_sections INTEGER,
  failed_sections INTEGER,
  processing_duration INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Section matches table
CREATE TABLE section_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id),
  section_index INTEGER NOT NULL,
  heading VARCHAR(500),
  rich_text_content TEXT,
  match_status VARCHAR(50), -- 'matched', 'unmatched', 'error'
  standard_code VARCHAR(10),
  standard_title VARCHAR(255),
  subspecification_code VARCHAR(10),
  subspecification_title VARCHAR(255),
  confidence INTEGER,
  rationale TEXT,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## CSHSE Standards Reference

For UI display and validation, here are the 21 CSHSE standards:

| Part | Code | Title |
|------|------|-------|
| I | 1 | Program Identity |
| I | 2 | Program Objectives |
| I | 3 | Organizational Structure |
| I | 4 | Budgetary Support |
| I | 5 | Administrative Support |
| I | 6 | Faculty |
| I | 7 | Faculty Development |
| I | 8 | Practicum/Field Experience Supervisors |
| I | 9 | Student Services |
| I | 10 | Admissions |
| II | 11 | Curriculum |
| II | 12 | Professional Practice |
| II | 13 | Program Assessment |
| II | 14 | Student Learning Outcomes |
| II | 15 | Student Portfolio |
| II | 16 | Program Advisory Committee |
| II | 17 | Diversity |
| II | 18 | Ethics |
| II | 19 | Supervision |
| II | 20 | Technology |
| II | 21 | Field Experience |

Each standard has subspecifications labeled `a` through `f`.

---

## Testing Checklist

- [ ] PDF specification upload works
- [ ] Callback receives spec loading results
- [ ] Word document converts to HTML correctly
- [ ] Document matching submission works
- [ ] Callback receives matching results
- [ ] Results display correctly with all match statuses
- [ ] Confidence scores display correctly
- [ ] Filter/sort functionality works
- [ ] Export to CSV/JSON works
- [ ] Error states handled gracefully
- [ ] Loading states shown during processing
