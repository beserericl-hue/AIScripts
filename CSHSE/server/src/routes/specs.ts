import { Router } from 'express';
import {
  getSpecs,
  getSpec,
  createSpec,
  updateSpec,
  archiveSpec,
  getSpecInstitutions
} from '../controllers/specController';
import { triggerSpecLoad, getSpecAIStatus, resetSpecAIStatus } from '../controllers/specLoaderController';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// SPEC ROUTES
// ============================================

/**
 * @route   GET /api/specs
 * @desc    Get all specs
 * @access  Private
 */
router.get('/', getSpecs);

/**
 * @route   GET /api/specs/:id
 * @desc    Get single spec
 * @access  Private
 */
router.get('/:id', getSpec);

/**
 * @route   POST /api/specs
 * @desc    Create a new spec
 * @access  Private (Admin only)
 */
router.post('/', requireAdmin, createSpec);

/**
 * @route   PUT /api/specs/:id
 * @desc    Update a spec
 * @access  Private (Admin only)
 */
router.put('/:id', requireAdmin, updateSpec);

/**
 * @route   DELETE /api/specs/:id
 * @desc    Archive a spec
 * @access  Private (Admin only)
 */
router.delete('/:id', requireAdmin, archiveSpec);

/**
 * @route   GET /api/specs/:id/institutions
 * @desc    Get institutions using a specific spec
 * @access  Private
 */
router.get('/:id/institutions', getSpecInstitutions);

/**
 * @route   POST /api/specs/:id/load-to-ai
 * @desc    Trigger loading spec document to AI via n8n
 * @access  Private (Admin only)
 */
router.post('/:id/load-to-ai', requireAdmin, triggerSpecLoad);

/**
 * @route   GET /api/specs/:id/ai-status
 * @desc    Get AI loading status for a spec
 * @access  Private
 */
router.get('/:id/ai-status', getSpecAIStatus);

/**
 * @route   POST /api/specs/:id/reset-ai-status
 * @desc    Reset AI loading status (cancel loading/retry)
 * @access  Private (Admin only)
 */
router.post('/:id/reset-ai-status', requireAdmin, resetSpecAIStatus);

export default router;
