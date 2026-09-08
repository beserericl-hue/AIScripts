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
  previewEvidence,
  getEvidencePublicUrl,
  linkEvidence,
  unlinkEvidence,
  getEvidenceStats,
  listRequiredDocuments,
  REQUIRED_DOC_TYPES
} from '../controllers/evidenceController';
import { authenticate } from '../middleware/auth';
import { submissionLockout } from '../middleware/submissionLockout';

const router = Router();

// All routes require authentication
router.use(authenticate);

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
 * @desc    Upload document/image evidence (stored in S3 if configured, base64 fallback)
 * @access  Private (Program Coordinator, Admin)
 * @body    file - The file (multipart/form-data)
 * @body    standardCode - Standard code to link to
 * @body    specCode - Spec code to link to
 * @body    description - Short description of the file
 * @note    Auto-versioning: re-uploading same filename to same standard/spec creates a new version
 */
router.post(
  '/submissions/:submissionId/evidence/upload',
  submissionLockout,
  upload.single('file'),
  uploadEvidence
);

/**
 * @route   POST /api/submissions/:submissionId/required-documents
 * @route   GET  /api/submissions/:submissionId/required-documents
 * @desc    CR-074 — Required program documents (VP-for-Accreditation letter,
 *          institutional support letter, …). Deliberately NOT behind
 *          submissionLockout: the PC/admin may add these AFTER the self-study is
 *          locked. Stored as Introduction-section evidence with a
 *          [[REQUIRED_DOC:<type>]] marker so they surface in the reader report;
 *          readers/leads can list + download them.
 * @access  Upload: Program Coordinator / Admin (enforced in uploadEvidence).
 *          List: anyone with submission access (readers + leads included).
 */
router.post(
  '/submissions/:submissionId/required-documents',
  upload.single('file'),
  (req, res, next) => {
    const type = String(req.body?.requiredDocType || 'other').toLowerCase();
    const label = REQUIRED_DOC_TYPES[type] || 'Required Document';
    // Force the Introduction section so the doc appears in the reader report,
    // and stamp the description marker the list endpoint filters on.
    req.body.standardCode = 'introduction';
    req.body.specCode = 'a';
    const extra = typeof req.body?.description === 'string' && req.body.description.trim()
      ? ` — ${req.body.description.trim()}` : '';
    req.body.description = `[[REQUIRED_DOC:${type}]] ${label}${extra}`;
    return uploadEvidence(req, res, next);
  }
);
router.get('/submissions/:submissionId/required-documents', listRequiredDocuments);

/**
 * @route   POST /api/submissions/:submissionId/evidence/url
 * @desc    Add URL evidence (web links to supporting documents)
 * @access  Private (Program Coordinator, Admin)
 */
router.post('/submissions/:submissionId/evidence/url', submissionLockout, addUrlEvidence);

/**
 * @route   PATCH /api/submissions/:submissionId/evidence/:evidenceId
 * @desc    Update evidence metadata
 * @access  Private (Program Coordinator, Admin)
 */
router.patch('/submissions/:submissionId/evidence/:evidenceId', submissionLockout, updateEvidence);

/**
 * @route   DELETE /api/submissions/:submissionId/evidence/:evidenceId
 * @desc    Delete evidence (soft delete)
 * @access  Private (Uploader, Admin)
 */
router.delete('/submissions/:submissionId/evidence/:evidenceId', submissionLockout, deleteEvidence);

/**
 * @route   GET /api/submissions/:submissionId/evidence/:evidenceId/preview
 * @desc    Preview evidence file content (PDF/DOCX → HTML, images → type hint)
 * @access  Private (with access control)
 */
router.get('/submissions/:submissionId/evidence/:evidenceId/preview', previewEvidence);

/**
 * @route   GET /api/submissions/:submissionId/evidence/:evidenceId/download
 * @desc    Download evidence file or redirect to URL
 * @access  Private (with access control - institution, submission, and user IDs verified)
 * @note    Binary files (Word, PPT, PDF) are decoded from base64 for proper download
 */
router.get('/submissions/:submissionId/evidence/:evidenceId/download', downloadEvidence);

// Short-lived PUBLIC url for the Office web viewer (xlsx/pptx native render).
router.get('/submissions/:submissionId/evidence/:evidenceId/public-url', getEvidencePublicUrl);

/**
 * @route   POST /api/submissions/:submissionId/evidence/:evidenceId/link
 * @desc    Link evidence to a specification
 * @access  Private (Program Coordinator, Admin)
 */
router.post('/submissions/:submissionId/evidence/:evidenceId/link', submissionLockout, linkEvidence);

/**
 * @route   POST /api/submissions/:submissionId/evidence/:evidenceId/unlink
 * @desc    Unlink evidence from a specification
 * @access  Private (Program Coordinator, Admin)
 */
router.post('/submissions/:submissionId/evidence/:evidenceId/unlink', submissionLockout, unlinkEvidence);

export default router;
