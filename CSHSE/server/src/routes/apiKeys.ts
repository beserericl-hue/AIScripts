import { Router } from 'express';
import {
  getAPIKeys,
  createAPIKey,
  getAPIKey,
  revokeAPIKey,
  rotateAPIKey
} from '../controllers/apiKeyController';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

// All routes require authentication and admin access
router.use(authenticate);
router.use(requireAdmin);

// ============================================
// API KEY ROUTES (Admin only)
// ============================================

/**
 * @route   GET /api/admin/api-keys
 * @desc    Get all API keys
 * @access  Private (Admin only)
 */
router.get('/', getAPIKeys);

/**
 * @route   POST /api/admin/api-keys
 * @desc    Create a new API key
 * @access  Private (Admin only)
 */
router.post('/', createAPIKey);

/**
 * @route   GET /api/admin/api-keys/:id
 * @desc    Get single API key details
 * @access  Private (Admin only)
 */
router.get('/:id', getAPIKey);

/**
 * @route   DELETE /api/admin/api-keys/:id
 * @desc    Revoke an API key
 * @access  Private (Admin only)
 */
router.delete('/:id', revokeAPIKey);

/**
 * @route   POST /api/admin/api-keys/:id/rotate
 * @desc    Rotate an API key (generates new, revokes old)
 * @access  Private (Admin only)
 */
router.post('/:id/rotate', rotateAPIKey);

export default router;
