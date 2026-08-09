import { Router } from 'express';
import multer from 'multer';
import {
  uploadDocument,
  getImport,
  getImportSourceFile,
  getImportSourceFileUrl,
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
  syncDocumentHtml,
  insertPlaceholderMarker,
  getTaggedSections,
  getTaggedSectionContent,
  updateTaggedSection,
  deleteTaggedSection,
  debugImport,
  repairDocument,
  finishTagging,
  // Session persistence
  checkExistingImport,
  discardImport
} from '../controllers/importController';
import {
  startAIImport,
  getAIImportStatus,
  streamAIImportEvents,
  receiveAIEventWebhook,
  receiveAICallback,
  applyAIImport,
  restartAIImport,
  reanchorImportSource,
  contractCheckImport,
  redetectImport,
  createImportCorrection,
  listImportCorrections,
  inferMatrixColumns,
  confirmMatrixColumn,
  inferMatrixRowSpec
} from '../controllers/aiImportController';
// CR-041 — Multi-file batched import.
import {
  createImportBatch,
  addFileToBatch,
  getImportBatch,
  startImportBatch,
  applyImportBatch,
  cancelImportBatch,
  removeFileFromBatch
} from '../controllers/importBatchController';
import { authenticate } from '../middleware/auth';

const router = Router();

// ============================================
// AI Import Wizard webhooks (Sprint 1)
// ============================================
//
// These two routes are called by the cshse-ai service, NOT the browser.
// They authenticate via HMAC signature (raw body captured by the global
// express.json verify hook in index.ts) and so are mounted BEFORE the
// router.use(authenticate) gate below.

router.post('/:importId/ai-event', receiveAIEventWebhook);
router.post('/:importId/ai-callback', receiveAICallback);

// Document images are referenced by <img src="/api/imports/:id/images/:file">
// inside the rendered source-document HTML (Compare / Show-in-source). A browser
// image request can't carry the Bearer token, so this route is mounted BEFORE
// the authenticate gate — otherwise every embedded image 401s and renders
// broken. The image_<uuid4>.ext filenames are unguessable, so a public-by-URL
// image exposes nothing the auth-gated /content HTML doesn't already show an
// authorized viewer.
router.get('/:importId/images/:filename', getDocumentImage);

// All other routes require user authentication.
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

// ============================================
// CR-041 — Multi-file batched import (US-2, partial US-3/US-7)
// ============================================
//
// US-3 kick-off endpoint + the merged Apply (US-8) ship in subsequent
// commits. This slice lands the batch lifecycle: create, add files,
// query, cancel.
router.post('/batch', createImportBatch);
router.post('/batch/:batchId/file', upload.single('file'), addFileToBatch);
router.post('/batch/:batchId/start', startImportBatch);
router.get('/batch/:batchId', getImportBatch);
router.post('/batch/:batchId/apply', applyImportBatch);
router.post('/batch/:batchId/cancel', cancelImportBatch);
router.post('/batch/:batchId/file/:importId/remove', removeFileFromBatch);

/**
 * @route   GET /api/imports/check/:submissionId
 * @desc    Check for existing in-progress import for a submission
 * @access  Private
 */
router.get('/check/:submissionId', checkExistingImport);

/**
 * @route   DELETE /api/imports/:importId/discard
 * @desc    Discard an in-progress import (start fresh)
 * @access  Private (Coordinator)
 */
router.delete('/:importId/discard', discardImport);

/**
 * @route   GET /api/imports/:importId
 * @desc    Get import status and summary
 * @access  Private
 */
router.get('/:importId', getImport);
// Stream the ORIGINAL uploaded document (raw bytes from S3) — used to pull the
// current prod source doc and re-run it through the dev parser.
router.get('/:importId/source-file', getImportSourceFile);
// Signed public URL for the ORIGINAL document — Compare pane renders the true
// source (Office viewer / PDF embed) beside the parser's reconstruction.
router.get('/:importId/source-file-url', getImportSourceFileUrl);

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
// AI Import Wizard (Sprint 1) — coordinator-facing routes
// ============================================
//
// POST start-ai      — kick off a cshse-ai job
// GET  ai-status     — synchronous snapshot (polling fallback)
// GET  ai-events     — SSE primary live updates
// POST apply-ai      — commit writes (stub in sub-sprint 1.a)
// POST restart-ai    — re-run with a different forced format

