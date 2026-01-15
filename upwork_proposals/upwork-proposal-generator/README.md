# Upwork Proposal Generator

A professional web application for generating and managing Upwork proposals for recommended leads. Built with React + Vite (frontend) and Express + MongoDB (backend), served from a single port.

## Features

- **Authentication**: Email/password and Google OAuth login
- **Role-based Access**: Administrator and user roles
- **Job Management**: View, review, and reject pending job proposals
- **Proposal Generation**: Create proposals with N8N webhook integration
- **Settings Management**: Configure webhooks, API keys, and database connections
- **API Key Management**: Generate and manage API keys for webhook callbacks
- **Mobile Responsive**: Works on all device sizes
- **Single Port Deployment**: Frontend and API served from port 8080

## Prerequisites

- Node.js 18+
- MongoDB (local or cloud instance)
- N8N instance (for workflow automation)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd upwork-proposal-generator
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Configure your `.env` file:
```env
PORT=8080
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/upwork_proposals
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

## Running the Application

### Development Mode

Build frontend and run server:
```bash
npm run build
npm start
```

Or for development with hot reload (runs on two ports during dev):
```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

The application runs on **port 8080** with:
- Frontend served at `/`
- API endpoints at `/api/*`

## Docker Deployment

Build and run with Docker:
```bash
docker build -t upwork-proposal-generator .
docker run -p 8080:8080 -e MONGODB_URI=your-mongo-uri -e JWT_SECRET=your-secret upwork-proposal-generator
```

## Railway Deployment

1. Connect your GitHub repository to Railway
2. Set environment variables in Railway dashboard:
   - `MONGODB_URI` - Your MongoDB connection string
   - `JWT_SECRET` - A secure random string
3. Railway will automatically build and deploy using the Dockerfile

Required Railway environment variables:
- `MONGODB_URI` (required)
- `JWT_SECRET` (required)
- `NODE_ENV=production` (optional, defaults to production)

## Project Structure

```
upwork-proposal-generator/
├── public/              # Static assets
├── server/              # Express backend
│   ├── middleware/      # Auth middleware
│   ├── models/          # Mongoose models
│   └── routes/          # API routes
├── src/                 # React frontend
│   ├── components/      # Reusable components
│   ├── context/         # React context providers
│   ├── pages/           # Page components
│   ├── services/        # API service
│   └── styles/          # CSS styles
├── dist/                # Built frontend (generated)
├── Dockerfile           # Docker configuration
├── railway.toml         # Railway configuration
└── package.json
```

## API Endpoints

All API endpoints are prefixed with `/api`:

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/google` - Google OAuth login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user
- `GET /api/auth/users` - Get all users (admin only)

### Jobs
- `GET /api/jobs` - Get all jobs
- `GET /api/jobs/pending` - Get pending jobs
- `GET /api/jobs/:id` - Get job by ID
- `POST /api/jobs` - Create new job
- `PATCH /api/jobs/:id` - Update job
- `POST /api/jobs/:id/reject` - Reject job

### Proposals
- `POST /api/proposals/generate` - Generate proposal (calls N8N webhook)
- `GET /api/proposals/:jobId` - Get proposal data

### Webhooks (N8N Callbacks)
- `POST /api/webhooks/evaluation` - Receive job evaluation data
- `POST /api/webhooks/proposal-result` - Receive generated proposal

### Settings
- `GET /api/settings` - Get user settings
- `PUT /api/settings` - Update settings

### API Keys
- `GET /api/api-keys` - Get all API keys
- `POST /api/api-keys` - Generate new API key
- `PATCH /api/api-keys/:id/toggle` - Toggle API key status
- `DELETE /api/api-keys/:id` - Delete API key

### Health Check
- `GET /api/health` - Server health status

## N8N Integration

### Webhook Headers
When calling webhooks from N8N, include the API key in headers:
```
X-API-Key: your-api-key
```

### Evaluation Webhook Payload
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

### Proposal Result Webhook Payload
```json
{
  "jobId": "unique-job-id",
  "coverLetter": "Generated cover letter...",
  "docUrl": "https://docs.google.com/...",
  "mermaidDiagram": "graph TD; ...",
  "mermaidImageUrl": "https://..."
}
```

## First User Setup

The first user to register will automatically be assigned the "administrator" role. Subsequent users can only be created by administrators.

## License

MIT
