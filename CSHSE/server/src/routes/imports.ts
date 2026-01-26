import { Router } from 'express';
import multer from 'multer';
import {
  uploadDocument,
  getImport,
  getExtractedSections,
  mapSection,
  applyMappings,
  getUnmappedContent,
  handleUnmapped
} from '../controllers/importController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Please upload PDF, DOCX, or PPTX files.'));
    }
  }
});

/**
 * @route   POST /api/imports/upload
 * @desc    Upload and process a self-study document
 * @access  Private (Coordinator)
 */
router.post('/upload', upload.single('file'), uploadDocument);

/**
 * @route   GET /api/imports/:importId
 * @desc    Get import status and summary
 * @access  Private
 */
router.get('/:importId', getImport);

/**
 * @route   GET /api/imports/:importId/sections
 * @desc    Get extracted sections with mapping suggestions
 * @access  Private
 */
router.get('/:importId/sections', getExtractedSections);

/**
 * @route   POST /api/imports/:importId/map
 * @desc    Map a section to a standard
 * @access  Private (Coordinator)
 */
router.post('/:importId/map', mapSection);

/**
 * @route   POST /api/imports/:importId/apply
 * @desc    Apply all mappings to the submission
 * @access  Private (Coordinator)
 */
router.post('/:importId/apply', applyMappings);

/**
 * @route   GET /api/imports/:importId/unmapped
 * @desc    Get unmapped content for review
 * @access  Private
 */
router.get('/:importId/unmapped', getUnmappedContent);

/**
 * @route   PUT /api/imports/:importId/unmapped/:sectionId
 * @desc    Handle unmapped content (assign or discard)
 * @access  Private (Coordinator)
 */
router.put('/:importId/unmapped/:sectionId', handleUnmapped);

export default router;
