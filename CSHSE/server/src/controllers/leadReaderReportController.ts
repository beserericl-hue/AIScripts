import { Request, Response } from 'express';
import { Submission } from '../models/Submission';
import { Assignment } from '../models/Assignment';
import { Comment } from '../models/Comment';
import { CurriculumMatrix } from '../models/CurriculumMatrix';
import { SiteVisit } from '../models/SiteVisit';
import { LeadReaderReport } from '../models/LeadReaderReport';
import { requireSubmissionAccess } from '../services/submissionAccessGuard';
import {
  generateLeadReaderReportDocx,
  generateLeadReaderReportPdf,
} from '../services/leadReaderReportGenerator';

interface AuthenticatedRequest extends Request {
  user?: any;
}

/**
 * Lead Reader Report to VPA to Request Board Action — assembles the
 * system-generated sections fresh (program metadata, required-courses list,
 * compiled non-compliance) and merges the lead-reader-authored fields stored in
 * LeadReaderReport. Distinct from the combined reader report.
 *
 * Access: lead_reader / admin / superuser (same gate as the compilation
 * surface), AND requireSubmissionAccess (assigned lead reader or admin).
 */

function isLeadOrAdmin(req: AuthenticatedRequest): boolean {
  const role = req.user?.role;
  return role === 'lead_reader' || role === 'admin' || req.user?.isSuperuser === true;
}

const DEGREE_LABEL: Record<string, string> = {
  associate: 'Associate',
  bachelors: 'Baccalaureate',
  masters: "Master's",
};
const TYPE_TO_STATUS: Record<string, 'initial' | 'reaccreditation' | 'interim'> = {
  initial: 'initial',
  reaccreditation: 'reaccreditation',
  extension: 'interim',
};

/** Build the system-generated sections from live submission data. */
export async function buildSystemSections(submission: any) {
  const submissionId = submission._id;

  // Readers from active assignments; the lead reader is stamped on each.
  const assignments: any[] = await Assignment.find({ submissionId, status: 'active' })
    .select('userName role leadReaderName')
    .lean();
  const leadReaderName =
    assignments.find((a) => a.leadReaderName)?.leadReaderName ||
    assignments.find((a) => a.role === 'lead_reader')?.userName ||
    '';
  const additionalReaders = assignments
    .map((a) => a.userName)
    .filter((n) => n && n !== leadReaderName);

  // Required courses from the curriculum matrices: non-human-services → General
  // Education; human-services → Program courses.
  const matrices: any[] = await CurriculumMatrix.find({ submissionId })
    .select('matrixType courses')
    .lean();
  const courseLabel = (c: any) =>
    [c.coursePrefix, c.courseNumber].filter(Boolean).join(' ').trim() +
    (c.courseName ? `${c.coursePrefix || c.courseNumber ? ' — ' : ''}${c.courseName}` : '');
  const collect = (type: string) =>
    matrices
      .filter((m) => m.matrixType === type)
      .flatMap((m) => (m.courses || []).slice().sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0)))
      .map(courseLabel)
      .filter(Boolean);
  const generalEducationCourses = collect('non_human_services_courses');
  const programCourses = [...collect('human_services_courses'), ...collect('custom')];

  // Compiled non-compliance: specs whose validation failed, with reader comments.
  const status =
    submission.standardsStatus instanceof Map
      ? Object.fromEntries(submission.standardsStatus)
      : submission.standardsStatus || {};
  const failedKeys = Object.entries(status)
    .filter(([, v]: [string, any]) => v?.validationStatus === 'fail' && !v?.excluded)
    .map(([k]) => k); // "std_spec"
  const comments: any[] = await Comment.find({ submissionId })
    .select('content standardCode specCode')
    .lean();
  const bySpec = new Map<string, string[]>();
  for (const c of comments) {
    if (!c.standardCode) continue;
    const key = `${c.standardCode}${c.specCode || ''}`;
    if (!bySpec.has(key)) bySpec.set(key, []);
    if (c.content) bySpec.get(key)!.push(String(c.content).trim());
  }
  const nonCompliance = failedKeys.map((k) => {
    const [std, spec] = k.split('_');
    const label = `${std}${spec || ''}`;
    const notes = bySpec.get(label) || [];
    return { spec: label, comments: notes };
  });

  const siteVisit: any = await SiteVisit.findOne({ submissionId }).select('scheduledDate').lean();

  return {
    institutionName: submission.institutionName || '',
    programName: submission.programName || '',
    programLevel: submission.programLevel || '',
    degreeLabel: DEGREE_LABEL[submission.programLevel] || submission.programLevel || '',
    accreditationStatusDefault: TYPE_TO_STATUS[submission.type] || 'initial',
    siteVisitDateDefault: siteVisit?.scheduledDate
      ? new Date(siteVisit.scheduledDate).toLocaleDateString('en-US')
      : '',
    leadReaderName,
    additionalReaders,
    generalEducationCourses,
    programCourses,
    nonCompliance,
  };
}

