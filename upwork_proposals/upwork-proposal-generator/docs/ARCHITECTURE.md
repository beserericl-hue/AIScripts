# Upwork Proposal Generator - Architecture Documentation

## Overview

The Upwork Proposal Generator is a full-stack web application designed to streamline the creation of professional proposals for Upwork job opportunities. It integrates with N8N workflows for AI-powered proposal generation and supports multi-tenant teams with role-based access control.

## Technology Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.2 | UI Framework |
| Vite | 7.2 | Build Tool & Dev Server |
| React Router | 7.12 | Client-side Routing |
| TanStack React Query | 5.90 | Data Fetching & Caching |
| Axios | 1.13 | HTTP Client |
| Lucide React | 0.562 | Icons |
| @react-oauth/google | 0.12 | Google OAuth |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 18+ | Runtime |
| Express | 5.2 | Web Framework |
| Mongoose | 9.1 | MongoDB ODM |
| JWT | 9.0 | Authentication Tokens |
| bcryptjs | 3.0 | Password Hashing |
| Nodemailer | 6.10 | Email Sending |

### Database
| Technology | Purpose |
|------------|---------|
| MongoDB | Primary Database |

### Deployment
| Technology | Purpose |
|------------|---------|
| Docker | Containerization |
| Railway | Cloud Hosting |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT (Browser)                               │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                     React Application (Vite)                        │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │ │
│  │  │  Login   │  │   Home   │  │ Proposal │  │ Settings │            │ │
│  │  │   Page   │  │   Page   │  │   Page   │  │   Page   │            │ │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘            │ │
│  │       │              │              │              │                 │ │
│  │       └──────────────┴──────────────┴──────────────┘                 │ │
│  │                          │                                           │ │
│  │                   AuthContext (State)                                │ │
│  │                          │                                           │ │
│  │                    API Service (Axios)                               │ │
│  └──────────────────────────┼───────────────────────────────────────────┘ │
└─────────────────────────────┼───────────────────────────────────────────┘
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        EXPRESS SERVER (Port 8080)                        │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                         Middleware Layer                            │ │
│  │  ┌─────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────────┐  │ │
│  │  │  CORS   │  │   JSON      │  │   Cookie    │  │    Static     │  │ │
│  │  │         │  │   Parser    │  │   Parser    │  │    Files      │  │ │
│  │  └─────────┘  └─────────────┘  └─────────────┘  └───────────────┘  │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                      Authentication Middleware                      │ │
│  │  ┌──────────────┐  ┌───────────────┐  ┌──────────────────────────┐ │ │
│  │  │   JWT Auth   │  │  API Key Auth │  │    Admin Check           │ │ │
│  │  └──────────────┘  └───────────────┘  └──────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                           API Routes                                │ │
│  │  ┌────────┐ ┌────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │ │
│  │  │ /auth  │ │ /jobs  │ │/proposals│ │/webhooks │ │  /settings   │  │ │
│  │  └────────┘ └────────┘ └──────────┘ └──────────┘ └──────────────┘  │ │
│  │  ┌────────┐ ┌────────┐ ┌──────────┐                                │ │
│  │  │/teams  │ │/profiles│ │/api-keys│                                │ │
│  │  └────────┘ └────────┘ └──────────┘                                │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────┼───────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│       MongoDB           │     │         N8N             │
│  ┌───────────────────┐  │     │  ┌───────────────────┐  │
│  │      Users        │  │     │  │    Evaluation     │  │
│  │      Jobs         │  │     │  │     Workflow      │  │
│  │     Profiles      │  │     │  └───────────────────┘  │
│  │      Teams        │  │     │  ┌───────────────────┐  │
│  │     ApiKeys       │  │     │  │    Proposal       │  │
│  │     Settings      │  │     │  │    Generation     │  │
│  └───────────────────┘  │     │  │     Workflow      │  │
└─────────────────────────┘     │  └───────────────────┘  │
                                └─────────────────────────┘
