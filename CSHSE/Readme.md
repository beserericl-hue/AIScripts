# CSHSE Accreditation Self-Study Application

A comprehensive accreditation self-study application and review management system for the Council for Standards in Human Service Education (CSHSE).

## Overview

This application enables educational institutions to prepare and submit accreditation self-studies, and allows accreditation reviewers to evaluate submissions against CSHSE National Standards.

### Target Users

| Role | Description |
|------|-------------|
| **Program Coordinators** | Prepare and submit accreditation applications and self-studies |
| **Readers/Reviewers** | Evaluate submissions against standards |
| **Lead Readers** | Compile multi-reader assessments and make final recommendations |
| **Administrators** | Manage users, assign readers, oversee submissions |

### Supported Program Levels

- **Associate Degree** - 20 Standards (Standards 1-10 General, 11-20 Curriculum)
- **Baccalaureate Degree** - 21 Standards (includes Administrative standard)
- **Master's Degree** - 18 Standards (focus on leadership/research)

---

## Key Features

### Self-Study Import System
- **Document Parsing**: Import legacy self-studies from PDF, DOCX, and PPTX formats
- **Auto-Mapping**: AI-assisted section detection with confidence scores
- **Manual Assignment**: Review and assign unmapped content to standards

### Self-Study Editor
- **Rich Text Editing**: TipTap-powered editor with formatting toolbar
- **Auto-Save**: 2-second debounced auto-save with visual indicators
- **Manual Save + Validation**: Trigger N8N validation on demand
- **Progress Tracking**: Visual indicators for standard completion status

### Curriculum Matrix Editor
- **Spreadsheet Interface**: Add/remove course columns dynamically
- **Assessment Cells**: Type (I/T/K/S) and Depth (L/M/H) per specification
- **Import/Export**: CSV export and Excel import support

### Evidence Management
- **File Upload**: Drag-drop support for Word, PDF, PPT, images
- **URL Evidence**: Link external resources and documents
- **Linking**: Associate evidence with specific standards/specifications

### N8N Validation Integration
- **Webhook Integration**: Real-time validation via N8N workflows
- **AI Analysis**: Pass/fail results with feedback and suggestions
- **Incremental Revalidation**: Only revalidate failed sections

### Reader/Reviewer Portal
- **Split-Screen View**: Standards + narrative on left, documents on right
- **Compliance Assessment**: Y/N/NA toggles per specification
- **Comments**: Rich text comments with evidence references
- **Bookmarks & Flags**: Mark items for follow-up
- **Final Assessment**: Recommendation with strengths/weaknesses

### Lead Reader Portal
- **Multi-Reader Comparison**: Side-by-side view of all reader assessments
- **Disagreement Detection**: Automatic flagging of conflicting assessments
- **Consensus Determination**: Set final determinations with rationale
- **Communication Threads**: Discussion threads with readers
- **PDF Reports**: Generate compilation reports

---

## Architecture

### Technology Stack

**Frontend**
- React 18 with TypeScript
- Vite (build tool)
- React Router v6 (navigation)
- TipTap (rich text editor)
- TanStack Query (data fetching)
- Tailwind CSS (styling)
- Lucide React (icons)

**Backend**
- Node.js with Express
- TypeScript
- JWT Authentication (bcrypt for passwords)
- Multer (file uploads)
- PDFKit (PDF generation)

**Document Parsing**
- pdf-parse (PDF text extraction)
- mammoth (DOCX parsing)
- pptx-parser (PowerPoint parsing)

**Storage**
- **Local Development**: JSON file-based storage
- **Production (Docker)**: MongoDB with Mongoose

**Integration**
- N8N workflow webhooks for AI-powered validation

### Project Structure

