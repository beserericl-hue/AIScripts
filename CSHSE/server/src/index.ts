import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDatabase } from './config/database';
import {
  globalErrorHandler,
  notFoundHandler,
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

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

// 404 handler - must be before error handler
app.use(notFoundHandler);

// Global error handler - must be last middleware
// Logs errors with full context for debugging while only showing
// safe messages to users
app.use(globalErrorHandler);

// Start server
const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase();

    // Initialize superuser account if configured via environment variables
    await initializeSuperuser();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
