import { Router } from 'express';
import {
  getSpecs,
  getSpec,
  createSpec,
  updateSpec,
  archiveSpec,
  getSpecInstitutions
} from '../controllers/specController';

const router = Router();

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
router.post('/', createSpec);

/**
 * @route   PUT /api/specs/:id
 * @desc    Update a spec
 * @access  Private (Admin only)
 */
router.put('/:id', updateSpec);

/**
 * @route   DELETE /api/specs/:id
 * @desc    Archive a spec
 * @access  Private (Admin only)
 */
router.delete('/:id', archiveSpec);

/**
 * @route   GET /api/specs/:id/institutions
 * @desc    Get institutions using a specific spec
 * @access  Private
 */
router.get('/:id/institutions', getSpecInstitutions);

export default router;
