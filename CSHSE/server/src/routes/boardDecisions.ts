import { Router } from 'express';
import {
  recordBoardDecision,
  upcomingReaccreditations,
  boardQueue,
  runCycleReminders,
  spinUpReaccreditations
} from '../controllers/boardDecisionController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// CR-053 / Sprint 7.1 — Board decisions + cycle scheduler.
router.post('/submissions/:submissionId/decision', recordBoardDecision);
router.get('/board/queue', boardQueue);
router.get('/board/upcoming-reaccreditations', upcomingReaccreditations);
router.post('/board/run-cycle-reminders', runCycleReminders);
// CR-053 / S12.1 — reaccreditation workflow auto-creation.
router.post('/board/spin-up-reaccreditations', spinUpReaccreditations);

export default router;
