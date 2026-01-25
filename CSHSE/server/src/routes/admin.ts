import { Router } from 'express';
import {
  getWebhookSettings,
  updateWebhookSettings,
  testWebhookConnection,
  getSystemStats
} from '../controllers/adminController';

const router = Router();

// ============================================
// ADMIN ROUTES
// ============================================

/**
 * @route   GET /api/admin/stats
 * @desc    Get system health and stats
 * @access  Private (Admin only)
 */
router.get('/stats', getSystemStats);

/**
 * @route   GET /api/admin/webhook-settings
 * @desc    Get webhook settings
 * @access  Private (Admin only)
 */
router.get('/webhook-settings', getWebhookSettings);

/**
 * @route   PUT /api/admin/webhook-settings
 * @desc    Update webhook settings
 * @access  Private (Admin only)
 */
router.put('/webhook-settings', updateWebhookSettings);

/**
 * @route   POST /api/admin/webhook-test
 * @desc    Test webhook connection
 * @access  Private (Admin only)
 */
router.post('/webhook-test', testWebhookConnection);

export default router;
