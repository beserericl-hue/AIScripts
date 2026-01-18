import express from 'express';
import Settings from '../models/Settings.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Get settings for current user
router.get('/', authenticate, async (req, res) => {
  try {
    let settings = await Settings.findOne({ userId: req.user._id });

    if (!settings) {
      settings = new Settings({ userId: req.user._id });
      await settings.save();
    }

    // Don't expose MongoDB password in response
    const safeSettings = settings.toObject();
    if (safeSettings.mongodbPassword) {
      safeSettings.mongodbPassword = '********';
    }

    res.json(safeSettings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update settings
router.put('/', authenticate, async (req, res) => {
  try {
    const {
      n8nWebhookUrl,
      n8nEvaluationWebhookUrl,
      mongodbUrl,
      mongodbUser,
      mongodbPassword,
      mongodbDatabase,
      callbackTeamId
    } = req.body;

    let settings = await Settings.findOne({ userId: req.user._id });

    if (!settings) {
      settings = new Settings({ userId: req.user._id });
    }

    if (n8nWebhookUrl !== undefined) settings.n8nWebhookUrl = n8nWebhookUrl;
    if (n8nEvaluationWebhookUrl !== undefined) settings.n8nEvaluationWebhookUrl = n8nEvaluationWebhookUrl;
    if (mongodbUrl !== undefined) settings.mongodbUrl = mongodbUrl;
    if (mongodbUser !== undefined) settings.mongodbUser = mongodbUser;
    if (mongodbPassword !== undefined && mongodbPassword !== '********') {
      settings.mongodbPassword = mongodbPassword;
    }
    if (mongodbDatabase !== undefined) settings.mongodbDatabase = mongodbDatabase;
    if (callbackTeamId !== undefined) {
      settings.callbackTeamId = callbackTeamId || null;
    }

    await settings.save();

    // Don't expose MongoDB password in response
    const safeSettings = settings.toObject();
    if (safeSettings.mongodbPassword) {
      safeSettings.mongodbPassword = '********';
    }

    res.json(safeSettings);
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
