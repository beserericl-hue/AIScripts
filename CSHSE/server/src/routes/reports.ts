import { Router } from 'express';
import {
  generateReaderReportPDF,
  generateCompilationReportPDF,
  generateAllReaderReportsPDF,
  previewReaderReport,
  previewCompilationReport
} from '../controllers/reportController';

const router = Router();

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
