import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDatabase } from './config/database';

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

// Load environment variables
dotenv.config();

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

// TODO: Add remaining routes
// app.use('/api/auth', authRouter);
// app.use('/api/standards', standardsRouter);

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase();

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
