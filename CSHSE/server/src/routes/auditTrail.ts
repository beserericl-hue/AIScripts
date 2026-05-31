import { Router } from 'express';
import { listAuditEntries, exportAuditCsv } from '../controllers/auditTrailController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.use(authenticate);

// CR-020 / Sprint 7.3 — admin audit-trail.
router.get('/admin/audit-log', listAuditEntries);
router.get('/admin/audit-log/export.csv', exportAuditCsv);

export default router;
