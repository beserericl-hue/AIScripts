import { Router } from 'express';
import {
  listChecklist,
  addManualChecklistItem,
  verifyChecklistItem,
  deleteChecklistItem,
  exportChecklistDocx
} from '../controllers/checklistController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// CR-012 / Sprint 6.1 — partial-compliance site-visit checklist.
// PCs are 403 at the controller level; this is a visit-team / lead-reader
// / admin surface only.

router.get('/submissions/:submissionId/checklist', listChecklist);
router.post('/submissions/:submissionId/checklist', addManualChecklistItem);
router.patch('/submissions/:submissionId/checklist/:itemId/verify', verifyChecklistItem);
router.delete('/submissions/:submissionId/checklist/:itemId', deleteChecklistItem);
router.get('/submissions/:submissionId/checklist/export.docx', exportChecklistDocx);

export default router;