router.post('/:importId/start-ai', startAIImport);
router.get('/:importId/ai-status', getAIImportStatus);
router.get('/:importId/ai-events', streamAIImportEvents);
router.post('/:importId/apply-ai', applyAIImport);
router.post('/:importId/restart-ai', restartAIImport);
// POST reanchor-source — repair Compare data-section-id anchors from current review state
router.post('/:importId/reanchor-source', reanchorImportSource);
// POST contract-check — run the §7 required-output contract verifier over this import
router.post('/:importId/contract-check', contractCheckImport);
// CR-040 follow-on — re-run standalone detectors (CVs / papers / syllabi
// / introductions) without re-uploading or re-running the matcher. Used
// by the Review surface "Re-run detectors" button.
router.post('/:importId/redetect', redetectImport);
// Coordinator-supplied corrections — see ImportCorrection model.
router.post('/:importId/corrections', createImportCorrection);
router.get('/:importId/corrections', listImportCorrections);

// CR-025 — matrix column inference + confirm. The wizard's Matrix step
// posts here per matrix to get AI-suggested column → course mappings,
// then again per confirmed override.
router.post('/:importId/matrix/infer-columns', inferMatrixColumns);
router.post('/:importId/matrix/confirm-column', confirmMatrixColumn);

// CR-030 — infer subspec for a matrix row when standard is known but
// subspec is unknown (the "Spec 12.?" case in the matrix step).
router.post('/:importId/matrix/infer-row-spec', inferMatrixRowSpec);

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

// NOTE: GET /:importId/images/:filename is mounted ABOVE the authenticate gate
// (see top of file) so embedded <img> tags load without a Bearer token.

/**
 * @route   POST /api/imports/:importId/extract-section
 * @desc    Extract a section from the document and save to MongoDB
 * @access  Private (Coordinator)
 */
router.post('/:importId/extract-section', extractSection);

/**
 * @route   PUT /api/imports/:importId/sync-html
 * @desc    Sync updated document HTML (with placeholders) to GridFS
 * @access  Private (Coordinator)
 */
router.put('/:importId/sync-html', syncDocumentHtml);

/**
 * @route   POST /api/imports/:importId/insert-marker
 * @desc    Insert an HTML comment marker into the GridFS document at the extracted section's position
 * @access  Private (Coordinator)
 */
router.post('/:importId/insert-marker', insertPlaceholderMarker);

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
 * @route   PATCH /api/imports/:importId/tagged-sections/:sectionId
 * @desc    Update a tagged section (e.g., mark as applied)
 * @access  Private (Coordinator)
 */
router.patch('/:importId/tagged-sections/:sectionId', updateTaggedSection);

/**
 * @route   DELETE /api/imports/:importId/tagged-sections/:sectionId
 * @desc    Delete a tagged section
 * @access  Private (Coordinator)
 */
router.delete('/:importId/tagged-sections/:sectionId', deleteTaggedSection);

/**
 * @route   GET /api/imports/:importId/debug
 * @desc    Get section metadata for diagnostic inspection (no GridFS load)
 * @access  Private
 */
router.get('/:importId/debug', debugImport);

/**
 * @route   POST /api/imports/:importId/repair
 * @desc    Re-upload document to repair corrupted GridFS HTML (keeps existing tags)
 * @access  Private (Coordinator)
 */
router.post('/:importId/repair', upload.single('file'), repairDocument);

/**
 * @route   POST /api/imports/:importId/finish-tagging
 * @desc    Finish manual tagging and proceed to processing
 * @access  Private (Coordinator)
 */
router.post('/:importId/finish-tagging', finishTagging);

export default router;