/** GET /api/submissions/:submissionId/lead-reader-report */
export async function getLeadReaderReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!isLeadOrAdmin(req)) {
    res.status(403).json({ error: 'Only a lead reader or admin may open the Lead Reader Report.' });
    return;
  }
  const submission = await requireSubmissionAccess(req as any, res, req.params.submissionId);
  if (!submission) return;

  const system = await buildSystemSections(submission);
  const saved: any =
    (await LeadReaderReport.findOne({ submissionId: submission._id }).lean()) || null;

  res.json({ system, report: saved });
}

const EDITABLE_FIELDS = [
  'vpaRecipients', 'contactInfo', 'accreditationStatus', 'initialAccreditationDate',
  'lastReaccreditationDate', 'siteVisitDate', 'noSiteVisitRequired', 'programDescription',
  'strengthsFromSelfStudy', 'strengthsFromSiteVisit', 'nonComplianceText',
  'requiredCoursesOverride', 'recommendation', 'conditionalRequirements', 'holdExplanation',
  'additionalRecommendations', 'nextSelfStudySuggestions', 'submittedByName', 'submissionDate',
] as const;

/** PUT /api/submissions/:submissionId/lead-reader-report — save lead-reader fields. */
export async function saveLeadReaderReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!isLeadOrAdmin(req)) {
    res.status(403).json({ error: 'Only a lead reader or admin may edit the Lead Reader Report.' });
    return;
  }
  const submission = await requireSubmissionAccess(req as any, res, req.params.submissionId);
  if (!submission) return;

  const set: Record<string, any> = { updatedBy: req.user?.id };
  for (const f of EDITABLE_FIELDS) {
    if (req.body[f] !== undefined) set[f] = req.body[f];
  }
  const saved = await LeadReaderReport.findOneAndUpdate(
    { submissionId: submission._id },
    { $set: set, $setOnInsert: { submissionId: submission._id } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
  res.json({ ok: true, report: saved });
}

/**
 * GET /api/submissions/:submissionId/lead-reader-report/download?format=docx|pdf
 * Streams the Lead Reader Report as a branded DOCX or PDF. Same access gate as
 * the read/save handlers (lead reader / admin / superuser + requireSubmissionAccess).
 */
export async function downloadLeadReaderReport(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!isLeadOrAdmin(req)) {
    res.status(403).json({ error: 'Only a lead reader or admin may download the Lead Reader Report.' });
    return;
  }
  const submission = await requireSubmissionAccess(req as any, res, req.params.submissionId);
  if (!submission) return;

  const format = String(req.query.format || 'pdf').toLowerCase() === 'docx' ? 'docx' : 'pdf';
  const safeName = String(submission.institutionName || 'submission').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'submission';
  const filename = `LeadReaderReport-${safeName}.${format}`;

  try {
    const buffer =
      format === 'docx'
        ? await generateLeadReaderReportDocx(String(submission._id))
        : await generateLeadReaderReportPdf(String(submission._id));
    const mime =
      format === 'docx'
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        : 'application/pdf';
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.end(buffer);
  } catch (error) {
    console.error('Download lead reader report error:', error);
    res.status(500).json({ error: 'Failed to generate the Lead Reader Report.' });
  }
}
