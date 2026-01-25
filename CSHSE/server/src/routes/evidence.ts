import { Router } from 'express';
import multer from 'multer';
import {
  listEvidence,
  getEvidence,
  uploadEvidence,
  addUrlEvidence,
  updateEvidence,
  deleteEvidence,
  downloadEvidence,
  linkEvidence,
  unlinkEvidence,
  getEvidenceStats
} from '../controllers/evidenceController';

const router = Router();

/**
 * Configure multer for memory storage
 * Files are stored as base64 in the database for secure access control
 * and to ensure binary files (Word, PPT) can be downloaded without corruption
 */
const storage = multer.memoryStorage();

/**
 * File filter - only allow specific document types
 */
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Allowed mime types for supporting evidence
  const allowedTypes = [
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/tiff',
    // Spreadsheets
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed: ${file.mimetype}. Allowed types: PDF, Word, PowerPoint, Excel, and images.`));
  }
};

/**
 * Multer upload configuration
 * - Uses memory storage for base64 encoding
 * - 50MB file size limit
 * - Validates file types
 */
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max
  }
});

// ============================================
// EVIDENCE ROUTES
// ============================================

/**
 * @route   GET /api/submissions/:submissionId/evidence
 * @desc    List all evidence for a submission
 * @access  Private (with access control)
 * @query   standardCode - Filter by standard
 * @query   specCode - Filter by specification
 * @query   evidenceType - Filter by type (document, url, image)
 */
router.get('/submissions/:submissionId/evidence', listEvidence);

/**
 * @route   GET /api/submissions/:submissionId/evidence/stats
 * @desc    Get evidence statistics for a submission
 * @access  Private (with access control)
 */
router.get('/submissions/:submissionId/evidence/stats', getEvidenceStats);

/**
 * @route   GET /api/submissions/:submissionId/evidence/:evidenceId
 * @desc    Get a single evidence item
 * @access  Private (with access control)
 */
router.get('/submissions/:submissionId/evidence/:evidenceId', getEvidence);

/**
 * @route   POST /api/submissions/:submissionId/evidence/upload
 * @desc    Upload document/image evidence
 * @access  Private (Program Coordinator, Admin)
 * @note    Files are stored as base64 in database for secure access
 */
router.post(
  '/submissions/:submissionId/evidence/upload',
  upload.single('file'),
  uploadEvidence
);

/**
 * @route   POST /api/submissions/:submissionId/evidence/url
 * @desc    Add URL evidence (web links to supporting documents)
 * @access  Private (Program Coordinator, Admin)
 */
router.post('/submissions/:submissionId/evidence/url', addUrlEvidence);

/**
 * @route   PATCH /api/submissions/:submissionId/evidence/:evidenceId
 * @desc    Update evidence metadata
 * @access  Private (Program Coordinator, Admin)
 */
router.patch('/submissions/:submissionId/evidence/:evidenceId', updateEvidence);

/**
 * @route   DELETE /api/submissions/:submissionId/evidence/:evidenceId
 * @desc    Delete evidence (soft delete)
 * @access  Private (Uploader, Admin)
 */
router.delete('/submissions/:submissionId/evidence/:evidenceId', deleteEvidence);

/**
 * @route   GET /api/submissions/:submissionId/evidence/:evidenceId/download
 * @desc    Download evidence file or redirect to URL
 * @access  Private (with access control - institution, submission, and user IDs verified)
 * @note    Binary files (Word, PPT, PDF) are decoded from base64 for proper download
 */
router.get('/submissions/:submissionId/evidence/:evidenceId/download', downloadEvidence);

/**
 * @route   POST /api/submissions/:submissionId/evidence/:evidenceId/link
 * @desc    Link evidence to a specification
 * @access  Private (Program Coordinator, Admin)
 */
router.post('/submissions/:submissionId/evidence/:evidenceId/link', linkEvidence);

/**
 * @route   POST /api/submissions/:submissionId/evidence/:evidenceId/unlink
 * @desc    Unlink evidence from a specification
 * @access  Private (Program Coordinator, Admin)
 */
router.post('/submissions/:submissionId/evidence/:evidenceId/unlink', unlinkEvidence);

export default router;
