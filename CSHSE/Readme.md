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

## Architecture

### Technology Stack

**Frontend**
- React 18 with TypeScript
- Vite (build tool)
- React Router v6 (navigation)
- TipTap (rich text editor)
- react-pdf (PDF viewing)
- CSS Modules (styling)

**Backend**
- Node.js with Express
- JWT Authentication (bcrypt for passwords)
- Multer (file uploads)

**Storage**
- **Local Development**: JSON file-based storage
- **Production (Docker)**: MongoDB with Mongoose

**Integration**
- N8N workflow webhooks for AI-powered text comparison

### Project Structure

```
/CSHSE
├── client/                          # React frontend
│   ├── public/
│   │   └── logo.png                # CSHSE logo
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/             # Reusable UI (Badge, Button, Table, etc.)
│   │   │   ├── editor/             # NarrativeEditor, AutoSaveIndicator
│   │   │   ├── layout/             # TopNav, Sidebar, PageLayout
│   │   │   ├── review/             # SplitView, DocumentViewer, ComplianceToggle
│   │   │   └── standards/          # StandardsNav, StandardsMatrix
│   │   ├── features/
│   │   │   ├── auth/               # Login, authentication
│   │   │   ├── dashboard/          # Home dashboard
│   │   │   ├── selfStudy/          # Coordinator portal
│   │   │   ├── review/             # Reader portal
│   │   │   ├── leadReview/         # Lead reader portal
│   │   │   └── submissions/        # Submission management
│   │   ├── hooks/                  # useAutoSave, useAuth, etc.
│   │   ├── services/               # API client
│   │   ├── store/                  # React Context state
│   │   ├── styles/                 # Global CSS, theme variables
│   │   ├── types/                  # TypeScript interfaces
│   │   └── utils/                  # Helper functions
│   └── package.json
├── server/                          # Express backend
│   ├── src/
│   │   ├── config/                 # Database, JWT config
│   │   ├── controllers/            # Route handlers
│   │   ├── middleware/             # Auth, error handling
│   │   ├── models/                 # Data models
│   │   ├── routes/                 # API routes
│   │   ├── services/               # Business logic
│   │   └── utils/                  # Helpers
│   └── package.json
├── data/                            # Local storage (dev)
│   ├── standards/                  # Standards JSON files
│   ├── submissions/                # Submission data
│   ├── reviews/                    # Review data
│   ├── uploads/                    # Uploaded documents
│   └── users.json                  # User accounts
├── docker-compose.yml              # Production deployment
└── package.json                    # Root workspace
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
  role: 'coordinator' | 'reader' | 'lead_reader' | 'admin';
  institutionId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
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
  submitterId: string;
  type: 'initial' | 'reaccreditation' | 'extension';
  status: SubmissionStatus;
  narratives: {
    [standardCode: string]: {
      [specCode: string]: {
        content: string;             // Rich text HTML
        lastModified: string;
        isComplete: boolean;
        linkedDocuments: string[];
      };
    };
  };
  documents: Document[];
  decision?: Decision;
  assignedReaders: string[];
  leadReader?: string;
  submittedAt?: string;
  createdAt: string;
  updatedAt: string;
}

type SubmissionStatus =
  | 'draft'
  | 'in_progress'
  | 'submitted'
  | 'under_review'
  | 'readers_assigned'
  | 'review_complete'
  | 'compliant'
  | 'non_compliant';
```

### Review
```typescript
interface Review {
  id: string;
  submissionId: string;
  reviewerId: string;
  status: 'assigned' | 'in_progress' | 'complete';
  assessments: {
    [standardCode: string]: {
      [specCode: string]: {
        compliance: 'compliant' | 'non_compliant' | 'not_applicable' | null;
        comments: string;
        reviewedAt: string;
      };
    };
  };
  finalAssessment?: {
    recommendation: 'approve' | 'deny' | 'conditional';
    strengths: string;
    weaknesses: string;
    additionalComments: string;
  };
  assignedAt: string;
  completedAt?: string;
}
```

### Standards Template
```typescript
interface StandardsTemplate {
  programLevel: 'associate' | 'bachelors' | 'masters';
  version: string;
  effectiveDate: string;
  sections: Section[];
}

interface Section {
  code: string;                      // "I", "II"
  title: string;
  standards: Standard[];
}

interface Standard {
  code: string;                      // "1", "2", etc.
  title: string;
  context: string;
  statement: string;
  specifications: Specification[];
}

interface Specification {
  code: string;                      // "a", "b", "c"
  text: string;
  subSpecifications?: SubSpecification[];
}

interface SubSpecification {
  code: string;                      // "1", "2" or "a", "b"
  text: string;
}
```

