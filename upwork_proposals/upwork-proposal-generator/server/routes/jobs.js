import express from 'express';
import Job from '../models/Job.js';
import { authenticate } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Get all jobs (with filtering)
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, excludeStatus } = req.query;
    let query = {};

    if (status) {
      query.status = status;
    }

    if (excludeStatus) {
      const excludeArray = excludeStatus.split(',');
      query.status = { $nin: excludeArray };
    }

    const jobs = await Job.find(query)
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name email');

    res.json(jobs);
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// Get pending jobs (not proposal_generated and not rejected)
router.get('/pending', authenticate, async (req, res) => {
  try {
    const jobs = await Job.find({
      status: { $nin: ['proposal_generated', 'rejected'] }
    })
      .sort({ createdAt: -1 })
      .select('jobId title rating status url createdAt');

    res.json(jobs);
  } catch (error) {
    console.error('Error fetching pending jobs:', error);
    res.status(500).json({ error: 'Failed to fetch pending jobs' });
  }
});

// Get single job
router.get('/:id', authenticate, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('createdBy', 'name email');

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(job);
  } catch (error) {
    console.error('Error fetching job:', error);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

// Get job by jobId
router.get('/by-job-id/:jobId', authenticate, async (req, res) => {
  try {
    const job = await Job.findOne({ jobId: req.params.jobId })
      .populate('createdBy', 'name email');

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(job);
  } catch (error) {
    console.error('Error fetching job:', error);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

// Create new job
router.post('/', authenticate, async (req, res) => {
  try {
    const { title, description, url, profile, rating } = req.body;

    const jobId = uuidv4();

    const job = new Job({
      jobId,
      title,
      description,
      url,
      profile,
      rating,
      status: 'pending',
      createdBy: req.user._id
    });

    await job.save();
    res.status(201).json(job);
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({ error: 'Failed to create job' });
  }
});

// Update job
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const updates = req.body;
    const job = await Job.findByIdAndUpdate(
      req.params.id,
      { ...updates, updatedAt: Date.now() },
      { new: true }
    );

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(job);
  } catch (error) {
    console.error('Error updating job:', error);
    res.status(500).json({ error: 'Failed to update job' });
  }
});

// Reject job
router.post('/:id/reject', authenticate, async (req, res) => {
  try {
    const job = await Job.findByIdAndUpdate(
      req.params.id,
      { status: 'rejected', updatedAt: Date.now() },
      { new: true }
    );

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(job);
  } catch (error) {
    console.error('Error rejecting job:', error);
    res.status(500).json({ error: 'Failed to reject job' });
  }
});

// Delete job
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await Job.findByIdAndDelete(req.params.id);
    res.json({ message: 'Job deleted' });
  } catch (error) {
    console.error('Error deleting job:', error);
    res.status(500).json({ error: 'Failed to delete job' });
  }
});

export default router;
