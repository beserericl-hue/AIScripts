# CSHSE Accreditation Self-Study Portal

A comprehensive accreditation self-study application and review management system for the Council for Standards in Human Service Education (CSHSE).

## Table of Contents

- [Overview](#overview)
- [User Roles](#user-roles)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [N8N Webhook Integration](#n8n-webhook-integration)
- [Self-Study Import Workflow](#self-study-import-workflow)
- [User Guide](#user-guide)
- [API Reference](#api-reference)
- [Development Setup](#development-setup)
- [Deployment](#deployment)
- [Recent Changes](#recent-changes)

---

## Overview

This portal enables educational institutions to prepare and submit accreditation self-studies for CSHSE National Standards, and allows accreditation reviewers to evaluate submissions. The system supports three degree levels:

| Program Level | Standards | Field Experience |
|---------------|-----------|------------------|
| Associate Degree | 20 Standards | Min. 250 hours |
| Baccalaureate Degree | 21 Standards | Min. 350 hours |
| Master's Degree | 18 Standards | Capstone/Field |

---

## User Roles

| Role | Permissions |
|------|-------------|
| **Program Coordinator** | Upload self-studies, edit narratives, manage evidence, submit for review |
| **Reader/Reviewer** | Evaluate submissions, mark compliance, add comments, submit recommendations |
| **Lead Reader** | Compile multi-reader assessments, resolve disagreements, make final recommendations |
| **Administrator** | Manage users, configure webhooks, assign readers, oversee all submissions |

---

## Key Features

### Self-Study Import & Manual Tagging
- **Document Upload**: Import legacy self-studies from DOCX or PDF formats
- **Visual Section Tagging**: Manually mark and tag document sections in a visual interface
- **GridFS Storage**: Large documents (up to 370MB+) stored using MongoDB GridFS
- **Image Preservation**: Embedded images extracted and served via API

### Self-Study Editor
- **Rich Text Editing**: TipTap-powered editor with formatting toolbar
- **Auto-Save**: 2-second debounced auto-save with visual indicators
- **N8N Validation**: AI-powered validation of narrative content against standards
- **Progress Tracking**: Visual indicators for standard completion status

### Curriculum Matrix Editor
- **Spreadsheet Interface**: Add/remove course columns dynamically
- **Assessment Cells**: Type (I/T/K/S) and Depth (L/M/H) per specification
- **Import/Export**: CSV export and Excel import support

### Evidence Management
- **File Upload**: Drag-drop support for Word, PDF, PPT, images
- **URL Evidence**: Link external resources and documents
- **Standard Linking**: Associate evidence with specific standards/specifications

### Reader/Reviewer Portal
- **Split-Screen View**: Standards + narrative on left, documents on right
- **Compliance Assessment**: Y/N/NA toggles per specification
- **Rich Comments**: Comments with evidence references
- **Bookmarks & Flags**: Mark items for follow-up

### Lead Reader Portal
- **Multi-Reader Comparison**: Side-by-side view of all reader assessments
- **Disagreement Detection**: Automatic flagging of conflicting assessments
- **Consensus Building**: Set final determinations with rationale
- **PDF Reports**: Generate compilation reports

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CSHSE Portal Architecture                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌──────────────┐         ┌──────────────┐         ┌──────────────┐   │
│   │   React UI   │ ◄──────►│  Express API │ ◄──────►│   MongoDB    │   │
│   │   (Vite)     │  REST   │  (Node.js)   │         │  + GridFS    │   │
│   └──────────────┘         └──────────────┘         └──────────────┘   │
│          │                        │                        │            │
│          │                        │                        ▼            │
│          │                        │                 ┌──────────────┐   │
│          │                        │                 │   GridFS     │   │
│          │                        │                 │   Buckets    │   │
│          │                        │                 │  - htmlContent│   │
│          │                        │                 │  - images    │   │
│          │                        │                 └──────────────┘   │
│          │                        │                                     │
│          │                        ▼                                     │
│          │              ┌─────────────────┐                            │
│          │              │   N8N Webhooks  │                            │
│          │              │  ┌───────────┐  │                            │
│          │              │  │ Validator │  │  ◄── AI Analysis           │
│          │              │  │ Spec Load │  │  ◄── PDF Parsing           │
│          │              │  │ Doc Match │  │  ◄── Section Mapping       │
│          │              │  └───────────┘  │                            │
│          │              └─────────────────┘                            │
│          │                                                              │
│          ▼                                                              │
│   ┌──────────────────────────────────────────────────────────────┐    │
│   │                         Railway PaaS                          │    │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │    │
│   │  │  Container  │  │   MongoDB   │  │  Environment Vars   │   │    │
│   │  │  (Docker)   │  │   Atlas     │  │  - MONGODB_URI      │   │    │
│   │  │             │  │             │  │  - JWT_SECRET       │   │    │
│   │  │  Port 8080  │  │             │  │  - N8N_WEBHOOK_URL  │   │    │
│   │  └─────────────┘  └─────────────┘  └─────────────────────┘   │    │
│   └──────────────────────────────────────────────────────────────┘    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Storage Architecture

The application uses a hybrid storage approach:

| Data Type | Storage Location | Reason |
|-----------|------------------|--------|
| User data, submissions, reviews | MongoDB Documents | Structured data <16MB |
| Large HTML content (self-studies) | GridFS `htmlContent` bucket | Documents can exceed 16MB BSON limit |
| Extracted images | GridFS `images` bucket | Persistent storage on ephemeral filesystem |
| Uploaded evidence files | MongoDB/Local | Configurable via environment |

---

## Technology Stack

### Frontend Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| React | 18.2.0 | UI framework |
| Vite | 5.1.0 | Build tool |
| React Router | 6.22.0 | Navigation |
| TanStack Query | 5.17.19 | Data fetching & caching |
| TipTap | 2.2.3+ | Rich text editor |
| Tailwind CSS | 3.4.1 | Styling |
| Radix UI | Various | Accessible UI primitives |
| Zustand | 4.5.0 | State management |
| Lucide React | 0.323.0 | Icons |
| Zod | 3.22.4 | Validation |
| React Hook Form | 7.50.1 | Form handling |

### Backend Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| Express | 4.18.2 | Web framework |
| Mongoose | 8.0.3 | MongoDB ODM |
| JWT/bcrypt | 9.0.2/5.1.1 | Authentication |
| Mammoth | 1.6.0 | DOCX parsing |
| pdf-parse | 1.1.1 | PDF extraction |
| pptx-parser | 1.1.0 | PowerPoint parsing |
| PDFKit | 0.14.0 | PDF generation |
| Sharp | 0.33.0 | Image processing |
| Tesseract.js | 5.0.0 | OCR (optional) |
| Multer | 1.4.5 | File uploads |
| Nodemailer | 7.0.12 | Email notifications |
| Axios | 1.13.3 | HTTP client |

---

## N8N Webhook Integration

The application integrates with three N8N workflows for AI-powered document processing:

### 1. Validation Webhook (`n8n_validation`)

Validates narrative content against CSHSE standards using AI analysis.

**Endpoint**: `POST /api/webhooks/n8n/callback`

**Outbound Request**:
```json
{
  "submissionId": "sub_123",
  "standardCode": "11",
  "specCode": "a",
  "narrativeText": "The curriculum provides...",
  "standardText": "The curriculum shall provide theoretical...",
  "supportingEvidence": [{ "filename": "syllabus.pdf", "type": "document" }],
  "validationType": "manual_save",
  "callbackUrl": "https://api/webhooks/n8n/callback"
}
```

**Callback Response**:
```json
{
  "executionId": "exec_456",
  "submissionId": "sub_123",
  "standardCode": "11",
  "specCode": "a",
  "result": {
    "status": "pass",
    "score": 85,
    "feedback": "The narrative adequately addresses the requirement.",
    "suggestions": ["Add specific course numbers"],
    "missingElements": []
  }
}
```

### 2. Spec Loader Webhook (`spec_loader`)

Loads and parses specification documents (PDFs) into the AI system.

**Endpoint**: `POST /api/webhooks/spec-loader/callback`

**Outbound Request**:
```json
{
  "data": "base64_encoded_pdf_content",
  "filename": "CSHSE-Standards-2025.pdf",
  "mimeType": "application/pdf",
  "specId": "spec_123",
  "specName": "CSHSE Associate Degree Standards",
  "specVersion": "July 2025",
  "callbackUrl": "https://api/webhooks/spec-loader/callback"
}
```

**Callback Response**:
```json
{
  "specId": "spec_123",
  "status": "success",
  "standardsFound": 20,
  "specifications": [
    { "code": "1", "title": "Program Identity", "specs": ["a", "b", "c"] }
  ]
}
```

### 3. Document Matcher Webhook (`document_matcher`)

Maps imported document sections to standards using AI analysis.

**Endpoint**: `POST /api/webhooks/document-matcher/callback`

**Callback Response** (incremental, one section at a time):
```json
{
  "type": "section_result",
  "jobId": "job_123",
  "documentId": "import_456",
  "moreData": true,
  "sectionIndex": 0,
  "totalSections": 15,
  "section": {
    "heading": "Program Overview",
    "richTextContent": "<p>Our program is regionally accredited...</p>",
    "match": {
      "status": "matched",
      "standard": { "code": "1", "title": "Program Identity" },
      "subspecification": { "code": "a", "title": "Regional Accreditation" },
      "confidence": 92,
      "rationale": "This section describes regional accreditation status."
    }
  }
}
```

### Webhook Configuration

Configure webhooks in the Admin Settings (`/admin/webhook-settings`):

| Setting | Description |
|---------|-------------|
| Webhook URL | N8N webhook endpoint |
| Callback URL | Auto-generated from server URL |
| Auth Type | `api_key` or `bearer` token |
| API Key | Authentication credential |
| Max Retries | Retry attempts on failure (default: 3) |
| Retry Delay | Initial delay in ms (default: 1000) |
| Backoff Multiplier | Exponential backoff factor (default: 2) |

---

## Self-Study Import Workflow

### Manual Section Tagging Process

The application uses a visual manual tagging workflow for importing self-study documents:

```
┌─────────────────────────────────────────────────────────────────┐
│                    SELF-STUDY IMPORT WORKFLOW                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. UPLOAD DOCUMENT                                              │
│     ├─ Accept DOCX or PDF                                        │
│     ├─ Parse with Mammoth/pdf-parse                              │
│     ├─ Extract images to GridFS                                  │
│     └─ Store HTML in GridFS (handles 370MB+ documents)           │
│                                                                  │
│  2. VISUAL TAGGING INTERFACE                                     │
│     ┌────────────────────────────┬────────────────────────┐     │
│     │    Document Viewer (70%)   │  Tagging Panel (30%)   │     │
│     │                            │                        │     │
│     │  ┌──────────────────────┐  │  [Mark Start]          │     │
│     │  │                      │  │  [Mark End]            │     │
│     │  │  Scrollable HTML     │  │                        │     │
│     │  │  with images         │  │  Section Type:         │     │
│     │  │                      │  │  ○ Standard (1-21)     │     │
│     │  │  Click to place      │  │  ○ Curriculum Matrix   │     │
│     │  │  cursor markers      │  │  ○ Appendix            │     │
│     │  │                      │  │  ○ Skip/Ignore         │     │
│     │  └──────────────────────┘  │                        │     │
│     │                            │  [Save Section]        │     │
│     └────────────────────────────┴────────────────────────┘     │
│                                                                  │
│  3. SECTION EXTRACTION                                           │
│     ├─ Extract HTML from marked offsets                          │
│     ├─ Save to MongoDB with metadata                             │
│     ├─ Insert visual marker in document                          │
│     └─ Update GridFS with remaining content                      │
│                                                                  │
│  4. FINISH TAGGING                                               │
│     ├─ Review tagged sections list                               │
│     ├─ Optionally send to N8N for AI processing                  │
│     └─ Apply sections to submission narratives                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Section Types

| Type | Description | Standard Mapping |
|------|-------------|------------------|
| **Standard** | Narrative content for Standards 1-21 | User selects standard number and optional spec (a-h) |
| **Curriculum Matrix** | Course/standard mapping tables | Parsed into matrix editor |
| **Appendix** | Supporting documentation | Linked as evidence |
| **Skip** | Content to ignore (TOC, headers, etc.) | Removed from document |

---

## User Guide

### For Program Coordinators

#### Creating a New Submission
1. Navigate to **Submissions** from the dashboard
2. Click **New Submission**
3. Fill in institution and program details
4. Select program level (Associate/Baccalaureate/Master's)

#### Importing a Self-Study Document
1. Open your submission
2. Click **Import Document** in the sidebar
3. Upload your DOCX or PDF file
4. Wait for document processing (progress shown)
5. Use the visual tagging interface:
   - Scroll to find a section
   - Click **Mark Start** at the beginning
   - Scroll to the end of the section
   - Click **Mark End**
   - Select the section type (Standard, Matrix, Appendix, Skip)
   - If Standard: select the standard number (1-21)
   - Click **Save Section**
6. Repeat until all content is tagged
7. Click **Finish Tagging** when complete

#### Editing Narratives
1. Navigate to a standard in the sidebar
2. Use the rich text editor to modify content
3. Content auto-saves every 2 seconds
4. Click **Save & Validate** to trigger AI validation
5. Review feedback and suggestions
6. Mark standards complete when satisfied

#### Managing Evidence
1. Click **Evidence** in the standard panel
2. Drag-drop files or click to upload
3. Add URL evidence with **Add Link**
4. Link evidence to specific specifications

#### Submitting for Review
1. Ensure all standards show "Complete" status
2. Click **Submit Self-Study**
3. Confirm submission (cannot edit after submission)

### For Readers/Reviewers

#### Reviewing a Submission
1. Navigate to **My Reviews** from the dashboard
2. Select an assigned submission
3. Use the split-screen workspace:
   - Left: Standards and narrative content
   - Right: Evidence documents
4. For each specification:
   - Select compliance: Compliant / Non-Compliant / N/A
   - Add comments explaining your assessment
   - Reference specific evidence if needed
5. Use **Bookmark** for items to revisit
6. Use **Flag** for items needing discussion

#### Submitting Your Review
1. Complete all standard assessments
2. Fill in the Final Assessment:
   - Overall strengths
   - Overall weaknesses
   - Recommendation
3. Click **Submit Review**

### For Lead Readers

#### Compiling Reader Assessments
1. Navigate to **Lead Reviews** from the dashboard
2. Select a submission with completed reader reviews
3. View the side-by-side comparison
4. For disagreements:
   - Review each reader's comments
   - Set the final determination
   - Add rationale for your decision
5. Complete the final compilation
6. Generate PDF report if needed

---

## API Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/logout` | User logout |
| GET | `/api/auth/me` | Get current user |

### Submissions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/submissions` | List submissions |
| GET | `/api/submissions/:id` | Get submission details |
| PATCH | `/api/submissions/:id/narrative` | Save narrative content |
| POST | `/api/submissions/:id/standards/:code/submit` | Submit for validation |

### Document Import
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/imports/upload` | Upload document |
| GET | `/api/imports/:id` | Get import status |
| GET | `/api/imports/:id/content` | Get HTML content from GridFS |
| GET | `/api/imports/:id/images/:filename` | Get image from GridFS |
| POST | `/api/imports/:id/extract-section` | Extract and save section |
| GET | `/api/imports/:id/tagged-sections` | List tagged sections |
| DELETE | `/api/imports/:id/tagged-sections/:sectionId` | Delete tagged section |
| POST | `/api/imports/:id/finish-tagging` | Complete tagging workflow |
| DELETE | `/api/imports/:id` | Cancel import |

### Curriculum Matrix
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/submissions/:id/matrix` | Get curriculum matrix |
| POST | `/api/submissions/:id/matrix/:matrixId/course` | Add course |
| PUT | `/api/submissions/:id/matrix/:matrixId/assessment` | Update assessment |

### Evidence
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/submissions/:id/evidence` | List evidence |
| POST | `/api/submissions/:id/evidence/upload` | Upload file |
| POST | `/api/submissions/:id/evidence/url` | Add URL evidence |

### Reviews
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reviews` | Get assigned reviews |
| GET | `/api/reviews/:id/workspace` | Get review workspace |
| PATCH | `/api/reviews/:id/assessment` | Save assessment |
| POST | `/api/reviews/:id/submit` | Submit review |

### Lead Reviews
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/lead-reviews` | Get compilations |
| GET | `/api/lead-reviews/:id/comparison` | Get reader comparison |
| PATCH | `/api/lead-reviews/:id/determination` | Set final determination |

### Webhooks
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/webhooks/n8n/validate` | Trigger validation |
| POST | `/api/webhooks/n8n/callback` | Receive validation result |
| POST | `/api/webhooks/spec-loader/callback` | Receive spec load result |
| POST | `/api/webhooks/document-matcher/callback` | Receive section mapping |

---

## Development Setup

### Prerequisites
- Node.js 20+
- MongoDB 6.0+ (local or Atlas)
- npm or yarn

### Local Development

```bash
# Clone repository
git clone <repository-url>
cd CSHSE

# Install dependencies
cd server && npm install
cd ../client && npm install

# Configure environment
cp server/.env.example server/.env
# Edit .env with your MongoDB URI and JWT secret

# Start development servers
# Terminal 1: Server (port 5000)
cd server && npm run dev

# Terminal 2: Client (port 3000)
cd client && npm run dev
```

### Environment Variables

**Server (`server/.env`)**:
```bash
NODE_ENV=development
PORT=5000

# MongoDB
MONGODB_URI=mongodb://localhost:27017/cshse

# Authentication
JWT_SECRET=your-secure-secret-key
JWT_EXPIRES_IN=7d

# File uploads
UPLOAD_DIR=uploads/evidence
MAX_FILE_SIZE=52428800

# N8N Webhooks (optional)
N8N_VALIDATION_URL=https://your-n8n/webhook/validate
N8N_SPEC_LOADER_URL=https://your-n8n/webhook/spec-loader
N8N_DOCUMENT_MATCHER_URL=https://your-n8n/webhook/doc-matcher
```

**Client (`client/.env`)**:
```bash
VITE_API_URL=http://localhost:5000/api
```

---

## Deployment

### Railway Deployment

The application is configured for Railway deployment with the included `Dockerfile` and `railway.json`.

**Deployment Steps**:
1. Connect GitHub repository to Railway
2. Configure environment variables in Railway dashboard
3. Add MongoDB Atlas addon or configure external MongoDB
4. Deploy automatically on push to main branch

**Required Environment Variables**:
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Secure random string
- `NODE_ENV=production`

**Railway Configuration** (`railway.json`):
```json
{
  "build": { "builder": "DOCKERFILE" },
  "deploy": {
    "numReplicas": 1,
    "healthcheckPath": "/health",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

### Docker Build

The multi-stage Dockerfile:
1. Builds React client with Vite
2. Compiles TypeScript server with esbuild
3. Creates minimal production image with Node.js 20 Alpine
4. Serves client as static files from `/public`
5. Exposes port 8080

---

## Recent Changes

### GridFS Storage Implementation (February 2026)
- **Problem**: Documents producing 370MB+ HTML exceeded MongoDB's 16MB BSON limit
- **Solution**: Implemented MongoDB GridFS for large file storage
- **Changes**:
  - Added `gridFsService.ts` with `htmlContent` and `images` buckets
  - HTML content stored in GridFS chunks (255KB each)
  - Images stored in GridFS for persistence on ephemeral filesystems
  - Updated `getDocumentContent` to stream from GridFS
  - Updated `extractSection` to read/write from GridFS
  - Added GridFS cleanup on import cancellation

### Manual Section Tagging Workflow (January 2026)
- **Problem**: Automated regex-based section detection failed on complex documents
- **Solution**: Visual manual tagging interface
- **Changes**:
  - Added `DocumentViewer` component for scrollable HTML display
  - Added `SectionTagger` component for marking sections
  - Added `TaggedSectionsList` component for managing tagged sections
  - Character offset-based section extraction
  - Visual markers for extracted sections

### Import Workflow Improvements
- Replaced automated detection with manual tagging
- Added progress indicators during document processing
- Improved error handling and user feedback
- Added cancel import functionality

---

## Standards Reference

### CSHSE National Standards (Revised July 2025)

**Associate Degree - 20 Standards**
- Section I (1-10): General Program Characteristics
- Section II (11-20): Curriculum

**Baccalaureate Degree - 21 Standards**
- Includes Administrative standard (18)
- Field Experience minimum 350 hours

**Master's Degree - 18 Standards**
- Focus on leadership and research
- Culminating experiences requirement

### Curriculum Matrix Coverage

| Code | Type | Description |
|------|------|-------------|
| I | Introduction | Basic exposure |
| T | Theory | Theoretical frameworks |
| K | Knowledge | Factual comprehension |
| S | Skills | Practical application |

| Code | Depth | Description |
|------|-------|-------------|
| L | Low | Brief mention |
| M | Medium | Dedicated content |
| H | High | Major focus |

---

## License

Proprietary - Council for Standards in Human Service Education

---

## Support

For issues or feature requests, please contact the CSHSE development team or submit an issue to the repository.
