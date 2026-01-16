# Webhook Callback API Documentation

This document describes the webhook endpoints used for N8N integration with the Upwork Proposal Generator.

## Authentication

All webhook endpoints require an API key passed in the `X-API-Key` header.

```
X-API-Key: YOUR_API_KEY
```

## Base URL

Production: `https://upwork-proposal-production.up.railway.app`

---

## 1. Evaluation Webhook (Job from N8N)

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

### JSON Body

| Field            | Type   | Required    | Description                                    |
|------------------|--------|-------------|------------------------------------------------|
| `jobId`          | string | Yes*        | Unique job identifier                          |
| `title`          | string | Yes*        | Job title (*either jobId or title required)    |
| `description`    | string | Recommended | Full job description                           |
| `url`            | string | Optional    | Upwork job URL                                 |
| `rating`         | number | Optional    | Rating 1-5                                     |
| `teamId`         | string | Optional    | MongoDB Team ID (takes precedence over teamName) |
| `teamName`       | string | Optional    | Team name to look up                           |
| `evaluationData` | object | Optional    | Any additional evaluation data from N8N        |

### Example Request (with teamId)

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

### Example Request (with teamName)

```bash
curl -X POST "https://upwork-proposal-production.up.railway.app/api/webhooks/evaluation?testMode=true" \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "jobId": "test-job-002",
    "title": "React Dashboard Development",
    "description": "Build a custom analytics dashboard",
    "url": "https://www.upwork.com/jobs/test456",
    "rating": 5,
    "teamName": "Sales Team A"
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
    "receivedFields": ["jobId", "title", "description", "url", "rating", "teamId"],
    "expectedFields": ["jobId", "title", "description", "url", "rating", "evaluationData", "teamId", "teamName"]
  },
  "receivedPayload": { ... }
}
```

---

## 2. Proposal Result Webhook (Generated Proposal from N8N)

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
    "coverLetter": "Dear Client,\n\nI am excited to help you build your N8N automation workflow. With over 5 years of experience in workflow automation...\n\nBest regards",
    "docUrl": "https://docs.google.com/document/d/abc123xyz",
    "mermaidDiagram": "graph TD\n  A[Start] --> B[Process Data]\n  B --> C[Generate Output]\n  C --> D[End]",
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

## 3. Test Data Management

These endpoints allow you to manage test mode data before committing to the database.

### Get All Test Data

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
      "validation": { ... },
      "timestamp": 1705420800000
    }
  ]
}
```

### Get Specific Test Data

```bash
curl -X GET "https://upwork-proposal-production.up.railway.app/api/webhooks/test-data/test-job-001" \
  -H "X-API-Key: YOUR_API_KEY"
```

### Confirm and Save to Database

After reviewing test data, confirm to save it to the database:

```bash
curl -X POST "https://upwork-proposal-production.up.railway.app/api/webhooks/test-data/test-job-001/confirm" \
  -H "X-API-Key: YOUR_API_KEY"
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
  -H "X-API-Key: YOUR_API_KEY"
```

**Response:**

```json
{
  "success": true,
  "message": "Test data discarded"
}
```

---

## 4. Health Check

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
  "error": "Either jobId or title is required",
  "validation": {
    "isValid": false,
    "errors": ["Either jobId or title is required"],
    "warnings": []
  }
}
```

### 401 Unauthorized

```json
{
  "error": "API key is required"
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

## Workflow Integration

### Typical N8N Workflow

1. **Job Evaluation Flow:**
   - N8N receives job posting from Upwork RSS/API
   - N8N evaluates and rates the job
   - N8N calls `POST /api/webhooks/evaluation` with job data
   - Job appears in the application's "Pending Jobs" list

2. **Proposal Generation Flow:**
   - User clicks "Generate Proposal" in the application
   - Application sends job to N8N webhook
   - N8N generates cover letter, creates Google Doc, generates diagram
   - N8N calls `POST /api/webhooks/proposal-result` with generated content
   - Proposal appears in the application's "Generated Proposals" section

### Test Mode Workflow

1. Send webhooks with `?testMode=true`
2. Review data in Settings → Webhooks tab (or via API)
3. Click "Confirm" to save to database, or "Discard" to remove
