import { Router } from 'express';
import {
  getSubmission,
  getSubmissionProgress,
  getWorkflowSummary,
  saveNarrative,
  saveIntroduction,
  submitStandard,
  revertStandard,
  submitSelfStudy,
  revalidateFailed,
  getFailedValidations,
  getSpecEvaluation,
  evaluateSpec,
  recordSectionEvalOverride,
  markStandardComplete,
  markSpecNotApplicable,
  clearSpecNotApplicable,
  adminUnlockSubmission,
  getSubmissionPreflight,
  listSubmissions,
  createSubmission,
  updateProgramLevel
} from '../controllers/submissionController';
import { authenticate } from '../middleware/auth';
import { submissionLockout } from '../middleware/submissionLockout';
import multer from 'multer';

const router = Router();

// Bulk supporting-evidence upload — memory storage, 50MB/file, up to 30 files.
// Accepts pdf/docx/xlsx/pptx (the formats the review + Office viewer support).
const bulkEvidenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 30 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/tiff',
    ];
    // Some browsers (and non-browser clients) send Office files as a generic
    // application/octet-stream — fall back to the extension so xlsx/pptx aren't
    // wrongly rejected. The extractor + storage key off the real bytes anyway.
    const okExt = /\.(pdf|docx?|pptx?|xlsx?|png|jpe?g|gif|webp|tiff?)$/i.test(file.originalname || '');
    if (allowed.includes(file.mimetype) || okExt) cb(null, true);
    else cb(new Error(`File type not allowed: ${file.mimetype}`));
  },
});

// All routes require authentication
router.use(authenticate);

// ============================================
// SUBMISSION ROUTES
// ============================================

/**
 * @route   GET /api/submissions
 * @desc    List all submissions for current user
 * @access  Private
 * @query   status - Filter by status
 * @query   limit - Number of results (default 10)
 * @query   offset - Pagination offset
 * @query   institutionId - Filter by institution
 */
router.get('/', listSubmissions);

/**
 * @route   POST /api/submissions
 * @desc    Create a new submission/self-study
 * @access  Private (Program Coordinator)
 */
router.post('/', createSubmission);

/**
 * @route   PATCH /api/submissions/:submissionId/program-level
 * @desc    Correct a submission's degree level (fixes phantom spec rows + wrong rubric)
 * @access  Private (owner / coordinator / superuser)
 */
router.patch('/:submissionId/program-level', updateProgramLevel);

/**
 * @route   GET /api/submissions/:submissionId
 * @desc    Get submission by ID
 * @access  Private
 */
router.get('/:submissionId', getSubmission);

/**
 * @route   GET /api/submissions/:submissionId/progress
 * @desc    Get detailed progress for a submission
 * @access  Private
 */
router.get('/:submissionId/progress', getSubmissionProgress);

/**
 * @route   GET /api/submissions/:submissionId/workflow-summary
 * @desc    CR-047 — derived rollup for the PC dashboard's IMPORT →
 *          DRAFTS → SELF-STUDY → SUBMIT workflow sections.
 * @access  Private (Program Coordinator owner, Admin)
 */
router.get('/:submissionId/workflow-summary', getWorkflowSummary);

/**
 * @route   PATCH /api/submissions/:submissionId/narrative
 * @desc    Save narrative content for a standard/specification
 * @access  Private (Program Coordinator, Admin)
 */
router.patch('/:submissionId/narrative', submissionLockout, saveNarrative);

/**
 * @route   PATCH /api/submissions/:submissionId/introduction
 * @desc    Save document-level or standard-level Introduction body
 *          (CR-039 Phase 2c part 2)
 * @access  Private (Program Coordinator, Admin)
 * @body    { scope: 'document' | 'standard', standardCode?: string, content: string }
 */
router.patch('/:submissionId/introduction', submissionLockout, saveIntroduction);

// ============================================
// CR-043 — submission-scoped persisted Review + Matrix state
// ============================================
//
// Review state survives wizard close + re-open + multi-author imports.
// Per-item approve/discard mutations write through to the persisted
// state. Apply walks the persisted state and pushes approved items
// into the Submission's narratives + supporting evidence + matrices.

import {
  getReviewState,
  approveItem,
  discardItem,
  clearItem,
  routeEvidence,
  setEvidenceDocReferences,
  splitReviewItem,
  setApprovedIds,
  saveReviewState,
  finishReview,
  applyReviewState,
  getMatrixState,
  setMatrixRowEdit,
  evaluateAllSpecs,
  getEvalProgress,
  getReviewEvidenceDocFile,
  bulkAddEvidence,
  getReviewEvidenceDocPublicUrl,
  recomputeCoverage,
  getCoverageProgress,
  denoiseNarratives,
  reconcileSpecLevel,
  suggestStandardForEvidence,
  dedupeImports,
  stripContextBleed,
} from '../controllers/aiReviewController';

