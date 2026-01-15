import express from 'express';
import crypto from 'crypto';
import ApiKey from '../models/ApiKey.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Get all API keys for current user
router.get('/', authenticate, async (req, res) => {
  try {
    const apiKeys = await ApiKey.find({ createdBy: req.user._id })
      .select('name key isActive lastUsed createdAt')
      .sort({ createdAt: -1 });

    // Mask the API keys (show only first 8 and last 4 chars)
    const maskedKeys = apiKeys.map(key => ({
      ...key.toObject(),
      key: `${key.key.substring(0, 8)}...${key.key.substring(key.key.length - 4)}`
    }));

    res.json(maskedKeys);
  } catch (error) {
    console.error('Error fetching API keys:', error);
    res.status(500).json({ error: 'Failed to fetch API keys' });
  }
});

// Generate new API key
router.post('/', authenticate, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'API key name is required' });
    }

    // Generate a unique API key
    const key = ApiKey.generateKey();
    const hashedKey = crypto.createHash('sha256').update(key).digest('hex');

    const apiKey = new ApiKey({
      name: name.trim(),
      key,
      hashedKey,
      createdBy: req.user._id
    });

    await apiKey.save();

    // Return the full key only once (on creation)
    res.status(201).json({
      _id: apiKey._id,
      name: apiKey.name,
      key: key, // Full key shown only on creation
      isActive: apiKey.isActive,
      createdAt: apiKey.createdAt,
      message: 'Save this API key - it will not be shown again!'
    });
  } catch (error) {
    console.error('Error generating API key:', error);
    res.status(500).json({ error: 'Failed to generate API key' });
  }
});

// Toggle API key active status
router.patch('/:id/toggle', authenticate, async (req, res) => {
  try {
    const apiKey = await ApiKey.findOne({
      _id: req.params.id,
      createdBy: req.user._id
    });

    if (!apiKey) {
      return res.status(404).json({ error: 'API key not found' });
    }

    apiKey.isActive = !apiKey.isActive;
    await apiKey.save();

    res.json({
      _id: apiKey._id,
      name: apiKey.name,
      isActive: apiKey.isActive
    });
  } catch (error) {
    console.error('Error toggling API key:', error);
    res.status(500).json({ error: 'Failed to toggle API key' });
  }
});

// Delete API key
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const result = await ApiKey.deleteOne({
      _id: req.params.id,
      createdBy: req.user._id
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'API key not found' });
    }

    res.json({ message: 'API key deleted' });
  } catch (error) {
    console.error('Error deleting API key:', error);
    res.status(500).json({ error: 'Failed to delete API key' });
  }
});

export default router;
