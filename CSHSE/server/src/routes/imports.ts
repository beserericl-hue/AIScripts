import { Router } from 'express';
import multer from 'multer';
import {
  uploadDocument,
  getImport,
  getExtractedSections,
  getSectionContent,
  mapSection,
  applyMappings,
  getUnmappedContent,
  handleUnmapped,
  cancelImport,
  // Part 6: Section selection before AI processing (legacy - to be replaced)
  getDetectedSections,
  updateSectionSelections,
  confirmSectionSelections,
  getAppendix,
  getFullSectionContent,
  // Manual tagging workflow
  getDocumentContent,
  getDocumentImage,
  extractSection,
  getTaggedSections,
  getTaggedSectionContent,
  deleteTaggedSection,
  finishTagging
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
 * @route   GET /api/imports/:importId/sections/:sectionId
 * @desc    Get full content of a specific section
 * @access  Private
 */
router.get('/:importId/sections/:sectionId', getSectionContent);

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

/**
 * @route   POST /api/imports/:importId/cancel
 * @desc    Cancel an in-progress import
 * @access  Private (Coordinator)
 */
router.post('/:importId/cancel', cancelImport);

// ============================================
// PART 6: Section Selection Before AI Processing
// ============================================

/**
 * @route   GET /api/imports/:importId/detected-sections
 * @desc    Get detected sections for user selection
 * @access  Private
 */
router.get('/:importId/detected-sections', getDetectedSections);

/**
 * @route   POST /api/imports/:importId/select-sections
 * @desc    Update section selections (select/deselect)
 * @access  Private (Coordinator)
 */
router.post('/:importId/select-sections', updateSectionSelections);

/**
 * @route   POST /api/imports/:importId/confirm-selections
 * @desc    Confirm selections and proceed to AI processing
 * @access  Private (Coordinator)
 */
router.post('/:importId/confirm-selections', confirmSectionSelections);

/**
 * @route   GET /api/imports/:importId/appendix
 * @desc    Get appendix content for viewing/copying
 * @access  Private
 */
router.get('/:importId/appendix', getAppendix);

/**
 * @route   GET /api/imports/:importId/full-section/:sectionId
 * @desc    Get full content of a detected section
 * @access  Private
 */
router.get('/:importId/full-section/:sectionId', getFullSectionContent);

// ============================================
// MANUAL TAGGING WORKFLOW
// ============================================

/**
 * @route   GET /api/imports/:importId/content
 * @desc    Get HTML document content from temp file for viewing
 * @access  Private
 */
router.get('/:importId/content', getDocumentContent);

/**
 * @route   GET /api/imports/:importId/images/:filename
 * @desc    Serve an image from the temp folder
 * @access  Private
 */
router.get('/:importId/images/:filename', getDocumentImage);

/**
 * @route   POST /api/imports/:importId/extract-section
 * @desc    Extract a section from the document and save to MongoDB
 * @access  Private (Coordinator)
 */
router.post('/:importId/extract-section', extractSection);

/**
 * @route   GET /api/imports/:importId/tagged-sections
 * @desc    Get list of manually tagged sections
 * @access  Private
 */
router.get('/:importId/tagged-sections', getTaggedSections);

/**
 * @route   GET /api/imports/:importId/tagged-sections/:sectionId
 * @desc    Get full content of a specific tagged section
 * @access  Private
 */
router.get('/:importId/tagged-sections/:sectionId', getTaggedSectionContent);

/**
 * @route   DELETE /api/imports/:importId/tagged-sections/:sectionId
 * @desc    Delete a tagged section
 * @access  Private (Coordinator)
 */
router.delete('/:importId/tagged-sections/:sectionId', deleteTaggedSection);

/**
 * @route   POST /api/imports/:importId/finish-tagging
 * @desc    Finish manual tagging and proceed to processing
 * @access  Private (Coordinator)
 */
router.post('/:importId/finish-tagging', finishTagging);

export default router;
