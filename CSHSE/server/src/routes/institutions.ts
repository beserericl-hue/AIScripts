import { Router } from 'express';
import {
  getInstitutions,
  getInstitution,
  createInstitution,
  updateInstitution,
  archiveInstitution,
  assignLeadReader,
  assignReaders
} from '../controllers/institutionController';
import { authenticate, requireAdmin } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// INSTITUTION ROUTES
// ============================================

/**
 * @route   GET /api/institutions
 * @desc    Get all institutions
 * @access  Private
 */
router.get('/', getInstitutions);

/**
 * @route   GET /api/institutions/:id
 * @desc    Get single institution
 * @access  Private
 */
router.get('/:id', getInstitution);

/**
 * @route   POST /api/institutions
 * @desc    Create a new institution (with optional program coordinator invitation)
 * @access  Private (Admin only)
 */
router.post('/', requireAdmin, createInstitution);

/**
 * @route   PUT /api/institutions/:id
 * @desc    Update institution
 * @access  Private (Admin only)
 */
router.put('/:id', requireAdmin, updateInstitution);

/**
 * @route   DELETE /api/institutions/:id
 * @desc    Archive institution
 * @access  Private (Admin only)
 */
router.delete('/:id', requireAdmin, archiveInstitution);

/**
 * @route   POST /api/institutions/:id/lead-reader
 * @desc    Assign lead reader to institution
 * @access  Private (Admin only)
 */
router.post('/:id/lead-reader', requireAdmin, assignLeadReader);

/**
 * @route   POST /api/institutions/:id/readers
 * @desc    Assign readers to institution
 * @access  Private (Admin or Lead Reader)
 */
router.post('/:id/readers', requireAdmin, assignReaders);

export default router;
