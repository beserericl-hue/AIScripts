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
- [API Reference](#api-reference)
- [N8N Integration](#n8n-integration)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

## Overview

The Upwork Proposal Generator streamlines the process of creating professional proposals for Upwork job postings. It works in conjunction with N8N automation workflows to:

1. **Evaluate incoming job leads** - N8N sends evaluated job data to the application via webhook
2. **Review and manage jobs** - Users review pending jobs, reject unsuitable ones, and select jobs for proposal generation
3. **Generate proposals** - The system calls an N8N workflow to generate cover letters, workflow diagrams, and documentation
4. **Track proposal status** - All jobs and proposals are tracked with their current status

## Architecture

```
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
```

### Component Breakdown

| Component | Description |
|-----------|-------------|
| **React Frontend** | Single-page application built with React 19, Vite, and React Router |
| **Express Backend** | Node.js server handling API requests and serving static files |
| **MongoDB** | Document database storing users, jobs, settings, and API keys |
| **N8N Workflows** | External automation platform for job evaluation and proposal generation |

### Data Flow

1. **Job Evaluation Flow**:
   ```
   N8N Workflow → POST /api/webhooks/evaluation → MongoDB (jobs collection)
   ```

2. **Proposal Generation Flow**:
   ```
   User submits form → POST /api/proposals/generate → N8N Workflow
                                                           ↓
   User views results ← MongoDB ← POST /api/webhooks/proposal-result
   ```

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
   ```bash
   git clone https://github.com/yourusername/upwork_proposals.git
   cd upwork_proposals/upwork-proposal-generator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create environment file**
   ```bash
   cp .env.example .env
   ```

4. **Configure environment variables** (see [Configuration](#configuration))

5. **Build and start the application**
   ```bash
   npm run build
   npm start
   ```

6. **Access the application**
   - Open http://localhost:8080 in your browser

### Docker Setup

```bash
cd upwork_proposals
docker build -t upwork-proposal-generator .
docker run -p 8080:8080 \
  -e MONGODB_URI=mongodb://your-mongo-host:27017/upwork_proposals \
  -e JWT_SECRET=your-secret-key \
  upwork-proposal-generator
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `8080` | Server port |
| `NODE_ENV` | No | `development` | Environment mode |
| `MONGODB_URI` | Yes | - | MongoDB connection string |
| `JWT_SECRET` | Yes | - | Secret key for JWT signing (use a strong random string) |
| `CORS_ORIGIN` | No | `*` | Allowed CORS origins |

### Example `.env` File

```env
# Server Configuration
PORT=8080
NODE_ENV=production

# MongoDB Connection
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/upwork_proposals

# JWT Secret (generate a strong random string)
JWT_SECRET=your-super-secret-key-min-32-characters

# CORS (optional)
CORS_ORIGIN=https://your-domain.com
```

### Generating a Secure JWT Secret

```bash
# Using OpenSSL
openssl rand -base64 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

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
   - Use this key in your N8N workflows as the `X-API-Key` header

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

## API Reference

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login with email/password |
| POST | `/api/auth/google` | Google OAuth login |
| POST | `/api/auth/logout` | Logout current user |
| GET | `/api/auth/me` | Get current user info |
| GET | `/api/auth/users` | List all users (admin) |
| PATCH | `/api/auth/users/:id/role` | Update user role (admin) |
| DELETE | `/api/auth/users/:id` | Delete user (admin) |

### Job Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/jobs` | List all jobs |
| GET | `/api/jobs/pending` | List pending jobs |
| GET | `/api/jobs/:id` | Get job by ID |
| POST | `/api/jobs` | Create new job |
| PATCH | `/api/jobs/:id` | Update job |
| POST | `/api/jobs/:id/reject` | Reject job |
| DELETE | `/api/jobs/:id` | Delete job |

### Proposal Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/proposals/generate` | Generate proposal |
| GET | `/api/proposals/:jobId` | Get proposal data |

### Webhook Endpoints (for N8N)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/webhooks/evaluation` | Receive job evaluation |
| POST | `/api/webhooks/proposal-result` | Receive generated proposal |

### Settings & API Keys

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings` | Get user settings |
| PUT | `/api/settings` | Update settings |
| GET | `/api/api-keys` | List API keys |
| POST | `/api/api-keys` | Generate new API key |
| PATCH | `/api/api-keys/:id/toggle` | Toggle key active status |
| DELETE | `/api/api-keys/:id` | Delete API key |

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Server health status |

## N8N Integration

### Setting Up N8N Workflows

#### 1. Job Evaluation Workflow

This workflow evaluates Upwork jobs and sends them to the application.

**Webhook Configuration:**
- Method: POST
- URL: `https://your-app-domain.com/api/webhooks/evaluation`
- Headers:
  ```
  X-API-Key: your-api-key-from-settings
  Content-Type: application/json
  ```

**Payload Format:**
```json
{
  "jobId": "unique-job-identifier",
  "title": "Job Title from Upwork",
  "description": "Full job description...",
  "url": "https://www.upwork.com/jobs/~01234567890",
  "rating": 4,
  "evaluationData": {
    "skills_match": 0.85,
    "budget_range": "$500-$1000",
    "client_history": "verified",
    "custom_field": "any additional data"
  }
}
```

#### 2. Proposal Generation Workflow

This workflow is called when a user clicks "Create Proposal".

**Incoming Webhook receives:**
```json
{
  "jobId": "unique-job-identifier",
  "title": "Job Title",
  "description": "Full job description...",
  "profile": "User's expertise and background...",
  "url": "https://www.upwork.com/jobs/~01234567890",
  "userId": "user-id",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Response Webhook Configuration:**
- Method: POST
- URL: `https://your-app-domain.com/api/webhooks/proposal-result`
- Headers:
  ```
  X-API-Key: your-api-key-from-settings
  Content-Type: application/json
  ```

**Response Payload Format:**
```json
{
  "jobId": "unique-job-identifier",
  "coverLetter": "Dear Hiring Manager,\n\nI am excited to apply for...",
  "docUrl": "https://docs.google.com/document/d/...",
  "mermaidDiagram": "graph TD;\n  A[Start] --> B[Analysis];\n  B --> C[Implementation];",
  "mermaidImageUrl": "https://your-storage.com/diagrams/job-123.png"
}
```

## Deployment

### Railway Deployment

1. **Connect Repository**
   - Go to [Railway](https://railway.app)
   - Create new project from GitHub repo
   - Select this repository

2. **Add MongoDB**
   - Add a MongoDB plugin to your project
   - Or use MongoDB Atlas connection string

3. **Configure Environment Variables**
   ```
   MONGODB_URI=<your-mongodb-uri>
   JWT_SECRET=<your-secure-secret>
   NODE_ENV=production
   ```

4. **Deploy**
   - Railway automatically detects the Dockerfile
   - Builds and deploys the application
   - Provides a public URL

### Manual Docker Deployment

```bash
# Build the image
docker build -t upwork-proposal-generator .

# Run with environment variables
docker run -d \
  --name upwork-proposals \
  -p 8080:8080 \
  -e MONGODB_URI="mongodb://host:27017/upwork_proposals" \
  -e JWT_SECRET="your-secret-key" \
  -e NODE_ENV="production" \
  upwork-proposal-generator
```

### Health Check

The application exposes a health check endpoint:
```
GET /api/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| "Cannot connect to MongoDB" | Verify `MONGODB_URI` is correct and MongoDB is accessible |
| "Invalid token" error | Clear browser cookies and localStorage, then login again |
| Webhooks not working | Verify API key is active in Settings → API Keys |
| CORS errors | Check `CORS_ORIGIN` environment variable |
| 404 on page refresh | Ensure Express is serving the React build correctly |

### Logs

In Docker:
```bash
docker logs upwork-proposals
```

In Railway:
- View logs in the Railway dashboard under your service

### Database Issues

Connect to MongoDB and check collections:
```javascript
// List all collections
show collections

// Check users
db.users.find().pretty()

// Check jobs
db.jobs.find({ status: 'pending' }).pretty()

// Check API keys
db.apikeys.find().pretty()
```

## License

MIT License - See LICENSE file for details.

## Support

For issues and feature requests, please open an issue on GitHub.