```
/CSHSE
├── client/                              # React frontend
│   ├── src/
│   │   ├── components/                  # Reusable UI components
│   │   ├── features/
│   │   │   ├── admin/
│   │   │   │   └── WebhookSettings/     # N8N configuration UI
│   │   │   └── selfStudy/
│   │   │       ├── Editor/              # TipTap narrative editor
│   │   │       ├── MatrixEditor/        # Curriculum matrix UI
│   │   │       ├── EvidenceManager/     # File/URL evidence UI
│   │   │       └── SubmissionWorkflow/  # Progress & validation UI
│   │   ├── hooks/
│   │   │   ├── useAutoSave.ts           # Debounced auto-save hook
│   │   │   └── useValidationStatus.ts   # Validation tracking hook
│   │   ├── services/                    # API client
│   │   ├── store/                       # React Context state
│   │   ├── styles/                      # Global CSS
│   │   ├── types/                       # TypeScript interfaces
│   │   └── utils/                       # Helper functions
│   └── package.json
├── server/                              # Express backend
│   ├── src/
│   │   ├── config/
│   │   │   └── database.ts              # MongoDB/JSON connection
│   │   ├── controllers/
│   │   │   ├── adminController.ts       # Admin settings
│   │   │   ├── evidenceController.ts    # Evidence CRUD
│   │   │   ├── importController.ts      # Document import
│   │   │   ├── leadReaderController.ts  # Lead reader operations
│   │   │   ├── matrixController.ts      # Curriculum matrix
│   │   │   ├── reportController.ts      # PDF generation
│   │   │   ├── reviewController.ts      # Reader operations
│   │   │   ├── submissionController.ts  # Submission workflow
│   │   │   └── webhookController.ts     # N8N integration
│   │   ├── models/
│   │   │   ├── CurriculumMatrix.ts      # Course/standard mapping
│   │   │   ├── LeadReaderCompilation.ts # Multi-reader aggregation
│   │   │   ├── Review.ts                # Reader assessments
│   │   │   ├── SelfStudyImport.ts       # Import tracking
│   │   │   ├── Submission.ts            # Main submission
│   │   │   ├── SupportingEvidence.ts    # Documents/URLs/images
│   │   │   ├── User.ts                  # User accounts
│   │   │   ├── ValidationResult.ts      # N8N results
│   │   │   └── WebhookSettings.ts       # N8N configuration
│   │   ├── routes/
│   │   │   ├── admin.ts                 # /api/admin/*
│   │   │   ├── evidence.ts              # /api/submissions/:id/evidence/*
│   │   │   ├── imports.ts               # /api/imports/*
│   │   │   ├── leadReviews.ts           # /api/lead-reviews/*
│   │   │   ├── matrix.ts                # /api/submissions/:id/matrix/*
│   │   │   ├── reports.ts               # /api/reports/*
│   │   │   ├── reviews.ts               # /api/reviews/*
│   │   │   ├── submissions.ts           # /api/submissions/*
│   │   │   └── webhooks.ts              # /api/webhooks/*
│   │   ├── services/
│   │   │   ├── documentParser.ts        # PDF/DOCX/PPTX parsing
│   │   │   ├── pdfGenerator.ts          # Report generation
│   │   │   ├── sectionMapper.ts         # Auto-mapping logic
│   │   │   └── validationService.ts     # N8N webhook calls
│   │   └── index.ts                     # Express app entry
│   └── package.json
├── cshse-parts/                         # Reference data (split self-study)
├── data/                                # Local storage (dev)
├── docker-compose.yml                   # Production deployment
└── package.json                         # Root workspace
```

---

## Data Models

