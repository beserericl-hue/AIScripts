# n8n CSHSE Document Matcher - Integration Guide

## Overview

This system uses n8n workflows to analyze documents and match sections to CSHSE (Council for Standards in Human Service Education) specifications. It consists of three workflows that work together:

1. **Specification Loader** - Uploads and loads CSHSE specification PDFs into a vector database
2. **Document Matcher** - Processes documents asynchronously and matches sections to specifications
3. **Error Handler** - Sends error notifications via webhook callbacks

---

## Required External Services

### 1. Supabase (Vector Database)

**Purpose**: Stores CSHSE specifications with vector embeddings for semantic search.

**Required Configuration**:
- Supabase Project URL
- Supabase Service Role Key (not anon key - needs write access)

### 2. OpenAI API

**Purpose**: Generates embeddings and powers the AI agent for matching.

**Required Configuration**:
- OpenAI API Key
- Models used: `gpt-4-turbo` (matching), `text-embedding-3-small` (embeddings)

### 3. n8n Instance

**Purpose**: Runs the workflows.

**Webhook Base URL**: Your n8n instance URL (e.g., `https://your-n8n.example.com`)

---

## Supabase Setup Script

Run this SQL in your Supabase SQL Editor before using the workflows:

```sql
-- ============================================
-- CSHSE Specifications Vector Store Setup
-- ============================================

-- Step 1: Enable pgvector extension
create extension if not exists vector;

-- Step 2: Create specifications table
create table if not exists cshse_specifications (
  id bigserial primary key,
  content text not null,
  metadata jsonb,
  embedding vector(1536),
  created_at timestamp with time zone default now()
);

-- Step 3: Create index for faster similarity search
create index if not exists cshse_specifications_embedding_idx
  on cshse_specifications
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Step 4: Create match function for n8n vector store
create or replace function match_specifications (
  query_embedding vector(1536),
  match_count int default 5,
  filter jsonb default '{}'
) returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    cshse_specifications.id,
    cshse_specifications.content,
    cshse_specifications.metadata,
    1 - (cshse_specifications.embedding <=> query_embedding) as similarity
  from cshse_specifications
  where cshse_specifications.metadata @> filter
  order by cshse_specifications.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Step 5: Grant permissions (adjust role name if needed)
grant usage on schema public to anon, authenticated;
grant all on cshse_specifications to anon, authenticated;
grant usage, select on sequence cshse_specifications_id_seq to anon, authenticated;
```

---

## Workflow 1: Load Specifications (PDF Upload)

### Endpoint

```
POST {N8N_BASE_URL}/webhook/load-specifications
Content-Type: multipart/form-data
```

### Request Parameters

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `data` (file) | Binary (PDF) | **Yes** | The PDF specification document to load |
| `specName` | string | No | Name of the specification (default: "CSHSE Standards") |
| `specVersion` | string | No | Version identifier (default: "1.0") |
| `specId` | string | No | Your internal specification ID for tracking |
| `callbackUrl` | string | No | URL to receive completion notification |

### Request Example

```bash
curl -X POST https://your-n8n.example.com/webhook/load-specifications \
  -F "data=@CSHSE-Standards-2024.pdf" \
  -F "specName=CSHSE Standards 2024" \
  -F "specVersion=2024.1" \
  -F "specId=spec-123" \
  -F "callbackUrl=https://your-app.com/api/spec-callback"
```

### Immediate Response

```json
{
  "status": "accepted",
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "PDF processing started. Specifications will be loaded to vector store."
}
```

### Callback Response (if callbackUrl provided)

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

### When to Call

- When adding a new specification PDF
- When updating an existing specification version
- After clearing the Supabase table

---

## Workflow 2: Document Matcher (Main Workflow)

### Endpoint

```
POST {N8N_BASE_URL}/webhook/match-document
```

### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `callbackUrl` | string | **Yes** | URL where results/errors will be sent via POST |
| `documentId` | string | No | Your internal document ID for tracking |
| `htmlContent` | string | **Yes*** | HTML content of the document to process |
| `options` | object | No | Processing options (see below) |

