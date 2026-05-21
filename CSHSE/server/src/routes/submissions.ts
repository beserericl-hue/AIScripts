import { Router } from 'express';
import {
  getSubmission,
  getSubmissionProgress,
  saveNarrative,
  submitStandard,
  revertStandard,
  submitSelfStudy,
  revalidateFailed,
  getFailedValidations,
  markStandardComplete,
  listSubmissions,
  createSubmission
} from '../controllers/submissionController';
import { authenticate } from '../middleware/auth';
import { submissionLockout } from '../middleware/submissionLockout';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// SUBMISSION ROUTES
// ============================================

/**
 * @route   GET /api/submissions
 * @desc    List all submissions for current user
 * @access  Private
 * @query   status - Filter by status
 * @query   limit - Number of results (default 10)
 * @query   offset - Pagination offset
 * @query   institutionId - Filter by institution
 */
router.get('/', listSubmissions);

/**
 * @route   POST /api/submissions
 * @desc    Create a new submission/self-study
 * @access  Private (Program Coordinator)
 */
router.post('/', createSubmission);

/**
 * @route   GET /api/submissions/:submissionId
 * @desc    Get submission by ID
 * @access  Private
 */
router.get('/:submissionId', getSubmission);

/**
 * @route   GET /api/submissions/:submissionId/progress
 * @desc    Get detailed progress for a submission
 * @access  Private
 */
router.get('/:submissionId/progress', getSubmissionProgress);

/**
 * @route   PATCH /api/submissions/:submissionId/narrative
 * @desc    Save narrative content for a standard/specification
 * @access  Private (Program Coordinator, Admin)
 */
router.patch('/:submissionId/narrative', submissionLockout, saveNarrative);

/**
 * @route   POST /api/submissions/:submissionId/submit
 * @desc    Submit the entire self-study for review (locks the submission)
 * @access  Private (Program Coordinator only - must be owner)
 */
router.post('/:submissionId/submit', submitSelfStudy);

/**
 * @route   POST /api/submissions/:submissionId/standards/:standardCode/submit
 * @desc    Submit a standard for validation
 * @access  Private (Program Coordinator, Admin)
 */
router.post('/:submissionId/standards/:standardCode/submit', submissionLockout, submitStandard);

/**
 * @route   POST /api/submissions/:submissionId/standards/:standardCode/revert
 * @desc    Revert a standard from `submitted` back to `in_progress` (PC may continue editing)
 * @access  Private (Program Coordinator owner, Admin)
 */
router.post('/:submissionId/standards/:standardCode/revert', submissionLockout, revertStandard);

/**
 * @route   POST /api/submissions/:submissionId/revalidate
 * @desc    Revalidate failed sections only (incremental)
 * @access  Private (Program Coordinator, Admin)
 * @body    standardCode - Optional: limit to specific standard
 */
router.post('/:submissionId/revalidate', submissionLockout, revalidateFailed);

/**
 * @route   GET /api/submissions/:submissionId/failed
 * @desc    Get failed validations for a submission
 * @access  Private
 * @query   standardCode - Optional: filter by standard
 */
router.get('/:submissionId/failed', getFailedValidations);

/**
 * @route   POST /api/submissions/:submissionId/standards/:standardCode/complete
 * @desc    Mark a standard as complete (manual)
 * @access  Private (Program Coordinator, Admin)
 */
router.post('/:submissionId/standards/:standardCode/complete', submissionLockout, markStandardComplete);

export default router;
