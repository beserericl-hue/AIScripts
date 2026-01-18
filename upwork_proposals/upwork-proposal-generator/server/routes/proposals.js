import express from 'express';
import axios from 'axios';
import Job from '../models/Job.js';
import Settings from '../models/Settings.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Generate proposal - calls N8N webhook
router.post('/generate', authenticate, async (req, res) => {
  try {
    const { jobId, title, description, profile, url } = req.body;

    // Get user settings for webhook URL
    let settings = await Settings.findOne({ userId: req.user._id });

    if (!settings || !settings.n8nWebhookUrl) {
      return res.status(400).json({
        error: 'N8N webhook URL not configured. Please configure it in Settings.'
      });
    }

    // Update or create job in database
    let job = await Job.findOne({ jobId });

    if (!job) {
      // Determine teamId: use user's teamId, or fall back to callbackTeamId from settings
      const teamIdForJob = req.user.teamId || settings.callbackTeamId || null;

      job = new Job({
        jobId,
        title,
        description,
        profile,
        url,
        status: 'pending',
        createdBy: req.user._id,
        teamId: teamIdForJob
      });
    } else {
      job.title = title;
      job.description = description;
      job.profile = profile;
      job.url = url;
    }

    await job.save();

    // Call N8N webhook
    try {
      // Include teamId so it can be passed back in the callback
      const teamIdForCallback = req.user.teamId ? req.user.teamId.toString() : (settings.callbackTeamId ? settings.callbackTeamId.toString() : null);

      const webhookResponse = await axios.post(settings.n8nWebhookUrl, {
        jobId: job.jobId,
        title,
        description,
        profile,
        url,
        userId: req.user._id.toString(),
        teamId: teamIdForCallback,
        timestamp: new Date().toISOString()
      }, {
        timeout: 30000
      });

      res.json({
        message: 'Proposal generation initiated',
        job,
        webhookResponse: webhookResponse.data
      });
    } catch (webhookError) {
      console.error('Webhook call failed:', webhookError.message);
      res.json({
        message: 'Job saved but webhook call failed',
        job,
        error: webhookError.message
      });
    }
  } catch (error) {
    console.error('Error generating proposal:', error);
    res.status(500).json({ error: 'Failed to generate proposal' });
  }
});

// Get proposal data for a job
router.get('/:jobId', authenticate, async (req, res) => {
  try {
    const job = await Job.findOne({ jobId: req.params.jobId });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({
      jobId: job.jobId,
      title: job.title,
      status: job.status,
      proposalData: job.proposalData
    });
  } catch (error) {
    console.error('Error fetching proposal:', error);
    res.status(500).json({ error: 'Failed to fetch proposal' });
  }
});

export default router;
