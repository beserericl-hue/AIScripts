# Webhook Callback API Documentation

This document describes the webhook endpoints and JSON formats used for N8N integration with the Upwork Proposal Generator.

## Authentication

All webhook endpoints require an API key passed in the `X-API-Key` header.

```
X-API-Key: YOUR_API_KEY
```

## Base URL

Production: `https://upwork-proposal-production.up.railway.app`

---

## 1. Generate Proposal (App → N8N)

When a user clicks "Generate Proposal", the application sends job data to your N8N webhook.

### Endpoint

Your configured N8N Webhook URL (set in Settings → Webhook Configuration)

### JSON Body Sent to N8N

| Field       | Type   | Description                           |
|-------------|--------|---------------------------------------|
| `jobId`     | string | Unique job identifier                 |
| `title`     | string | Job title                             |
| `description` | string | Job description                     |
| `profile`   | string | Selected profile name                 |
| `url`       | string | Upwork job URL                        |
| `userId`    | string | User ID who initiated the request     |
| `timestamp` | string | ISO 8601 timestamp                    |

### Example JSON Sent to N8N

```json
{
  "jobId": "job-abc123",
  "title": "Senior React Native + Node.js Developer",
  "description": "We are building a high-traffic automotive marketplace app...",
  "profile": "Full Stack Developer",
  "url": "https://www.upwork.com/jobs/~022012293270821996782",
  "userId": "678abc123def456789012345",
  "timestamp": "2026-01-16T18:30:00.000Z"
}
```

---

## 2. Evaluation Webhook (N8N → App)

Called when N8N evaluates a job posting and sends the data to the application.

### Endpoint

```
POST /api/webhooks/evaluation
```

### Query Parameters

| Parameter  | Type    | Description                                      |
|------------|---------|--------------------------------------------------|
| `testMode` | boolean | Set to `true` to test without saving to database |

### Headers

```
X-API-Key: YOUR_API_KEY
Content-Type: application/json
```

### JSON Body - New Format (Recommended)

The new format uses nested `score` and `job` objects:

| Field                   | Type    | Required    | Description                                    |
|-------------------------|---------|-------------|------------------------------------------------|
| `score.score`           | number  | Recommended | Job rating/score (1-5)                         |
| `score.reasoning`       | string  | Recommended | Explanation of the score                       |
| `job.jobName`           | string  | Yes*        | Job title                                      |
| `job.jobType`           | string  | Optional    | "Fixed" or "Hourly"                            |
| `job.price`             | string  | Optional    | Budget (e.g., "$5,000" or "$50-$100/hr")       |
| `job.jobDetailUrl`      | string  | Optional    | Upwork job URL                                 |
| `job.descriptionSnippet`| string  | Recommended | Job description                                |
| `job.country`           | string  | Optional    | Client's country                               |
| `job.paymentVerified`   | boolean | Optional    | Whether client payment is verified             |
| `job.clientRating`      | number  | Optional    | Client's rating on Upwork                      |
| `job.amountSpent`       | string  | Optional    | Total spent by client (e.g., "$5K spent")      |
| `job.tags`              | array   | Optional    | Skills/tags array                              |
| `job.postedAt`          | string  | Optional    | When job was posted                            |
| `job.experienceLevel`   | string  | Optional    | "Entry", "Intermediate", or "Expert"           |
| `jobId`                 | string  | Yes*        | Unique job identifier (*either jobId or job.jobName required) |
| `teamId`                | string  | Optional    | MongoDB Team ID (takes precedence over teamName) |
| `teamName`              | string  | Optional    | Team name to look up                           |

### Example Request - New Format

```bash
curl -X POST "https://upwork-proposal-production.up.railway.app/api/webhooks/evaluation?testMode=true" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "score": {
      "score": 3,
      "reasoning": "The job requires expert-level skills in React Native and Node.js with high-traffic experience. Budget is reasonable at $5K fixed price. Client has moderate rating (3.37) but payment is verified. Good opportunity but competitive."
    },
    "job": {
      "jobName": "Senior React Native + Node.js Developer for Automotive Marketplace",
      "jobType": "Fixed",
      "price": "$5,000",
      "jobDetailUrl": "https://www.upwork.com/jobs/~022012293270821996782",
      "descriptionSnippet": "We are building a high-traffic automotive marketplace app. Looking for an experienced developer who can handle both frontend (React Native) and backend (Node.js) development...",
      "country": "Ireland",
      "paymentVerified": true,
      "clientRating": 3.37,
      "amountSpent": "$5K spent",
      "tags": ["React Native", "Node.js", "React", "iOS", "Android"],
      "postedAt": "2026-01-16 16:40",
      "experienceLevel": "Expert"
    },
    "teamId": "678abc123def456789012345"
  }'
```

### JSON Body - Legacy Format (Still Supported)

For backward compatibility, the flat format is still supported:

