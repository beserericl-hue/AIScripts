import { Router } from 'express';
import {
  getComments,
  getCommentSummary,
  createComment,
  updateComment,
  deleteComment,
  addReply,
  deleteReply,
  toggleResolve,
  getCommentsForNavigation,
  relayComment,
  unrelayComment,
  escalateComment,
  getRelayQueue
} from '../controllers/commentController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// COMMENT ROUTES
// ============================================

/**
 * @route   GET /api/submissions/:submissionId/comments
 * @desc    Get all comments for a submission (optionally filtered by standard/spec)
 * @access  Private (Assigned readers, lead reader, program coordinator)
 */
router.get('/submissions/:submissionId/comments', getComments);

/**
 * @route   GET /api/submissions/:submissionId/comments/summary
 * @desc    Get comment count summary for navigation header
 * @access  Private
 */
router.get('/submissions/:submissionId/comments/summary', getCommentSummary);

/**
 * @route   GET /api/submissions/:submissionId/comments/navigate
 * @desc    Get paginated comments for navigation (<<, <, >, >> buttons)
 * @access  Private
 */
router.get('/submissions/:submissionId/comments/navigate', getCommentsForNavigation);

/**
 * @route   POST /api/submissions/:submissionId/comments
 * @desc    Create a new comment (readers and lead readers only)
 * @access  Private (Reader, Lead Reader)
 */
router.post('/submissions/:submissionId/comments', createComment);

/**
 * @route   PUT /api/comments/:commentId
 * @desc    Update a comment (author only)
 * @access  Private (Comment Author)
 */
router.put('/comments/:commentId', updateComment);

/**
 * @route   DELETE /api/comments/:commentId
 * @desc    Delete a comment (author or lead reader)
 * @access  Private (Comment Author, Lead Reader)
 */
router.delete('/comments/:commentId', deleteComment);

/**
 * @route   POST /api/comments/:commentId/replies
 * @desc    Add a reply to a comment (all roles can reply)
 * @access  Private (Reader, Lead Reader, Program Coordinator)
 */
router.post('/comments/:commentId/replies', addReply);

/**
 * @route   DELETE /api/comments/:commentId/replies/:replyId
 * @desc    Delete a reply (reply author only)
 * @access  Private (Reply Author)
 */
router.delete('/comments/:commentId/replies/:replyId', deleteReply);

/**
 * @route   POST /api/comments/:commentId/resolve
 * @desc    Toggle resolved status of a comment
 * @access  Private (Reader, Lead Reader)
 */
router.post('/comments/:commentId/resolve', toggleResolve);

// ============================================
// CR-004 / CR-023 — relay endpoints
// ============================================

/**
 * @route   GET /api/submissions/:submissionId/comments/relay-queue
 * @desc    Lead-reader / admin / board inbox of comments awaiting relay.
 * @access  Private (Lead Reader, Admin, Superuser)
 */
router.get('/submissions/:submissionId/comments/relay-queue', getRelayQueue);

/**
 * @route   POST /api/comments/:commentId/relay
 * @desc    Mark a comment "relayed" so the PC sees it. Optional sanitized
 *          relayedText + pcLabel. Writes a comment.relayed audit entry.
 * @access  Private (Lead Reader, Admin, Superuser)
 */
router.post('/comments/:commentId/relay', relayComment);

/**
 * @route   DELETE /api/comments/:commentId/relay
 * @desc    Un-mark relay; PC loses visibility.
 * @access  Private (Lead Reader, Admin, Superuser)
 */
router.delete('/comments/:commentId/relay', unrelayComment);

/**
 * @route   POST /api/comments/:commentId/escalate
 * @desc    Flag a comment for board review.
 * @access  Private (Lead Reader, Admin, Superuser)
 */
router.post('/comments/:commentId/escalate', escalateComment);

export default router;
