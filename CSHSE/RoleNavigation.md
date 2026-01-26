# CSHSE Self-Study Portal - Role Navigation Guide

This document describes all screens in the application, navigation paths, and role-based access for the CSHSE Self-Study Portal.

---

## Table of Contents

1. [User Roles Overview](#user-roles-overview)
2. [Navigation from Home Page](#navigation-from-home-page)
3. [Screen Access by Role](#screen-access-by-role)
4. [Self-Study Editor Navigation](#self-study-editor-navigation)
5. [Reader and Lead Reader Screens](#reader-and-lead-reader-screens)
6. [Administrator Screens](#administrator-screens)
7. [Complete Route Reference](#complete-route-reference)

---

## User Roles Overview

The application supports four user roles with different access levels:

| Role | Description | Primary Purpose |
|------|-------------|-----------------|
| **Program Coordinator** | Institution staff responsible for self-study | Edit and submit self-study documents |
| **Reader** | External reviewer assigned to submissions | Review and assess self-study content |
| **Lead Reader** | Senior reviewer managing compilation | Compile reader assessments, resolve disagreements |
| **Admin** | System administrator | Manage users, institutions, and system settings |

### Permissions Matrix

| Permission | Program Coordinator | Reader | Lead Reader | Admin |
|------------|:------------------:|:------:|:-----------:|:-----:|
| Edit Self-Study | Yes | No | No | Yes |
| View Self-Study | Own only | Assigned | Assigned | All |
| Add Comments | No | Yes | Yes | Yes |
| Review Submissions | No | Yes | Yes | Yes |
| Compile Reviews | No | No | Yes | Yes |
| Assign Readers | No | No | Yes | Yes |
| Approve Changes | No | No | Yes | Yes |
| Manage Users | No | No | No | Yes |
| Manage Institutions | No | No | No | Yes |
| System Settings | No | No | No | Yes |

---

## Navigation from Home Page

### Header Navigation Bar

After logging in, all users see a navigation header with these elements:

```
[CSHSE Logo] Self-Study Portal    [Home] [Self-Study] [Settings*]    [User Name] [Role Badge] [Logout]
```

*Settings is only visible to Admin users

### Navigation Links

| Link | Route | Available To | Description |
|------|-------|--------------|-------------|
| **Home** | `/dashboard` | All authenticated users | Main dashboard with statistics and activity |
| **Self-Study** | `/self-study` | All authenticated users | Self-study document viewer/editor |
| **Settings** | `/admin` | Admin only | System administration |

### Role-Specific Home Page Content

**Program Coordinator Dashboard:**
- View their institution's submission status
- See upcoming deadlines for their submission
- View site visit schedules
- See submitted change requests

**Reader Dashboard:**
- View assigned submissions for review
- See review deadlines
- Track assessment progress

**Lead Reader Dashboard:**
- View all institutions in their oversight
- Pending change requests requiring approval
- Site visit schedules for their submissions
- Compilation status

**Admin Dashboard:**
- Complete overview of all institutions
- All pending change requests
- All upcoming site visits
- System-wide statistics

---

## Screen Access by Role

### Program Coordinator

| Screen | Access | Navigation Path |
|--------|--------|-----------------|
| Dashboard | Full Access | Home → `/dashboard` |
| Self-Study Editor | Edit own submission | Home → Self-Study → Select submission |
| Evidence Manager | Full Access | Self-Study → Evidence tab |
| Curriculum Matrix | Full Access | Self-Study → Matrix tab |
| View Comments | Read Only | Self-Study → Comments panel |
| Admin Settings | **NO ACCESS** | N/A |

**How to Access Self-Study Editor:**
1. Click **Self-Study** in the navigation bar
2. Select your institution's submission from the list
3. Navigate to: `/self-study/{submissionId}`

**Key Features Available:**
- Edit narrative content for each standard
- Upload supporting evidence
- Submit standards for validation
- Revalidate failed sections
- View reader comments (read-only)

### Reader

| Screen | Access | Navigation Path |
|--------|--------|-----------------|
| Dashboard | Limited (assigned only) | Home → `/dashboard` |
| Self-Study Viewer | View assigned submissions | Home → Self-Study → Select submission |
| Review Interface | Full Access | Self-Study → Review tab |
| Comments | Add/View | Self-Study → Comments panel |
| Lead Reader Tools | **NO ACCESS** | N/A |
| Admin Settings | **NO ACCESS** | N/A |

**How to Access Review Interface:**
1. From Dashboard, view your assigned submissions
2. Click on a submission to open it
3. Navigate to: `/self-study/{submissionId}`
4. Use the Review panel on the right side

**Key Features Available:**
- View self-study narrative content
- Mark specifications as compliant/non-compliant
- Add assessment comments
- Flag items for lead reader attention
- Save final assessment with strengths/weaknesses

### Lead Reader

| Screen | Access | Navigation Path |
|--------|--------|-----------------|
| Dashboard | Full Access | Home → `/dashboard` |
| Self-Study Viewer | View all assigned | Home → Self-Study → Select submission |
| Review Interface | View all readers | Self-Study → Reviews tab |
| Compilation Tools | Full Access | Self-Study → Compilation tab |
| Change Request Approval | Full Access | Dashboard → Change Requests panel |
| Admin Settings | **NO ACCESS** | N/A |

**How to Access Compilation Tools:**
1. Click **Self-Study** in the navigation bar
2. Select a submission with completed reader reviews
3. Navigate to: `/self-study/{submissionId}`
4. Click **Compilation** tab

**Key Features Available:**
- View side-by-side reader assessments
- Identify and resolve disagreements
- Set final determinations
- Approve/deny change requests
- Assign readers to submissions
- Export compilation report

### Admin (Administrator)

| Screen | Access | Navigation Path |
|--------|--------|-----------------|
| Dashboard | Full System Access | Home → `/dashboard` |
| Self-Study Viewer/Editor | Full Access | Home → Self-Study |
| All Reader/Lead Reader Tools | Full Access | Self-Study → All tabs |
| Admin Settings | Full Access | Settings → `/admin` |
| User Management | Full Access | Settings → Users tab |
| Institution Management | Full Access | Settings → Institutions tab |
| Webhook Configuration | Full Access | Settings → N8N Webhook tab |
| API Key Management | Full Access | Settings → API Keys tab |

**How to Access Admin Settings:**
1. Click **Settings** in the navigation bar (only visible to admins)
2. Navigate to: `/admin`
3. Select from tabs: N8N Webhook, API Keys, Users, Institutions

---

## Self-Study Editor Navigation

### Getting to the Self-Study Editor

**Path:** Home → Self-Study → Select Submission

**URL:** `/self-study/{submissionId}`

### Self-Study Editor Layout

```
+------------------------------------------------------------------+
|  [Standards Navigation]  |  [Content Area]  |  [Sidebar Panel]   |
|                          |                  |                    |
|  Standard 1              |  Narrative       |  Validation        |
|  Standard 2              |  Editor          |  Status            |
|  Standard 3              |  (TipTap)        |                    |
|  ...                     |                  |  Comments          |
|  Standard 21             |                  |                    |
|                          |                  |  Evidence          |
+------------------------------------------------------------------+
```

### Standards Navigation Sidebar

The left panel shows all 21 CSHSE standards with progress indicators:

| Status | Indicator | Meaning |
|--------|-----------|---------|
| Not Started | Gray circle | No content entered |
| In Progress | Yellow circle | Content being edited |
| Complete | Blue circle | Ready for submission |
| Submitted | Orange circle | Sent for validation |
| Validated | Green checkmark | Passed validation |
| Failed | Red X | Failed validation (needs revision) |

### Content Editing Tabs

| Tab | Purpose | Available To |
|-----|---------|--------------|
| **Narrative** | Edit self-study text | Program Coordinator, Admin |
| **Evidence** | Upload supporting documents | Program Coordinator, Admin |
| **Matrix** | Curriculum mapping grid | Program Coordinator, Admin |
| **Reviews** | View reader assessments | Lead Reader, Admin |
| **Compilation** | Final compilation tools | Lead Reader, Admin |

### Self-Study Import Feature

**For Program Coordinators:**

1. Navigate to Self-Study Editor
2. Click **Import** button (top right)
3. Upload file (PDF, DOCX, or PPTX)
4. Review extracted sections
5. Map sections to standards (auto-suggestions provided)
6. Review unmapped content
7. Apply mappings to populate narrative fields

**Import Wizard Steps:**
1. **File Upload** - Drag and drop or select file
2. **Processing** - System extracts content
3. **Content Preview** - Review extracted sections
4. **Mapping Interface** - Map to standards
5. **Unmapped Review** - Handle remaining content
6. **Apply** - Populate self-study fields

---

## Reader and Lead Reader Screens

### Reader Review Interface

**Access:** Self-Study → Select assigned submission → Review panel

**Features:**
- View narrative content for each specification
- Mark compliance status (Compliant / Non-Compliant / Needs Clarification)
- Add assessment notes
- Flag items for lead reader
- Save progress (auto-save enabled)
- Submit final assessment

**Review Workflow:**
1. Open assigned submission from Dashboard
2. Navigate through standards using left sidebar
3. For each specification:
   - Read narrative content
   - Review supporting evidence
   - Select compliance status
   - Add notes if needed
4. Complete final assessment summary
5. Submit review

### Lead Reader Compilation Interface

**Access:** Self-Study → Select submission with completed reviews → Compilation tab

**Features:**
- Side-by-side view of all reader assessments
- Disagreement highlighting (automatic)
- Final determination controls
- Bulk actions for multiple items
- Export to report format

**Compilation Workflow:**
1. View submissions ready for compilation on Dashboard
2. Open submission in Self-Study
3. Click **Compilation** tab
4. Review reader assessments side-by-side
5. Identify disagreements (highlighted in yellow)
6. Set final determination for each specification
7. Add compilation notes
8. Generate final report

### Change Request Approval (Lead Reader)

**Access:** Dashboard → Pending Change Requests panel

**Request Types:**
- Deadline Extension Requests
- Site Visit Reschedule Requests

**Approval Process:**
1. View pending request details
2. Review reason and supporting information
3. Approve or Deny with comments
4. Notification sent to requester

---

## Administrator Screens

### Admin Settings Overview

**Access:** Settings link in header (Admin only)

**URL:** `/admin`

### Settings Tabs

#### 1. N8N Webhook Settings
**Purpose:** Configure AI validation integration

| Setting | Description |
|---------|-------------|
| Webhook URL | N8N workflow endpoint |
| Authentication | API key or Bearer token |
| Callback URL | Return endpoint for results |
| Test Connection | Verify webhook is working |

#### 2. API Keys Management
**Purpose:** Manage API credentials for integrations

| Action | Description |
|--------|-------------|
| Generate Key | Create new API key |
| View Keys | List active keys |
| Revoke Key | Disable an API key |

#### 3. Users Management
**Purpose:** Manage user accounts and access

| Action | Description |
|--------|-------------|
| View Users | List all users with role/status |
| Invite User | Send invitation email |
| Edit Role | Change user role |
| Disable/Enable | Toggle account status |
| Assign to Institution | Link user to institution |

**User Invitation Flow:**
1. Click **Invite User** button
2. Enter email address
3. Select role (Program Coordinator, Reader, Lead Reader, Admin)
4. Select institution (for Program Coordinators)
5. Send invitation
6. User receives email with link to set password

#### 4. Institutions Management
**Purpose:** Manage colleges and universities

| Action | Description |
|--------|-------------|
| Add Institution | Create new institution record |
| Edit Details | Update name, type, contact info |
| Set Deadline | Configure accreditation deadline |
| Assign Coordinator | Link program coordinator |
| Assign Readers | Assign reader team |
| Assign Lead Reader | Set lead reader |

**Institution Setup Checklist:**
- [ ] Add institution name and type
- [ ] Set accreditation deadline
- [ ] Assign program coordinator
- [ ] Assign lead reader
- [ ] Assign readers (typically 2-3)
- [ ] Create initial submission record

---

## Complete Route Reference

### Public Routes (No Authentication Required)

| Route | Page | Purpose |
|-------|------|---------|
| `/login` | Login Page | User authentication |
| `/accept-invitation?token=...` | Invitation Page | New user password setup |

### Protected Routes (Authentication Required)

| Route | Page | Roles |
|-------|------|-------|
| `/` | Redirects to `/dashboard` | All |
| `/dashboard` | Dashboard | All (role-filtered content) |
| `/self-study` | Submission List | All (role-filtered list) |
| `/self-study/:submissionId` | Self-Study Editor | All (role-based features) |
| `/admin` | Admin Settings | Admin only |

### API Endpoints Summary

| Category | Base Path | Purpose |
|----------|-----------|---------|
| Authentication | `/api/auth/*` | Login, logout, token refresh |
| Submissions | `/api/submissions/*` | Self-study CRUD |
| Reviews | `/api/reviews/*` | Reader assessments |
| Lead Reviews | `/api/lead-reviews/*` | Compilation |
| Comments | `/api/submissions/:id/comments/*` | Comment threads |
| Evidence | `/api/evidence/*` | File management |
| Users | `/api/users/*` | User management |
| Institutions | `/api/institutions/*` | Institution directory |
| Admin | `/api/admin/*` | System settings |
| Change Requests | `/api/change-requests/*` | Deadline/visit changes |
| Site Visits | `/api/site-visits/*` | Visit scheduling |

---

## Quick Reference Cards

### Program Coordinator Quick Start
```
1. Login at /login
2. View Dashboard for submission status
3. Click "Self-Study" to open editor
4. Select your institution's submission
5. Edit narrative content for each standard
6. Upload evidence documents
7. Submit standards for validation
8. Fix any failed validations
```

### Reader Quick Start
```
1. Login at /login
2. View Dashboard for assigned submissions
3. Click "Self-Study" to view submission
4. Navigate to each standard
5. Mark compliance status for specifications
6. Add assessment notes
7. Flag items needing attention
8. Submit final assessment
```

### Lead Reader Quick Start
```
1. Login at /login
2. View Dashboard for submissions ready for compilation
3. Click "Self-Study" → Select submission
4. Open "Compilation" tab
5. Review reader assessments
6. Resolve disagreements
7. Set final determinations
8. Approve pending change requests from Dashboard
```

### Admin Quick Start
```
1. Login at /login
2. Access all Dashboard features
3. Click "Settings" for admin panel
4. Manage users: Invite, assign roles, enable/disable
5. Manage institutions: Add, configure, assign teams
6. Configure webhooks for N8N integration
7. Generate API keys for integrations
```

---

*Document Version: 1.0*
*Last Updated: January 2026*
