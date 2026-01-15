import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import ApiKey from '../models/ApiKey.js';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export const authenticate = async (req, res, next) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

export const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'administrator') {
    return res.status(403).json({ error: 'Administrator access required' });
  }
  next();
};

export const authenticateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }

    const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');
    const keyDoc = await ApiKey.findOne({ hashedKey, isActive: true });

    if (!keyDoc) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    // Update last used timestamp
    keyDoc.lastUsed = new Date();
    await keyDoc.save();

    req.apiKey = keyDoc;
    next();
  } catch (error) {
    res.status(500).json({ error: 'API key authentication failed' });
  }
};

export const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
};
