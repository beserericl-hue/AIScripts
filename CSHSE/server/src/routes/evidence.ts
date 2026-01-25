import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
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

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || 'uploads/evidence';
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${uuidv4()}${ext}`;
    cb(null, filename);
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Allowed mime types
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
    cb(new Error('File type not allowed'));
  }
};

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
 * @access  Private
 * @query   standardCode - Filter by standard
 * @query   specCode - Filter by specification
 * @query   evidenceType - Filter by type (document, url, image)
 */
router.get('/submissions/:submissionId/evidence', listEvidence);

/**
 * @route   GET /api/submissions/:submissionId/evidence/stats
 * @desc    Get evidence statistics for a submission
 * @access  Private
 */
router.get('/submissions/:submissionId/evidence/stats', getEvidenceStats);

/**
 * @route   GET /api/submissions/:submissionId/evidence/:evidenceId
 * @desc    Get a single evidence item
 * @access  Private
 */
router.get('/submissions/:submissionId/evidence/:evidenceId', getEvidence);

/**
 * @route   POST /api/submissions/:submissionId/evidence/upload
 * @desc    Upload document/image evidence
 * @access  Private (Program Coordinator, Admin)
 */
router.post(
  '/submissions/:submissionId/evidence/upload',
  upload.single('file'),
  uploadEvidence
);

/**
 * @route   POST /api/submissions/:submissionId/evidence/url
 * @desc    Add URL evidence
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
 * @desc    Delete evidence
 * @access  Private (Program Coordinator, Admin)
 */
router.delete('/submissions/:submissionId/evidence/:evidenceId', deleteEvidence);

/**
 * @route   GET /api/submissions/:submissionId/evidence/:evidenceId/download
 * @desc    Download evidence file
 * @access  Private
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
