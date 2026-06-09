import { Router } from 'express';
import {
  generateReaderReportPDF,
  generateCompilationReportPDF,
  generateAllReaderReportsPDF,
  previewReaderReport,
  previewCompilationReport,
  generateReaderReportNow
} from '../controllers/reportController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// READER REPORT PDF ROUTES
// ============================================

/**
 * @route   GET /api/reports/reader/:reviewId/pdf
 * @desc    Generate PDF for a reader report
 * @access  Private (Reader who owns review, Lead Reader, Admin)
 */
router.get('/reader/:reviewId/pdf', generateReaderReportPDF);

/**
 * @route   GET /api/reports/reader/:reviewId/preview
 * @desc    Get data for reader report preview
 * @access  Private (Reader who owns review, Lead Reader, Admin)
 */
router.get('/reader/:reviewId/preview', previewReaderReport);

/**
 * @route   GET /api/reports/submission/:submissionId/all-readers/pdf
 * @desc    Generate combined PDF of all reader reports for a submission
 * @access  Private (Lead Reader, Admin)
 */
router.get('/submission/:submissionId/all-readers/pdf', generateAllReaderReportsPDF);

/**
 * @route   POST /api/reports/submission/:submissionId/reader-report/generate
 * @desc    Compile the Reader Report (full self-study + AI verdicts) into the
 *          library as PDF + DOCX. Auto-runs after a submitted submission's
 *          background validate-all finishes; this forces an immediate rebuild.
 * @access  Private (PC owner, Reader/Lead assigned, Admin)
 */
router.post('/submission/:submissionId/reader-report/generate', generateReaderReportNow);

// ============================================
// COMPILATION REPORT PDF ROUTES
// ============================================

/**
 * @route   GET /api/reports/compilation/:compilationId/pdf
 * @desc    Generate PDF for a lead reader compilation report
 * @access  Private (Lead Reader who owns compilation, Admin)
 */
router.get('/compilation/:compilationId/pdf', generateCompilationReportPDF);

/**
 * @route   GET /api/reports/compilation/:compilationId/preview
 * @desc    Get data for compilation report preview
 * @access  Private (Lead Reader who owns compilation, Admin)
 */
router.get('/compilation/:compilationId/preview', previewCompilationReport);

export default router;
