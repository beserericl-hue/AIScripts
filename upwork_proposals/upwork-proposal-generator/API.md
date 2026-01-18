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

Called when N8N generates a proposal and sends back the results. **Now supports creating new jobs** if the jobId doesn't exist in the database (useful for GigRadar integration and direct proposal generation).

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

| Field             | Type   | Required    | Description                                      |
|-------------------|--------|-------------|--------------------------------------------------|
| `jobId`           | string | Optional    | Job ID to update (auto-generated UUID if not provided) |
| `title`           | string | Optional    | Job title (used when creating new job, defaults to "Untitled Job") |
| `description`     | string | Optional    | Job description (used when creating new job)     |
| `url`             | string | Optional    | Upwork job URL (used when creating new job)      |
| `coverLetter`     | string | Recommended | Generated cover letter text                      |
| `docUrl`          | string | Optional    | Google Doc URL                                   |
| `mermaidDiagram`  | string | Optional    | Mermaid diagram code                             |
| `mermaidImageUrl` | string | Optional    | Rendered diagram image URL                       |
| `teamId`          | string | Optional    | MongoDB Team ID (for new job assignment)         |
| `teamName`        | string | Optional    | Team name to look up (for new job assignment)    |

### Behavior

- **If jobId exists**: Updates the existing job with proposal data
- **If jobId doesn't exist**: Creates a new job with the provided metadata and proposal data
- **If jobId not provided**: Generates a UUID and creates a new job

### Example Request - Update Existing Job

```bash
curl -X POST "https://upwork-proposal-production.up.railway.app/api/webhooks/proposal-result" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "test-job-001",
    "coverLetter": "Dear Client,\n\nI am excited to help you build your automotive marketplace app...",
    "docUrl": "https://docs.google.com/document/d/abc123xyz",
    "mermaidDiagram": "graph TD\n  A[Mobile App] --> B[API Gateway]...",
    "mermaidImageUrl": "https://mermaid.ink/img/eyJjb2RlIjoiZ3JhcGggVEQiLCJtZXJtYWlkIjp7fX0"
  }'
```

### Example Request - Create New Job with Proposal

```bash
curl -X POST "https://upwork-proposal-production.up.railway.app/api/webhooks/proposal-result" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Senior React Native Developer",
    "description": "We are building a high-traffic automotive marketplace app...",
    "url": "https://www.upwork.com/jobs/~022012293270821996782",
    "coverLetter": "Dear Client,\n\nI am excited to help you build your automotive marketplace app...",
    "docUrl": "https://docs.google.com/document/d/abc123xyz",
    "mermaidDiagram": "graph TD\n  A[Mobile App] --> B[API Gateway]...",
    "mermaidImageUrl": "https://mermaid.ink/img/eyJjb2RlIjoiZ3JhcGggVEQiLCJtZXJtYWlkIjp7fX0",
    "teamId": "678abc123def456789012345"
  }'
```

### Success Response - Updated Existing Job

```json
{
  "success": true,
  "message": "Proposal result received",
  "jobId": "test-job-001",
  "teamId": "678abc123def456789012345",
  "isNewJob": false
}
```

### Success Response - Created New Job

```json
{
  "success": true,
  "message": "Proposal result received and new job created",
  "jobId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "teamId": "678abc123def456789012345",
  "isNewJob": true
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
    "warnings": ["docUrl is missing - Google Doc link will not be available"],
    "receivedFields": ["jobId", "coverLetter", "mermaidDiagram", "mermaidImageUrl"],
    "expectedFields": ["jobId", "title", "description", "url", "coverLetter", "docUrl", "mermaidDiagram", "mermaidImageUrl", "teamId", "teamName"]
  },
  "receivedPayload": { ... }
}
```

---

## 4. GigRadar Webhook (GigRadar → App)

Called when GigRadar detects a new job matching your scanner criteria. This endpoint creates a job in the system and automatically triggers the N8N proposal generator workflow.

### Endpoint

```
POST /api/webhooks/gigradar
```

### Query Parameters

| Parameter  | Type    | Description                                      |
|------------|---------|--------------------------------------------------|
| `testMode` | boolean | Set to `true` to test without saving to database or triggering N8N |

### Headers

```
X-API-Key: YOUR_API_KEY
Content-Type: application/json
```

### GigRadar Payload Structure

The webhook expects the GigRadar `GIGRADAR.PROPOSAL.UPDATE` event format:

