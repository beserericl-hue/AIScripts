import { Router } from 'express';
import {
  listThreads,
  createThread,
  getThread,
  postMessage
} from '../controllers/directMessageController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// CR-010 / Sprint 5.4 — Portal direct messaging.
// PCs are 403 at the controller level; this is a reader / lead_reader /
// admin surface only.

router.get('/submissions/:submissionId/messages', listThreads);
router.post('/submissions/:submissionId/messages', createThread);
router.get('/messages/:threadId', getThread);
router.post('/messages/:threadId', postMessage);

export default router;
