import express from 'express';
import Job from '../models/Job.js';
import Team from '../models/Team.js';
import Settings from '../models/Settings.js';
import { authenticateApiKey } from '../middleware/auth.js';

const router = express.Router();

// In-memory storage for test mode webhook data (keyed by jobId or timestamp)
const testModeData = new Map();

// Clean up old test data (older than 1 hour)
const cleanupTestData = () => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [key, value] of testModeData.entries()) {
    if (value.timestamp < oneHourAgo) {
      testModeData.delete(key);
    }
  }
};

// Run cleanup every 15 minutes
setInterval(cleanupTestData, 15 * 60 * 1000);

// Helper function to validate evaluation payload
const validateEvaluationPayload = (payload) => {
  const errors = [];
  const warnings = [];

  // Required fields
  if (!payload.jobId && !payload.title) {
    errors.push('Either jobId or title is required');
  }

  // Recommended fields
  if (!payload.title) {
    warnings.push('title is missing - recommended for job display');
  }
  if (!payload.description) {
    warnings.push('description is missing - recommended for context');
  }

  // Optional team assignment validation
  if (payload.teamId && payload.teamName) {
    warnings.push('Both teamId and teamName provided - teamId will take precedence');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    receivedFields: Object.keys(payload),
    expectedFields: ['jobId', 'title', 'description', 'url', 'rating', 'evaluationData', 'teamId', 'teamName']
  };
};

// N8N Proposal Evaluation Callback
// Called when N8N evaluates a job and sends back data
// Now accepts teamId to assign jobs to specific teams
router.post('/evaluation', authenticateApiKey, async (req, res) => {
  try {
    const payload = req.body;
    const { jobId, title, description, url, rating, evaluationData, teamId, teamName } = payload;
    const testMode = req.query.testMode === 'true';

    // Validate payload
    const validation = validateEvaluationPayload(payload);

    if (!validation.isValid) {
      return res.status(400).json({
        error: validation.errors.join(', '),
        validation
      });
    }

    // If test mode, store data but don't save to database
    if (testMode) {
      const testKey = jobId || `test_${Date.now()}`;
      testModeData.set(testKey, {
        type: 'evaluation',
        payload,
        validation,
        timestamp: Date.now()
      });

      return res.json({
        success: true,
        testMode: true,
        message: 'Test mode: Evaluation data received but NOT saved to database',
        jobId: testKey,
        validation,
        receivedPayload: payload
      });
    }

    // Resolve team by teamId or teamName
    let resolvedTeamId = null;
    if (teamId) {
      const team = await Team.findById(teamId);
      if (team) {
        resolvedTeamId = team._id;
      }
    } else if (teamName) {
      const team = await Team.findOne({ name: teamName, isActive: true });
      if (team) {
        resolvedTeamId = team._id;
      }
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
        evaluationData: payload,
        teamId: resolvedTeamId
      });
    } else if (job) {
      // Update existing job
      job.evaluationData = payload;
      if (title) job.title = title;
      if (description) job.description = description;
      if (url) job.url = url;
      if (rating) job.rating = rating;
      // Only update teamId if provided and job doesn't already have one
      if (resolvedTeamId && !job.teamId) {
        job.teamId = resolvedTeamId;
      }
    } else {
      return res.status(404).json({ error: 'Job not found and insufficient data to create' });
    }

    await job.save();

    res.json({
      success: true,
      message: 'Evaluation data received',
      jobId: job.jobId,
      teamId: job.teamId
    });
  } catch (error) {
    console.error('Evaluation webhook error:', error);
    res.status(500).json({ error: 'Failed to process evaluation' });
  }
});

// Helper function to validate proposal result payload
const validateProposalResultPayload = (payload) => {
  const errors = [];
  const warnings = [];

  // Required fields
  if (!payload.jobId) {
    errors.push('jobId is required');
  }

  // Recommended fields
  if (!payload.coverLetter) {
    warnings.push('coverLetter is missing - this is the main proposal content');
  }

  // Optional fields check
  if (!payload.docUrl) {
    warnings.push('docUrl is missing - Google Doc link will not be available');
  }
  if (!payload.mermaidDiagram && !payload.mermaidImageUrl) {
    warnings.push('No diagram provided (mermaidDiagram or mermaidImageUrl)');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    receivedFields: Object.keys(payload),
    expectedFields: ['jobId', 'coverLetter', 'docUrl', 'mermaidDiagram', 'mermaidImageUrl']
  };
};

