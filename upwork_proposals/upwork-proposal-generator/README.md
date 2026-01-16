# Upwork Proposal Generator

A full-stack web application for generating professional proposals for Upwork job opportunities. Integrates with N8N workflows for AI-powered proposal generation and supports multi-tenant teams with role-based access control.

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![MongoDB](https://img.shields.io/badge/MongoDB-9.1-47A248?logo=mongodb&logoColor=white)
![Express](https://img.shields.io/badge/Express-5.2-000000?logo=express&logoColor=white)

## Features

- **AI-Powered Proposals**: Generate professional cover letters using N8N workflows
- **Multi-Tenant Teams**: Organize users into teams with isolated data
- **Role-Based Access**: Administrator and user roles with different permissions
- **Google OAuth**: Quick sign-in with Google accounts
- **Email Verification**: Secure registration with 6-digit verification codes
- **Profile Management**: Create and manage multiple freelancer profiles
- **Job Management**: Track job status (pending, applied, rejected)
- **Mermaid Diagrams**: Auto-generated project diagrams for proposals
- **API Integration**: Webhook support for N8N automation
- **Mobile Responsive**: Works on all device sizes
- **Single Port Deployment**: Frontend and API served from port 8080

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [Installation](#installation)
- [Configuration](#configuration)
- [User Guide](#user-guide)
- [API Documentation](#api-documentation)
- [Deployment](#deployment)
- [Development](#development)
- [Troubleshooting](#troubleshooting)

## Quick Start

```bash
# Clone the repository
git clone https://github.com/your-repo/upwork-proposal-generator.git
cd upwork-proposal-generator

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm run dev
```

Visit `http://localhost:5173` for the frontend and `http://localhost:8080` for the API.

## Architecture

```mermaid
flowchart TB
    subgraph Client["Client (Browser)"]
        React["React 19 + Vite"]
    end

    subgraph Server["Express Server"]
        API["REST API"]
        Auth["JWT + API Key Auth"]
    end

    subgraph Database["MongoDB"]
        Collections["Users, Jobs, Profiles, Teams"]
    end

    subgraph External["External Services"]
        N8N["N8N Workflows"]
        Google["Google OAuth"]
        SMTP["Email (SMTP)"]
    end

    Client -->|HTTPS| Server
    Server --> Database
    Server <-->|Webhooks| N8N
    Server -->|OAuth| Google
    Server -->|Verification| SMTP
```

For detailed architecture documentation, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

### Diagrams

Additional Mermaid diagrams are available in [docs/diagrams/](docs/diagrams/):
- `architecture.mmd` - System architecture overview
- `data-flow.mmd` - Proposal generation sequence diagram
- `auth-flow.mmd` - Authentication flows
- `database-schema.mmd` - Entity relationship diagram

## Installation

### Prerequisites

- Node.js 18 or higher
- MongoDB 6.0 or higher
- npm or yarn

### Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up MongoDB:**
   - Local: Install MongoDB and start the service
   - Cloud: Create a MongoDB Atlas cluster

3. **Configure environment:**
   ```bash
   # Create .env file
   PORT=8080
   MONGODB_URI=mongodb://localhost:27017/upwork_proposals
   JWT_SECRET=your-secret-key-here
   NODE_ENV=development
   ```

4. **Start the application:**
   ```bash
   # Development mode (frontend + backend)
   npm run dev

   # Or separately:
   npm run dev:client  # Frontend on port 5173
   npm run dev:server  # Backend on port 8080
   ```

### Docker Deployment

```bash
# Build the image
docker build -t upwork-proposal-generator .

# Run the container
docker run -p 8080:8080 \
  -e MONGODB_URI=mongodb://host.docker.internal:27017/upwork_proposals \
  -e JWT_SECRET=your-secret-key \
  upwork-proposal-generator
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | 8080 | Server port |
| `MONGODB_URI` | Yes | - | MongoDB connection string |
| `JWT_SECRET` | Yes | - | Secret for signing JWT tokens |
| `NODE_ENV` | No | development | Environment mode |
| `CORS_ORIGIN` | No | * | Allowed CORS origins |
| `VITE_GOOGLE_CLIENT_ID` | No | - | Google OAuth client ID |
| `SMTP_HOST` | No | smtp.gmail.com | SMTP server host |
| `SMTP_PORT` | No | 587 | SMTP server port |
| `SMTP_USER` | No | - | SMTP username |
| `SMTP_PASS` | No | - | SMTP password (app password for Gmail) |
| `SMTP_FROM` | No | - | From email address |

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Navigate to **APIs & Services** > **Credentials**
4. Create **OAuth 2.0 Client ID** (Web application)
5. Add authorized JavaScript origins:
   - `http://localhost:5173` (development)
   - `https://your-domain.com` (production)
6. Add authorized redirect URIs:
   - `http://localhost:5173`
   - `https://your-domain.com`
   - `https://your-domain.com/login`
7. Copy the Client ID to `VITE_GOOGLE_CLIENT_ID`

### Email Verification Setup (Gmail)

1. Enable 2-Step Verification on your Google account
2. Go to [App Passwords](https://myaccount.google.com/apppasswords)
3. Generate an app password for "Mail"
4. Use the 16-character password as `SMTP_PASS`

## User Guide

### First-Time Setup

1. **Register the Admin Account:**
   - Navigate to the login page
   - Click "Sign up"
   - Enter your email and click "Verify Email"
   - Check your email for the 6-digit code
   - Enter the code and complete registration
   - The first user automatically becomes an administrator

2. **Configure Settings:**
   - Go to Settings (gear icon)
   - Set up N8N webhook URLs
   - Generate API keys for N8N integration
   - Configure teams if using multi-tenant mode

### Creating Teams

1. Go to **Settings** > **Teams**
2. Enter team name and description
3. Click **Create Team**
4. Assign users to the team using the member management section

### Managing Profiles

Profiles contain your freelancer information used in proposal generation.

1. Go to the **Proposal** page
2. In the Profile dropdown, select "Create new profile"
3. Enter a name and your profile content (skills, experience, etc.)
4. Click **Save Profile**

**Profile Tips:**
- Include relevant skills and technologies
- Mention years of experience
- Add notable projects or achievements
- Keep content under 4000 characters

### Generating Proposals

1. **From Home Page:**
   - Select a pending job from the dropdown
   - Review job details (title, description, client rating)
   - Click "View Proposal" to open the Proposal page

2. **From Proposal Page:**
   - Fill in job details (title, description, URL)
   - Select a team member and profile
   - Click **Generate Proposal**
   - Wait for AI to process (polling every 5 seconds)
   - View results: cover letter, Word document, Mermaid diagram

3. **Using Generated Content:**
   - Copy the cover letter to Upwork
   - Open the Word document for detailed proposal
   - Use the Mermaid diagram to visualize project approach

### Managing Jobs

| Status | Description | Actions |
|--------|-------------|---------|
| Pending | New job awaiting proposal | Generate proposal, Reject |
| Proposal Generated | AI has created a proposal | View, Apply, Reject |
| Applied | User has applied to the job | View history |
| Rejected | User rejected the job | View history |

### Admin Functions

Administrators have access to additional features:

- **User Management:** Create users, change roles, delete users
- **Team Management:** Create/delete teams, assign members
- **API Keys:** Generate and manage API keys for N8N
- **Settings:** Configure webhook URLs and database settings

## API Documentation

### Authentication

All protected endpoints require one of:
- **JWT Token:** In cookie or `Authorization: Bearer <token>` header
- **API Key:** In `X-API-Key` header (webhooks only)

### Endpoints

#### Authentication (`/api/auth`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | /send-verification | Send 6-digit email code | None |
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

#### Jobs (`/api/jobs`)
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

#### Proposals (`/api/proposals`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | /generate | Trigger N8N workflow | JWT |
| GET | /:jobId | Get proposal data | JWT |

#### Webhooks (`/api/webhooks`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | /evaluation | Store job evaluation | API Key |
| POST | /proposal-result | Store generated proposal | API Key |
| GET | /health | Health check | None |

#### Settings (`/api/settings`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | / | Get settings | JWT |
| PUT | / | Update settings | JWT |

#### API Keys (`/api/api-keys`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | / | List keys | JWT |
| POST | / | Generate key | JWT |
| PATCH | /:id/toggle | Toggle active | JWT |
| DELETE | /:id | Delete key | JWT |

#### Teams (`/api/teams`)
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

#### Profiles (`/api/profiles`)
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | /user/:userId | Get user profiles | JWT |
| GET | /my | Get my profiles | JWT |
| GET | /:id | Get profile | JWT |
| POST | / | Create profile | JWT |
| PUT | /:id | Update profile | JWT |
| POST | /:id/set-active | Set active | JWT |
| DELETE | /:id | Delete profile | JWT |

### N8N Integration

#### Webhook Headers
Include the API key in headers:
```
X-API-Key: your-api-key
```

#### Evaluation Webhook Payload
```json
{
  "jobId": "unique-job-id",
  "title": "Job Title",
  "description": "Job description",
  "url": "https://upwork.com/jobs/...",
  "rating": 4,
  "evaluationData": { ... }
}
```

#### Proposal Result Webhook Payload
```json
{
  "jobId": "unique-job-id",
  "coverLetter": "Generated cover letter...",
  "docUrl": "https://docs.google.com/...",
  "mermaidDiagram": "graph TD; ...",
  "mermaidImageUrl": "https://..."
}
```

## Deployment

### Railway

1. Connect your GitHub repository to Railway
2. Add MongoDB service to the project (same project for internal networking)
3. Set environment variables:
   ```
   MONGODB_URI=mongodb://... (use Railway's reference syntax)
   JWT_SECRET=your-secret-key
   NODE_ENV=production
   VITE_GOOGLE_CLIENT_ID=your-client-id
   ```
4. Deploy automatically on push

### Docker Compose

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - MONGODB_URI=mongodb://mongo:27017/upwork_proposals
      - JWT_SECRET=your-secret-key
      - NODE_ENV=production
    depends_on:
      - mongo

  mongo:
    image: mongo:6
    volumes:
      - mongo_data:/data/db
    ports:
      - "27017:27017"

volumes:
  mongo_data:
```

## Development

### Project Structure

```
├── src/                    # React frontend
│   ├── components/         # Reusable components
│   │   ├── Navbar.jsx     # Navigation with mobile menu
│   │   └── ProtectedRoute.jsx # Route guard
│   ├── context/            # React context
│   │   └── AuthContext.jsx # Authentication state
│   ├── pages/              # Page components
│   │   ├── Home.jsx       # Job listing
│   │   ├── Login.jsx      # Authentication
│   │   ├── Proposal.jsx   # Proposal generation
│   │   └── Settings.jsx   # Admin settings
│   ├── services/           # API client
│   │   └── api.js         # Axios configuration
│   └── styles/             # CSS styles
│       └── index.css      # Global styles
├── server/                 # Express backend
│   ├── models/             # Mongoose schemas
│   │   ├── User.js        # User with auth
│   │   ├── Job.js         # Jobs/proposals
│   │   ├── Profile.js     # User profiles
│   │   ├── Team.js        # Team grouping
│   │   ├── ApiKey.js      # API keys
│   │   └── Settings.js    # User settings
│   ├── routes/             # API routes
│   ├── middleware/         # Auth middleware
│   │   └── auth.js        # JWT & API key auth
│   └── index.js            # Server entry
├── docs/                   # Documentation
│   ├── ARCHITECTURE.md    # System architecture
│   └── diagrams/          # Mermaid diagrams
└── public/                 # Static assets
```

### Scripts

```bash
npm run dev          # Start both frontend and backend
npm run dev:client   # Start frontend only (port 5173)
npm run dev:server   # Start backend only (port 8080)
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

### Technology Stack

**Frontend:**
- React 19.2 with Vite 7.2
- React Router 7.12
- TanStack React Query 5.90
- Axios 1.13
- Lucide React icons
- @react-oauth/google

**Backend:**
- Express 5.2
- Mongoose 9.1
- JWT (jsonwebtoken 9.0)
- bcryptjs 3.0
- Nodemailer 6.10

## Troubleshooting

### Common Issues

#### MongoDB Connection Fails
```
Error: getaddrinfo ENOTFOUND mongodb.railway.internal
```
**Solution:**
- Ensure MongoDB is in the same Railway project
- Check `MONGODB_URI` format: `mongodb://user:pass@host:port/database`
- For Railway, use internal hostname: `mongodb.railway.internal`

#### Google OAuth Shows Wrong App Name
**Solution:**
- Go to Google Cloud Console > APIs & Services > OAuth consent screen
- Change the "App name" field (this is project-wide)

#### Email Verification Fails
```
Error: Failed to send verification email
```
**Solution:**
- Verify SMTP credentials
- For Gmail, use an App Password (not regular password)
- Ensure 2-Step Verification is enabled
- Check SMTP_HOST and SMTP_PORT settings

#### "next is not a function" Error
```
TypeError: next is not a function at model.<anonymous>
```
**Solution:**
- This is a Mongoose 7+ issue with async pre-save hooks
- Remove `next` parameter from async hooks (already fixed in codebase)

#### Express 5 Wildcard Route Error
```
PathError: Missing parameter name at index 1: *
```
**Solution:**
- Express 5 changed wildcard syntax
- Use middleware instead: `app.use((req, res, next) => ...)`

### Health Check

Check application health:
```bash
curl https://your-domain/api/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "mongodb": "connected"
}
```

### Logs

View Railway logs:
```bash
railway logs
```

View Docker logs:
```bash
docker logs <container-id>
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -m 'Add my feature'`
4. Push to branch: `git push origin feature/my-feature`
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

For issues and feature requests, please [open an issue](https://github.com/your-repo/upwork-proposal-generator/issues).
