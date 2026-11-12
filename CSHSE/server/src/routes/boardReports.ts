import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  listCompletedLeadReaderReports,
  getCompletedLeadReaderReport,
  downloadCompletedLeadReaderReport,
} from '../controllers/boardReportController';

// CSHSE Board — read-only access to COMPLETED Lead Reader Reports (all
// institutions). These are the ONLY routes a board session can use; every
// submission-scoped route refuses a board session (submissionAccessGuard).
const router = Router();
router.use(authenticate);

router.get('/lead-reader-reports', listCompletedLeadReaderReports);
router.get('/lead-reader-reports/:submissionId', getCompletedLeadReaderReport);
router.get('/lead-reader-reports/:submissionId/download', downloadCompletedLeadReaderReport);

export default router;
