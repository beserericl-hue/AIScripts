import { Router } from 'express';
import {
  getUsers,
  getUser,
  updateUser,
  disableUser,
  enableUser,
  getReadersCommittee,
  assignToSubmission,
  removeFromSubmission
} from '../controllers/userController';
import {
  getInvitations,
  createInvitation,
  verifyInvitation,
  acceptInvitation,
  resendInvitation,
  revokeInvitation
} from '../controllers/invitationController';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// USER ROUTES (static paths first, then dynamic)
// ============================================

/**
 * @route   GET /api/users
 * @desc    Get all users (filtered by role permissions)
 * @access  Private
 */
router.get('/', getUsers);

/**
 * @route   GET /api/users/readers-committee
 * @desc    Get readers committee (lead readers and readers)
 * @access  Private (Admin, Lead Reader)
 */
router.get('/readers-committee', getReadersCommittee);

// ============================================
// INVITATION ROUTES (must be before /:id routes)
// ============================================

/**
 * @route   GET /api/users/invitations
 * @desc    Get all invitations
 * @access  Private (Admin only)
 */
router.get('/invitations', getInvitations);

/**
 * @route   POST /api/users/invite
 * @desc    Create and send invitation
 * @access  Private (Admin, Lead Reader for readers)
 */
router.post('/invite', createInvitation);

/**
 * @route   POST /api/users/invitations/:id/resend
 * @desc    Resend invitation email
 * @access  Private (Admin only)
 */
router.post('/invitations/:id/resend', resendInvitation);

/**
 * @route   DELETE /api/users/invitations/:id
 * @desc    Revoke invitation
 * @access  Private (Admin only)
 */
router.delete('/invitations/:id', revokeInvitation);

// ============================================
// DYNAMIC USER ROUTES (must be after static paths)
// ============================================

/**
 * @route   GET /api/users/:id
 * @desc    Get single user
 * @access  Private
 */
router.get('/:id', getUser);

/**
 * @route   PUT /api/users/:id
 * @desc    Update user
 * @access  Private (Admin or self for limited fields)
 */
router.put('/:id', updateUser);

/**
 * @route   DELETE /api/users/:id
 * @desc    Disable user
 * @access  Private (Admin only)
 */
router.delete('/:id', disableUser);

/**
 * @route   POST /api/users/:id/enable
 * @desc    Re-enable disabled user
 * @access  Private (Admin only)
 */
router.post('/:id/enable', enableUser);

/**
 * @route   POST /api/users/:id/assign
 * @desc    Assign user to submission
 * @access  Private (Admin, Lead Reader)
 */
router.post('/:id/assign', assignToSubmission);

/**
 * @route   POST /api/users/:id/unassign
 * @desc    Remove user from submission
 * @access  Private (Admin, Lead Reader)
 */
router.post('/:id/unassign', removeFromSubmission);

export default router;
