import { Router } from 'express';
import {
  upsertScore,
  deleteScore,
  getScores,
  getScoreSummary
} from '../controllers/scoreController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/submissions/:submissionId/scores
 * @desc    Get scores for a submission (own scores for reader, all for lead_reader/admin)
 * @access  Private (Reader, Lead Reader, Admin)
 */
router.get('/submissions/:submissionId/scores', getScores);

/**
 * @route   GET /api/submissions/:submissionId/scores/summary
 * @desc    Get averaged score summary (per spec, per standard, global)
 * @access  Private (Reader, Lead Reader, Admin)
 */
router.get('/submissions/:submissionId/scores/summary', getScoreSummary);

/**
 * @route   PUT /api/submissions/:submissionId/scores
 * @desc    Upsert a score for current reviewer on a standard+spec
 * @access  Private (Reader, Lead Reader)
 */
router.put('/submissions/:submissionId/scores', upsertScore);

/**
 * @route   DELETE /api/submissions/:submissionId/scores
 * @desc    Clear (delete) a score for current reviewer on a standard+spec
 * @access  Private (Reader, Lead Reader)
 */
router.delete('/submissions/:submissionId/scores', deleteScore);

export default router;
