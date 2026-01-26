import { Router } from 'express';
import {
  getChangeRequests,
  getChangeRequest,
  createChangeRequest,
  approveChangeRequest,
  denyChangeRequest,
  withdrawChangeRequest,
  getPendingChangeRequests
} from '../controllers/changeRequestController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// CHANGE REQUEST ROUTES
// ============================================

/**
 * @route   GET /api/change-requests
 * @desc    Get all change requests
 * @access  Private
 */
router.get('/', getChangeRequests);

/**
 * @route   GET /api/change-requests/pending
 * @desc    Get pending change requests for dashboard
 * @access  Private (Admin, Lead Reader)
 */
router.get('/pending', getPendingChangeRequests);

/**
 * @route   GET /api/change-requests/:id
 * @desc    Get single change request
 * @access  Private
 */
router.get('/:id', getChangeRequest);

/**
 * @route   POST /api/change-requests
 * @desc    Create a change request (deadline or site visit)
 * @access  Private (Program Coordinator)
 */
router.post('/', createChangeRequest);

/**
 * @route   POST /api/change-requests/:id/approve
 * @desc    Approve a change request
 * @access  Private (Admin, Lead Reader)
 */
router.post('/:id/approve', approveChangeRequest);

/**
 * @route   POST /api/change-requests/:id/deny
 * @desc    Deny a change request
 * @access  Private (Admin, Lead Reader)
 */
router.post('/:id/deny', denyChangeRequest);

/**
 * @route   POST /api/change-requests/:id/withdraw
 * @desc    Withdraw a change request
 * @access  Private (Requester only)
 */
router.post('/:id/withdraw', withdrawChangeRequest);

export default router;
