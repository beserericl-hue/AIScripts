import { Request, Response } from 'express';
import { Submission } from '../models/Submission';
import { Assignment } from '../models/Assignment';
import { User } from '../models/User';
import { Comment } from '../models/Comment';
import { CurriculumMatrix } from '../models/CurriculumMatrix';
import { SupportingEvidence } from '../models/SupportingEvidence';
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

// Course prefixes that always denote a Human-Services / program course (so a
// program whose own courses are outnumbered by gen-ed syllabi is still split
// correctly). Everything else falls back to the "most common prefix = program"
// heuristic in deriveCoursesFromSyllabi.
const KNOWN_PROGRAM_PREFIXES = new Set(['chs', 'hs', 'hsv', 'hserv', 'hmsv', 'hums', 'hsrv', 'hser']);

/** Turn a syllabus-TOC slug ("chs-315-515-group-counseling") into a display
 *  label ("CHS 315/515 — Group Counseling") + its lowercased prefix. */
function parseCourseSlug(slug: string): { prefix: string; label: string } | null {
  const parts = String(slug).split('-').filter(Boolean);
  if (parts.length === 0) return null;
  const prefix = parts[0].toLowerCase();
  let i = 1;
  const nums: string[] = [];
  while (i < parts.length && /^\d+[a-z]?$/i.test(parts[i])) { nums.push(parts[i]); i++; }
  const name = parts.slice(i).join(' ').trim();
  const titled = name.replace(/\b\w/g, (c) => c.toUpperCase());
  const label = `${prefix.toUpperCase()}${nums.length ? ' ' + nums.join('/') : ''}${titled ? ' — ' + titled : ''}`.trim();
  return { prefix, label };
}

/** Pull a "PREFIX NUMBER" course identifier out of a syllabus FILE NAME, e.g.
 *  "HUS 275 Master Syllabi.pdf" → {prefix:'hus', label:'HUS 275'}. Used when the
 *  syllabi were imported without TOC tags (so `rev:syllabus-toc:` is absent). */
function parseCourseFromFileName(name: string): { prefix: string; label: string } | null {
  const base = String(name || '').replace(/\.[a-z0-9]+$/i, '');
  const mt = /\b([A-Za-z]{2,4})\s*[-_ ]?\s*(\d{2,4}[A-Za-z]?)\b/.exec(base);
  if (!mt) return null;
  const prefix = mt[1].toLowerCase();
  // A short trailing title after the code (best-effort), stopping at filler words.
  const after = base.slice((mt.index || 0) + mt[0].length).replace(/[_-]+/g, ' ').trim();
  const title = after.replace(/\b(master|masters|syllabus|syllabi|updated|final|v?\d{4}|fall|spring|summer)\b/gi, '').trim();
  const label = `${prefix.toUpperCase()} ${mt[2]}${title ? ' — ' + title.replace(/\b\w/g, (c) => c.toUpperCase()) : ''}`.trim();
  return { prefix, label };
}

/** Derive the course list from imported syllabi when the curriculum matrix has
 *  no named courses. Sources, in order: `rev:syllabus-toc:<n>:<slug>` tags (rich),
 *  then syllabus FILE NAMES (kind:syllabus) as a fallback. Splits Program vs
 *  General-Education by course prefix. */
async function deriveCoursesFromSyllabi(submissionId: any): Promise<{ general: string[]; program: string[] }> {
  const ev: any[] = await SupportingEvidence.find({
    submissionId,
    isDeleted: { $ne: true },
    $or: [{ tags: { $regex: '^rev:syllabus-toc:' } }, { tags: { $regex: '^kind:syllabus' } }],
  }).select('tags file.originalName').lean();
  const parsedMap = new Map<string, { prefix: string; label: string }>();
  const add = (p: { prefix: string; label: string } | null) => {
    if (p && !parsedMap.has(p.label.toLowerCase())) parsedMap.set(p.label.toLowerCase(), p);
  };
  for (const e of ev) {
    const tags = (e.tags || []).map(String);
    const tocTags = tags.filter((t: string) => /^rev:syllabus-toc:\d+:/.test(t));
    if (tocTags.length) {
      for (const t of tocTags) {
        const mt = /^rev:syllabus-toc:\d+:(.+)$/.exec(t);
        if (mt && mt[1]) add(parseCourseSlug(mt[1]));
      }
    } else if (tags.some((t: string) => t.startsWith('kind:syllabus'))) {
      // No TOC tags on this syllabus — fall back to its file name.
      add(parseCourseFromFileName(e.file?.originalName || ''));
    }
  }
  const parsed = [...parsedMap.values()];
  if (parsed.length === 0) return { general: [], program: [] };
  // Program prefix = the most common prefix among the syllabi (the program's own courses).
  const freq = new Map<string, number>();
  for (const p of parsed) freq.set(p.prefix, (freq.get(p.prefix) || 0) + 1);
  let dominant = ''; let best = 0;
  for (const [pre, n] of freq) if (n > best) { best = n; dominant = pre; }
  const isProgram = (pre: string) => KNOWN_PROGRAM_PREFIXES.has(pre) || pre === dominant;
  const program: string[] = []; const general: string[] = [];
  for (const p of parsed.sort((a, b) => a.label.localeCompare(b.label))) {
    (isProgram(p.prefix) ? program : general).push(p.label);
  }
  return { general, program };
}

/** Build the system-generated sections from live submission data. */
export async function buildSystemSections(submission: any) {
  const submissionId = submission._id;

  // Readers from active assignments. CR-074 — the Assignment field is
  // `assignmentType` ('lead_reader' | 'reader'), NOT `role` (which doesn't
  // exist on the schema). The LEAD reader is the lead_reader assignment (or the
  // submission.leadReader fallback); the ADDITIONAL readers are the 'reader'
  // assignments ONLY — previously EVERY assignment (including the lead) was
  // listed as an additional reader and the lead slot came back blank.
  const assignments: any[] = await Assignment.find({ submissionId, status: 'active' })
    .select('userName assignmentType userId')
    .lean();
  let leadReaderName = assignments.find((a) => a.assignmentType === 'lead_reader')?.userName || '';
  if (!leadReaderName && submission.leadReader) {
    const lead: any = await User.findById(submission.leadReader).select('firstName lastName').lean();
    if (lead) leadReaderName = `${lead.firstName || ''} ${lead.lastName || ''}`.trim();
  }
  const additionalReaders = assignments
    .filter((a) => a.assignmentType === 'reader')
    .map((a) => a.userName)
    .filter(Boolean);

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
  let generalEducationCourses = collect('non_human_services_courses');
  let programCourses = [...collect('human_services_courses'), ...collect('custom')];
  // Fallback: many submitted matrices have UNNAMED course columns (the grid was
  // imported without course headers), so `courses` is empty and both lists come
  // back blank. Derive the course list from the imported syllabi — their
  // table-of-contents entries carry clean course identifiers (e.g.
  // "chs-360-counseling-strategies-for-individuals") — so the lead reader
  // doesn't have to re-key the curriculum. Program vs General-Education is split
  // by course prefix (the program's own prefix vs everything else).
  if (generalEducationCourses.length === 0 && programCourses.length === 0) {
    const derived = await deriveCoursesFromSyllabi(submissionId);
    generalEducationCourses = derived.general;
    programCourses = derived.program;
  }

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
