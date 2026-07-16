import { Router } from 'express';
import {
  getLeadReaderReport,
  saveLeadReaderReport,
  downloadLeadReaderReport,
} from '../controllers/leadReaderReportController';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// Lead Reader Report to VPA to Request Board Action. System-generated program
// info + required-courses (from the matrix) + compiled non-compliance, merged
// with the lead-reader-authored fields. Lead reader / admin only.
router.get('/submissions/:submissionId/lead-reader-report', getLeadReaderReport);
router.put('/submissions/:submissionId/lead-reader-report', saveLeadReaderReport);
// Branded DOCX/PDF download of the Lead Reader Report. ?format=docx|pdf
router.get('/submissions/:submissionId/lead-reader-report/download', downloadLeadReaderReport);

export default router;
