import { Router } from 'express';
import {
  recordBoardDecision,
  upcomingReaccreditations,
  boardQueue
} from '../controllers/boardDecisionController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// CR-053 / Sprint 7.1 — Board decisions + cycle scheduler.
router.post('/submissions/:submissionId/decision', recordBoardDecision);
router.get('/board/queue', boardQueue);
router.get('/board/upcoming-reaccreditations', upcomingReaccreditations);

export default router;