*Note: Since n8n Code nodes cannot use mammoth.js, you must pre-convert Word documents to HTML before sending.

#### Options Object

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `batchSize` | number | 10 | Sections processed per batch |
| `confidenceThreshold` | number | 50 | Minimum confidence for a match (0-100) |
| `maxRetries` | number | 3 | Retry attempts per section on failure |
| `timeoutPerSection` | number | 60000 | Timeout per section in milliseconds |

### Request Example

```bash
curl -X POST https://your-n8n.example.com/webhook/match-document \
  -H "Content-Type: application/json" \
  -d '{
    "callbackUrl": "https://your-app.com/api/n8n-callback",
    "documentId": "doc-12345",
    "htmlContent": "<h1>Program Overview</h1><p>Our human services program...</p><h2>Accreditation</h2><p>We are regionally accredited by...</p>",
    "options": {
      "batchSize": 10,
      "confidenceThreshold": 50,
      "maxRetries": 3
    }
  }'
```

### Immediate Response

The workflow returns immediately with a job ID while processing continues in the background:

```json
{
  "status": "accepted",
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Document processing started. Results will be sent to callbackUrl."
}
```

---

## Callback Responses

Your `callbackUrl` will receive POST requests with the following payloads:

### Success Callback

```json
{
  "status": "completed",
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "documentId": "doc-12345",
  "results": {
    "jobId": "550e8400-e29b-41d4-a716-446655440000",
    "documentId": "doc-12345",
    "processedAt": "2024-01-15T10:30:00.000Z",
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
        "richTextContent": "<p>Our human services program...</p>",
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
          "confidence": 92,
          "rationale": "This section describes the program's identity and regional accreditation status, directly addressing Standard 1a requirements."
        }
      },
      {
        "sectionIndex": 1,
        "heading": "Miscellaneous Notes",
        "richTextContent": "<p>Administrative information...</p>",
        "match": {
          "status": "unmatched",
          "standard": null,
          "subspecification": null,
          "confidence": 35,
          "rationale": "This section contains general administrative content that doesn't align with any specific CSHSE standard."
        }
      },
      {
        "sectionIndex": 2,
        "heading": "Failed Section",
        "richTextContent": "<p>Content here...</p>",
        "match": {
          "status": "error",
          "error": "AI processing timeout"
        }
      }
    ],
    "errors": [
      {
        "sectionIndex": 2,
        "heading": "Failed Section",
        "error": "AI processing timeout"
      }
    ]
  }
}
```

### Partial Success Callback

Same structure as success, but with `"status": "partial_success"` when some sections failed.

### Error Callback (Complete Failure)

```json
{
  "status": "failed",
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "documentId": "doc-12345",
  "error": {
    "code": "PROCESSING_ERROR",
    "message": "Failed to parse document: No content found",
    "details": {
      "failedAt": "Split into Sections",
      "timestamp": "2024-01-15T10:30:00.000Z"
    }
  },
  "partialResults": null
}
```

---

## Integration Code Examples

### TypeScript/Node.js Client

