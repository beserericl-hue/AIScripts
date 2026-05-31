import { Router } from 'express';
import { getEvidenceRecommendations } from '../controllers/evidenceRecommendationsController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// CR-018 / Sprint 4.1 finish — reader-side evidence-recommendations.
router.get(
  '/submissions/:submissionId/specs/:standardCode/:specCode/evidence-recommendations',
  getEvidenceRecommendations
);

export default router;