// N8N Proposal Result Callback
// Called when N8N generates a proposal and sends back the results
router.post('/proposal-result', authenticateApiKey, async (req, res) => {
  try {
    const payload = req.body;
    const { jobId, coverLetter, docUrl, mermaidDiagram, mermaidImageUrl } = payload;
    const testMode = req.query.testMode === 'true';

    // Validate payload
    const validation = validateProposalResultPayload(payload);

    if (!validation.isValid) {
      return res.status(400).json({
        error: validation.errors.join(', '),
        validation
      });
    }

    // If test mode, store data but don't save to database
    if (testMode) {
      testModeData.set(jobId, {
        type: 'proposal-result',
        payload,
        validation,
        timestamp: Date.now()
      });

      return res.json({
        success: true,
        testMode: true,
        message: 'Test mode: Proposal result received but NOT saved to database',
        jobId,
        validation,
        receivedPayload: payload
      });
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
      jobId: job.jobId,
      teamId: job.teamId
    });
  } catch (error) {
    console.error('Proposal result webhook error:', error);
    res.status(500).json({ error: 'Failed to process proposal result' });
  }
});

// Get test mode data for a specific job
router.get('/test-data/:jobId', authenticateApiKey, async (req, res) => {
  try {
    const { jobId } = req.params;
    const data = testModeData.get(jobId);

    if (!data) {
      return res.status(404).json({ error: 'No test data found for this jobId' });
    }

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error fetching test data:', error);
    res.status(500).json({ error: 'Failed to fetch test data' });
  }
});

// Get all pending test mode data
router.get('/test-data', authenticateApiKey, async (req, res) => {
  try {
    const allData = [];
    for (const [key, value] of testModeData.entries()) {
      allData.push({
        jobId: key,
        ...value
      });
    }
    res.json({
      success: true,
      count: allData.length,
      data: allData.sort((a, b) => b.timestamp - a.timestamp)
    });
  } catch (error) {
    console.error('Error fetching all test data:', error);
    res.status(500).json({ error: 'Failed to fetch test data' });
  }
});

// Confirm and save test mode data to database
router.post('/test-data/:jobId/confirm', authenticateApiKey, async (req, res) => {
  try {
    const { jobId } = req.params;
    const testData = testModeData.get(jobId);

    if (!testData) {
      return res.status(404).json({ error: 'No test data found for this jobId' });
    }

    // Process based on type
    if (testData.type === 'evaluation') {
      const payload = testData.payload;
      const { title, description, url, rating, teamId, teamName } = payload;

      // Resolve team
      let resolvedTeamId = null;
      if (teamId) {
        const team = await Team.findById(teamId);
        if (team) resolvedTeamId = team._id;
      } else if (teamName) {
        const team = await Team.findOne({ name: teamName, isActive: true });
        if (team) resolvedTeamId = team._id;
      }

      // Find or create job
      let job = await Job.findOne({ jobId });

      if (!job && title) {
        const { v4: uuidv4 } = await import('uuid');
        job = new Job({
          jobId: jobId || uuidv4(),
          title,
          description: description || '',
          url: url || '',
          rating: rating || null,
          status: 'pending',
          evaluationData: payload,
          teamId: resolvedTeamId
        });
      } else if (job) {
        job.evaluationData = payload;
        if (title) job.title = title;
        if (description) job.description = description;
        if (url) job.url = url;
        if (rating) job.rating = rating;
        if (resolvedTeamId && !job.teamId) {
          job.teamId = resolvedTeamId;
        }
      }

      await job.save();
      testModeData.delete(jobId);

      return res.json({
        success: true,
        message: 'Evaluation data confirmed and saved to database',
        jobId: job.jobId,
        teamId: job.teamId
      });

    } else if (testData.type === 'proposal-result') {
      const payload = testData.payload;
      const { coverLetter, docUrl, mermaidDiagram, mermaidImageUrl } = payload;

      const job = await Job.findOne({ jobId });

      if (!job) {
        return res.status(404).json({ error: 'Job not found - cannot save proposal result' });
      }

      job.proposalData = {
        coverLetter: coverLetter || '',
        docUrl: docUrl || '',
        mermaidDiagram: mermaidDiagram || '',
        mermaidImageUrl: mermaidImageUrl || ''
      };
      job.status = 'proposal_generated';
      job.evaluationData = {
        ...job.evaluationData,
        proposalResponse: payload
      };

      await job.save();
      testModeData.delete(jobId);

      return res.json({
        success: true,
        message: 'Proposal result confirmed and saved to database',
        jobId: job.jobId,
        teamId: job.teamId
      });
    }

    res.status(400).json({ error: 'Unknown test data type' });
  } catch (error) {
    console.error('Error confirming test data:', error);
    res.status(500).json({ error: 'Failed to confirm test data' });
  }
});

// Discard test mode data
router.delete('/test-data/:jobId', authenticateApiKey, async (req, res) => {
  try {
    const { jobId } = req.params;
    const deleted = testModeData.delete(jobId);

    if (!deleted) {
      return res.status(404).json({ error: 'No test data found for this jobId' });
    }

    res.json({
      success: true,
      message: 'Test data discarded'
    });
  } catch (error) {
    console.error('Error deleting test data:', error);
    res.status(500).json({ error: 'Failed to delete test data' });
  }
});

// Health check for webhooks
router.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'webhooks' });
});

export default router;