```typescript
import axios from 'axios';

interface MatchDocumentOptions {
  batchSize?: number;
  confidenceThreshold?: number;
  maxRetries?: number;
  timeoutPerSection?: number;
}

interface MatchDocumentRequest {
  callbackUrl: string;
  documentId?: string;
  htmlContent: string;
  options?: MatchDocumentOptions;
}

interface MatchDocumentResponse {
  status: 'accepted';
  jobId: string;
  message: string;
}

interface SectionMatch {
  sectionIndex: number;
  heading: string;
  richTextContent: string;
  match: {
    status: 'matched' | 'unmatched' | 'error';
    standard?: { code: string; title: string } | null;
    subspecification?: { code: string; title: string } | null;
    confidence?: number;
    rationale?: string;
    error?: string;
  };
}

interface CallbackPayload {
  status: 'completed' | 'partial_success' | 'failed';
  jobId: string;
  documentId?: string;
  results?: {
    jobId: string;
    documentId?: string;
    processedAt: string;
    processingDuration: number;
    status: string;
    summary: {
      totalSections: number;
      matchedSections: number;
      unmatchedSections: number;
      failedSections: number;
    };
    sections: SectionMatch[];
    errors: Array<{ sectionIndex: number; heading: string; error: string }>;
  };
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

interface SpecUploadRequest {
  file: File | Buffer;
  specName?: string;
  specVersion?: string;
  specId?: string;
  callbackUrl?: string;
}

interface SpecUploadResponse {
  status: 'accepted';
  jobId: string;
  message: string;
}

interface SpecCallbackPayload {
  status: 'completed' | 'failed';
  jobId: string;
  specName: string;
  specVersion: string;
  specId?: string;
  documentsLoaded?: number;
  fileName?: string;
  processedAt?: string;
  message?: string;
  error?: { code: string; message: string };
}

class N8nDocumentMatcher {
  private baseUrl: string;

  constructor(n8nBaseUrl: string) {
    this.baseUrl = n8nBaseUrl.replace(/\/$/, '');
  }

  /**
   * Upload a PDF specification to load into the vector store
   */
  async uploadSpecification(request: SpecUploadRequest): Promise<SpecUploadResponse> {
    const formData = new FormData();

    // Add the PDF file
    if (request.file instanceof Buffer) {
      formData.append('data', new Blob([request.file]), 'specification.pdf');
    } else {
      formData.append('data', request.file);
    }

    // Add optional metadata
    if (request.specName) formData.append('specName', request.specName);
    if (request.specVersion) formData.append('specVersion', request.specVersion);
    if (request.specId) formData.append('specId', request.specId);
    if (request.callbackUrl) formData.append('callbackUrl', request.callbackUrl);

    const response = await axios.post(
      `${this.baseUrl}/webhook/load-specifications`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  }

  /**
   * Submit a document for matching (async - results sent to callbackUrl)
   */
  async matchDocument(request: MatchDocumentRequest): Promise<MatchDocumentResponse> {
    const response = await axios.post(
      `${this.baseUrl}/webhook/match-document`,
      request,
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
    return response.data;
  }
}

// Usage example
const matcher = new N8nDocumentMatcher('https://your-n8n.example.com');

// Upload specification PDF
const specFile = fs.readFileSync('/path/to/CSHSE-Standards.pdf');
const specResult = await matcher.uploadSpecification({
  file: specFile,
  specName: 'CSHSE Standards 2024',
  specVersion: '2024.1',
  callbackUrl: 'https://your-app.com/api/spec-callback'
});
console.log(`Spec upload job started: ${specResult.jobId}`);

// Process a document for matching
const matchResult = await matcher.matchDocument({
  callbackUrl: 'https://your-app.com/api/n8n-callback',
  documentId: 'doc-12345',
  htmlContent: '<h1>Program Overview</h1><p>Content here...</p>',
  options: {
    batchSize: 10,
    confidenceThreshold: 50
  }
});
console.log(`Document match job started: ${matchResult.jobId}`);
```

### Express.js Callback Handlers

