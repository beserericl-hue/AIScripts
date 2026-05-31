import { Router } from 'express';
import {
  createBugReport,
  listBugReports,
  updateBugReport
} from '../controllers/bugReportController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// CR-016 / Sprint 7.2 — in-app bug reporter.
router.post('/bug-reports', createBugReport);
router.get('/admin/bug-reports', listBugReports);
router.patch('/admin/bug-reports/:id', updateBugReport);

export default router;
