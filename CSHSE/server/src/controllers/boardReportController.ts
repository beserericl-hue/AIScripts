import { Response } from 'express';
import { Submission } from '../models/Submission';
import { LeadReaderReport } from '../models/LeadReaderReport';
import { AuditLogEntry } from '../models/AuditLogEntry';
import { AuthenticatedRequest } from '../middleware/auth';
import { isBoardSession, isGlobalAdmin } from '../services/roleResolver';
import { buildSystemSections } from './leadReaderReportController';
import {
  generateLeadReaderReportDocx,
  generateLeadReaderReportPdf,
} from '../services/leadReaderReportGenerator';

/**
 * CSHSE Board — READ-ONLY access to COMPLETED Lead Reader Reports across every
 * institution (and their Word / PDF downloads). Nothing else.
 *
 * "Completed" — the LeadReaderReport model has no completion flag of its own;
 * the existing signal that the lead reader is DONE is the submission leaving
 * lead review: the lead's "Complete review & send to board"
 * (POST /compilation/finalize, CR-056 — and the legacy createCompilation) flips
 * the submission to `review_complete`, the status the admin board queue reads;
 * a board decision then moves it to `compliant` / `non_compliant`. So a Lead
 * Reader Report is completed iff its submission's status is one of
 * COMPLETED_LRR_STATUSES. Anything earlier (still with readers / the lead) is
 * invisible to the board. Parser-Train sandbox runs are always excluded.
 *
 * Access: the effective session must be the board role (or a global admin /
 * superuser, so staff can preview what the board sees).
 */
export const COMPLETED_LRR_STATUSES = ['review_complete', 'compliant', 'non_compliant'] as const;

const COMPLETED_FILTER = {
  status: { $in: COMPLETED_LRR_STATUSES as unknown as string[] },
  trainingRun: { $ne: true },
};

function mayUseBoard(req: AuthenticatedRequest): boolean {
  return isBoardSession(req.user as any) || isGlobalAdmin(req.user as any);
}

function deny(res: Response): void {
  res.status(403).json({ error: 'Only CSHSE Board members can view completed Lead Reader Reports here.' });
}

/** Load a submission ONLY when its Lead Reader Report is completed; else 404
 *  (never reveal that an in-progress self-study exists). */
async function loadCompleted(submissionId: string): Promise<any | null> {
  if (!/^[a-f0-9]{24}$/i.test(String(submissionId || ''))) return null;
  return Submission.findOne({ _id: submissionId, ...COMPLETED_FILTER });
}

/** GET /api/board/lead-reader-reports — every completed LRR (all institutions). */
export async function listCompletedLeadReaderReports(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!mayUseBoard(req)) return deny(res);
  try {
    const subs: any[] = await Submission.find(COMPLETED_FILTER)
      .select('submissionId institutionName programName programLevel type status decision updatedAt')
      .lean();
    const ids = subs.map((s) => s._id);
    const [reports, finalized] = await Promise.all([
      LeadReaderReport.find({ submissionId: { $in: ids } })
        .select('submissionId recommendation updatedAt')
        .lean(),
      AuditLogEntry.find({ submissionId: { $in: ids }, action: 'compilation.finalized' })
        .select('submissionId timestamp')
        .sort({ timestamp: -1 })
        .lean(),
    ]);
    const reportBySub = new Map<string, any>(reports.map((r: any) => [String(r.submissionId), r]));
    const finalizedBySub = new Map<string, Date>();
    for (const f of finalized as any[]) {
      const k = String(f.submissionId);
      if (!finalizedBySub.has(k)) finalizedBySub.set(k, f.timestamp);
    }
    const rows = subs.map((s) => {
      const r = reportBySub.get(String(s._id));
      const completedAt = finalizedBySub.get(String(s._id)) || r?.updatedAt || s.updatedAt || null;
      return {
        submissionId: String(s._id),
        submissionCode: s.submissionId,
        institutionName: s.institutionName || '',
        programName: s.programName || '',
        programLevel: s.programLevel || '',
        type: s.type || '',
        status: s.status,
        recommendation: r?.recommendation || '',
        decisionOutcome: s.decision?.outcome || null,
        completedAt,
        hasAuthoredReport: !!r,
      };
    });
    rows.sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime());
    res.json({ reports: rows });
  } catch (error) {
    console.error('Board list LRRs error:', error);
    res.status(500).json({ error: 'Failed to list Lead Reader Reports' });
  }
}

/** GET /api/board/lead-reader-reports/:submissionId — read-only report. */
export async function getCompletedLeadReaderReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!mayUseBoard(req)) return deny(res);
  try {
    const submission = await loadCompleted(req.params.submissionId);
    if (!submission) {
      res.status(404).json({ error: 'No completed Lead Reader Report for this submission.' });
      return;
    }
    const system = await buildSystemSections(submission);
    const report: any = (await LeadReaderReport.findOne({ submissionId: submission._id }).lean()) || null;
    res.json({
      system,
      report,
      status: submission.status,
      decisionOutcome: (submission as any).decision?.outcome || null,
      readOnly: true,
    });
  } catch (error) {
    console.error('Board get LRR error:', error);
    res.status(500).json({ error: 'Failed to load the Lead Reader Report' });
  }
}

/** GET /api/board/lead-reader-reports/:submissionId/download?format=docx|pdf */
export async function downloadCompletedLeadReaderReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!mayUseBoard(req)) return deny(res);
  const submission = await loadCompleted(req.params.submissionId);
  if (!submission) {
    res.status(404).json({ error: 'No completed Lead Reader Report for this submission.' });
    return;
  }
  const format = String(req.query.format || 'pdf').toLowerCase() === 'docx' ? 'docx' : 'pdf';
  const safeName =
    String(submission.institutionName || 'submission').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') ||
    'submission';
  try {
    const buffer =
      format === 'docx'
        ? await generateLeadReaderReportDocx(String(submission._id))
        : await generateLeadReaderReportPdf(String(submission._id));
    res.setHeader(
      'Content-Type',
      format === 'docx'
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/pdf'
    );
    res.setHeader('Content-Disposition', `attachment; filename="LeadReaderReport-${safeName}.${format}"`);
    res.end(buffer);
  } catch (error) {
    console.error('Board download LRR error:', error);
    res.status(500).json({ error: 'Failed to generate the Lead Reader Report.' });
  }
}
