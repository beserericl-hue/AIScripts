import { Router } from 'express';
import {
  getSubmission,
  getSubmissionProgress,
  saveNarrative,
  submitStandard,
  revalidateFailed,
  getFailedValidations,
  markStandardComplete,
  listSubmissions
} from '../controllers/submissionController';

const router = Router();

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
 */
router.get('/', listSubmissions);

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
router.patch('/:submissionId/narrative', saveNarrative);

/**
 * @route   POST /api/submissions/:submissionId/standards/:standardCode/submit
 * @desc    Submit a standard for validation
 * @access  Private (Program Coordinator, Admin)
 */
router.post('/:submissionId/standards/:standardCode/submit', submitStandard);

/**
 * @route   POST /api/submissions/:submissionId/revalidate
 * @desc    Revalidate failed sections only (incremental)
 * @access  Private (Program Coordinator, Admin)
 * @body    standardCode - Optional: limit to specific standard
 */
router.post('/:submissionId/revalidate', revalidateFailed);

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
router.post('/:submissionId/standards/:standardCode/complete', markStandardComplete);

export default router;
