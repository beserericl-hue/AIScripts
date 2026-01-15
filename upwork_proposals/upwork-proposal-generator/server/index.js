import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

console.log('Starting server initialization...');
console.log('Node version:', process.version);
console.log('Environment:', process.env.NODE_ENV || 'development');

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

// Health check - defined early so it works even if routes fail to load
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mongodb: mongoConnected ? 'connected' : 'disconnected'
  });
});

// Initialize routes
async function initializeRoutes() {
  try {
    console.log('Loading route modules...');

    const authRoutes = (await import('./routes/auth.js')).default;
    const jobRoutes = (await import('./routes/jobs.js')).default;
    const proposalRoutes = (await import('./routes/proposals.js')).default;
    const settingsRoutes = (await import('./routes/settings.js')).default;
    const webhookRoutes = (await import('./routes/webhooks.js')).default;
    const apiKeyRoutes = (await import('./routes/apiKeys.js')).default;
    const teamRoutes = (await import('./routes/teams.js')).default;
    const profileRoutes = (await import('./routes/profiles.js')).default;

    console.log('All route modules loaded successfully');

    // API Routes
    app.use('/api/auth', authRoutes);
    app.use('/api/jobs', jobRoutes);
    app.use('/api/proposals', proposalRoutes);
    app.use('/api/settings', settingsRoutes);
    app.use('/api/webhooks', webhookRoutes);
    app.use('/api/api-keys', apiKeyRoutes);
    app.use('/api/teams', teamRoutes);
    app.use('/api/profiles', profileRoutes);

    console.log('All routes registered');
    return true;
  } catch (error) {
    console.error('Failed to load route modules:', error);
    return false;
  }
}

// Connect to MongoDB with retry logic
const connectDB = async (retries = 5, delay = 5000) => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/upwork_proposals';
  console.log('MongoDB URI configured:', mongoUri ? 'Yes' : 'No (using default)');

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

// Start server
async function startServer() {
  // Start HTTP server immediately for health checks
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });

  // Initialize routes
  const routesLoaded = await initializeRoutes();

  if (routesLoaded) {
    // Serve static files from React build
    const distPath = path.join(__dirname, '..', 'dist');
    app.use(express.static(distPath));

    // Handle React routing - serve index.html for all non-API routes
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API endpoint not found' });
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });

    console.log('Static file serving configured');
  }

  // Connect to MongoDB in the background
  connectDB().then(connected => {
    if (!connected) {
      console.error('WARNING: Running without MongoDB connection. API calls will fail.');
    }
  });

  return server;
}

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

export default app;
