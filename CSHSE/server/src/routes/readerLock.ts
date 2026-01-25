import { Router } from 'express';
import {
  getLockStatus,
  lockSubmission,
  unlockSubmission,
  sendBackForCorrection,
  clearSentBack
} from '../controllers/readerLockController';

const router = Router();

// ============================================
// READER LOCK ROUTES
// ============================================

/**
 * @route   GET /api/submissions/:submissionId/lock
 * @desc    Get current lock status and edit permissions
 * @access  Private
 */
router.get('/submissions/:submissionId/lock', getLockStatus);

/**
 * @route   POST /api/submissions/:submissionId/lock
 * @desc    Lock a submission for reader review
 * @access  Private (Reader, Lead Reader)
 */
router.post('/submissions/:submissionId/lock', lockSubmission);

/**
 * @route   DELETE /api/submissions/:submissionId/lock
 * @desc    Unlock a submission
 * @access  Private (Reader who locked, Lead Reader, Admin)
 */
router.delete('/submissions/:submissionId/lock', unlockSubmission);

/**
 * @route   POST /api/submissions/:submissionId/send-back
 * @desc    Send submission back to program coordinator for correction
 * @access  Private (Reader, Lead Reader)
 */
router.post('/submissions/:submissionId/send-back', sendBackForCorrection);

/**
 * @route   POST /api/submissions/:submissionId/clear-sent-back
 * @desc    Clear sent-back status after corrections are made
 * @access  Private (Program Coordinator)
 */
router.post('/submissions/:submissionId/clear-sent-back', clearSentBack);

export default router;
