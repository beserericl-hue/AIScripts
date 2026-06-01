import { Router } from 'express';
import {
  getCompilation,
  getFinalScoresForReader,
  setFinalScore,
  clearFinalScore,
  exportSuggestionsDoc,
  finalizeCompilation
} from '../controllers/compilationController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// CR-009 / Sprint 5.1 — lead-reader compilation surface (0-3 Scores
// side-by-side + Final score). Sits next to the existing
// /api/lead-reviews (LeadReaderCompilation, compliance triplet, legacy).

router.get('/submissions/:submissionId/compilation', getCompilation);
// CR-009 follow-on / Sprint 11.3 — readers (assigned) + lead/admin can read
// the lead reader's Final scores (transparency default). Raw peer votes stay
// lead/admin-only via getCompilation.
router.get('/submissions/:submissionId/final-scores', getFinalScoresForReader);
router.put('/submissions/:submissionId/compilation/final-score', setFinalScore);
router.delete('/submissions/:submissionId/compilation/final-score', clearFinalScore);

// CR-011 / Sprint 5.2 — consolidated suggestions DOCX export.
router.get('/submissions/:submissionId/compilation/suggestions-doc', exportSuggestionsDoc);

// CR-056 — lead-reader "Complete review & send to board": flips the
// submission to `review_complete` so it lands in the board queue. Lead/admin
// only; gated inside the controller.
router.post('/submissions/:submissionId/compilation/finalize', finalizeCompilation);

export default router;
