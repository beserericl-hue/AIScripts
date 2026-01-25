import { Router } from 'express';
import {
  getMyCompilations,
  getReadyForCompilation,
  createOrGetCompilation,
  getCompilation,
  getComparisonView,
  getDisagreements,
  setFinalDetermination,
  bulkSetDeterminations,
  saveFinalCompilation,
  submitCompilation,
  createCommentThread,
  addThreadMessage,
  toggleThreadResolved,
  sendReaderReminder,
  exportCompilation
} from '../controllers/leadReaderController';

const router = Router();

// ============================================
// LEAD READER DASHBOARD ROUTES
// ============================================

/**
 * @route   GET /api/lead-reviews
 * @desc    Get all compilations assigned to the current lead reader
 * @access  Private (Lead Reader)
 */
router.get('/', getMyCompilations);

/**
 * @route   GET /api/lead-reviews/ready
 * @desc    Get submissions ready for lead reader compilation
 * @access  Private (Lead Reader, Admin)
 */
router.get('/ready', getReadyForCompilation);

// ============================================
// COMPILATION MANAGEMENT ROUTES
// ============================================

/**
 * @route   POST /api/lead-reviews/submissions/:submissionId
 * @desc    Create or get compilation for a submission
 * @access  Private (Lead Reader, Admin)
 */
router.post('/submissions/:submissionId', createOrGetCompilation);

/**
 * @route   GET /api/lead-reviews/:compilationId
 * @desc    Get full compilation details
 * @access  Private (Lead Reader, Admin)
 */
router.get('/:compilationId', getCompilation);

/**
 * @route   GET /api/lead-reviews/:compilationId/comparison
 * @desc    Get side-by-side comparison of reader assessments
 * @access  Private (Lead Reader, Admin)
 * @query   standardCode - Filter by standard
 * @query   showDisagreementsOnly - Show only items with disagreement
 */
router.get('/:compilationId/comparison', getComparisonView);

/**
 * @route   GET /api/lead-reviews/:compilationId/disagreements
 * @desc    Get all disagreements across the compilation
 * @access  Private (Lead Reader, Admin)
 */
router.get('/:compilationId/disagreements', getDisagreements);

/**
 * @route   GET /api/lead-reviews/:compilationId/export
 * @desc    Export compilation data (JSON or CSV)
 * @access  Private (Lead Reader, Admin)
 * @query   format - 'json' or 'csv'
 */
router.get('/:compilationId/export', exportCompilation);

// ============================================
// DETERMINATION ROUTES
// ============================================

/**
 * @route   PATCH /api/lead-reviews/:compilationId/determination
 * @desc    Set final determination for a specification
 * @access  Private (Lead Reader)
 */
router.patch('/:compilationId/determination', setFinalDetermination);

/**
 * @route   PATCH /api/lead-reviews/:compilationId/determinations/bulk
 * @desc    Bulk set final determinations (use consensus for all)
 * @access  Private (Lead Reader)
 */
router.patch('/:compilationId/determinations/bulk', bulkSetDeterminations);

// ============================================
// FINAL COMPILATION ROUTES
// ============================================

/**
 * @route   PATCH /api/lead-reviews/:compilationId/final
 * @desc    Save final compilation (strengths, weaknesses, recommendation)
 * @access  Private (Lead Reader)
 */
router.patch('/:compilationId/final', saveFinalCompilation);

/**
 * @route   POST /api/lead-reviews/:compilationId/submit
 * @desc    Submit completed compilation
 * @access  Private (Lead Reader)
 */
router.post('/:compilationId/submit', submitCompilation);

// ============================================
// COMMUNICATION ROUTES
// ============================================

/**
 * @route   POST /api/lead-reviews/:compilationId/threads
 * @desc    Create a comment thread
 * @access  Private (Lead Reader)
 */
router.post('/:compilationId/threads', createCommentThread);

/**
 * @route   POST /api/lead-reviews/:compilationId/threads/:threadId/messages
 * @desc    Add message to comment thread
 * @access  Private (Lead Reader, Reader)
 */
router.post('/:compilationId/threads/:threadId/messages', addThreadMessage);

/**
 * @route   PATCH /api/lead-reviews/:compilationId/threads/:threadId/resolve
 * @desc    Resolve/unresolve comment thread
 * @access  Private (Lead Reader)
 */
router.patch('/:compilationId/threads/:threadId/resolve', toggleThreadResolved);

/**
 * @route   POST /api/lead-reviews/:compilationId/reminder
 * @desc    Send reminder to readers
 * @access  Private (Lead Reader)
 */
router.post('/:compilationId/reminder', sendReaderReminder);

export default router;
