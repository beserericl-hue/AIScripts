import { Router } from 'express';
import {
  getLeadReaderReport,
  saveLeadReaderReport,
  downloadLeadReaderReport,
  getSiteVisitReview,
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

// Site-Visit Review consensus (who agreed / who didn't, per standard). Lead/admin
// only; powers the Reader Report popup. Not printed on any report.
router.get('/submissions/:submissionId/site-visit-review', getSiteVisitReview);

export default router;
