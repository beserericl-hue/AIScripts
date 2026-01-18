import express from 'express';
import Job from '../models/Job.js';
import Team from '../models/Team.js';
import Settings from '../models/Settings.js';
import { authenticateApiKey, authenticateAny } from '../middleware/auth.js';

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

// Helper function to normalize evaluation payload (handles both old and new N8N formats)
const normalizeEvaluationPayload = (payload) => {
  // Check if it's the new N8N format with nested score and job objects
  if (payload.score && payload.job) {
    const { score, job } = payload;
    return {
      // Extract job fields
      jobId: payload.jobId || null,
      title: job.jobName || '',
      description: job.descriptionSnippet || '',
      url: job.jobDetailUrl || '',
      rating: score.score || null,
      // New fields from N8N
      jobType: job.jobType || '',
      price: job.price || '',
      country: job.country || '',
      paymentVerified: job.paymentVerified || false,
      clientRating: job.clientRating || null,
      amountSpent: job.amountSpent || '',
      tags: job.tags || [],
      postedAt: job.postedAt || '',
      experienceLevel: job.experienceLevel || '',
      // Score fields
      scoreValue: score.score || null,
      scoreReasoning: score.reasoning || '',
      // Team assignment
      teamId: payload.teamId || null,
      teamName: payload.teamName || null,
      // Store original payload
      rawPayload: payload
    };
  }

  // Old format - return as is with defaults
  return {
    jobId: payload.jobId || null,
    title: payload.title || '',
    description: payload.description || '',
    url: payload.url || '',
    rating: payload.rating || null,
    jobType: payload.jobType || '',
    price: payload.price || '',
    country: payload.country || '',
    paymentVerified: payload.paymentVerified || false,
    clientRating: payload.clientRating || null,
    amountSpent: payload.amountSpent || '',
    tags: payload.tags || [],
    postedAt: payload.postedAt || '',
    experienceLevel: payload.experienceLevel || '',
    scoreValue: payload.scoreValue || payload.rating || null,
    scoreReasoning: payload.scoreReasoning || '',
    teamId: payload.teamId || null,
    teamName: payload.teamName || null,
    rawPayload: payload
  };
};

// Helper function to validate evaluation payload
const validateEvaluationPayload = (payload) => {
  const errors = [];
  const warnings = [];

  // Normalize payload first
  const normalized = normalizeEvaluationPayload(payload);

  // Required fields - need either jobId or title
  if (!normalized.jobId && !normalized.title) {
    errors.push('Either jobId or title (job.jobName) is required');
  }

  // Recommended fields
  if (!normalized.title) {
    warnings.push('title/jobName is missing - recommended for job display');
  }
  if (!normalized.description) {
    warnings.push('description/descriptionSnippet is missing - recommended for context');
  }

  // Optional team assignment validation
  if (normalized.teamId && normalized.teamName) {
    warnings.push('Both teamId and teamName provided - teamId will take precedence');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    receivedFields: Object.keys(payload),
    normalizedFields: Object.keys(normalized),
    expectedFields: ['jobId', 'score.score', 'score.reasoning', 'job.jobName', 'job.jobType', 'job.price', 'job.jobDetailUrl', 'job.descriptionSnippet', 'job.country', 'job.tags', 'teamId', 'teamName']
  };
};

