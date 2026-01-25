import { Router } from 'express';
import {
  getMyReviews,
  getReview,
  getReviewWorkspace,
  saveAssessment,
  bulkSaveAssessments,
  saveFinalAssessment,
  toggleBookmark,
  flagSpecification,
  markStandardComplete,
  submitReview,
  getReviewProgress,
  assignReaders,
  getSubmissionReviews
} from '../controllers/reviewController';

const router = Router();

// ============================================
// READER ROUTES
// ============================================

/**
 * @route   GET /api/reviews
 * @desc    Get all reviews assigned to the current reader
 * @access  Private (Reader)
 */
router.get('/', getMyReviews);

/**
 * @route   GET /api/reviews/:reviewId
 * @desc    Get a specific review with full details
 * @access  Private (Reader, Lead Reader, Admin)
 */
router.get('/:reviewId', getReview);

/**
 * @route   GET /api/reviews/:reviewId/workspace
 * @desc    Get review workspace data (submission + review for side-by-side view)
 * @access  Private (Reader, Lead Reader, Admin)
 */
router.get('/:reviewId/workspace', getReviewWorkspace);

/**
 * @route   GET /api/reviews/:reviewId/progress
 * @desc    Get detailed progress summary for a review
 * @access  Private
 */
router.get('/:reviewId/progress', getReviewProgress);

/**
 * @route   PATCH /api/reviews/:reviewId/assessment
 * @desc    Save assessment for a specification (auto-save or manual)
 * @access  Private (Reader)
 */
router.patch('/:reviewId/assessment', saveAssessment);

/**
 * @route   PATCH /api/reviews/:reviewId/assessments/bulk
 * @desc    Bulk save assessments (for marking multiple as compliant/non-compliant)
 * @access  Private (Reader)
 */
router.patch('/:reviewId/assessments/bulk', bulkSaveAssessments);

/**
 * @route   PATCH /api/reviews/:reviewId/final-assessment
 * @desc    Save final assessment (recommendation, strengths, weaknesses)
 * @access  Private (Reader)
 */
router.patch('/:reviewId/final-assessment', saveFinalAssessment);

/**
 * @route   POST /api/reviews/:reviewId/bookmark
 * @desc    Toggle bookmark on a specification
 * @access  Private (Reader)
 */
router.post('/:reviewId/bookmark', toggleBookmark);

/**
 * @route   POST /api/reviews/:reviewId/flag
 * @desc    Flag a specification for follow-up
 * @access  Private (Reader)
 */
router.post('/:reviewId/flag', flagSpecification);

/**
 * @route   POST /api/reviews/:reviewId/standard-complete
 * @desc    Mark a standard as complete
 * @access  Private (Reader)
 */
router.post('/:reviewId/standard-complete', markStandardComplete);

/**
 * @route   POST /api/reviews/:reviewId/submit
 * @desc    Submit completed review
 * @access  Private (Reader)
 */
router.post('/:reviewId/submit', submitReview);

// ============================================
// ADMIN ROUTES
// ============================================

/**
 * @route   POST /api/reviews/submissions/:submissionId/assign
 * @desc    Assign readers to a submission
 * @access  Private (Admin, Lead Reader)
 */
router.post('/submissions/:submissionId/assign', assignReaders);

/**
 * @route   GET /api/reviews/submissions/:submissionId
 * @desc    Get all reviews for a submission
 * @access  Private (Admin, Lead Reader)
 */
router.get('/submissions/:submissionId', getSubmissionReviews);

export default router;
