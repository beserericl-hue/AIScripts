import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import jobRoutes from './routes/jobs.js';
import proposalRoutes from './routes/proposals.js';
import settingsRoutes from './routes/settings.js';
import webhookRoutes from './routes/webhooks.js';
import apiKeyRoutes from './routes/apiKeys.js';
import teamRoutes from './routes/teams.js';
import profileRoutes from './routes/profiles.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// MongoDB connection state
let mongoConnected = false;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/proposals', proposalRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/api-keys', apiKeyRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/profiles', profileRoutes);

// Health check - must be before catch-all route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mongodb: mongoConnected ? 'connected' : 'disconnected'
  });
});

// Serve static files from React build
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// Handle React routing - serve index.html for all non-API routes
app.get('*', (req, res) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

// Connect to MongoDB with retry logic
const connectDB = async (retries = 5, delay = 5000) => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/upwork_proposals';

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`MongoDB connection attempt ${attempt}/${retries}...`);
      await mongoose.connect(mongoUri);
      mongoConnected = true;
      console.log('Connected to MongoDB');
      return true;
    } catch (error) {
      console.error(`MongoDB connection attempt ${attempt} failed:`, error.message);
      if (attempt < retries) {
        console.log(`Retrying in ${delay / 1000} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.error('All MongoDB connection attempts failed');
  return false;
};

// Start server immediately, then connect to MongoDB
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);

  // Connect to MongoDB in the background
  connectDB().then(connected => {
    if (!connected) {
      console.error('WARNING: Running without MongoDB connection. API calls will fail.');
    }
  });
});

export default app;
