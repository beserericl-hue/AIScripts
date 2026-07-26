import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  createParserTrainRun,
  diagnoseParserTrain,
  setParserTrainRule,
  approveParserTrainSpec,
  listParserTrainRuns,
  autoRefineParserTrain,
  refineStatusParserTrain,
  markGoldensGreen,
  getGuard,
  getReviewPage,
  addParserTrainNote,
} from '../controllers/parserTrainController';

// Parser Train (CR-073) — superuser-only. Every handler self-guards via isSU(),
// but the router still requires a valid session first.
const router = Router();
router.use(authenticate);

router.get('/runs', listParserTrainRuns);
router.get('/guard', getGuard);
router.post('/mark-goldens-green', markGoldensGreen);
router.post('/', createParserTrainRun);
router.post('/set-rule', setParserTrainRule);
router.get('/:importId/review-page', getReviewPage);
router.post('/:importId/note', addParserTrainNote);
router.post('/:importId/diagnose', diagnoseParserTrain);
router.post('/:importId/approve-spec', approveParserTrainSpec);
router.post('/:importId/auto-refine', autoRefineParserTrain);
router.get('/:importId/refine-status', refineStatusParserTrain);

export default router;