```

---

## Directory Structure

```
upwork-proposal-generator/
├── src/                          # React Frontend
│   ├── components/               # Reusable UI Components
│   │   ├── Navbar.jsx           # Navigation with mobile menu
│   │   └── ProtectedRoute.jsx   # Route guard component
│   ├── context/
│   │   └── AuthContext.jsx      # Authentication state
│   ├── pages/                    # Page Components
│   │   ├── Home.jsx             # Job listing & rejection
│   │   ├── Login.jsx            # Auth with email verification
│   │   ├── Proposal.jsx         # Proposal generation
│   │   └── Settings.jsx         # Admin configuration
│   ├── services/
│   │   └── api.js               # Axios API client
│   ├── styles/
│   │   └── index.css            # Global styles
│   ├── App.jsx                  # Root component
│   └── main.jsx                 # Entry point
│
├── server/                       # Express Backend
│   ├── models/                   # Mongoose Schemas
│   │   ├── User.js              # User with auth
│   │   ├── Job.js               # Jobs/proposals
│   │   ├── Profile.js           # User profiles
│   │   ├── Team.js              # Team grouping
│   │   ├── ApiKey.js            # API keys
│   │   └── Settings.js          # User settings
│   ├── routes/                   # API Endpoints
│   │   ├── auth.js              # Authentication
│   │   ├── jobs.js              # Job management
│   │   ├── proposals.js         # Proposal generation
│   │   ├── webhooks.js          # N8N callbacks
│   │   ├── settings.js          # Settings CRUD
│   │   ├── apiKeys.js           # API key management
│   │   ├── teams.js             # Team management
│   │   └── profiles.js          # Profile management
│   ├── middleware/
│   │   └── auth.js              # Auth middleware
│   └── index.js                 # Server entry point
│
├── public/                       # Static assets
├── dist/                         # Built frontend
├── docs/                         # Documentation
├── Dockerfile                    # Container config
├── package.json                  # Dependencies
├── vite.config.js               # Vite config
└── index.html                   # HTML template
```

---

## Data Models

### User
```javascript
{
  email: String,          // Unique, lowercase
  password: String,       // Hashed (optional for OAuth)
  googleId: String,       // For Google OAuth
  name: String,
  role: 'user' | 'administrator',
  teamId: ObjectId,       // Team reference
  lastProfileId: ObjectId,// Active profile
  createdAt: Date,
  updatedAt: Date
}
```

### Job
```javascript
{
  jobId: String,          // Unique identifier
  title: String,
  description: String,
  url: String,
  rating: Number,         // 1-5
  status: 'pending' | 'proposal_generated' | 'rejected' | 'applied',
  profile: String,
  profileId: ObjectId,
  teamId: ObjectId,
  evaluationData: Object, // From N8N
  proposalData: {
    coverLetter: String,
    wordDocUrl: String,
    mermaidCode: String,
    mermaidImageUrl: String
  },
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

### Profile
```javascript
{
  name: String,           // Unique per user
  content: String,        // Up to 4000 chars
  userId: ObjectId,
  teamId: ObjectId,
  isLastUsed: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Team
```javascript
{
  name: String,           // Unique
  description: String,
  isActive: Boolean,
  createdBy: ObjectId,
  createdAt: Date,
  updatedAt: Date
}
```

### ApiKey
```javascript
{
  name: String,
  key: String,            // Shown once
  hashedKey: String,      // SHA256
  isActive: Boolean,
  createdBy: ObjectId,
  lastUsed: Date,
  createdAt: Date
}
```

### Settings
```javascript
{
  userId: ObjectId,
  n8nWebhookUrl: String,
  n8nEvaluationWebhookUrl: String,
  mongodbUrl: String,
  mongodbUser: String,
  mongodbPassword: String,
  mongodbDatabase: String,
  updatedAt: Date
}
```

---

## API Endpoints

### Authentication (`/api/auth`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | /send-verification | Send email code | None |
| POST | /verify-code | Verify email code | None |
| POST | /register | Create account | None* |
| POST | /login | Email/password login | None |
| POST | /google | Google OAuth | None |
| POST | /logout | Clear session | JWT |
| GET | /me | Get current user | JWT |
| GET | /users | List all users | Admin |
| PATCH | /users/:id/role | Update role | Admin |
| DELETE | /users/:id | Delete user | Admin |

*First user can register without auth; subsequent users require admin

### Jobs (`/api/jobs`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | / | List jobs | JWT |
| GET | /pending | Get pending jobs | JWT |
| GET | /:id | Get job by ID | JWT |
| GET | /by-job-id/:jobId | Get by jobId | JWT |
| POST | / | Create job | JWT |
| PATCH | /:id | Update job | JWT |
| POST | /:id/reject | Reject job | JWT |
| DELETE | /:id | Delete job | JWT |

### Proposals (`/api/proposals`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | /generate | Trigger generation | JWT |
| GET | /:jobId | Get proposal data | JWT |

### Webhooks (`/api/webhooks`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | /evaluation | Store evaluation | API Key |
| POST | /proposal-result | Store proposal | API Key |
| GET | /health | Health check | None |

### Settings (`/api/settings`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | / | Get settings | JWT |
| PUT | / | Update settings | JWT |

### API Keys (`/api/api-keys`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | / | List keys | JWT |
| POST | / | Generate key | JWT |
| PATCH | /:id/toggle | Toggle active | JWT |
| DELETE | /:id | Delete key | JWT |

### Teams (`/api/teams`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | / | List teams | Admin |
| GET | /:id | Get team | Admin |
| GET | /my/members | Get team members | JWT |
| POST | / | Create team | Admin |
| PUT | /:id | Update team | Admin |
| POST | /:id/members | Add member | Admin |
| DELETE | /:id/members/:userId | Remove member | Admin |
| DELETE | /:id | Delete team | Admin |

### Profiles (`/api/profiles`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | /user/:userId | Get user profiles | JWT |
| GET | /my | Get my profiles | JWT |
| GET | /:id | Get profile | JWT |
| POST | / | Create profile | JWT |
| PUT | /:id | Update profile | JWT |
| POST | /:id/set-active | Set active | JWT |
| DELETE | /:id | Delete profile | JWT |

---

## Authentication Flow

### Email/Password Registration
```
1. User enters email → POST /auth/send-verification
2. Server generates 6-digit code, stores in memory (10min TTL)
3. Server sends code via Nodemailer
4. User enters code → POST /auth/verify-code
5. Server validates code, marks email as verified
6. User completes form → POST /auth/register
7. Server creates user, returns JWT
```

### Google OAuth
```
1. User clicks Google button
2. Google Identity Services shows picker
3. User selects account
4. Frontend receives credential (JWT)
5. Frontend decodes JWT, extracts user info
6. Frontend → POST /auth/google with user data
7. Server creates/updates user, returns JWT
```

### JWT Authentication
```
1. JWT stored in HttpOnly cookie (7-day expiration)
2. Middleware extracts from cookie or Authorization header
3. Middleware verifies and decodes JWT
4. User attached to request object
```

### API Key Authentication (Webhooks)
```
1. N8N sends X-API-Key header
2. Middleware extracts and hashes key
3. Middleware queries database for matching hash
4. Updates lastUsed timestamp
5. Request proceeds if valid
```

---

## Proposal Generation Flow

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  User   │────▶│ Frontend│────▶│ Backend │────▶│   N8N   │
└─────────┘     └─────────┘     └─────────┘     └─────────┘
                                     │               │
                                     │  ◀────────────┘
                                     │  (webhook callback)
                                     ▼
                               ┌─────────┐
                               │ MongoDB │
                               └─────────┘

1. User fills proposal form (title, description, profile, URL)
2. Frontend POST /api/proposals/generate
3. Backend creates job in MongoDB
4. Backend calls N8N webhook with job data
5. Backend returns jobId to frontend
6. Frontend starts polling GET /api/proposals/:jobId (5s interval)
7. N8N processes job with AI
8. N8N POST /api/webhooks/proposal-result with results
9. Backend updates job with proposalData
10. Frontend polling detects coverLetter
11. Frontend displays results (cover letter, doc URL, diagram)
```

---

## Security Features

| Feature | Implementation |
|---------|----------------|
| Password Hashing | bcryptjs with 12 salt rounds |
| JWT Tokens | 7-day expiration, secret-signed |
| API Keys | SHA256 hashed, shown once on creation |
| Team Isolation | Users only see their team's data |
| Role-Based Access | Admin routes protected |
| Email Verification | 6-digit codes, 10-minute expiration |
| CORS | Configurable origin |
| HttpOnly Cookies | Auth token not accessible via JS |
| Password Masking | MongoDB passwords hidden in API responses |

---

## Environment Variables

### Required
```env
PORT=8080
MONGODB_URI=mongodb://localhost:27017/upwork_proposals
JWT_SECRET=your-secret-key
NODE_ENV=production
```

### Optional
```env
CORS_ORIGIN=*
VITE_GOOGLE_CLIENT_ID=your-google-client-id
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
```

---

## Deployment Architecture

### Single Port Deployment
The application serves both frontend and API on a single port (8080):

```
Port 8080
├── /api/*          → Express API routes
├── /dist/*         → Static frontend files
└── /*              → Fallback to index.html (SPA routing)
```

### Docker Build Process
```dockerfile
# Stage 1: Build frontend
FROM node:20-alpine AS builder
RUN npm ci && npm run build

# Stage 2: Production
FROM node:20-alpine AS production
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
CMD ["node", "server/index.js"]
```

### Railway Deployment
- Auto-deploy from GitHub
- Environment variables in Railway dashboard
- MongoDB service in same project (internal networking)
- Health check endpoint: `/api/health`

---

## Performance Considerations

1. **Database Indexes**
   - Jobs: `status + createdAt`, text search on `title/description`
   - Profiles: `userId + teamId`, `userId + name`
   - Users: `email` (unique)

2. **Connection Pooling**
   - Mongoose default connection pool
   - MongoDB retry logic (5 attempts, 5s delay)

3. **Frontend Optimization**
   - Vite code splitting
   - React Query caching
   - Polling with exponential backoff

4. **Memory Management**
   - Verification codes stored in-memory with TTL
   - Consider Redis for production at scale
