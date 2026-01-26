import { Router } from 'express';
import {
  getSiteVisits,
  getSiteVisit,
  scheduleSiteVisit,
  updateSiteVisit,
  cancelSiteVisit,
  confirmAttendance
} from '../controllers/siteVisitController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// SITE VISIT ROUTES
// ============================================

/**
 * @route   GET /api/site-visits
 * @desc    Get all site visits (filtered by role)
 * @access  Private
 */
router.get('/', getSiteVisits);

/**
 * @route   GET /api/site-visits/:id
 * @desc    Get single site visit
 * @access  Private
 */
router.get('/:id', getSiteVisit);

/**
 * @route   POST /api/site-visits
 * @desc    Schedule a new site visit
 * @access  Private (Lead Reader, Admin)
 */
router.post('/', scheduleSiteVisit);

/**
 * @route   PUT /api/site-visits/:id
 * @desc    Update site visit
 * @access  Private (Lead Reader, Admin)
 */
router.put('/:id', updateSiteVisit);

/**
 * @route   DELETE /api/site-visits/:id
 * @desc    Cancel site visit
 * @access  Private (Lead Reader, Admin)
 */
router.delete('/:id', cancelSiteVisit);

/**
 * @route   POST /api/site-visits/:id/confirm
 * @desc    Confirm reader attendance
 * @access  Private (Assigned Readers)
 */
router.post('/:id/confirm', confirmAttendance);

export default router;
