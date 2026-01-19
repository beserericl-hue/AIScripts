import express from 'express';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Store connected SSE clients
const clients = new Map();

// Helper to authenticate SSE connection via query param token
const authenticateSSE = (req) => {
  const token = req.query.token;
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
    return decoded.userId;
  } catch {
    return null;
  }
};

// SSE endpoint for proposal updates
router.get('/proposals', (req, res) => {
  const userId = authenticateSSE(req);

  // Allow connection even without auth (for simplicity), but could restrict
  const clientId = userId || `anon_${Date.now()}`;

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);

  // Store client connection
  clients.set(clientId, res);

  // Send heartbeat every 30 seconds to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`);
  }, 30000);

  // Handle client disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(clientId);
  });
});

// Broadcast proposal update to all connected clients
export const broadcastProposalUpdate = (jobId, jobData = {}) => {
  const message = JSON.stringify({
    type: 'proposal_updated',
    jobId,
    ...jobData,
    timestamp: new Date().toISOString()
  });

  for (const [clientId, res] of clients) {
    try {
      res.write(`data: ${message}\n\n`);
    } catch (err) {
      // Remove disconnected clients
      clients.delete(clientId);
    }
  }
};

export default router;