| Field                           | Type    | Required | Description                                    |
|---------------------------------|---------|----------|------------------------------------------------|
| `type`                          | string  | Yes      | Must be "GIGRADAR.PROPOSAL.UPDATE"             |
| `data.teamName`                 | string  | Optional | GigRadar team name                             |
| `data.teamId`                   | string  | Optional | GigRadar team ID                               |
| `data.scannerName`              | string  | Optional | Scanner that detected the job                  |
| `data.scannerId`                | string  | Optional | Scanner ID                                     |
| `data.job.ciphertext`           | string  | Yes      | Upwork job ciphertext (used to generate job URL) |
| `data.job.title`                | string  | Yes      | Job title                                      |
| `data.job.description`          | string  | Yes      | Full job description                           |
| `data.job.createdOn`            | string  | Optional | Job creation timestamp (ISO 8601)              |
| `data.job.duration`             | string  | Optional | Project duration                               |
| `data.job.engagement`           | string  | Optional | Engagement type                                |
| `data.job.connectsPrice`        | number  | Optional | Cost in connects to apply                      |
| `data.job.talentPreference`     | string  | Optional | Talent preference settings                     |
| `data.job.experienceLevel`      | string  | Optional | "Entry", "Intermediate", or "Expert"           |
| `data.job.categoryName`         | string  | Optional | Job category                                   |
| `data.job.subCategoryName`      | string  | Optional | Job subcategory                                |
| `data.job.skills`               | array   | Optional | Skills array `[{name, uid}]`                   |
| `data.job.questions`            | array   | Optional | Application questions                          |
| `data.job.budget.type`          | number  | Optional | 1 = Fixed, 2 = Hourly                          |
| `data.job.budget.fixed`         | number  | Optional | Fixed price budget                             |
| `data.job.budget.hourlyMin`     | number  | Optional | Min hourly rate                                |
| `data.job.budget.hourlyMax`     | number  | Optional | Max hourly rate                                |
| `data.job.client.paymentVerified` | boolean | Optional | Client payment verified                      |
| `data.job.client.location.country` | string | Optional | Client country                              |
| `data.job.client.location.city`   | string  | Optional | Client city                                 |
| `data.job.client.location.timezone` | string | Optional | Client timezone                            |
| `data.job.client.stats.feedbackScore` | number | Optional | Client feedback score                    |
| `data.job.client.stats.totalSpent` | number | Optional | Total amount spent by client               |
| `data.job.client.stats.hireRate` | number  | Optional | Client hire rate                             |
| `data.job.client.stats.totalHires` | number | Optional | Total hires by client                       |
| `data.job.client.stats.jobsPostedCount` | number | Optional | Jobs posted by client                |
| `data.job.client.company.industry` | string | Optional | Company industry                            |
| `data.job.client.company.size`   | string  | Optional | Company size                                  |
| `data.job.client.company.isEnterprise` | boolean | Optional | Enterprise client flag               |

### Job URL Generation

The endpoint generates the Upwork job URL from the ciphertext:

```
https://www.upwork.com/freelance-jobs/apply/{ciphertext}
```

### Example Request

```bash
curl -X POST "https://upwork-proposal-production.up.railway.app/api/webhooks/gigradar" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "GIGRADAR.PROPOSAL.UPDATE",
    "data": {
      "teamName": "My Team",
      "teamId": "team123",
      "scannerName": "React Native Scanner",
      "scannerId": "scanner456",
      "job": {
        "ciphertext": "~01abc123def456",
        "title": "Senior React Native Developer for iOS App",
        "description": "We are looking for an experienced React Native developer...",
        "createdOn": "2026-01-18T10:00:00.000Z",
        "duration": "3-6 months",
        "engagement": "Full-time",
        "experienceLevel": "Expert",
        "connectsPrice": 16,
        "categoryName": "Web, Mobile & Software Dev",
        "subCategoryName": "Mobile Development",
        "skills": [
          {"name": "React Native", "uid": "skill1"},
          {"name": "iOS", "uid": "skill2"},
          {"name": "TypeScript", "uid": "skill3"}
        ],
        "budget": {
          "type": 2,
          "hourlyMin": 50,
          "hourlyMax": 80
        },
        "client": {
          "paymentVerified": true,
          "location": {
            "country": "United States",
            "city": "San Francisco",
            "timezone": "America/Los_Angeles"
          },
          "stats": {
            "feedbackScore": 4.8,
            "totalSpent": 150000,
            "hireRate": 85,
            "totalHires": 45,
            "jobsPostedCount": 120
          },
          "company": {
            "industry": "Technology",
            "size": "51-200",
            "isEnterprise": false
          }
        }
      }
    }
  }'
```

### Success Response

```json
{
  "success": true,
  "message": "GigRadar job created",
  "jobId": "~01abc123def456",
  "jobUrl": "https://www.upwork.com/freelance-jobs/apply/~01abc123def456",
  "teamId": "678abc123def456789012345",
  "isNewJob": true,
  "n8nTriggered": true,
  "validation": {
    "isValid": true,
    "errors": [],
    "warnings": []
  }
}
```

### Success Response (N8N not configured)

```json
{
  "success": true,
  "message": "GigRadar job created",
  "jobId": "~01abc123def456",
  "jobUrl": "https://www.upwork.com/freelance-jobs/apply/~01abc123def456",
  "teamId": null,
  "isNewJob": true,
  "n8nTriggered": false,
  "n8nError": "No N8N webhook URL configured in settings",
  "validation": {
    "isValid": true,
    "errors": [],
    "warnings": []
  }
}
```

### Test Mode Response

```json
{
  "success": true,
  "testMode": true,
  "message": "Test mode: GigRadar data received but NOT saved or sent to N8N",
  "jobId": "~01abc123def456",
  "jobUrl": "https://www.upwork.com/freelance-jobs/apply/~01abc123def456",
  "validation": {
    "isValid": true,
    "errors": [],
    "warnings": []
  },
  "normalizedPayload": { ... }
}
```

### Error Response - Missing Ciphertext

```json
{
  "error": "Missing ciphertext - required for generating Upwork job URL",
  "validation": {
    "isValid": false,
    "errors": ["Missing ciphertext - required for generating Upwork job URL"],
    "warnings": []
  }
}
```

### UI Indicators

Jobs created via GigRadar are marked with:
- **Source badge**: "GigRadar" indicator in the dashboard job list
- **Job URL**: Displayed prominently at the top of the Generated Proposal page

---

## 5. Test Data Management

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

## 6. Health Check

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
  "jobId": "string (optional - auto-generated if not provided)",
  "title": "string (optional - for new job creation)",
  "description": "string (optional - for new job creation)",
  "url": "string (optional - for new job creation)",
  "coverLetter": "string",
  "docUrl": "string",
  "mermaidDiagram": "string",
  "mermaidImageUrl": "string",
  "teamId": "string (optional - for new job assignment)",
  "teamName": "string (optional - for new job assignment)"
}
```