| Field            | Type   | Required    | Description                                    |
|------------------|--------|-------------|------------------------------------------------|
| `jobId`          | string | Yes*        | Unique job identifier                          |
| `title`          | string | Yes*        | Job title (*either jobId or title required)    |
| `description`    | string | Recommended | Full job description                           |
| `url`            | string | Optional    | Upwork job URL                                 |
| `rating`         | number | Optional    | Rating 1-5                                     |
| `teamId`         | string | Optional    | MongoDB Team ID                                |
| `teamName`       | string | Optional    | Team name to look up                           |

### Example Request - Legacy Format

```bash
curl -X POST "https://upwork-proposal-production.up.railway.app/api/webhooks/evaluation?testMode=true" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "test-job-001",
    "title": "Build N8N Automation Workflow",
    "description": "Need help creating automated workflows for data processing",
    "url": "https://www.upwork.com/jobs/test123",
    "rating": 4,
    "teamId": "678abc123def456789012345"
  }'
```

### Success Response

```json
{
  "success": true,
  "message": "Evaluation data received",
  "jobId": "test-job-001",
  "teamId": "678abc123def456789012345"
}
```

### Test Mode Response

```json
{
  "success": true,
  "testMode": true,
  "message": "Test mode: Evaluation data received but NOT saved to database",
  "jobId": "test-job-001",
  "validation": {
    "isValid": true,
    "errors": [],
    "warnings": [],
    "receivedFields": ["score", "job", "teamId"],
    "normalizedFields": ["jobId", "title", "description", "url", "rating", "jobType", "price", "country", "paymentVerified", "clientRating", "amountSpent", "tags", "postedAt", "experienceLevel", "scoreValue", "scoreReasoning", "teamId", "teamName", "rawPayload"],
    "expectedFields": ["jobId", "score.score", "score.reasoning", "job.jobName", "job.jobType", "job.price", "job.jobDetailUrl", "job.descriptionSnippet", "job.country", "job.tags", "teamId", "teamName"]
  },
  "normalizedPayload": { ... },
  "receivedPayload": { ... }
}
```

---

## 3. Proposal Result Webhook (N8N → App)

Called when N8N generates a proposal and sends back the results.

### Endpoint

```
POST /api/webhooks/proposal-result
```

### Query Parameters

| Parameter  | Type    | Description                                      |
|------------|---------|--------------------------------------------------|
| `testMode` | boolean | Set to `true` to test without saving to database |

### Headers

```
X-API-Key: YOUR_API_KEY
Content-Type: application/json
```

### JSON Body

| Field             | Type   | Required    | Description                      |
|-------------------|--------|-------------|----------------------------------|
| `jobId`           | string | **Required**| Job ID to update                 |
| `coverLetter`     | string | Recommended | Generated cover letter text      |
| `docUrl`          | string | Optional    | Google Doc URL                   |
| `mermaidDiagram`  | string | Optional    | Mermaid diagram code             |
| `mermaidImageUrl` | string | Optional    | Rendered diagram image URL       |

### Example Request

```bash
curl -X POST "https://upwork-proposal-production.up.railway.app/api/webhooks/proposal-result?testMode=true" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "test-job-001",
    "coverLetter": "Dear Client,\n\nI am excited to help you build your automotive marketplace app. With over 5 years of experience in React Native and Node.js development, I have successfully delivered several high-traffic mobile applications.\n\nKey highlights:\n- Built marketplace apps handling 100K+ daily active users\n- Expert in React Native performance optimization\n- Strong background in Node.js microservices architecture\n\nI would love to discuss your project in more detail.\n\nBest regards",
    "docUrl": "https://docs.google.com/document/d/abc123xyz",
    "mermaidDiagram": "graph TD\n  A[Mobile App] --> B[API Gateway]\n  B --> C[Auth Service]\n  B --> D[Listing Service]\n  B --> E[Search Service]\n  D --> F[(MongoDB)]\n  E --> G[(Elasticsearch)]",
    "mermaidImageUrl": "https://mermaid.ink/img/eyJjb2RlIjoiZ3JhcGggVEQiLCJtZXJtYWlkIjp7fX0"
  }'
```

### Success Response

```json
{
  "success": true,
  "message": "Proposal result received",
  "jobId": "test-job-001",
  "teamId": "678abc123def456789012345"
}
```

### Test Mode Response

```json
{
  "success": true,
  "testMode": true,
  "message": "Test mode: Proposal result received but NOT saved to database",
  "jobId": "test-job-001",
  "validation": {
    "isValid": true,
    "errors": [],
    "warnings": [],
    "receivedFields": ["jobId", "coverLetter", "docUrl", "mermaidDiagram", "mermaidImageUrl"],
    "expectedFields": ["jobId", "coverLetter", "docUrl", "mermaidDiagram", "mermaidImageUrl"]
  },
  "receivedPayload": { ... }
}
```

---

## 4. Test Data Management

These endpoints allow you to manage test mode data before committing to the database. Accepts either JWT token (from browser) or API key.