---

## MongoDB Schema (Production)

### Collections

**users**
```javascript
{
  _id: ObjectId,
  email: { type: String, unique: true, required: true },
  passwordHash: { type: String, required: true },
  firstName: String,
  lastName: String,
  role: { type: String, enum: ['coordinator', 'reader', 'lead_reader', 'admin'] },
  institutionId: ObjectId,
  isActive: { type: Boolean, default: true },
  createdAt: Date,
  updatedAt: Date
}
```

**submissions**
```javascript
{
  _id: ObjectId,
  submissionId: { type: String, unique: true },
  institutionName: String,
  programName: String,
  programLevel: { type: String, enum: ['associate', 'bachelors', 'masters'] },
  submitterId: { type: ObjectId, ref: 'User' },
  type: { type: String, enum: ['initial', 'reaccreditation', 'extension'] },
  status: String,
  narratives: Schema.Types.Mixed,
  documents: [{
    _id: ObjectId,
    filename: String,
    originalName: String,
    mimeType: String,
    size: Number,
    uploadedAt: Date,
    type: { type: String, enum: ['file', 'url'] },
    url: String
  }],
  decision: {
    outcome: String,
    decidedBy: ObjectId,
    decidedAt: Date,
    comments: String
  },
  assignedReaders: [{ type: ObjectId, ref: 'User' }],
  leadReader: { type: ObjectId, ref: 'User' },
  submittedAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

**reviews**
```javascript
{
  _id: ObjectId,
  submissionId: { type: ObjectId, ref: 'Submission' },
  reviewerId: { type: ObjectId, ref: 'User' },
  status: { type: String, enum: ['assigned', 'in_progress', 'complete'] },
  assessments: Schema.Types.Mixed,
  finalAssessment: {
    recommendation: String,
    strengths: String,
    weaknesses: String,
    additionalComments: String
  },
  assignedAt: Date,
  completedAt: Date
}
```

**standards_templates**
```javascript
{
  _id: ObjectId,
  programLevel: { type: String, enum: ['associate', 'bachelors', 'masters'] },
  version: String,
  effectiveDate: Date,
  sections: [{
    code: String,
    title: String,
    standards: [{
      code: String,
      title: String,
      context: String,
      statement: String,
      specifications: [{
        code: String,
        text: String,
        subSpecifications: [{
          code: String,
          text: String
        }]
      }]
    }]
  }]
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
| POST | `/api/submissions` | Create new submission |
| GET | `/api/submissions/:id` | Get submission details |
| PUT | `/api/submissions/:id` | Update submission |
| PATCH | `/api/submissions/:id/narrative` | Auto-save narrative (debounced) |
| POST | `/api/submissions/:id/submit` | Submit for review |
| GET | `/api/submissions/:id/documents` | List documents |
| POST | `/api/submissions/:id/documents` | Upload document |
| DELETE | `/api/submissions/:id/documents/:docId` | Remove document |

### Standards
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/standards/:level` | Get standards for program level |
| POST | `/api/admin/standards` | Create/update standards (admin) |

### Reviews
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reviews` | My assigned reviews |
| GET | `/api/reviews/:id` | Get review details |
| PATCH | `/api/reviews/:id/assessment` | Save assessment |
| POST | `/api/reviews/:id/complete` | Submit completed review |

### Lead Reviews
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/lead-reviews` | Submissions ready for compilation |
| GET | `/api/lead-reviews/:submissionId` | Aggregated reader view |
| POST | `/api/lead-reviews/:submissionId/compile` | Save compilation |
| POST | `/api/lead-reviews/:submissionId/decision` | Final decision |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/users` | List users |
| POST | `/api/admin/users` | Create user |
| PUT | `/api/admin/users/:id` | Update user |
| POST | `/api/admin/submissions/:id/assign-readers` | Assign readers |

### N8N Integration
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/webhooks/n8n/compare-text` | Trigger AI text comparison |

---

## N8N Workflow Integration

The application integrates with N8N workflows to provide AI-powered analysis of narrative text against standards.

### Webhook Request
```json
POST /api/webhooks/n8n/compare-text
{
  "submissionId": "sub_123",
  "standardCode": "1",
  "specCode": "a",
  "narrativeText": "The program is part of...",
  "standardText": "The primary program objective shall be...",
  "specificationText": "Provide evidence that the program is part of..."
}
```

### Webhook Response
```json
{
  "score": 85,
  "feedback": "The narrative adequately addresses regional accreditation but could provide more specific documentation references.",
  "suggestions": [
    "Include the specific accrediting body name",
    "Reference the date of most recent accreditation"
  ],
  "missingElements": [
    "Accreditation certificate reference"
  ]
}
```

---

## UI/UX Design

### Color Palette
```css
/* Primary - Teal/Dark Green */
--primary-500: #1a5e4a;      /* Main brand color */
--primary-600: #165641;      /* Hover state */
--primary-400: #4ca58c;      /* Light accent */

/* Program Level Badges */
--level-bachelors: #059669;  /* Green */
--level-associate: #d97706;  /* Yellow/Amber */
--level-masters: #2563eb;    /* Blue */

/* Status Colors */
--status-draft: #9ca3af;
--status-in-progress: #2563eb;
--status-submitted: #7c3aed;
--status-under-review: #d97706;
--status-complete: #059669;
--status-compliant: #059669;
--status-non-compliant: #dc2626;
```

### Typography
```css
--font-sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
--font-mono: "JetBrains Mono", "Fira Code", monospace;
```

### Key UI Components

**TopNav**
- CSHSE logo (green snowflake symbol)
- Navigation: Home, Self Study Report, Self Study Read, Settings
- Panel selector dropdown
- User menu with role indicator

**Standards Navigation**
- Collapsible sections (I. General, II. Curriculum)
- Standards list with completion indicators
- Click to expand specifications

**Narrative Editor**
- TipTap rich text editor
- Formatting toolbar (bold, italic, lists, links)
- Auto-save indicator ("Saving...", "Saved at HH:MM")
- Word count display
- Document linking interface

**Split-View Review Workspace**
- Left panel: Standard info + narrative content
- Right panel: Document viewer/list
- Resizable divider
- Full-screen mode

**Submissions Table**
- Sortable columns (ID, Institution, Level, Status, Decision)
- Color-coded level badges
- Status labels with icons
- Search and filter controls
- Pagination

---

## Routing Structure

```
/login                              # Login page

# Coordinator Routes
/dashboard                          # Home dashboard
/self-study                         # My submissions list
/self-study/new                     # Create new submission
/self-study/:id                     # Edit submission
/self-study/:id/standards/:stdId    # Narrative editor
/self-study/:id/documents           # Document management
/self-study/:id/preview             # Preview before submit

# Reader Routes
/reviews                            # Assigned reviews
/reviews/:id                        # Review workspace
/reviews/:id/assessment             # Final assessment form

# Lead Reader Routes
/lead-reviews                       # Ready for compilation
/lead-reviews/:id                   # Aggregated view
/lead-reviews/:id/compile           # Compilation interface
/lead-reviews/:id/decision          # Final decision

# Admin Routes
/admin/submissions                  # All submissions
/admin/users                        # User management
/admin/standards                    # Standards configuration

/settings                           # User settings
```

---

## Development Setup

### Prerequisites
- Node.js 18+
- npm or yarn

### Local Development (JSON Storage)
```bash
# Install dependencies
npm install

# Start development servers
npm run dev
# Client: http://localhost:3000
# Server: http://localhost:5000
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
```
NODE_ENV=development
PORT=5000
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# MongoDB (production only)
MONGODB_URI=mongodb://admin:password@localhost:27017/cshse?authSource=admin

# N8N Integration
N8N_WEBHOOK_URL=https://your-n8n-instance/webhook/compare-text
```

**Client (.env)**
```
VITE_API_URL=http://localhost:5000/api
```

---

## Docker Compose Configuration

```yaml
version: '3.8'

services:
  mongodb:
    image: mongo:7.0
    container_name: cshse-mongodb
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: password
      MONGO_INITDB_DATABASE: cshse

  mongo-express:
    image: mongo-express:latest
    container_name: cshse-mongo-express
    ports:
      - "8081:8081"
    environment:
      ME_CONFIG_MONGODB_ADMINUSERNAME: admin
      ME_CONFIG_MONGODB_ADMINPASSWORD: password
      ME_CONFIG_MONGODB_URL: mongodb://admin:password@mongodb:27017/
    depends_on:
      - mongodb

  server:
    build: ./server
    container_name: cshse-server
    ports:
      - "5000:5000"
    environment:
      NODE_ENV: production
      PORT: 5000
      MONGODB_URI: mongodb://admin:password@mongodb:27017/cshse?authSource=admin
      JWT_SECRET: production-secret-change-this
    depends_on:
      - mongodb

  client:
    build: ./client
    container_name: cshse-client
    ports:
      - "3000:80"
    environment:
      VITE_API_URL: http://localhost:5000/api
    depends_on:
      - server

volumes:
  mongodb_data:
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

## License

Proprietary - Council for Standards in Human Service Education
