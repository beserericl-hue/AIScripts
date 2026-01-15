# Upwork Proposal Generator

A full-stack web application for generating, managing, and tracking Upwork job proposals. The system integrates with N8N workflows to automate proposal generation and evaluation, storing all data in MongoDB.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage Guide](#usage-guide)
- [MongoDB Data Schema](#mongodb-data-schema)
- [API Reference](#api-reference)
- [Webhook Callbacks (N8N Integration)](#webhook-callbacks-n8n-integration)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

## Overview

The Upwork Proposal Generator streamlines the process of creating professional proposals for Upwork job postings. It works in conjunction with N8N automation workflows to:

1. **Evaluate incoming job leads** - N8N sends evaluated job data to the application via webhook
2. **Review and manage jobs** - Users review pending jobs, reject unsuitable ones, and select jobs for proposal generation
3. **Generate proposals** - The system calls an N8N workflow to generate cover letters, workflow diagrams, and documentation
4. **Track proposal status** - All jobs and proposals are tracked with their current status

## Architecture

\`\`\`
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SINGLE PORT (8080)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         Express.js Server                            │   │
│  │                                                                      │   │
│  │   ┌──────────────────┐    ┌──────────────────────────────────────┐  │   │
│  │   │   Static Files   │    │            API Routes                 │  │   │
│  │   │   (React Build)  │    │                                       │  │   │
│  │   │                  │    │  /api/auth     - Authentication       │  │   │
│  │   │   Serves:        │    │  /api/jobs     - Job Management       │  │   │
│  │   │   - /            │    │  /api/proposals - Proposal Gen        │  │   │
│  │   │   - /login       │    │  /api/settings  - User Settings       │  │   │
│  │   │   - /proposal    │    │  /api/api-keys  - API Key Mgmt        │  │   │
│  │   │   - /settings    │    │  /api/webhooks  - N8N Callbacks       │  │   │
│  │   └──────────────────┘    └──────────────────────────────────────┘  │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                      │
│                                      ▼                                      │
│                           ┌──────────────────┐                              │
│                           │     MongoDB      │                              │
│                           │                  │                              │
│                           │  Collections:    │                              │
│                           │  - users         │                              │
│                           │  - jobs          │                              │
│                           │  - apikeys       │                              │
│                           │  - settings      │                              │
│                           └──────────────────┘                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ Webhooks
                                      ▼
                           ┌──────────────────┐
                           │       N8N        │
                           │                  │
                           │  Workflows:      │
                           │  - Job Eval      │
                           │  - Proposal Gen  │
                           └──────────────────┘
\`\`\`

### Mermaid Diagram

\`\`\`mermaid
flowchart TB
    subgraph CLIENT["Browser (Port 8080)"]
        UI[React Frontend]
    end

    subgraph SERVER["Express.js Server (Port 8080)"]
        STATIC[Static Files<br>/dist]
        subgraph API["API Routes"]
            AUTH["/api/auth"]
            JOBS["/api/jobs"]
            PROPOSALS["/api/proposals"]
            SETTINGS["/api/settings"]
            APIKEYS["/api/api-keys"]
            WEBHOOKS["/api/webhooks"]
            HEALTH["/api/health"]
        end
    end

    subgraph DB["MongoDB"]
        USERS[(users)]
        JOBSCOLL[(jobs)]
        APIKEYSDOC[(apikeys)]
        SETTINGSDOC[(settings)]
    end

    N8N["N8N Workflows<br>- Job Evaluation<br>- Proposal Generation"]

    UI -->|"GET /, /login, /proposal, /settings"| STATIC
    UI -->|"API Requests"| API
    API --> DB
    N8N -->|"POST /api/webhooks/evaluation"| WEBHOOKS
    N8N -->|"POST /api/webhooks/proposal-result"| WEBHOOKS
    PROPOSALS -->|"Calls webhook"| N8N
\`\`\`

### Component Breakdown

| Component | Description |
|-----------|-------------|
| **React Frontend** | Single-page application built with React 19, Vite, and React Router |
| **Express Backend** | Node.js server handling API requests and serving static files |
| **MongoDB** | Document database storing users, jobs, settings, and API keys |
| **N8N Workflows** | External automation platform for job evaluation and proposal generation |

### Data Flow

1. **Job Evaluation Flow**:
   \`\`\`
   N8N Workflow → POST /api/webhooks/evaluation → MongoDB (jobs collection)
   \`\`\`

2. **Proposal Generation Flow**:
   \`\`\`
   User submits form → POST /api/proposals/generate → N8N Workflow
                                                           ↓
   User views results ← MongoDB ← POST /api/webhooks/proposal-result
   \`\`\`

## Features

### Authentication & Authorization
- Email/password authentication with JWT tokens
- Google OAuth integration
- Role-based access control (User / Administrator)
- First user automatically becomes administrator

### Home Page - Job Review
- Dropdown selector showing all pending jobs
- Job details table displaying:
  - Proposal Title
  - Proposal Details
  - Live Upwork URL
  - Rating (1-5 stars)
- Reject button to dismiss unsuitable jobs
- Navigate to Proposal page for selected job

### Proposal Page - Create & View Proposals
- **Left panel**: iFrame displaying the live Upwork job posting
- **Right panel - Form**:
  - Job Title (up to 4,000 characters)
  - Full Job Description (up to 4,000 characters)
  - Profile/Expertise (up to 4,000 characters)
  - Job URL
- **Right panel - Results** (after generation):
  - Word document URL
  - Generated cover letter with copy button
  - Mermaid workflow diagram with copy button
  - Rendered diagram image

### Settings Page (Administrators Only)
- **Webhooks Tab**: Configure N8N webhook URLs
- **API Keys Tab**: Generate and manage API keys for N8N callbacks
- **Database Tab**: MongoDB connection settings
- **Users Tab**: Add/remove users, assign roles

## Technology Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| React 19 | UI framework |
| Vite 7 | Build tool and dev server |
| React Router 7 | Client-side routing |
| TanStack Query | Data fetching and caching |
| Axios | HTTP client |
| Lucide React | Icon library |

### Backend
| Technology | Purpose |
|------------|---------|
| Node.js 20 | Runtime environment |
| Express 5 | Web framework |
| Mongoose 9 | MongoDB ODM |
| JSON Web Token | Authentication |
| bcryptjs | Password hashing |
| uuid | Unique ID generation |

### Infrastructure
| Technology | Purpose |
|------------|---------|
| MongoDB | Database |
| Docker | Containerization |
| Railway | Cloud deployment |

## Installation

### Prerequisites
- Node.js 18 or higher
- MongoDB instance (local or cloud)
- N8N instance (for automation workflows)

### Local Development Setup

1. **Clone the repository**
   \`\`\`bash
   git clone https://github.com/yourusername/upwork_proposals.git
   cd upwork_proposals/upwork-proposal-generator
   \`\`\`

2. **Install dependencies**
   \`\`\`bash
   npm install
   \`\`\`

3. **Create environment file**
   \`\`\`bash
   cp .env.example .env
   \`\`\`

4. **Configure environment variables** (see [Configuration](#configuration))

5. **Build and start the application**
   \`\`\`bash
   npm run build
   npm start
   \`\`\`

6. **Access the application**
   - Open http://localhost:8080 in your browser

### Docker Setup

\`\`\`bash
cd upwork_proposals
docker build -t upwork-proposal-generator .
docker run -p 8080:8080 \
  -e MONGODB_URI=mongodb://your-mongo-host:27017/upwork_proposals \
  -e JWT_SECRET=your-secret-key \
  upwork-proposal-generator
\`\`\`

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| \`PORT\` | No | \`8080\` | Server port |
| \`NODE_ENV\` | No | \`development\` | Environment mode |
| \`MONGODB_URI\` | Yes | - | MongoDB connection string |
| \`JWT_SECRET\` | Yes | - | Secret key for JWT signing (use a strong random string) |
| \`CORS_ORIGIN\` | No | \`*\` | Allowed CORS origins |

### Example \`.env\` File

\`\`\`env
# Server Configuration
PORT=8080
NODE_ENV=production

# MongoDB Connection
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/upwork_proposals

# JWT Secret (generate a strong random string)
JWT_SECRET=your-super-secret-key-min-32-characters

# CORS (optional)
CORS_ORIGIN=https://your-domain.com
\`\`\`

### Generating a Secure JWT Secret

\`\`\`bash
# Using OpenSSL
openssl rand -base64 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
\`\`\`

## Usage Guide

### Initial Setup

1. **Create the first user account**
   - Navigate to the login page
   - Click "Sign up" and create an account
   - The first user is automatically an administrator

2. **Configure N8N webhooks**
   - Go to Settings → Webhooks
   - Enter your N8N proposal generation webhook URL
   - Save settings

3. **Generate API keys for N8N**
   - Go to Settings → API Keys
   - Enter a name (e.g., "N8N Production")
   - Click "Generate Key"
   - **Important**: Copy and save the key immediately - it won't be shown again
   - Use this key in your N8N workflows as the \`X-API-Key\` header

### Daily Workflow

1. **Review incoming jobs** (Home page)
   - Select a job from the dropdown
   - Review the job details and rating
   - Click "Reject Job" to dismiss, or "View in Proposal" to proceed

2. **Generate a proposal** (Proposal page)
   - Review the job in the left iframe
   - Fill in or edit the job details in the form
   - Add your profile/expertise information
   - Click "Create Proposal"
   - Wait for the N8N workflow to complete
   - Copy the generated cover letter and diagram

3. **Manage users** (Settings → Users, Administrators only)
   - Add new team members with User or Administrator role
   - Remove inactive users

---

## MongoDB Data Schema

All data is stored in MongoDB. Below are the collections and their document structures.

### Collection: \`users\`

Stores user accounts and authentication data.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| \`_id\` | ObjectId | Auto | MongoDB document ID |
| \`email\` | String | Yes | User email (unique, lowercase) |
| \`password\` | String | Conditional | Hashed password (required if no googleId) |
| \`googleId\` | String | No | Google OAuth ID |
| \`name\` | String | Yes | User's display name |
| \`role\` | String | Yes | \`"user"\` or \`"administrator"\` |
| \`createdAt\` | Date | Auto | Account creation timestamp |
| \`updatedAt\` | Date | Auto | Last update timestamp |

**Example Document:**
\`\`\`json
{
  "_id": "507f1f77bcf86cd799439011",
  "email": "john@example.com",
  "password": "$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.G5FhN8/X4.G5Fh",
  "name": "John Doe",
  "role": "administrator",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
\`\`\`

---

### Collection: \`jobs\`

Stores job postings and generated proposals.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| \`_id\` | ObjectId | Auto | MongoDB document ID |
| \`jobId\` | String | Yes | Unique job identifier (indexed) |
| \`title\` | String | Yes | Job title |
| \`description\` | String | No | Full job description (max 4000 chars) |
| \`url\` | String | Yes | Upwork job URL |
| \`rating\` | Number | No | Job rating 1-5 |
| \`status\` | String | Yes | \`"pending"\`, \`"proposal_generated"\`, \`"rejected"\`, \`"applied"\` |
| \`profile\` | String | No | User's profile/expertise (max 4000 chars) |
| \`evaluationData\` | Object | No | Complete JSON from N8N evaluation webhook |
| \`proposalData\` | Object | No | Generated proposal data (see below) |
| \`createdBy\` | ObjectId | No | Reference to user who created |
| \`createdAt\` | Date | Auto | Creation timestamp |
| \`updatedAt\` | Date | Auto | Last update timestamp |

**proposalData Sub-Object:**
| Field | Type | Description |
|-------|------|-------------|
| \`coverLetter\` | String | Generated cover letter text |
| \`docUrl\` | String | URL to generated Word document |
| \`mermaidDiagram\` | String | Mermaid diagram source code |
| \`mermaidImageUrl\` | String | URL to rendered diagram image |

**Example Document:**
\`\`\`json
{
  "_id": "507f1f77bcf86cd799439022",
  "jobId": "job_1705312200000",
  "title": "Build a React Dashboard",
  "description": "We need a skilled React developer to build a dashboard...",
  "url": "https://www.upwork.com/jobs/~01234567890abcdef",
  "rating": 4,
  "status": "proposal_generated",
  "profile": "I am an experienced React developer with 5 years...",
  "evaluationData": {
    "skills_match": 0.92,
    "budget_range": "$1000-$2500",
    "client_history": "verified",
    "job_type": "fixed_price"
  },
  "proposalData": {
    "coverLetter": "Dear Hiring Manager,\n\nI am excited to apply...",
    "docUrl": "https://docs.google.com/document/d/abc123",
    "mermaidDiagram": "graph TD;\n  A[Start] --> B[Development];",
    "mermaidImageUrl": "https://storage.example.com/diagrams/job123.png"
  },
  "createdBy": "507f1f77bcf86cd799439011",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T11:45:00.000Z"
}
\`\`\`

---

### Collection: \`apikeys\`

Stores API keys for webhook authentication.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| \`_id\` | ObjectId | Auto | MongoDB document ID |
| \`name\` | String | Yes | Friendly name for the API key |
| \`key\` | String | Yes | The API key (format: \`upw_xxxx...\`) |
| \`hashedKey\` | String | Yes | SHA-256 hash for verification |
| \`isActive\` | Boolean | Yes | Whether key is active |
| \`createdBy\` | ObjectId | Yes | Reference to user who created |
| \`lastUsed\` | Date | No | Last time key was used |
| \`createdAt\` | Date | Auto | Creation timestamp |

**Example Document:**
\`\`\`json
{
  "_id": "507f1f77bcf86cd799439033",
  "name": "N8N Production",
  "key": "upw_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "hashedKey": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "isActive": true,
  "createdBy": "507f1f77bcf86cd799439011",
  "lastUsed": "2024-01-15T14:22:00.000Z",
  "createdAt": "2024-01-15T10:30:00.000Z"
}
\`\`\`

---

### Collection: \`settings\`

Stores user-specific application settings.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| \`_id\` | ObjectId | Auto | MongoDB document ID |
| \`userId\` | ObjectId | Yes | Reference to user |
| \`n8nWebhookUrl\` | String | No | URL for proposal generation webhook |
| \`n8nEvaluationWebhookUrl\` | String | No | URL for evaluation webhook |
| \`mongodbUrl\` | String | No | Custom MongoDB URL |
| \`mongodbUser\` | String | No | MongoDB username |
| \`mongodbPassword\` | String | No | MongoDB password |
| \`mongodbDatabase\` | String | No | MongoDB database name |
| \`updatedAt\` | Date | Auto | Last update timestamp |

**Example Document:**
\`\`\`json
{
  "_id": "507f1f77bcf86cd799439044",
  "userId": "507f1f77bcf86cd799439011",
  "n8nWebhookUrl": "https://n8n.example.com/webhook/proposal-gen",
  "n8nEvaluationWebhookUrl": "https://n8n.example.com/webhook/evaluate",
  "mongodbUrl": "",
  "mongodbUser": "",
  "mongodbPassword": "",
  "mongodbDatabase": "",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
\`\`\`

---

## API Reference

### Base URL

\`\`\`
https://your-domain.com/api
\`\`\`

For local development:
\`\`\`
http://localhost:8080/api
\`\`\`

### Authentication

Most endpoints require a JWT token. Include it in the Authorization header:
\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\`

Webhook endpoints require an API key:
\`\`\`
X-API-Key: <your-api-key>
\`\`\`

---

### Authentication Endpoints

#### POST \`/api/auth/register\`
Register a new user account.

**Request Body:**
\`\`\`json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe",
  "role": "user"
}
\`\`\`

**Response (201):**
\`\`\`json
{
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user",
    "createdAt": "2024-01-15T10:30:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
\`\`\`

**Stored in:** \`users\` collection

---

#### POST \`/api/auth/login\`
Login with email and password.

**Request Body:**
\`\`\`json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
\`\`\`

**Response (200):**
\`\`\`json
{
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "administrator"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
\`\`\`

---

#### GET \`/api/auth/me\`
Get current authenticated user.

**Headers:**
\`\`\`
Authorization: Bearer <token>
\`\`\`

**Response (200):**
\`\`\`json
{
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "administrator"
  }
}
\`\`\`

---

### Job Endpoints

#### GET \`/api/jobs\`
List all jobs with optional filtering.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| \`status\` | String | Filter by status (\`pending\`, \`rejected\`, etc.) |
| \`excludeStatus\` | String | Exclude statuses (comma-separated) |

**Response (200):**
\`\`\`json
[
  {
    "_id": "507f1f77bcf86cd799439022",
    "jobId": "job_1705312200000",
    "title": "Build a React Dashboard",
    "status": "pending",
    "rating": 4,
    "url": "https://www.upwork.com/jobs/~01234567890"
  }
]
\`\`\`

---

#### POST \`/api/jobs\`
Create a new job manually.

**Request Body:**
\`\`\`json
{
  "title": "Build a React Dashboard",
  "description": "We need a skilled React developer...",
  "url": "https://www.upwork.com/jobs/~01234567890",
  "profile": "I am an experienced React developer...",
  "rating": 4
}
\`\`\`

**Stored in:** \`jobs\` collection

---

#### POST \`/api/jobs/:id/reject\`
Reject a job.

**Updated in:** \`jobs\` collection (status → "rejected")

---

### Proposal Endpoints

#### POST \`/api/proposals/generate\`
Generate a proposal for a job.

**Request Body:**
\`\`\`json
{
  "jobId": "job_1705312200000",
  "title": "Build a React Dashboard",
  "description": "Full job description...",
  "profile": "Your expertise...",
  "url": "https://www.upwork.com/jobs/~01234567890"
}
\`\`\`

**Stored in:** \`jobs\` collection  
**Calls:** N8N webhook URL from settings

---

## Webhook Callbacks (N8N Integration)

These endpoints are called BY N8N to send data TO the application.

### POST \`/api/webhooks/evaluation\`

**Purpose:** N8N sends evaluated job data to the application.

**Full URL:**
\`\`\`
https://your-domain.com/api/webhooks/evaluation
\`\`\`

**Headers:**
\`\`\`
X-API-Key: upw_your_api_key_here
Content-Type: application/json
\`\`\`

**Request Body:**
\`\`\`json
{
  "jobId": "unique-job-identifier-123",
  "title": "Senior React Developer Needed",
  "description": "We are looking for an experienced React developer...",
  "url": "https://www.upwork.com/jobs/~01234567890abcdef",
  "rating": 4,
  "evaluationData": {
    "skills_match": 0.92,
    "budget_range": "$2000-$5000",
    "client_history": "verified",
    "client_rating": 4.8,
    "job_type": "fixed_price",
    "required_skills": ["React", "TypeScript", "Redux"]
  }
}
\`\`\`

**Field Descriptions:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| \`jobId\` | String | Yes* | Unique identifier for the job |
| \`title\` | String | Yes* | Job title |
| \`description\` | String | No | Full job description |
| \`url\` | String | No | Upwork job URL |
| \`rating\` | Number | No | Rating 1-5 |
| \`evaluationData\` | Object | No | Any additional data (flexible schema) |

**Response (200):**
\`\`\`json
{
  "success": true,
  "message": "Evaluation data received",
  "jobId": "unique-job-identifier-123"
}
\`\`\`

**Data Storage:**
- **Collection:** \`jobs\`
- **Fields Updated:** jobId, title, description, url, rating, status="pending", evaluationData (stores complete JSON)

**cURL Example:**
\`\`\`bash
curl -X POST https://your-domain.com/api/webhooks/evaluation \
  -H "X-API-Key: upw_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "job_123",
    "title": "React Developer Needed",
    "description": "Build a dashboard...",
    "url": "https://www.upwork.com/jobs/~01234567890",
    "rating": 4,
    "evaluationData": {"skills_match": 0.92}
  }'
\`\`\`

---

### POST \`/api/webhooks/proposal-result\`

**Purpose:** N8N sends generated proposal results back to the application.

**Full URL:**
\`\`\`
https://your-domain.com/api/webhooks/proposal-result
\`\`\`

**Headers:**
\`\`\`
X-API-Key: upw_your_api_key_here
Content-Type: application/json
\`\`\`

**Request Body:**
\`\`\`json
{
  "jobId": "unique-job-identifier-123",
  "coverLetter": "Dear Hiring Manager,\n\nI am thrilled to apply...",
  "docUrl": "https://docs.google.com/document/d/1abc123xyz/edit",
  "mermaidDiagram": "graph TD;\n  A[Start] --> B[Analysis];\n  B --> C[Development];",
  "mermaidImageUrl": "https://storage.example.com/diagrams/proposal-123.png"
}
\`\`\`

**Field Descriptions:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| \`jobId\` | String | Yes | Job identifier (must match existing job) |
| \`coverLetter\` | String | No | Generated cover letter text |
| \`docUrl\` | String | No | URL to generated document |
| \`mermaidDiagram\` | String | No | Mermaid diagram source code |
| \`mermaidImageUrl\` | String | No | URL to rendered diagram image |

**Response (200):**
\`\`\`json
{
  "success": true,
  "message": "Proposal result received",
  "jobId": "unique-job-identifier-123"
}
\`\`\`

**Data Storage:**
- **Collection:** \`jobs\`
- **Fields Updated:** 
  - status → "proposal_generated"
  - proposalData.coverLetter
  - proposalData.docUrl
  - proposalData.mermaidDiagram
  - proposalData.mermaidImageUrl
  - evaluationData.proposalResponse (stores complete JSON)

**cURL Example:**
\`\`\`bash
curl -X POST https://your-domain.com/api/webhooks/proposal-result \
  -H "X-API-Key: upw_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "job_123",
    "coverLetter": "Dear Hiring Manager...",
    "docUrl": "https://docs.google.com/document/d/abc123",
    "mermaidDiagram": "graph TD; A-->B;",
    "mermaidImageUrl": "https://example.com/diagram.png"
  }'
\`\`\`

---

### N8N Workflow Configuration

#### Workflow 1: Job Evaluation
\`\`\`
[Trigger] → [Scrape Upwork] → [AI Evaluation] → [HTTP Request to /api/webhooks/evaluation]
\`\`\`

#### Workflow 2: Proposal Generation
\`\`\`
[Webhook Trigger] → [AI Generate] → [Create Doc] → [HTTP Request to /api/webhooks/proposal-result]
\`\`\`

**Data sent TO N8N when user clicks "Create Proposal":**
\`\`\`json
{
  "jobId": "job_123",
  "title": "Job Title",
  "description": "Full description...",
  "profile": "User expertise...",
  "url": "https://www.upwork.com/jobs/~01234567890",
  "userId": "507f1f77bcf86cd799439011",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
\`\`\`

---

## Deployment

### Railway Deployment

1. Connect GitHub repository to Railway
2. Add MongoDB plugin or use Atlas connection string
3. Set environment variables:
   \`\`\`
   MONGODB_URI=<your-mongodb-uri>
   JWT_SECRET=<your-secure-secret>
   NODE_ENV=production
   \`\`\`
4. Deploy - Railway auto-detects the Dockerfile

### Docker Deployment

\`\`\`bash
docker build -t upwork-proposal-generator .
docker run -d -p 8080:8080 \
  -e MONGODB_URI="mongodb://host:27017/upwork_proposals" \
  -e JWT_SECRET="your-secret-key" \
  upwork-proposal-generator
\`\`\`

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Cannot connect to MongoDB" | Verify MONGODB_URI is correct |
| "Invalid token" error | Clear browser cookies, login again |
| Webhooks not working | Check API key is active in Settings |
| "API key required" | Include X-API-Key header |

### Testing Webhooks

\`\`\`bash
# Test evaluation webhook
curl -X POST http://localhost:8080/api/webhooks/evaluation \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"jobId": "test_123", "title": "Test Job", "url": "https://upwork.com/test"}'

# Test proposal result webhook
curl -X POST http://localhost:8080/api/webhooks/proposal-result \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"jobId": "test_123", "coverLetter": "Test cover letter"}'
\`\`\`

## License

MIT License
