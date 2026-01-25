# CSHSE Self-Study Management System - API Documentation

## Overview

This document describes the REST API endpoints for the CSHSE Self-Study and Review Management System, including N8N webhook integration for AI-powered validation.

---

## Table of Contents

1. [Authentication](#authentication)
2. [Users & Invitations](#users--invitations)
3. [Institutions](#institutions)
4. [Submissions (Self-Studies)](#submissions-self-studies)
5. [Standards & Narratives](#standards--narratives)
6. [Curriculum Matrix](#curriculum-matrix)
7. [Evidence Management](#evidence-management)
8. [Reviews](#reviews)
9. [Lead Reader Reviews](#lead-reader-reviews)
10. [Comments](#comments)
11. [Reader Lock](#reader-lock)
12. [Assignments](#assignments)
13. [Site Visits](#site-visits)
14. [Change Requests](#change-requests)
15. [Reports](#reports)
16. [Admin Settings](#admin-settings)
17. [N8N Webhook Integration](#n8n-webhook-integration)
18. [API Keys](#api-keys)

---

## Base URL

```
Production: https://api.cshse-accreditation.org/api
Development: http://localhost:5000/api
```

---

## Authentication

### POST /auth/login
Authenticate a user and receive a JWT token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "program_coordinator",
    "institutionId": "inst_456"
  },
  "expiresIn": 86400
}
```

### POST /auth/accept-invitation
Accept an invitation and create account (from email link).

**Request Body:**
```json
{
  "token": "invitation_token_from_email",
  "password": "newpassword",
  "confirmPassword": "newpassword"
}
```

**Response:**
```json
{
  "message": "Account created successfully",
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "program_coordinator"
  }
}
```

### POST /auth/refresh
Refresh an expired JWT token.

**Headers:**
```
Authorization: Bearer <expired_token>
```

**Response:**
```json
{
  "token": "new_jwt_token",
  "expiresIn": 86400
}
```

### POST /auth/logout
Invalidate the current session.

**Headers:**
```
Authorization: Bearer <token>
```

---

## Users & Invitations

### GET /users
List all users (Admin only).

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| role | string | Filter by role (admin, reader, lead_reader, program_coordinator) |
| institutionId | string | Filter by institution |
| status | string | Filter by status (active, pending, disabled) |
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 50) |

**Response:**
```json
{
  "users": [
    {
      "id": "user_123",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "program_coordinator",
      "institutionId": "inst_456",
      "institutionName": "State University",
      "status": "active",
      "createdAt": "2024-01-15T10:30:00Z",
      "lastLoginAt": "2024-06-10T14:22:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 125,
    "totalPages": 3
  }
}
```

### POST /users/invite
Invite a new user to the system (Admin or Lead Reader).

**Request Body:**
```json
{
  "email": "newuser@university.edu",
  "name": "Jane Smith",
  "role": "program_coordinator",
  "institutionId": "inst_456"
}
```

**Response:**
```json
{
  "message": "Invitation sent successfully",
  "invitation": {
    "id": "inv_789",
    "email": "newuser@university.edu",
    "role": "program_coordinator",
    "expiresAt": "2024-06-20T10:30:00Z"
  }
}
```

### GET /users/:id
Get user details.

**Response:**
```json
{
  "id": "user_123",
  "email": "user@example.com",
  "name": "John Doe",
  "role": "program_coordinator",
  "institutionId": "inst_456",
  "institution": {
    "id": "inst_456",
    "name": "State University",
    "type": "university"
  },
  "permissions": ["edit_self_study", "view_comments"],
  "assignedSubmissions": ["sub_001", "sub_002"],
  "status": "active",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

### PUT /users/:id
Update user details (Admin only).

**Request Body:**
```json
{
  "name": "John D. Doe",
  "role": "lead_reader",
  "status": "active"
}
```

### DELETE /users/:id
Disable a user account (Admin only).

### POST /users/:id/resend-invitation
Resend invitation email to pending user.

---

## Institutions

### GET /institutions
List all institutions.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| type | string | Filter by type (college, university) |
| hasActiveSubmission | boolean | Filter by active submission status |
| page | number | Page number |
| limit | number | Items per page |

**Response:**
```json
{
  "institutions": [
    {
      "id": "inst_456",
      "name": "State University",
      "type": "university",
      "address": {
        "street": "123 Campus Drive",
        "city": "Springfield",
        "state": "IL",
        "zip": "62701"
      },
      "primaryContact": {
        "name": "John Doe",
        "email": "jdoe@stateuniv.edu",
        "phone": "555-123-4567"
      },
      "accreditationDeadline": "2024-12-15",
      "currentSubmissionId": "sub_001",
      "assignedLeadReader": "user_789",
      "status": "active"
    }
  ],
  "pagination": {...}
}
```

### POST /institutions
Create a new institution (Admin only).

**Request Body:**
```json
{
  "name": "City College",
  "type": "college",
  "address": {
    "street": "456 College Ave",
    "city": "Metropolis",
    "state": "NY",
    "zip": "10001"
  },
  "primaryContact": {
    "name": "Jane Smith",
    "email": "jsmith@citycollege.edu",
    "phone": "555-987-6543"
  },
  "accreditationDeadline": "2025-03-01",
  "programCoordinatorEmail": "coordinator@citycollege.edu",
  "programCoordinatorName": "Program Coordinator Name"
}
```

**Response:**
```json
{
  "message": "Institution created and invitation sent to program coordinator",
  "institution": {
    "id": "inst_789",
    "name": "City College",
    ...
  },
  "invitation": {
    "id": "inv_101",
    "email": "coordinator@citycollege.edu",
    "expiresAt": "2024-06-27T10:30:00Z"
  }
}
```

### GET /institutions/:id
Get institution details.

### PUT /institutions/:id
Update institution details (Admin only).

### DELETE /institutions/:id
Archive an institution (Admin only).

---

## Submissions (Self-Studies)

### GET /submissions
List all submissions.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| institutionId | string | Filter by institution |
| status | string | Filter by status |
| assignedReader | string | Filter by assigned reader ID |
| leadReader | string | Filter by lead reader ID |
| page | number | Page number |
| limit | number | Items per page |

**Response:**
```json
{
  "submissions": [
    {
      "id": "sub_001",
      "submissionId": "2024-001",
      "institutionName": "State University",
      "programName": "Human Services",
      "programLevel": "bachelors",
      "type": "reaccreditation",
      "status": "under_review",
      "assignedReaders": ["user_101", "user_102"],
      "leadReader": "user_789",
      "accreditationDeadline": "2024-12-15",
      "siteVisitDate": "2024-11-01",
      "selfStudyProgress": {
        "totalSections": 21,
        "completedSections": 18,
        "validatedSections": 15,
        "passedSections": 14,
        "failedSections": 1
      },
      "readerLock": {
        "isLocked": true,
        "lockedByName": "Dr. Smith",
        "lockedByRole": "lead_reader"
      },
      "submittedAt": "2024-06-01T10:30:00Z"
    }
  ],
  "pagination": {...}
}
```

### POST /submissions
Create a new submission.

### GET /submissions/:id
Get submission details.

### PUT /submissions/:id
Update submission.

### GET /submissions/:id/progress
Get detailed progress for a submission.

**Response:**
```json
{
  "submissionId": "sub_001",
  "overallProgress": 85,
  "standardsProgress": {
    "1": { "status": "validated", "validationStatus": "pass", "completionPercentage": 100 },
    "2": { "status": "validated", "validationStatus": "pass", "completionPercentage": 100 },
    "11": { "status": "in_progress", "completionPercentage": 75 },
    ...
  },
  "timeline": {
    "created": "2024-01-15T10:30:00Z",
    "submitted": "2024-06-01T10:30:00Z",
    "reviewStarted": "2024-06-05T09:00:00Z",
    "siteVisitScheduled": "2024-11-01"
  }
}
```

### POST /submissions/:id/standards/:standardCode/submit
Submit a standard for validation.

**Response:**
```json
{
  "message": "Standard submitted for validation",
  "validationResults": [
    {
      "specCode": "a",
      "status": "pass",
      "score": 92,
      "feedback": "Narrative adequately addresses the requirement."
    },
    {
      "specCode": "b",
      "status": "fail",
      "score": 45,
      "feedback": "Missing specific course references.",
      "missingElements": ["Course numbers", "Credit hours"]
    }
  ]
}
```

### POST /submissions/:id/revalidate
Revalidate failed sections only.

---

## Standards & Narratives

### GET /submissions/:id/narratives
Get all narratives for a submission.

### GET /submissions/:id/narratives/:standardCode
Get narrative for a specific standard.

### PUT /submissions/:id/narratives/:standardCode
Update narrative content.

**Request Body:**
```json
{
  "specCode": "a",
  "content": "<p>The program provides comprehensive...</p>",
  "triggerValidation": true
}
```

---

## Curriculum Matrix

### GET /submissions/:submissionId/matrix
Get curriculum matrix.

### POST /submissions/:submissionId/matrix
Create a new curriculum matrix.

### PUT /submissions/:submissionId/matrix/:matrixId
Update matrix.

### POST /submissions/:submissionId/matrix/:matrixId/course
Add a course to the matrix.

**Request Body:**
```json
{
  "coursePrefix": "HUS",
  "courseNumber": "201",
  "courseName": "Introduction to Human Services",
  "credits": 3
}
```

### PUT /submissions/:submissionId/matrix/:matrixId/assessment
Update assessment cell.

**Request Body:**
```json
{
  "courseId": "course_123",
  "standardCode": "11",
  "specCode": "a",
  "type": ["K", "S"],
  "depth": "H"
}
```

---

## Evidence Management

### GET /submissions/:submissionId/evidence
List all evidence for a submission.

### POST /submissions/:submissionId/evidence/upload
Upload file evidence.

**Request:** `multipart/form-data`

| Field | Type | Description |
|-------|------|-------------|
| file | File | The file to upload (PDF, DOCX, PPTX, images) |
| standardCode | string | Standard to link to |
| specCode | string | Specification to link to (optional) |
| description | string | Description of the evidence |

### POST /submissions/:submissionId/evidence/url
Add URL evidence.

**Request Body:**
```json
{
  "url": "https://university.edu/catalog/course-descriptions",
  "title": "Course Catalog",
  "description": "Official course descriptions and requirements",
  "standardCode": "11",
  "specCode": "b"
}
```

### DELETE /submissions/:submissionId/evidence/:evidenceId
Remove evidence.

---

## Reviews

### GET /reviews
List reviews.

### GET /reviews/:id
Get review details.

### POST /reviews
Create a new review.

### PUT /reviews/:id
Update review.

### PUT /reviews/:id/assessments/:standardCode
Update compliance assessment for a standard.

**Request Body:**
```json
{
  "specCode": "a",
  "compliance": "compliant",
  "comments": "The program adequately demonstrates...",
  "recommendations": "Consider adding more specific examples."
}
```

---

## Lead Reader Reviews

### GET /lead-reviews/:submissionId
Get lead reader compilation.

### POST /lead-reviews/:submissionId/compile
Compile reader reports into final assessment.

### PUT /lead-reviews/:submissionId/standards/:standardCode
Update final consensus assessment.

---

## Comments

### GET /submissions/:submissionId/comments
Get all comments for a submission.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| standardCode | string | Filter by standard |
| specCode | string | Filter by specification |
| page | number | Page number |
| limit | number | Items per page |

**Response:**
```json
{
  "comments": [
    {
      "id": "cmt_001",
      "standardCode": "11",
      "specCode": "a",
      "selectedText": "The program curriculum",
      "selectionStart": 45,
      "selectionEnd": 65,
      "authorId": "user_789",
      "authorName": "Dr. Smith",
      "authorRole": "lead_reader",
      "content": "Please provide more specific course numbers.",
      "replies": [
        {
          "id": "reply_001",
          "authorId": "user_123",
          "authorName": "John Doe",
          "authorRole": "program_coordinator",
          "content": "Added HUS 201 and HUS 305 references.",
          "createdAt": "2024-06-12T15:30:00Z"
        }
      ],
      "isResolved": false,
      "createdAt": "2024-06-10T10:30:00Z"
    }
  ],
  "pagination": {...}
}
```

### GET /submissions/:submissionId/comments/summary
Get comment count summary.

**Response:**
```json
{
  "totalComments": 15,
  "totalUnresolved": 5,
  "bySection": [
    { "standardCode": "11", "specCode": "a", "count": 3, "unresolvedCount": 1 },
    { "standardCode": "11", "specCode": "b", "count": 2, "unresolvedCount": 2 }
  ],
  "firstComment": {
    "standardCode": "11",
    "specCode": "a",
    "commentId": "cmt_001"
  }
}
```

### GET /submissions/:submissionId/comments/navigate
Get paginated comments for navigation.

### POST /submissions/:submissionId/comments
Create a comment (Reader, Lead Reader only).

**Request Body:**
```json
{
  "standardCode": "11",
  "specCode": "a",
  "selectedText": "The program curriculum",
  "selectionStart": 45,
  "selectionEnd": 65,
  "content": "Please clarify this section."
}
```

### PUT /comments/:commentId
Update a comment (author only).

### DELETE /comments/:commentId
Delete a comment (author or lead reader).

### POST /comments/:commentId/replies
Add a reply to a comment.

**Request Body:**
```json
{
  "content": "I've updated the section with the requested information."
}
```

### DELETE /comments/:commentId/replies/:replyId
Delete a reply (reply author only).

### POST /comments/:commentId/resolve
Toggle comment resolved status.

---

## Reader Lock

### GET /submissions/:submissionId/lock
Get lock status.

**Response:**
```json
{
  "isLocked": true,
  "canEdit": false,
  "lockMessage": "Reader Locked - Dr. Smith is currently reviewing this self-study.",
  "lockDetails": {
    "isLocked": true,
    "lockedBy": "user_789",
    "lockedByName": "Dr. Smith",
    "lockedByRole": "lead_reader",
    "lockedAt": "2024-06-10T09:00:00Z",
    "lockReason": "lead_reader_review"
  }
}
```

### POST /submissions/:submissionId/lock
Lock a submission for review (Reader, Lead Reader).

**Request Body:**
```json
{
  "reason": "reader_review"
}
```

### DELETE /submissions/:submissionId/lock
Unlock a submission.

### POST /submissions/:submissionId/send-back
Send submission back to program coordinator for correction.

**Request Body:**
```json
{
  "reason": "Standard 11 needs additional course information and supporting evidence."
}
```

### POST /submissions/:submissionId/clear-sent-back
Clear sent-back status after corrections (Program Coordinator).

---

## Assignments

### GET /assignments
List all reader assignments.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| readerId | string | Filter by reader |
| leadReaderId | string | Filter by lead reader |
| institutionId | string | Filter by institution |
| status | string | Filter by assignment status |

### POST /assignments
Create reader assignment (Admin, Lead Reader).

**Request Body:**
```json
{
  "submissionId": "sub_001",
  "readerId": "user_101",
  "assignedBy": "user_admin"
}
```

### POST /assignments/lead-reader
Assign lead reader to institution (Admin only).

**Request Body:**
```json
{
  "institutionId": "inst_456",
  "leadReaderId": "user_789"
}
```

### DELETE /assignments/:id
Remove reader assignment.

---

## Site Visits

### GET /site-visits
List scheduled site visits.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| institutionId | string | Filter by institution |
| leadReaderId | string | Filter by lead reader |
| upcoming | boolean | Show only upcoming visits |
| startDate | date | Filter by date range start |
| endDate | date | Filter by date range end |

**Response:**
```json
{
  "siteVisits": [
    {
      "id": "sv_001",
      "submissionId": "sub_001",
      "institutionId": "inst_456",
      "institutionName": "State University",
      "scheduledDate": "2024-11-01",
      "scheduledBy": "user_789",
      "leadReader": {
        "id": "user_789",
        "name": "Dr. Smith"
      },
      "readers": [
        { "id": "user_101", "name": "Jane Doe" },
        { "id": "user_102", "name": "Bob Wilson" }
      ],
      "status": "confirmed",
      "notes": "Visit will include tour of facilities.",
      "createdAt": "2024-06-15T10:30:00Z"
    }
  ]
}
```

### POST /site-visits
Schedule a site visit (Lead Reader).

**Request Body:**
```json
{
  "submissionId": "sub_001",
  "scheduledDate": "2024-11-01",
  "notes": "Tentative date pending confirmation."
}
```

### PUT /site-visits/:id
Update site visit details.

### DELETE /site-visits/:id
Cancel a site visit.

---

## Change Requests

### GET /change-requests
List change requests.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| submissionId | string | Filter by submission |
| type | string | Filter by type (deadline, site_visit) |
| status | string | Filter by status (pending, approved, denied) |

**Response:**
```json
{
  "changeRequests": [
    {
      "id": "cr_001",
      "submissionId": "sub_001",
      "institutionName": "State University",
      "requestedBy": {
        "id": "user_123",
        "name": "John Doe",
        "role": "program_coordinator"
      },
      "type": "deadline",
      "currentValue": "2024-12-15",
      "requestedValue": "2025-02-15",
      "reason": "Additional time needed to complete curriculum revisions.",
      "status": "pending",
      "approvals": {
        "admin": null,
        "leadReader": null
      },
      "createdAt": "2024-06-10T10:30:00Z"
    }
  ]
}
```

### POST /change-requests
Create a change request (Program Coordinator).

**Request Body:**
```json
{
  "submissionId": "sub_001",
  "type": "deadline",
  "requestedValue": "2025-02-15",
  "reason": "Additional time needed for curriculum revisions."
}
```

### POST /change-requests/:id/approve
Approve a change request (Admin or Lead Reader).

**Request Body:**
```json
{
  "comments": "Approved as requested."
}
```

### POST /change-requests/:id/deny
Deny a change request.

**Request Body:**
```json
{
  "reason": "Cannot extend deadline beyond the accreditation cycle."
}
```

---

## Reports

### GET /reports/reader/:reviewId/pdf
Generate reader report PDF.

### GET /reports/reader/:reviewId/preview
Preview reader report data.

### GET /reports/submission/:submissionId/all-readers/pdf
Generate combined reader reports PDF.

### GET /reports/compilation/:compilationId/pdf
Generate lead reader compilation report PDF.

---

## Admin Settings

### GET /admin/webhook-settings
Get N8N webhook configuration.

**Response:**
```json
{
  "settingType": "n8n_validation",
  "webhookUrl": "https://n8n.example.com/webhook/abc123",
  "isActive": true,
  "authentication": {
    "type": "api_key",
    "apiKey": "********************xyz9"
  },
  "callbackUrl": "https://api.cshse-accreditation.org/api/webhooks/n8n/callback",
  "retryConfig": {
    "maxRetries": 3,
    "retryDelayMs": 1000,
    "backoffMultiplier": 2
  }
}
```

### PUT /admin/webhook-settings
Update webhook settings.

### POST /admin/webhook-test
Test webhook connection.

### GET /admin/stats
Get system statistics.

**Response:**
```json
{
  "submissions": { "total": 45, "active": 12 },
  "users": 156,
  "reviews": 89,
  "validations": 1234,
  "webhook": { "configured": true, "active": true },
  "serverTime": "2024-06-10T10:30:00Z"
}
```

---

## N8N Webhook Integration

### Outbound: Validation Request

When a section is saved (manual save), the system sends a validation request to the configured N8N webhook.

**Endpoint:** Configured N8N Webhook URL (e.g., `https://n8n.example.com/webhook/validate`)

**Method:** POST

**Headers:**
```
Content-Type: application/json
X-API-Key: <configured_api_key>
```

**Request Payload:**
```json
{
  "executionId": "exec_789",
  "submissionId": "sub_001",
  "institutionName": "State University",
  "programName": "Human Services",
  "programLevel": "bachelors",
  "standardCode": "11",
  "specCode": "a",
  "standardText": "The curriculum shall provide content in...",
  "narrativeText": "<p>The program provides comprehensive coverage of...</p>",
  "plainText": "The program provides comprehensive coverage of...",
  "validationType": "manual_save",
  "supportingEvidence": [
    {
      "type": "document",
      "filename": "syllabus_hus201.pdf",
      "description": "Course syllabus"
    },
    {
      "type": "url",
      "url": "https://university.edu/catalog",
      "title": "Course Catalog"
    }
  ],
  "curriculumMatrix": {
    "coursesWithAssessment": ["HUS 201", "HUS 305", "HUS 401"],
    "assessmentTypes": ["K", "S"],
    "assessmentDepths": ["M", "H"]
  },
  "callbackUrl": "https://api.cshse-accreditation.org/api/webhooks/n8n/callback",
  "timestamp": "2024-06-10T10:30:00Z"
}
```

### Inbound: Validation Callback

N8N sends validation results back to the system via the callback URL.

**Endpoint:** `POST /api/webhooks/n8n/callback`

**Headers:**
```
Content-Type: application/json
X-API-Key: <callback_api_key>
```

**Request Payload:**
```json
{
  "executionId": "exec_789",
  "submissionId": "sub_001",
  "standardCode": "11",
  "specCode": "a",
  "result": {
    "status": "pass",
    "score": 85,
    "feedback": "The narrative adequately addresses the standard requirement. The program demonstrates a clear commitment to providing comprehensive content coverage.",
    "suggestions": [
      "Consider adding specific assessment methods for each course.",
      "Include more detail about how fieldwork experiences reinforce classroom learning."
    ],
    "missingElements": [],
    "strengths": [
      "Clear articulation of curriculum objectives",
      "Well-documented course sequence"
    ],
    "areasForImprovement": [
      "Additional evidence of student learning outcomes would strengthen this section"
    ]
  },
  "processingTime": 2500,
  "modelUsed": "claude-3-opus",
  "timestamp": "2024-06-10T10:30:02Z"
}
```

**Response:**
```json
{
  "received": true,
  "validationResultId": "vr_123",
  "message": "Validation result recorded successfully"
}
```

### Webhook Authentication Options

#### Option 1: API Key Header
```
X-API-Key: your_api_key_here
```

#### Option 2: Bearer Token
```
Authorization: Bearer your_token_here
```

### N8N Workflow Example

```
Webhook Trigger
    ↓
Extract Data (Set Node)
    ↓
AI Analysis (Claude/OpenAI Node)
    ↓
Format Response (Code Node)
    ↓
HTTP Request to Callback URL
```

---

## API Keys

### GET /admin/api-keys
List all API keys (Admin only).

**Response:**
```json
{
  "apiKeys": [
    {
      "id": "key_001",
      "name": "N8N Webhook Key",
      "keyPrefix": "cshse_",
      "keyMasked": "cshse_****************************abc1",
      "purpose": "webhook_callback",
      "permissions": ["webhook:callback"],
      "lastUsed": "2024-06-10T09:45:00Z",
      "expiresAt": "2025-06-10T00:00:00Z",
      "isActive": true,
      "createdAt": "2024-06-01T10:30:00Z",
      "createdBy": "user_admin"
    }
  ]
}
```

### POST /admin/api-keys
Generate a new API key.

**Request Body:**
```json
{
  "name": "N8N Callback Key",
  "purpose": "webhook_callback",
  "permissions": ["webhook:callback"],
  "expiresInDays": 365
}
```

**Response:**
```json
{
  "message": "API key created successfully",
  "apiKey": {
    "id": "key_002",
    "name": "N8N Callback Key",
    "key": "cshse_live_abc123def456ghi789jkl012mno345",
    "keyMasked": "cshse_****************************o345",
    "purpose": "webhook_callback",
    "permissions": ["webhook:callback"],
    "expiresAt": "2025-06-10T00:00:00Z"
  },
  "warning": "Store this API key securely. It will not be shown again."
}
```

### DELETE /admin/api-keys/:id
Revoke an API key.

### POST /admin/api-keys/:id/rotate
Rotate an API key (generates new key, invalidates old).

---

## Error Responses

All endpoints return errors in a consistent format:

```json
{
  "error": "Error type or code",
  "message": "Human-readable error message",
  "details": {
    "field": "Additional context about the error"
  }
}
```

### Common HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Missing or invalid token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found |
| 409 | Conflict - Resource already exists or is locked |
| 422 | Unprocessable Entity - Validation failed |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

---

## Rate Limiting

API requests are rate-limited to ensure fair usage:

| Endpoint Type | Limit |
|---------------|-------|
| Authentication | 10 requests/minute |
| Standard API | 100 requests/minute |
| File Upload | 20 requests/minute |
| Webhook Callback | 1000 requests/minute |

Rate limit headers are included in all responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1623456789
```

---

## Versioning

The API uses URL versioning. The current version is v1:

```
https://api.cshse-accreditation.org/api/v1/...
```

Breaking changes will be introduced in new versions (v2, etc.) with appropriate migration periods.

---

## SDKs and Code Examples

### JavaScript/TypeScript

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://api.cshse-accreditation.org/api',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

// Get submissions
const { data } = await api.get('/submissions', {
  params: { status: 'under_review' }
});

// Create comment
await api.post(`/submissions/${submissionId}/comments`, {
  standardCode: '11',
  specCode: 'a',
  selectedText: 'curriculum',
  selectionStart: 45,
  selectionEnd: 55,
  content: 'Please clarify this section.'
});
```

### cURL

```bash
# Get submissions
curl -X GET "https://api.cshse-accreditation.org/api/submissions" \
  -H "Authorization: Bearer your_token_here"

# Webhook callback
curl -X POST "https://api.cshse-accreditation.org/api/webhooks/n8n/callback" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key_here" \
  -d '{
    "executionId": "exec_789",
    "submissionId": "sub_001",
    "standardCode": "11",
    "specCode": "a",
    "result": {
      "status": "pass",
      "score": 85,
      "feedback": "Well documented."
    }
  }'
```
