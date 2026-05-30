import { Router } from 'express';
import {
  getCompilation,
  setFinalScore,
  clearFinalScore,
  exportSuggestionsDoc
} from '../controllers/compilationController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// CR-009 / Sprint 5.1 — lead-reader compilation surface (0-3 Scores
// side-by-side + Final score). Sits next to the existing
// /api/lead-reviews (LeadReaderCompilation, compliance triplet, legacy).

router.get('/submissions/:submissionId/compilation', getCompilation);
router.put('/submissions/:submissionId/compilation/final-score', setFinalScore);
router.delete('/submissions/:submissionId/compilation/final-score', clearFinalScore);

// CR-011 / Sprint 5.2 — consolidated suggestions DOCX export.
router.get('/submissions/:submissionId/compilation/suggestions-doc', exportSuggestionsDoc);

export default router;