```typescript
import express from 'express';

const app = express();
app.use(express.json({ limit: '50mb' })); // Large payloads for big documents

// Callback endpoint for specification upload results
app.post('/api/spec-callback', async (req, res) => {
  const payload: SpecCallbackPayload = req.body;

  console.log(`Spec upload callback for job: ${payload.jobId}`);
  console.log(`Status: ${payload.status}`);

  if (payload.status === 'completed') {
    console.log(`Loaded ${payload.documentsLoaded} chunks from ${payload.fileName}`);
    // Store specification metadata in your database
    await storeSpecification({
      jobId: payload.jobId,
      name: payload.specName,
      version: payload.specVersion,
      specId: payload.specId,
      documentsLoaded: payload.documentsLoaded,
      fileName: payload.fileName,
      loadedAt: payload.processedAt
    });
  } else {
    console.error('Specification loading failed:', payload.error);
  }

  res.status(200).json({ received: true });
});

// Callback endpoint for document matching results
app.post('/api/n8n-callback', async (req, res) => {
  const payload: CallbackPayload = req.body;

  console.log(`Received callback for job: ${payload.jobId}`);
  console.log(`Status: ${payload.status}`);

  if (payload.status === 'failed') {
    // Handle complete failure
    console.error('Document processing failed:', payload.error);
    await handleProcessingError(payload.jobId, payload.error);
  } else {
    // Handle success or partial success
    const results = payload.results!;
    console.log(`Processed ${results.summary.totalSections} sections`);
    console.log(`Matched: ${results.summary.matchedSections}`);
    console.log(`Unmatched: ${results.summary.unmatchedSections}`);
    console.log(`Failed: ${results.summary.failedSections}`);

    // Store results in your database
    await storeMatchResults(payload.jobId, payload.documentId, results);

    // Handle any errors in individual sections
    if (results.errors.length > 0) {
      console.warn('Some sections had errors:', results.errors);
    }
  }

  // Always return 200 to acknowledge receipt
  res.status(200).json({ received: true });
});

async function handleProcessingError(jobId: string, error: any) {
  // Update job status in your database
  // Notify user of failure
  // etc.
}

async function storeMatchResults(jobId: string, documentId: string | undefined, results: any) {
  // Store matched sections in your database
  // Update document status
  // etc.
}
```

### Word Document to HTML Conversion

Since n8n cannot convert Word documents directly, convert them before sending:

```typescript
import mammoth from 'mammoth';
import * as fs from 'fs';

async function convertWordToHtml(filePath: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);
  const result = await mammoth.convertToHtml({ buffer });

  if (result.messages.length > 0) {
    console.warn('Conversion warnings:', result.messages);
  }

  return result.value;
}

// Usage
const htmlContent = await convertWordToHtml('/path/to/document.docx');

await matcher.matchDocument({
  callbackUrl: 'https://your-app.com/api/n8n-callback',
  documentId: 'doc-12345',
  htmlContent: htmlContent
});
```

---

## CSHSE Standards Reference

The system matches against 21 CSHSE standards:

### Part I: General Program Standards (1-10)
| Code | Title |
|------|-------|
| 1 | Program Identity |
| 2 | Program Objectives |
| 3 | Program Organization |
| 4 | Program Budget |
| 5 | Program Support |
| 6 | Program Faculty |
| 7 | Faculty Development |
| 8 | Field Supervisors |
| 9 | Program Services |
| 10 | Admissions |

### Part II: Curriculum Standards (11-21)
| Code | Title |
|------|-------|
| 11 | Curriculum |
| 12 | Practice |
| 13 | Assessment |
| 14 | Outcomes |
| 15 | Portfolio |
| 16 | Advisory Committee |
| 17 | Diversity |
| 18 | Ethics |
| 19 | Supervision |
| 20 | Technology |
| 21 | Field Experience |

Each standard has subspecifications labeled `a` through `f`.

---

## Error Handling Best Practices

1. **Always implement the callback endpoint** - Results are sent asynchronously
2. **Handle partial successes** - Some sections may fail while others succeed
3. **Store the jobId** - Use it to correlate callbacks with original requests
4. **Implement idempotency** - You may receive duplicate callbacks
5. **Set appropriate timeouts** - Large documents can take several minutes
6. **Handle the `unmatched` status** - Not all sections will match a specification

---

## Environment Variables

Your application should configure:

```env
# n8n Configuration
N8N_BASE_URL=https://your-n8n.example.com

# Your callback server
CALLBACK_BASE_URL=https://your-app.com
```

n8n workflows require these credentials configured in n8n:
- OpenAI API credentials
- Supabase API credentials (URL + Service Role Key)

---

## Workflow IDs (for reference)

| Workflow | ID | Purpose |
|----------|-----|---------|
| Specification Loader (PDF) | `UWg1TsqA9Bmc7NFg` | Upload PDF specs to vector store |
| Document Matcher | `B9fsLY5OK5H1C245` | Main document processing |
| Error Handler | `xOKfFZfiPtoeZ5e1` | Error notification |
