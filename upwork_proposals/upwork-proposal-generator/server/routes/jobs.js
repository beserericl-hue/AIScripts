import express from 'express';
import Job from '../models/Job.js';
import { authenticate } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Helper to add team filter to queries
const addTeamFilter = (query, user) => {
  // Only filter by team if user has a team assigned
  if (user.teamId) {
    query.teamId = user.teamId;
  }
  return query;
};

// Get all jobs (with filtering) - filtered by team
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, excludeStatus } = req.query;
    let query = {};

    // Add team filter
    addTeamFilter(query, req.user);

    if (status) {
      query.status = status;
    }

    if (excludeStatus) {
      const excludeArray = excludeStatus.split(',');
      query.status = { $nin: excludeArray };
    }

    const jobs = await Job.find(query)
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name email')
      .populate('profileId', 'name');

    res.json(jobs);
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// Get pending jobs (status = pending only) - filtered by team
router.get('/pending', authenticate, async (req, res) => {
  try {
    let query = {
      status: 'pending'
    };

    // Add team filter
    addTeamFilter(query, req.user);

    const jobs = await Job.find(query)
      .sort({ createdAt: -1 })
      .select('jobId title rating status url createdAt teamId description');

    res.json(jobs);
  } catch (error) {
    console.error('Error fetching pending jobs:', error);
    res.status(500).json({ error: 'Failed to fetch pending jobs' });
  }
});

// Get jobs with proposals (proposal_generated, submitted, won, lost) - filtered by team
router.get('/with-proposals', authenticate, async (req, res) => {
  try {
    let query = {
      status: { $in: ['proposal_generated', 'submitted', 'won', 'lost'] }
    };

    // Add team filter
    addTeamFilter(query, req.user);

    const jobs = await Job.find(query)
      .sort({ updatedAt: -1 })
      .select('jobId title rating status url createdAt updatedAt teamId proposalData description');

    res.json(jobs);
  } catch (error) {
    console.error('Error fetching jobs with proposals:', error);
    res.status(500).json({ error: 'Failed to fetch jobs with proposals' });
  }
});

// Update job status - verify team access
router.post('/:id/status', authenticate, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'proposal_generated', 'rejected', 'submitted', 'won', 'lost'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    // First, verify team access
    const existingJob = await Job.findById(req.params.id);
    if (!existingJob) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (req.user.teamId && existingJob.teamId && existingJob.teamId.toString() !== req.user.teamId.toString()) {
      return res.status(403).json({ error: 'Access denied - job belongs to different team' });
    }

    const job = await Job.findByIdAndUpdate(
      req.params.id,
      { status, updatedAt: Date.now() },
      { new: true }
    );

    res.json(job);
  } catch (error) {
    console.error('Error updating job status:', error);
    res.status(500).json({ error: 'Failed to update job status' });
  }
});

// Get single job - verify team access
router.get('/:id', authenticate, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('profileId', 'name content');

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Verify team access
    if (req.user.teamId && job.teamId && job.teamId.toString() !== req.user.teamId.toString()) {
      return res.status(403).json({ error: 'Access denied - job belongs to different team' });
    }

    res.json(job);
  } catch (error) {
    console.error('Error fetching job:', error);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

// Get job by jobId - verify team access
router.get('/by-job-id/:jobId', authenticate, async (req, res) => {
  try {
    let query = { jobId: req.params.jobId };

    // Add team filter
    addTeamFilter(query, req.user);

    const job = await Job.findOne(query)
      .populate('createdBy', 'name email')
      .populate('profileId', 'name content');

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(job);
  } catch (error) {
    console.error('Error fetching job:', error);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

// Create new job - assign to user's team
router.post('/', authenticate, async (req, res) => {
  try {
    const { title, description, url, profile, rating, profileId } = req.body;

    const jobId = uuidv4();

    const job = new Job({
      jobId,
      title,
      description,
      url,
      profile,
      rating,
      status: 'pending',
      createdBy: req.user._id,
      teamId: req.user.teamId, // Assign to user's team
      profileId: profileId || null
    });

    await job.save();
    res.status(201).json(job);
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({ error: 'Failed to create job' });
  }
});

// Update job - verify team access
router.patch('/:id', authenticate, async (req, res) => {
  try {
    // First, verify team access
    const existingJob = await Job.findById(req.params.id);
    if (!existingJob) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (req.user.teamId && existingJob.teamId && existingJob.teamId.toString() !== req.user.teamId.toString()) {
      return res.status(403).json({ error: 'Access denied - job belongs to different team' });
    }

    const updates = req.body;
    // Prevent changing teamId through updates
    delete updates.teamId;

    const job = await Job.findByIdAndUpdate(
      req.params.id,
      { ...updates, updatedAt: Date.now() },
      { new: true }
    );

    res.json(job);
  } catch (error) {
    console.error('Error updating job:', error);
    res.status(500).json({ error: 'Failed to update job' });
  }
});

// Reject job - verify team access
router.post('/:id/reject', authenticate, async (req, res) => {
  try {
    // First, verify team access
    const existingJob = await Job.findById(req.params.id);
    if (!existingJob) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (req.user.teamId && existingJob.teamId && existingJob.teamId.toString() !== req.user.teamId.toString()) {
      return res.status(403).json({ error: 'Access denied - job belongs to different team' });
    }

    const job = await Job.findByIdAndUpdate(
      req.params.id,
      { status: 'rejected', updatedAt: Date.now() },
      { new: true }
    );

    res.json(job);
  } catch (error) {
    console.error('Error rejecting job:', error);
    res.status(500).json({ error: 'Failed to reject job' });
  }
});

// Delete job - verify team access
router.delete('/:id', authenticate, async (req, res) => {
  try {
    // First, verify team access
    const existingJob = await Job.findById(req.params.id);
    if (!existingJob) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (req.user.teamId && existingJob.teamId && existingJob.teamId.toString() !== req.user.teamId.toString()) {
      return res.status(403).json({ error: 'Access denied - job belongs to different team' });
    }

    await Job.findByIdAndDelete(req.params.id);
    res.json({ message: 'Job deleted' });
  } catch (error) {
    console.error('Error deleting job:', error);
    res.status(500).json({ error: 'Failed to delete job' });
  }
});

export default router;