router.get('/:submissionId/review', getReviewState);
router.get('/:submissionId/review/evidence-doc/:sectionId/file', getReviewEvidenceDocFile);
// Short-lived public URL for the Office web viewer (xlsx/pptx native render).
router.get('/:submissionId/review/evidence-doc/:sectionId/public-url', getReviewEvidenceDocPublicUrl);
// Bulk drag-and-drop supporting-evidence import (creates File-Library rows +
// review-rail cards with AI-suggested standard/sub-spec).
router.post(
  '/:submissionId/review/bulk-evidence',
  submissionLockout,
  bulkEvidenceUpload.array('files', 30),
  bulkAddEvidence
);
router.post('/:submissionId/review/approve', submissionLockout, approveItem);
router.post('/:submissionId/review/discard', submissionLockout, discardItem);
router.post('/:submissionId/review/clear-item', submissionLockout, clearItem);
// Persist a CV/Syllabi/Paper Standard+Substandard assignment so it survives
// reload + Re-run detectors (lived only in the browser store before).
router.post('/:submissionId/review/route-evidence', submissionLockout, routeEvidence);
// Persist MULTIPLE Standard/Substandard references for one appendix/evidence doc
// so a single file can be linked under several specs (chips + Add-reference UI).
router.post('/:submissionId/review/evidence-doc-references', submissionLockout, setEvidenceDocReferences);
// Move part of a mis-parsed card into another subspec (split source + add new).
router.post('/:submissionId/review/split-item', submissionLockout, splitReviewItem);
// Persist the whole approved-id set (Approve / Approve-all / Clear).
router.post('/:submissionId/review/set-approved', submissionLockout, setApprovedIds);
// Background AI-evaluation queue: "Validate all" enqueues every spec; poll progress.
router.post('/:submissionId/review/evaluate-all', submissionLockout, evaluateAllSpecs);
// "Check coverage" — (re)run the AI coverage reviewer over the filled specs so
// the green/yellow/red dots + "why" tooltips have real data (backfills imports
// that never ran it, e.g. older MCC imports).
router.post('/:submissionId/review/recompute-coverage', submissionLockout, recomputeCoverage);
// Clean an already-duplicated review state (re-read under a different filename
// before the merge fix): keep the newest document parse, drop older duplicates.
router.post('/:submissionId/review/dedupe-imports', submissionLockout, dedupeImports);
// Strip the "<Standard Title> Context: <rubric>" descriptor bleed from stored
// narratives (mirrors the template-walker fix for already-parsed submissions).
router.post('/:submissionId/review/strip-context-bleed', submissionLockout, stripContextBleed);
// Clean curriculum-matrix garbage out of an already-parsed submission's narratives.
router.post('/:submissionId/review/denoise-narratives', submissionLockout, denoiseNarratives);
// Remove EMPTY spec rows not in the submission's degree level (an associate study
// seeded with baccalaureate-only specs like 12.g/12.h). Prunes empties only.
router.post('/:submissionId/review/reconcile-spec-level', submissionLockout, reconcileSpecLevel);
// AI-classify a SINGLE existing library file: suggest which Standard/sub-spec it
// supports (reference-match + AI placement) so files that never hit the Review
// panel can be routed. Suggest-only; the client confirms + saves via evidence PATCH.
router.post('/:submissionId/evidence/:evidenceId/suggest-standard', suggestStandardForEvidence);
router.get('/:submissionId/review/eval-progress', getEvalProgress);
// Progress of the background coverage re-check queue.
router.get('/:submissionId/review/coverage-progress', getCoverageProgress);
// Autosave review-rail content (change-kind, reassign, edit, move, etc.).
router.post('/:submissionId/review/save-state', submissionLockout, saveReviewState);
// CR-048 — "I'm done reviewing": discard all remaining un-triaged drafts.
router.post('/:submissionId/review/finish', submissionLockout, finishReview);
router.post('/:submissionId/review/apply', submissionLockout, applyReviewState);
router.get('/:submissionId/matrix-state', getMatrixState);
router.post('/:submissionId/matrix-state', submissionLockout, setMatrixRowEdit);

