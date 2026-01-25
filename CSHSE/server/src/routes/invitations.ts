import { Router } from 'express';
import {
  verifyInvitation,
  acceptInvitation
} from '../controllers/invitationController';

const router = Router();

/**
 * @route   GET /api/invitations/verify/:token
 * @desc    Verify invitation token (public)
 * @access  Public
 */
router.get('/verify/:token', verifyInvitation);

/**
 * @route   POST /api/invitations/accept
 * @desc    Accept invitation and create account (public)
 * @access  Public
 */
router.post('/accept', acceptInvitation);

export default router;
