import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  createParserTrainRun,
  diagnoseParserTrain,
  setParserTrainRule,
  approveParserTrainSpec,
  listParserTrainRuns,
} from '../controllers/parserTrainController';

// Parser Train (CR-073) — superuser-only. Every handler self-guards via isSU(),
// but the router still requires a valid session first.
const router = Router();
router.use(authenticate);

router.get('/runs', listParserTrainRuns);
router.post('/', createParserTrainRun);
router.post('/set-rule', setParserTrainRule);
router.post('/:importId/diagnose', diagnoseParserTrain);
router.post('/:importId/approve-spec', approveParserTrainSpec);

export default router;
