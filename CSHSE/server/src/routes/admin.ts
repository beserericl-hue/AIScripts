import { Router } from 'express';
import {
  getWebhookSettings,
  updateWebhookSettings,
  testWebhookConnection,
  getSystemStats,
  deleteInstitutionData
} from '../controllers/adminController';
import { authenticate, requireAdmin, requireSuperuser } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// ADMIN ROUTES
// ============================================

/**
 * @route   GET /api/admin/stats
 * @desc    Get system health and stats
 * @access  Private (Admin only)
 */
router.get('/stats', requireAdmin, getSystemStats);

/**
 * @route   GET /api/admin/webhook-settings
 * @desc    Get webhook settings
 * @access  Private (Admin only)
 */
router.get('/webhook-settings', requireAdmin, getWebhookSettings);

/**
 * @route   PUT /api/admin/webhook-settings
 * @desc    Update webhook settings
 * @access  Private (Admin only)
 */
router.put('/webhook-settings', requireAdmin, updateWebhookSettings);

/**
 * @route   POST /api/admin/webhook-test
 * @desc    Test webhook connection
 * @access  Private (Admin only)
 */
router.post('/webhook-test', requireAdmin, testWebhookConnection);

// ============================================
// SUPERUSER-ONLY ROUTES
// ============================================

/**
 * @route   DELETE /api/admin/institution-data/:institutionId
 * @desc    Delete all self-study data for an institution
 * @access  Private (Superuser only)
 */
router.delete('/institution-data/:institutionId', requireSuperuser, deleteInstitutionData);

export default router;
