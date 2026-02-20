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

  if (!userId) {
    console.warn(`[SSE] Client connected without valid auth token (IP: ${req.ip})`);
  }

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
  console.log(`[SSE] Client connected: ${clientId} (total clients: ${clients.size})`);

  // Send heartbeat every 30 seconds to keep connection alive
  const heartbeat = setInterval(() => {
    try {
      res.write(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`);
    } catch (err) {
      console.warn(`[SSE] Heartbeat failed for client ${clientId}, removing`);
      clearInterval(heartbeat);
      clients.delete(clientId);
    }
  }, 30000);

  // Handle client disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(clientId);
    console.log(`[SSE] Client disconnected: ${clientId} (remaining clients: ${clients.size})`);
  });
});

// Broadcast proposal update to all connected clients
export const broadcastProposalUpdate = (jobId, jobData = {}) => {
  const clientCount = clients.size;
  console.log(`[SSE-BROADCAST] Broadcasting proposal_updated for jobId=${jobId} to ${clientCount} connected client(s)`);

  if (clientCount === 0) {
    console.warn(`[SSE-BROADCAST] WARNING: No SSE clients connected! Proposal update for jobId=${jobId} will not be delivered in real-time`);
  }

  const message = JSON.stringify({
    type: 'proposal_updated',
    jobId,
    ...jobData,
    timestamp: new Date().toISOString()
  });

  let delivered = 0;
  let failed = 0;

  for (const [clientId, res] of clients) {
    try {
      res.write(`data: ${message}\n\n`);
      delivered++;
    } catch (err) {
      console.warn(`[SSE-BROADCAST] Failed to send to client ${clientId}: ${err.message}`);
      clients.delete(clientId);
      failed++;
    }
  }

  console.log(`[SSE-BROADCAST] Delivery complete: ${delivered} delivered, ${failed} failed (jobId=${jobId})`);
};

export default router;
