// CSHSE Self-Study Portal Server
import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { connectDatabase } from './config/database';
import {
  globalErrorHandler,
  setupProcessErrorHandlers
} from './middleware/errorHandler';
import { initializeSuperuser } from './services/superuserInit';

// Import routes
import importsRouter from './routes/imports';
import webhooksRouter from './routes/webhooks';
import reviewsRouter from './routes/reviews';
import leadReviewsRouter from './routes/leadReviews';
import reportsRouter from './routes/reports';
import matrixRouter from './routes/matrix';
import evidenceRouter from './routes/evidence';
import submissionsRouter from './routes/submissions';
import adminRouter from './routes/admin';
import commentsRouter from './routes/comments';
import readerLockRouter from './routes/readerLock';
import authRouter from './routes/auth';
import usersRouter from './routes/users';
import institutionsRouter from './routes/institutions';
import apiKeysRouter from './routes/apiKeys';
import siteVisitsRouter from './routes/siteVisits';
import changeRequestsRouter from './routes/changeRequests';
import errorLogsRouter from './routes/errorLogs';
import invitationsRouter from './routes/invitations';
import specsRouter from './routes/specs';
import filesRouter from './routes/files';

// Load environment variables
dotenv.config();

// Setup process-level error handlers for uncaught exceptions/rejections
setupProcessErrorHandlers();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Track database connection status for health checks
let dbConnected = false;
let dbError: string | null = null;

// Liveness check - always returns 200 if server is running
// Used by container orchestrators (Docker/Railway) to verify process is alive
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Readiness check - returns 200 only if all dependencies are ready
// Use this to check if the server can handle requests
app.get('/ready', (_req, res) => {
  if (dbConnected) {
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } else {
    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      ...(dbError && { error: dbError })
    });
  }
});

// API Routes
app.use('/api/imports', importsRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/reviews', reviewsRouter);
app.use('/api/lead-reviews', leadReviewsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api', matrixRouter);
app.use('/api', evidenceRouter);
app.use('/api/submissions', submissionsRouter);
app.use('/api/admin', adminRouter);
app.use('/api', commentsRouter);
app.use('/api', readerLockRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/institutions', institutionsRouter);
app.use('/api/admin/api-keys', apiKeysRouter);
app.use('/api/site-visits', siteVisitsRouter);
app.use('/api/change-requests', changeRequestsRouter);
app.use('/api/admin/error-logs', errorLogsRouter);
app.use('/api/invitations', invitationsRouter);
app.use('/api/specs', specsRouter);
app.use('/api/files', filesRouter);

// Serve static files from React app build
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

// SPA catch-all: serve index.html for any non-API routes
// This enables client-side routing in React
app.get('*', (req, res, next) => {
  // Skip API routes - they should 404 if not matched above
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  // Serve React app for all other routes
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Global error handler - must be last middleware
// Logs errors with full context for debugging while only showing
// safe messages to users
app.use(globalErrorHandler);

// Start server
const startServer = async () => {
  // Start HTTP server immediately so healthchecks work
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });

  // Connect to database in background
  try {
    await connectDatabase();
    dbConnected = true;
    console.log('Database connected successfully');

    // Initialize superuser account if configured via environment variables
    await initializeSuperuser();
  } catch (error) {
    dbError = error instanceof Error ? error.message : 'Unknown database error';
    console.error('Database connection failed:', dbError);
    // Don't exit - keep server running for healthchecks to report degraded status
  }
};

startServer();

export default app;