### User
```typescript
interface User {
  id: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: 'program_coordinator' | 'reader' | 'lead_reader' | 'admin';
  institutionId?: string;
  assignedSubmissions: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### Submission
```typescript
interface Submission {
  id: string;
  submissionId: string;              // Human-readable "2024-001"
  institutionName: string;
  programName: string;
  programLevel: 'associate' | 'bachelors' | 'masters';
  coordinatorId: string;
  type: 'initial' | 'reaccreditation' | 'extension';
  status: SubmissionStatus;
  narrativeContent: NarrativeContent[];
  standardsStatus: Record<string, StandardStatusInfo>;
  imports: string[];                 // SelfStudyImport references
  curriculumMatrices: string[];      // CurriculumMatrix references
  selfStudyProgress: SelfStudyProgress;
  decision?: Decision;
  assignedReaders: string[];
  leadReaderId?: string;
  submittedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface NarrativeContent {
  standardCode: string;
  specCode: string;
  content: string;                   // Rich text HTML
  lastModified: Date;
}

interface StandardStatusInfo {
  status: 'not_started' | 'in_progress' | 'complete' | 'submitted' | 'validated';
  validationStatus?: 'pending' | 'pass' | 'fail';
  submittedAt?: Date;
}

type SubmissionStatus =
  | 'draft'
  | 'in_progress'
  | 'submitted'
  | 'under_review'
  | 'readers_assigned'
  | 'review_complete'
  | 'approved'
  | 'denied'
  | 'conditional';
```

### Review (Reader Assessment)
```typescript
interface Review {
  id: string;
  submissionId: string;
  reviewerId: string;
  reviewerNumber: number;            // 1, 2, or 3
  totalReviewers: number;
  institutionName: string;
  programName: string;
  programLevel: string;
  status: 'assigned' | 'in_progress' | 'complete' | 'submitted';
  reviewDate?: Date;
  assessments: StandardAssessment[];
  finalAssessment?: FinalAssessment;
  progress: ReaderProgress;
  bookmarkedItems: string[];         // "11.a", "12.b"
  flaggedItems: FlaggedItem[];
  createdAt: Date;
  updatedAt: Date;
}

interface StandardAssessment {
  standardCode: string;
  specifications: SpecificationAssessment[];
  isComplete: boolean;
  completedAt?: Date;
}

interface SpecificationAssessment {
  specCode: string;
  compliance: 'compliant' | 'non_compliant' | 'not_applicable' | null;
  comments: string;
  internalNotes?: string;
  evidenceRefs: string[];
  reviewedAt?: Date;
}

interface FinalAssessment {
  recommendation: RecommendationType;
  overallStrengths: string;
  overallWeaknesses: string;
  conditionsForApproval?: string;
  additionalComments?: string;
  submittedAt?: Date;
}

type RecommendationType =
  | 'accreditation_no_conditions'
  | 'conditional_accreditation'
  | 'deny_accreditation'
  | 'hold_decision';
```

### Lead Reader Compilation
```typescript
interface LeadReaderCompilation {
  id: string;
  submissionId: string;
  leadReaderId: string;
  institutionName: string;
  programName: string;
  programLevel: string;
  totalReaders: number;
  completedReviews: number;
  readerIds: string[];
  status: 'pending_reviews' | 'ready_for_compilation' | 'in_progress' | 'submitted';
  compiledAssessments: StandardCompilation[];
  readerRecommendations: ReaderRecommendation[];
  finalCompilation?: FinalCompilation;
  commentThreads: CommentThread[];
  createdAt: Date;
  updatedAt: Date;
}

interface StandardCompilation {
  standardCode: string;
  specifications: SpecificationCompilation[];
}

interface SpecificationCompilation {
  specCode: string;
  readerVotes: ReaderComplianceVote[];
  consensus: 'unanimous' | 'majority' | 'split' | 'pending';
  hasDisagreement: boolean;
  finalDetermination?: 'compliant' | 'non_compliant' | 'not_applicable';
  leadReaderRationale?: string;
}

interface ReaderComplianceVote {
  readerId: string;
  readerNumber: number;
  compliance: 'compliant' | 'non_compliant' | 'not_applicable' | null;
  comments: string;
}

interface FinalCompilation {
  overallStrengths: string;
  overallWeaknesses: string;
  recommendation: RecommendationType;
  conditionsForApproval?: string;
  additionalComments?: string;
  submittedAt?: Date;
}
```

### Curriculum Matrix
```typescript
interface CurriculumMatrix {
  id: string;
  submissionId: string;
  courses: CourseEntry[];
  standards: StandardMapping[];
  createdAt: Date;
  updatedAt: Date;
}

interface CourseEntry {
  id: string;
  coursePrefix: string;              // "HUS", "PSY"
  courseNumber: string;              // "101", "310"
  courseName: string;
  credits: number;
  order: number;
}

interface StandardMapping {
  standardCode: string;
  specCode: string;
  courseAssessments: CourseAssessment[];
}

interface CourseAssessment {
  courseId: string;
  type: 'I' | 'T' | 'K' | 'S' | null;  // Introduction, Theory, Knowledge, Skills
  depth: 'L' | 'M' | 'H' | null;        // Low, Medium, High
}
```

### Supporting Evidence
```typescript
interface SupportingEvidence {
  id: string;
  submissionId: string;
  standardCode?: string;
  specCode?: string;
  evidenceType: 'document' | 'url' | 'image';
  file?: {
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    storagePath: string;
  };
  url?: {
    href: string;
    title: string;
    description: string;
  };
  imageMetadata?: {
    sourceType: 'fax' | 'letter' | 'certificate' | 'other';
    description: string;
  };
  uploadedBy: string;
  createdAt: Date;
}
```

### Validation Result
```typescript
interface ValidationResult {
  id: string;
  submissionId: string;
  standardCode: string;
  specCode: string;
  validationType: 'auto_save' | 'manual_save' | 'submit';
  result: {
    status: 'pass' | 'fail' | 'pending';
    score: number;
    feedback: string;
    suggestions: string[];
    missingElements: string[];
  };
  n8nExecutionId?: string;
  attemptNumber: number;
  previousValidationId?: string;
  createdAt: Date;
}
```

### Webhook Settings
```typescript
interface WebhookSettings {
  id: string;
  settingType: 'n8n_validation';
  webhookUrl: string;
  isActive: boolean;
  authentication: {
    type: 'api_key' | 'bearer';
    apiKey: string;
  };
  callbackUrl: string;
  retryConfig: {
    maxRetries: number;
    retryDelayMs: number;
    backoffMultiplier: number;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

---

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/logout` | User logout |
| POST | `/api/auth/refresh` | Refresh JWT token |
| GET | `/api/auth/me` | Get current user |

### Submissions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/submissions` | List submissions (with filters) |
| GET | `/api/submissions/:id` | Get submission details |
| GET | `/api/submissions/:id/progress` | Get detailed progress |
| PATCH | `/api/submissions/:id/narrative` | Save narrative content |
| POST | `/api/submissions/:id/standards/:code/submit` | Submit standard for validation |
| POST | `/api/submissions/:id/standards/:code/complete` | Mark standard complete |
| POST | `/api/submissions/:id/revalidate` | Revalidate failed sections |
| GET | `/api/submissions/:id/failed` | Get failed validations |

### Document Import
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/imports/upload` | Upload PDF/DOCX/PPTX for parsing |
| GET | `/api/imports/:id` | Get import status and content |
| POST | `/api/imports/:id/map` | Map extracted section to standard |
| POST | `/api/imports/:id/apply` | Apply all mappings to submission |
| GET | `/api/imports/:id/unmapped` | Get unmapped content |
| PUT | `/api/imports/:id/unmapped/:sectionId` | Assign/discard unmapped |

### Curriculum Matrix
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/submissions/:id/matrix` | Get curriculum matrix |
| GET | `/api/submissions/:id/matrix/:matrixId` | Get specific matrix |
| POST | `/api/submissions/:id/matrix/:matrixId/course` | Add course column |
| DELETE | `/api/submissions/:id/matrix/:matrixId/course/:courseId` | Remove course |
| PUT | `/api/submissions/:id/matrix/:matrixId/assessment` | Update cell assessment |
| PUT | `/api/submissions/:id/matrix/:matrixId/reorder` | Reorder courses |
| POST | `/api/submissions/:id/matrix/:matrixId/import` | Import from CSV |
| GET | `/api/submissions/:id/matrix/:matrixId/export` | Export to CSV/JSON |

### Evidence Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/submissions/:id/evidence` | List evidence (with filters) |
| GET | `/api/submissions/:id/evidence/stats` | Get evidence statistics |
| GET | `/api/submissions/:id/evidence/:evidenceId` | Get evidence details |
| POST | `/api/submissions/:id/evidence/upload` | Upload document/image |
| POST | `/api/submissions/:id/evidence/url` | Add URL evidence |
| PATCH | `/api/submissions/:id/evidence/:evidenceId` | Update metadata |
| DELETE | `/api/submissions/:id/evidence/:evidenceId` | Delete evidence |
| GET | `/api/submissions/:id/evidence/:evidenceId/download` | Download file |
| POST | `/api/submissions/:id/evidence/:evidenceId/link` | Link to standard |
| POST | `/api/submissions/:id/evidence/:evidenceId/unlink` | Unlink from standard |

### Reviews (Reader Portal)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reviews` | Get my assigned reviews |
| GET | `/api/reviews/:reviewId` | Get review details |
| GET | `/api/reviews/:reviewId/workspace` | Get workspace data (split-view) |
| GET | `/api/reviews/:reviewId/progress` | Get progress summary |
| PATCH | `/api/reviews/:reviewId/assessment` | Save assessment |
| PATCH | `/api/reviews/:reviewId/assessments/bulk` | Bulk save assessments |
| PATCH | `/api/reviews/:reviewId/final-assessment` | Save final assessment |
| POST | `/api/reviews/:reviewId/bookmark` | Toggle bookmark |
| POST | `/api/reviews/:reviewId/flag` | Flag specification |
| POST | `/api/reviews/:reviewId/standard-complete` | Mark standard complete |
| POST | `/api/reviews/:reviewId/submit` | Submit completed review |
| POST | `/api/reviews/submissions/:submissionId/assign` | Assign readers (admin) |
| GET | `/api/reviews/submissions/:submissionId` | Get all reviews for submission |

### Lead Reviews (Lead Reader Portal)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/lead-reviews` | Get my compilations |
| GET | `/api/lead-reviews/ready` | Get submissions ready for compilation |
| POST | `/api/lead-reviews/submissions/:submissionId` | Create/get compilation |
| GET | `/api/lead-reviews/:compilationId` | Get compilation details |
| GET | `/api/lead-reviews/:compilationId/comparison` | Get side-by-side comparison |
| GET | `/api/lead-reviews/:compilationId/disagreements` | Get all disagreements |
| GET | `/api/lead-reviews/:compilationId/export` | Export compilation (JSON/CSV) |
| PATCH | `/api/lead-reviews/:compilationId/determination` | Set final determination |
| PATCH | `/api/lead-reviews/:compilationId/determinations/bulk` | Bulk set determinations |
| PATCH | `/api/lead-reviews/:compilationId/final` | Save final compilation |
| POST | `/api/lead-reviews/:compilationId/submit` | Submit compilation |
| POST | `/api/lead-reviews/:compilationId/threads` | Create comment thread |
| POST | `/api/lead-reviews/:compilationId/threads/:threadId/messages` | Add message |
| PATCH | `/api/lead-reviews/:compilationId/threads/:threadId/resolve` | Toggle resolved |
| POST | `/api/lead-reviews/:compilationId/reminder` | Send reader reminder |

### Reports (PDF Generation)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports/reader/:reviewId/pdf` | Generate reader report PDF |
| GET | `/api/reports/reader/:reviewId/preview` | Get preview data |
| GET | `/api/reports/submission/:submissionId/all-readers/pdf` | Generate all readers PDF |
| GET | `/api/reports/compilation/:compilationId/pdf` | Generate compilation PDF |
| GET | `/api/reports/compilation/:compilationId/preview` | Get preview data |

### Webhooks (N8N Integration)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/webhooks/n8n/validate` | Trigger N8N validation |
| POST | `/api/webhooks/n8n/callback` | Receive validation result |
| GET | `/api/webhooks/validation/latest` | Get latest validation |
| GET | `/api/webhooks/validation/standard/:submissionId/:standardCode` | Get standard status |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/stats` | Get system statistics |
| GET | `/api/admin/webhook-settings` | Get webhook settings |
| PUT | `/api/admin/webhook-settings` | Update webhook settings |
| POST | `/api/admin/webhook-test` | Test webhook connection |

---

## N8N Workflow Integration

The application integrates with N8N workflows to provide AI-powered validation of narrative content against standards.

### Validation Webhook Request
```json
POST [N8N_WEBHOOK_URL]
{
  "submissionId": "sub_123",
  "standardCode": "11",
  "specCode": "a",
  "narrativeText": "The curriculum provides...",
  "standardText": "The curriculum shall provide theoretical and applied content...",
  "supportingEvidence": [
    { "filename": "syllabus.pdf", "type": "document" }
  ],
  "validationType": "manual_save",
  "callbackUrl": "https://api/webhooks/n8n/callback"
}
```

### Callback Webhook Response
```json
POST /api/webhooks/n8n/callback
{
  "executionId": "exec_456",
  "submissionId": "sub_123",
  "standardCode": "11",
  "specCode": "a",
  "result": {
    "status": "pass",
    "score": 85,
    "feedback": "The narrative adequately addresses the requirement but could include more specific course references.",
    "suggestions": [
      "Add specific course numbers from the curriculum",
      "Reference the curriculum matrix"
    ],
    "missingElements": []
  }
}
```

### Webhook Settings Configuration

Configure via Admin UI at `/admin/webhook-settings`:

| Setting | Description |
|---------|-------------|
| **Webhook URL** | N8N webhook endpoint URL |
| **Callback URL** | URL for N8N to send results back |
| **Auth Type** | `api_key` (X-API-Key header) or `bearer` (Authorization) |
| **API Key** | Authentication token |
| **Max Retries** | Retry attempts on failure (default: 3) |
| **Retry Delay** | Initial delay in ms (default: 1000) |
| **Backoff Multiplier** | Exponential backoff factor (default: 2) |

---

## UI/UX Design

### Color Palette
```css
/* Primary - Teal/Dark Green */
--primary-500: #0d9488;      /* Main brand color */
--primary-600: #0f766e;      /* Hover state */
--primary-400: #2dd4bf;      /* Light accent */

/* Program Level Badges */
--level-bachelors: #059669;  /* Green */
--level-associate: #d97706;  /* Amber */
--level-masters: #2563eb;    /* Blue */

/* Status Colors */
--status-draft: #9ca3af;
--status-in-progress: #f59e0b;
--status-submitted: #3b82f6;
--status-complete: #10b981;
--status-pass: #22c55e;
--status-fail: #ef4444;

/* Compliance Colors */
--compliant: #22c55e;
--non-compliant: #ef4444;
--not-applicable: #9ca3af;
```

### Key UI Components

**Self-Study Editor**
- Standards navigation sidebar with progress indicators
- TipTap rich text editor with formatting toolbar
- Auto-save status indicator (Saving... / Saved / Unsaved changes)
- Validation panel showing pass/fail with feedback

**Curriculum Matrix**
- Spreadsheet-like grid interface
- Course columns with prefix/number/name
- Assessment cells with Type/Depth popover editor
- Add/remove course functionality
- Export to CSV button

**Evidence Manager**
- Two-panel layout (list + preview)
- Drag-drop file upload zone
- URL input with auto-title detection
- Filter by type and linked status
- Evidence preview with download

**Reader Workspace**
- Split-screen: left (standards/narrative), right (documents)
- Compliance toggle (Y/N/NA) per specification
- Rich text comment field
- Bookmark and flag buttons
- Progress indicator

**Lead Reader Comparison**
- Side-by-side reader columns
- Consensus indicator badges
- Disagreement highlighting
- Final determination selector
- Communication threads

---

## Development Setup

### Prerequisites
- Node.js 18+
- npm or yarn

### Local Development (JSON Storage)
```bash
# Install dependencies
cd server && npm install
cd ../client && npm install

# Start development servers
# Terminal 1: Server
cd server && npm run dev
# Server: http://localhost:5000

# Terminal 2: Client
cd client && npm run dev
# Client: http://localhost:3000
```

### Docker Deployment (MongoDB)
```bash
# Start all services
docker-compose up -d

# Services:
# - MongoDB: localhost:27017
# - Mongo Express: localhost:8081
# - Server: localhost:5000
# - Client: localhost:3000
```

### Environment Variables

**Server (.env)**
```bash
NODE_ENV=development
PORT=5000
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# MongoDB (production only)
MONGODB_URI=mongodb://admin:password@localhost:27017/cshse?authSource=admin

# File uploads
UPLOAD_DIR=uploads/evidence
MAX_FILE_SIZE=52428800  # 50MB

# N8N Integration
N8N_WEBHOOK_URL=https://your-n8n-instance.com/webhook/validate
N8N_API_KEY=your-n8n-api-key
```

**Client (.env)**
```bash
VITE_API_URL=http://localhost:5000/api
```

---

## Standards Reference

The application uses the CSHSE National Standards (Revised July 2025) for three degree levels:

### Associate Degree - 20 Standards
**Section I: General Program Characteristics (1-10)**
1. Institutional Requirements and Primary Program Objective
2. Philosophical Base of Programs
3. Community Assessment
4. Program Evaluation
5. Policies and Procedures for Admitting, Retaining, and Dismissing Students
6. Credentials of Human Services Faculty
7. Personnel Roles, Responsibilities, and Evaluation
8. Cultural Competence
9. Program Support
10. Evaluation of Transfer Credits and Prior Learning

**Section II: Curriculum (11-20)**
11. History
12. Human Systems
13. Human Service Delivery Systems
14. Discipline Inquiry and Information Literacy
15. Program Planning and Evaluation
16. Client Interventions and Strategies
17. Interpersonal Communication
18. Client-Related Values and Attitudes
19. Self-Development
20. Field Experience (min. 250 hours)

### Baccalaureate Degree - 21 Standards
Same general structure with additions:
- Standard 18: Administrative (leadership/management)
- Standard 21: Field Experience (min. 350 hours)
- Additional specifications for advocacy and policy

### Master's Degree - 18 Standards
Focus on administrative, leadership, and research:
- Standards 11-18 cover curriculum
- Standard 18: Culminating Experiences (field or capstone)
- Emphasis on organizational management

---

## Curriculum Matrix Guide

### Coverage Types
| Code | Type | Description |
|------|------|-------------|
| **I** | Introduction | Basic exposure to concepts |
| **T** | Theory | Theoretical understanding and frameworks |
| **K** | Knowledge | Factual knowledge and comprehension |
| **S** | Skills | Practical application and competencies |

### Coverage Depth
| Code | Depth | Description |
|------|-------|-------------|
| **L** | Low | Minimal coverage (brief mention) |
| **M** | Medium | Moderate coverage (dedicated content) |
| **H** | High | Comprehensive coverage (major focus) |

### Example Matrix Entry
| Course | Standard 11.a | Standard 12.b |
|--------|--------------|---------------|
| HUS 101 | I/M | T/L |
| PSY 210 | K/H | K/M |
| HUS 310 | S/H | S/H |

---

## License

Proprietary - Council for Standards in Human Service Education