/**
 * @route   GET /api/submissions/:submissionId/preflight
 * @desc    CR-008 / S2A.2 — structured "what's missing" + "what's worth
 *          knowing" for the FinalSubmitModal. Mirrors the server submit
 *          gate so the popup and the server agree on readiness.
 * @access  Private (PC owner, Admin)
 */
router.get('/:submissionId/preflight', getSubmissionPreflight);

/**
 * @route   POST /api/submissions/:submissionId/submit
 * @desc    Submit the entire self-study for review (locks the submission)
 * @access  Private (Program Coordinator only - must be owner)
 */
router.post('/:submissionId/submit', submitSelfStudy);

/**
 * @route   POST /api/submissions/:submissionId/unlock
 * @desc    CR-005 S2A.4 — Admin-only override that reverts a final-submitted
 *          submission to in_progress + clears any reader lock. Distinct
 *          from the reader-side DELETE /api/submissions/:id/lock, which
 *          only clears a reader lock (and cannot lift the system lock).
 * @access  Private (Admin or superuser only)
 * @body    { reason?: string }
 */
router.post('/:submissionId/unlock', adminUnlockSubmission);

/**
 * @route   POST /api/submissions/:submissionId/standards/:standardCode/submit
 * @desc    Submit a standard for validation
 * @access  Private (Program Coordinator, Admin)
 */
router.post('/:submissionId/standards/:standardCode/submit', submissionLockout, submitStandard);

/**
 * @route   POST /api/submissions/:submissionId/standards/:standardCode/revert
 * @desc    Revert a standard from `submitted` back to `in_progress` (PC may continue editing)
 * @access  Private (Program Coordinator owner, Admin)
 */
router.post('/:submissionId/standards/:standardCode/revert', submissionLockout, revertStandard);

/**
 * @route   POST /api/submissions/:submissionId/revalidate
 * @desc    Revalidate failed sections only (incremental)
 * @access  Private (Program Coordinator, Admin)
 * @body    standardCode - Optional: limit to specific standard
 */
router.post('/:submissionId/revalidate', submissionLockout, revalidateFailed);

/**
 * @route   GET /api/submissions/:submissionId/failed
 * @desc    Get failed validations for a submission
 * @access  Private
 * @query   standardCode - Optional: filter by standard
 */
router.get('/:submissionId/failed', getFailedValidations);

/**
 * @route   GET /api/submissions/:submissionId/standards/:standardCode/specs/:specCode/evaluation
 * @desc    CR-049 — latest AI section evaluation (verdict + rationale) for a spec
 * @access  Private
 */
router.get('/:submissionId/standards/:standardCode/specs/:specCode/evaluation', getSpecEvaluation);

/**
 * @route   POST /api/submissions/:submissionId/standards/:standardCode/specs/:specCode/evaluate
 * @desc    CR-049 — run the AI evaluator for one spec on demand ("Run AI Review")
 * @access  Private (Program Coordinator owner, Admin)
 */
router.post('/:submissionId/standards/:standardCode/specs/:specCode/evaluate', evaluateSpec);

/**
 * @route   POST /api/submissions/:submissionId/standards/:standardCode/specs/:specCode/override
 * @desc    CR-049 Phase 4b — reader overrides the AI verdict; feeds the
 *          learning store (section_eval_override). Reader/lead/admin only.
 * @access  Private (Reader, Lead Reader, Admin)
 */
router.post('/:submissionId/standards/:standardCode/specs/:specCode/override', recordSectionEvalOverride);

/**
 * @route   POST /api/submissions/:submissionId/standards/:standardCode/complete
 * @desc    Mark a standard as complete (manual)
 * @access  Private (Program Coordinator, Admin)
 */
router.post('/:submissionId/standards/:standardCode/complete', submissionLockout, markStandardComplete);

/**
 * @route   POST /api/submissions/:submissionId/standards/:standardCode/specs/:specCode/not-applicable
 * @desc    CR-050 — Mark a single spec as "not applicable / intentionally
 *          omitted". The submit-readiness gate then treats it as satisfied.
 * @access  Private (Program Coordinator owner, Admin)
 * @body    { reason?: string }
 */
router.post('/:submissionId/standards/:standardCode/specs/:specCode/not-applicable', submissionLockout, markSpecNotApplicable);

/**
 * @route   DELETE /api/submissions/:submissionId/standards/:standardCode/specs/:specCode/not-applicable
 * @desc    CR-050 — Clear the N/A flag on a spec.
 * @access  Private (Program Coordinator owner, Admin)
 */
router.delete('/:submissionId/standards/:standardCode/specs/:specCode/not-applicable', submissionLockout, clearSpecNotApplicable);

export default router;
