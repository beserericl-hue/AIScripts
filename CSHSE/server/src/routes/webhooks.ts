import { Router } from 'express';
import {
  triggerValidation,
  receiveCallback,
  getWebhookSettings,
  updateWebhookSettings,
  testWebhookConnection,
  getValidationStatus,
  getFailedSections,
  revalidateFailedSections
} from '../controllers/webhookController';
import { receiveSpecLoaderCallback } from '../controllers/specLoaderController';
import { receiveDocumentMatcherCallback } from '../controllers/documentMatcherController';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

/**
 * @route   POST /api/webhooks/n8n/callback
 * @desc    Receive validation result callback from N8N
 * @access  Public (webhook callback)
 */
router.post('/n8n/callback', receiveCallback);

/**
 * @route   POST /api/webhooks/spec-loader/callback
 * @desc    Receive spec loading completion callback from N8N
 * @access  Public (webhook callback)
 */
router.post('/spec-loader/callback', receiveSpecLoaderCallback);

/**
 * @route   POST /api/webhooks/document-matcher/callback
 * @desc    Receive document section mapping callback from N8N
 * @access  Public (webhook callback)
 */
router.post('/document-matcher/callback', receiveDocumentMatcherCallback);

// All routes below require authentication
router.use(authenticate);

/**
 * @route   POST /api/webhooks/n8n/validate
 * @desc    Trigger N8N validation for a section
 * @access  Private (Coordinator)
 */
router.post('/n8n/validate', triggerValidation);

/**
 * @route   GET /api/webhooks/settings
 * @desc    Get all webhook settings
 * @access  Private (Admin)
 */
router.get('/settings', requireAdmin, getWebhookSettings);

/**
 * @route   PUT /api/webhooks/settings
 * @desc    Create or update webhook settings
 * @access  Private (Admin)
 */
router.put('/settings', requireAdmin, updateWebhookSettings);

/**
 * @route   POST /api/webhooks/settings/:settingType/test
 * @desc    Test webhook connection
 * @access  Private (Admin)
 */
router.post('/settings/:settingType/test', requireAdmin, testWebhookConnection);

/**
 * @route   GET /api/webhooks/validation/:submissionId/:standardCode/:specCode
 * @desc    Get validation status for a section
 * @access  Private
 */
router.get('/validation/:submissionId/:standardCode/:specCode', getValidationStatus);

/**
 * @route   GET /api/webhooks/validation/:submissionId/failed
 * @desc    Get all failed sections for a submission
 * @access  Private
 */
router.get('/validation/:submissionId/failed', getFailedSections);

/**
 * @route   POST /api/webhooks/validation/:submissionId/revalidate
 * @desc    Revalidate failed sections only
 * @access  Private (Coordinator)
 */
router.post('/validation/:submissionId/revalidate', revalidateFailedSections);

export default router;