### Get All Test Data

```bash
curl -X GET "https://upwork-proposal-production.up.railway.app/api/webhooks/test-data" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Or with API key:

```bash
curl -X GET "https://upwork-proposal-production.up.railway.app/api/webhooks/test-data" \
  -H "X-API-Key: YOUR_API_KEY"
```

**Response:**

```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "jobId": "test-job-001",
      "type": "evaluation",
      "payload": { ... },
      "normalized": { ... },
      "validation": { ... },
      "timestamp": 1705420800000
    }
  ]
}
```

### Get Specific Test Data

```bash
curl -X GET "https://upwork-proposal-production.up.railway.app/api/webhooks/test-data/test-job-001" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Confirm and Save to Database

After reviewing test data, confirm to save it to the database:

```bash
curl -X POST "https://upwork-proposal-production.up.railway.app/api/webhooks/test-data/test-job-001/confirm" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**

```json
{
  "success": true,
  "message": "Evaluation data confirmed and saved to database",
  "jobId": "test-job-001",
  "teamId": "678abc123def456789012345"
}
```

### Discard Test Data

Remove test data without saving:

```bash
curl -X DELETE "https://upwork-proposal-production.up.railway.app/api/webhooks/test-data/test-job-001" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**

```json
{
  "success": true,
  "message": "Test data discarded"
}
```

---

## 5. Health Check

```bash
curl -X GET "https://upwork-proposal-production.up.railway.app/api/webhooks/health"
```

**Response:**

```json
{
  "status": "ok",
  "service": "webhooks"
}
```

---

## Finding Your Team ID

To get your Team ID for use in webhook calls:

1. Log in to the application as an administrator
2. Go to **Settings** → **Teams** tab
3. Each team card displays the Team ID with a copy button
4. Click the copy icon to copy the ID to your clipboard

---

## Error Responses

### 400 Bad Request

```json
{
  "error": "Either jobId or title (job.jobName) is required",
  "validation": {
    "isValid": false,
    "errors": ["Either jobId or title (job.jobName) is required"],
    "warnings": []
  }
}
```

### 401 Unauthorized

```json
{
  "error": "API key required"
}
```

### 404 Not Found

```json
{
  "error": "Job not found"
}
```

### 500 Internal Server Error

```json
{
  "error": "Failed to process evaluation"
}
```

---

## Complete Workflow Integration

### Typical N8N Workflow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         JOB EVALUATION FLOW                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. N8N receives job posting from Upwork RSS/API                    │
│                    ↓                                                │
│  2. N8N evaluates and scores the job using AI                       │
│                    ↓                                                │
│  3. N8N calls POST /api/webhooks/evaluation                         │
│     with nested {score, job} format                                 │
│                    ↓                                                │
│  4. Job appears in app's "Pending Jobs" list                        │
│     with score, reasoning, and job metadata                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                      PROPOSAL GENERATION FLOW                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. User clicks "Generate Proposal" in the app                      │
│                    ↓                                                │
│  2. App sends job data to N8N webhook URL                           │
│     {jobId, title, description, profile, url, userId, timestamp}    │
│                    ↓                                                │
│  3. N8N generates cover letter, creates Google Doc,                 │
│     generates Mermaid diagram                                       │
│                    ↓                                                │
│  4. N8N calls POST /api/webhooks/proposal-result                    │
│     {jobId, coverLetter, docUrl, mermaidDiagram, mermaidImageUrl}   │
│                    ↓                                                │
│  5. Proposal appears in app's "Generated Proposals" section         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Test Mode Workflow

1. Send webhooks with `?testMode=true`
2. Review data in Settings → Webhooks tab (or via API)
3. Click "Confirm" to save to database, or "Discard" to remove

---

## Quick Reference: JSON Schemas

### Generate Proposal (App → N8N)

```json
{
  "jobId": "string",
  "title": "string",
  "description": "string",
  "profile": "string",
  "url": "string",
  "userId": "string",
  "timestamp": "ISO 8601 string"
}
```

### Evaluation (N8N → App) - New Format

```json
{
  "score": {
    "score": "number (1-5)",
    "reasoning": "string"
  },
  "job": {
    "jobName": "string",
    "jobType": "Fixed | Hourly",
    "price": "string",
    "jobDetailUrl": "string",
    "descriptionSnippet": "string",
    "country": "string",
    "paymentVerified": "boolean",
    "clientRating": "number",
    "amountSpent": "string",
    "tags": ["string"],
    "postedAt": "string",
    "experienceLevel": "Entry | Intermediate | Expert"
  },
  "jobId": "string (optional)",
  "teamId": "string (optional)",
  "teamName": "string (optional)"
}
```

### Proposal Result (N8N → App)

```json
{
  "jobId": "string (required)",
  "coverLetter": "string",
  "docUrl": "string",
  "mermaidDiagram": "string",
  "mermaidImageUrl": "string"
}
```
