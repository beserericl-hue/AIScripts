import { Router } from 'express';
import {
  getCompilation,
  setFinalMark,
  clearFinalMark,
  exportSuggestionsDoc,
  finalizeCompilation
} from '../controllers/compilationController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// CR-009 / Sprint 5.1 — lead-reader compilation surface: every reader's
// Compliant / Non-compliant mark side-by-side + the lead reader's Final mark.
// (Lauri CR Nov 2026 retired the 0–3 score and its /final-score(s) routes.)

router.get('/submissions/:submissionId/compilation', getCompilation);
router.put('/submissions/:submissionId/compilation/final-mark', setFinalMark);
router.delete('/submissions/:submissionId/compilation/final-mark', clearFinalMark);

// CR-011 / Sprint 5.2 — consolidated suggestions DOCX export.
router.get('/submissions/:submissionId/compilation/suggestions-doc', exportSuggestionsDoc);

// CR-056 — lead-reader "Complete review & send to board": flips the
// submission to `review_complete` so it lands in the board queue. Lead/admin
// only; gated inside the controller.
router.post('/submissions/:submissionId/compilation/finalize', finalizeCompilation);

export default router;
