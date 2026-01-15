import express from 'express';
import Job from '../models/Job.js';
import { authenticateApiKey } from '../middleware/auth.js';

const router = express.Router();

// N8N Proposal Evaluation Callback
// Called when N8N evaluates a job and sends back data
router.post('/evaluation', authenticateApiKey, async (req, res) => {
  try {
    const payload = req.body;
    const { jobId, title, description, url, rating, evaluationData } = payload;

    if (!jobId && !title) {
      return res.status(400).json({ error: 'jobId or title is required' });
    }

    // Find or create job
    let job;

    if (jobId) {
      job = await Job.findOne({ jobId });
    }

    if (!job && title) {
      // Create new job from evaluation
      const { v4: uuidv4 } = await import('uuid');
      job = new Job({
        jobId: jobId || uuidv4(),
        title,
        description: description || '',
        url: url || '',
        rating: rating || null,
        status: 'pending',
        evaluationData: payload
      });
    } else if (job) {
      // Update existing job
      job.evaluationData = payload;
      if (title) job.title = title;
      if (description) job.description = description;
      if (url) job.url = url;
      if (rating) job.rating = rating;
    } else {
      return res.status(404).json({ error: 'Job not found and insufficient data to create' });
    }

    await job.save();

    res.json({
      success: true,
      message: 'Evaluation data received',
      jobId: job.jobId
    });
  } catch (error) {
    console.error('Evaluation webhook error:', error);
    res.status(500).json({ error: 'Failed to process evaluation' });
  }
});

// N8N Proposal Result Callback
// Called when N8N generates a proposal and sends back the results
router.post('/proposal-result', authenticateApiKey, async (req, res) => {
  try {
    const payload = req.body;
    const { jobId, coverLetter, docUrl, mermaidDiagram, mermaidImageUrl } = payload;

    if (!jobId) {
      return res.status(400).json({ error: 'jobId is required' });
    }

    const job = await Job.findOne({ jobId });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Update job with proposal data
    job.proposalData = {
      coverLetter: coverLetter || '',
      docUrl: docUrl || '',
      mermaidDiagram: mermaidDiagram || '',
      mermaidImageUrl: mermaidImageUrl || ''
    };
    job.status = 'proposal_generated';

    // Store complete N8N response
    job.evaluationData = {
      ...job.evaluationData,
      proposalResponse: payload
    };

    await job.save();

    res.json({
      success: true,
      message: 'Proposal result received',
      jobId: job.jobId
    });
  } catch (error) {
    console.error('Proposal result webhook error:', error);
    res.status(500).json({ error: 'Failed to process proposal result' });
  }
});

// Health check for webhooks
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'webhooks' });
});

export default router;
