import { Router } from 'express';
import multer from 'multer';
import {
  runSectionValidation,
  getWebhookSettings,
  updateWebhookSettings,
  testWebhookConnection,
  getValidationStatus,
  getLatestValidation,
  getStandardValidation,
  getFailedSections
} from '../controllers/webhookController';
import { receiveSpecLoaderCallback } from '../controllers/specLoaderController';
import { receiveDocumentMatcherCallback } from '../controllers/documentMatcherController';
import { sendChatMessage, getHelpChatStatus, uploadHelpDocument, receiveHelpUploadCallback, getHelpDocuments, deleteHelpDocument } from '../controllers/helpChatController';
import { authenticate, requireAdmin } from '../middleware/auth';
import { verifyN8nCallback } from '../middleware/verifyN8nCallback';

const helpUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'text/markdown', 'text/plain'];
    cb(null, allowed.includes(file.mimetype) || file.originalname.endsWith('.md'));
  }
});

const router = Router();

// CR-054 — the n8n validation trigger+callback path was retired (validation
// is now in-process via cshse-ai). The former `POST /n8n/callback` endpoint
// no longer exists, closing the C2 unauthenticated-callback exploit
// (an attacker could flip a failing ValidationResult to passing).

/**
 * @route   POST /api/webhooks/spec-loader/callback
 * @desc    Receive spec loading completion callback from N8N
 * @access  n8n only — verifyN8nCallback enforces a shared secret when
 *          N8N_CALLBACK_SECRET is configured (CR-054).
 */
router.post('/spec-loader/callback', verifyN8nCallback, receiveSpecLoaderCallback);

/**
 * @route   POST /api/webhooks/document-matcher/callback
 * @desc    Receive document section mapping callback from N8N
 * @access  n8n only — verifyN8nCallback enforces a shared secret when
 *          N8N_CALLBACK_SECRET is configured (CR-054).
 */
router.post('/document-matcher/callback', verifyN8nCallback, receiveDocumentMatcherCallback);

/**
 * @route   POST /api/webhooks/help/upload/callback
 * @desc    Receive help document vectorization completion callback from N8N
 * @access  Public (webhook callback)
 */
router.post('/help/upload/callback', receiveHelpUploadCallback);

// All routes below require authentication
router.use(authenticate);

/**
 * @route   POST /api/webhooks/validate
 * @desc    Validate a section in-process via cshse-ai (CR-054; replaces the
 *          legacy /n8n/validate trigger).
 * @access  Private (Coordinator)
 */
router.post('/validate', runSectionValidation);

/**
 * @route   GET /api/webhooks/help/status
 * @desc    Check if help chat is available
 * @access  Private (any authenticated user)
 */
router.get('/help/status', getHelpChatStatus);

/**
 * @route   POST /api/webhooks/help/chat
 * @desc    Send help question to N8N AI agent
 * @access  Private (any authenticated user)
 */
router.post('/help/chat', sendChatMessage);

/**
 * @route   POST /api/webhooks/help/upload
 * @desc    Upload a help document (PDF/MD) to the N8N vectorization webhook
 * @access  Private (Admin)
 */
router.post('/help/upload', requireAdmin, helpUpload.single('file'), uploadHelpDocument);

/**
 * @route   GET /api/webhooks/help/documents
 * @desc    Get all help documents with status
 * @access  Private (Admin)
 */
router.get('/help/documents', requireAdmin, getHelpDocuments);

/**
 * @route   DELETE /api/webhooks/help/documents/:id
 * @desc    Delete a help document record (does not remove from vector store)
 * @access  Private (Admin)
 */
router.delete('/help/documents/:id', requireAdmin, deleteHelpDocument);

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
 * @route   GET /api/webhooks/validation/latest
 * @desc    Get latest validation status (query params: submissionId, standardCode, specCode)
 * @access  Private
 */
router.get('/validation/latest', getLatestValidation);

/**
 * @route   GET /api/webhooks/validation/standard/:submissionId/:standardCode
 * @desc    Get validation summary for a standard
 * @access  Private
 */
router.get('/validation/standard/:submissionId/:standardCode', getStandardValidation);

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

// CR-054 — the legacy n8n batch revalidate route was removed. The live
// "Revalidate" affordance uses POST /api/submissions/:id/revalidate
// (submissionController.revalidateFailed → validateSection).

export default router;