// N8N Proposal Evaluation Callback
// Called when N8N evaluates a job and sends back data
// Supports both old flat format and new nested {score, job} format from N8N
router.post('/evaluation', authenticateApiKey, async (req, res) => {
  try {
    const payload = req.body;
    const testMode = req.query.testMode === 'true';

    // Normalize payload (handles both old and new N8N formats)
    const normalized = normalizeEvaluationPayload(payload);

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
      const testKey = normalized.jobId || `test_${Date.now()}`;
      testModeData.set(testKey, {
        type: 'evaluation',
        payload,
        normalized,
        validation,
        timestamp: Date.now()
      });

      return res.json({
        success: true,
        testMode: true,
        message: 'Test mode: Evaluation data received but NOT saved to database',
        jobId: testKey,
        validation,
        normalizedPayload: normalized,
        receivedPayload: payload
      });
    }

    // Resolve team by teamId or teamName
    let resolvedTeamId = null;
    if (normalized.teamId) {
      const team = await Team.findById(normalized.teamId);
      if (team) {
        resolvedTeamId = team._id;
      }
    } else if (normalized.teamName) {
      const team = await Team.findOne({ name: normalized.teamName, isActive: true });
      if (team) {
        resolvedTeamId = team._id;
      }
    }

    // Find or create job
    let job;

    if (normalized.jobId) {
      job = await Job.findOne({ jobId: normalized.jobId });
    }

    if (!job && normalized.title) {
      // Create new job from evaluation
      const { v4: uuidv4 } = await import('uuid');
      job = new Job({
        jobId: normalized.jobId || uuidv4(),
        title: normalized.title,
        description: normalized.description || '',
        url: normalized.url || '',
        rating: normalized.scoreValue || normalized.rating || null,
        status: 'pending',
        // Store all evaluation data including new fields
        evaluationData: {
          ...normalized,
          originalPayload: payload
        },
        teamId: resolvedTeamId
      });
    } else if (job) {
      // Update existing job
      job.evaluationData = {
        ...normalized,
        originalPayload: payload
      };
      if (normalized.title) job.title = normalized.title;
      if (normalized.description) job.description = normalized.description;
      if (normalized.url) job.url = normalized.url;
      if (normalized.scoreValue || normalized.rating) {
        job.rating = normalized.scoreValue || normalized.rating;
      }
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

  // jobId is now optional - will be generated if not provided
  // Required: either jobId OR title (to create a new job)
  if (!payload.jobId && !payload.title) {
    warnings.push('jobId is missing - a new job will be created with auto-generated ID');
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
    isValid: true, // Always valid now - we can create jobs if needed
    errors,
    warnings,
    receivedFields: Object.keys(payload),
    expectedFields: ['jobId', 'title', 'description', 'url', 'coverLetter', 'docUrl', 'mermaidDiagram', 'mermaidImageUrl', 'teamId', 'teamName']
  };
};

// N8N Proposal Result Callback
// Called when N8N generates a proposal and sends back the results
// Now supports creating new jobs if jobId doesn't exist (for GigRadar integration)
router.post('/proposal-result', authenticateApiKey, async (req, res) => {
  try {
    const payload = req.body;
    const { jobId, title, description, url, coverLetter, docUrl, mermaidDiagram, mermaidImageUrl, teamId, teamName } = payload;
    const testMode = req.query.testMode === 'true';

    // Validate payload
    const validation = validateProposalResultPayload(payload);

    if (!validation.isValid) {
      return res.status(400).json({
        error: validation.errors.join(', '),
        validation
      });
    }

    // Generate jobId if not provided
    let resolvedJobId = jobId;
    if (!resolvedJobId) {
      const { v4: uuidv4 } = await import('uuid');
      resolvedJobId = uuidv4();
    }

    // If test mode, store data but don't save to database
    if (testMode) {
      testModeData.set(resolvedJobId, {
        type: 'proposal-result',
        payload: { ...payload, jobId: resolvedJobId },
        validation,
        timestamp: Date.now()
      });

      return res.json({
        success: true,
        testMode: true,
        message: 'Test mode: Proposal result received but NOT saved to database',
        jobId: resolvedJobId,
        validation,
        receivedPayload: payload
      });
    }

    // Try to find existing job
    let job = await Job.findOne({ jobId: resolvedJobId });
    let isNewJob = false;

    // If job doesn't exist, create a new one
    if (!job) {
      isNewJob = true;

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

      job = new Job({
        jobId: resolvedJobId,
        title: title || 'Untitled Job',
        description: description || '',
        url: url || '',
        status: 'proposal_generated',
        teamId: resolvedTeamId
      });
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
      message: isNewJob ? 'Proposal result received and new job created' : 'Proposal result received',
      jobId: job.jobId,
      teamId: job.teamId,
      isNewJob
    });
  } catch (error) {
    console.error('Proposal result webhook error:', error);
    res.status(500).json({ error: 'Failed to process proposal result' });
  }
});

// Get test mode data for a specific job (accepts JWT or API key)
router.get('/test-data/:jobId', authenticateAny, async (req, res) => {
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

// Get all pending test mode data (accepts JWT or API key)
router.get('/test-data', authenticateAny, async (req, res) => {
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

// Confirm and save test mode data to database (accepts JWT or API key)
router.post('/test-data/:jobId/confirm', authenticateAny, async (req, res) => {
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

// Discard test mode data (accepts JWT or API key)
router.delete('/test-data/:jobId', authenticateAny, async (req, res) => {
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
