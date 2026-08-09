import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Review } from '../models/Review';
import { LeadReaderCompilation } from '../models/LeadReaderCompilation';
import { User } from '../models/User';
import { Score } from '../models/Score';
import { PDFGeneratorService } from '../services/pdfGenerator';
import { generateAndStoreReaderReport, getReaderReportStructure, renderReaderReportBuffers } from '../services/readerReportGenerator';
import { ReaderReport } from '../models/ReaderReport';
import { Comment } from '../models/Comment';
import { Assignment } from '../models/Assignment';
import { isGlobalAdmin, institutionIdsWithRole } from '../services/roleResolver';
import { requireSubmissionAccess } from '../services/submissionAccessGuard';

/**
 * CR-003 / S11.1 — build the per-spec 0-3 score map for a reader's report,
 * keyed by `${standardCode}.${specCode}`. The reader PDF renders these labels
 * next to the pass/fail compliance verdict. Returns an empty map when a reader
 * hasn't scored (the PDF then simply omits the score line).
 */
async function buildReaderScoreMap(
  submissionId: mongoose.Types.ObjectId | string,
  reviewerId: mongoose.Types.ObjectId | string
): Promise<Record<string, number>> {
  const scores = await Score.find({ submissionId, reviewerId })
    .select('standardCode specCode score')
    .lean();
  const map: Record<string, number> = {};
  for (const s of scores) {
    map[`${s.standardCode}.${s.specCode}`] = s.score;
  }
  return map;
}

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
    firstName?: string;
    lastName?: string;
  };
}

/**
 * Generate PDF for a reader report
 */
export const generateReaderReportPDF = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    const _sub = await requireSubmissionAccess(req as any, res, String(review.submissionId)); if (!_sub) return;

    // Check authorization
    if (review.reviewerId.toString() !== req.user?.id && !isLeadOrAdmin(req)) {
      return res.status(403).json({ error: 'Not authorized to generate this report' });
    }

    // Get reader info
    const reader = await User.findById(review.reviewerId);
    if (!reader) {
      return res.status(404).json({ error: 'Reader not found' });
    }

    // Generate PDF — CR-003: include the reader's captured 0-3 scores.
    const scoreMap = await buildReaderScoreMap(review.submissionId, review.reviewerId);
    const pdfGenerator = new PDFGeneratorService();
    const pdfBuffer = await pdfGenerator.generateReaderReport(review, {
      firstName: reader.firstName,
      lastName: reader.lastName,
      email: reader.email
    }, scoreMap);

    // Set response headers
    const filename = `reader-report-${review.institutionName.replace(/\s+/g, '-')}-${review.reviewerNumber}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Generate reader report PDF error:', error);
    return res.status(500).json({ error: 'Failed to generate PDF' });
  }
};

/**
 * Generate PDF for a lead reader compilation report
 */
export const generateCompilationReportPDF = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { compilationId } = req.params;

    const compilation = await LeadReaderCompilation.findById(compilationId);
    if (!compilation) {
      return res.status(404).json({ error: 'Compilation not found' });
    }

    // Check authorization
    if (compilation.leadReaderId.toString() !== req.user?.id && !isGlobalAdmin(req.user)) {
      return res.status(403).json({ error: 'Not authorized to generate this report' });
    }

    // Get lead reader info
    const leadReader = await User.findById(compilation.leadReaderId);
    if (!leadReader) {
      return res.status(404).json({ error: 'Lead reader not found' });
    }

    // Generate PDF
    const pdfGenerator = new PDFGeneratorService();
    const pdfBuffer = await pdfGenerator.generateCompilationReport(compilation, {
      firstName: leadReader.firstName,
      lastName: leadReader.lastName,
      email: leadReader.email
    });

    // Set response headers
    const filename = `compilation-report-${compilation.institutionName.replace(/\s+/g, '-')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Generate compilation report PDF error:', error);
    return res.status(500).json({ error: 'Failed to generate PDF' });
  }
};

/**
 * Generate a summary PDF of all reader reports for a submission
 */
export const generateAllReaderReportsPDF = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId } = req.params;

    const _sub = await requireSubmissionAccess(req as any, res, submissionId); if (!_sub) return;

    if (!isLeadOrAdmin(req)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const reviews = await Review.find({
      submissionId,
      status: 'submitted'
    }).populate('reviewerId', 'firstName lastName email');

    if (reviews.length === 0) {
      return res.status(404).json({ error: 'No submitted reviews found' });
    }

    // For now, return the first review's PDF
    // In a full implementation, you might want to combine all PDFs
    const firstReview = reviews[0];
    const reader = firstReview.reviewerId as any;

    const scoreMap = await buildReaderScoreMap(firstReview.submissionId, firstReview.reviewerId);
    const pdfGenerator = new PDFGeneratorService();
    const pdfBuffer = await pdfGenerator.generateReaderReport(firstReview, {
      firstName: reader.firstName,
      lastName: reader.lastName,
      email: reader.email
    }, scoreMap);

    const filename = `reader-reports-${submissionId}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Generate all reader reports PDF error:', error);
    return res.status(500).json({ error: 'Failed to generate PDF' });
  }
};

/**
 * Preview reader report (returns HTML for preview)
 */
export const previewReaderReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findById(reviewId)
      .populate('reviewerId', 'firstName lastName email');

    if (!review) {
      return res.status(404).json({ error: 'Review not found' });
    }

    const _sub = await requireSubmissionAccess(req as any, res, String(review.submissionId)); if (!_sub) return;

    // Check authorization
    if (
      (review.reviewerId as any)._id.toString() !== req.user?.id &&
      req.user?.role !== 'admin' &&
      req.user?.role !== 'lead_reader'
    ) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const reader = review.reviewerId as any;

    // Return data for client-side preview rendering
    return res.json({
      review: {
        institutionName: review.institutionName,
        programName: review.programName,
        programLevel: review.programLevel,
        reviewerNumber: review.reviewerNumber,
        totalReviewers: review.totalReviewers,
        reviewDate: review.reviewDate,
        assessments: review.assessments,
        finalAssessment: review.finalAssessment,
        progress: review.progress
      },
      reader: {
        firstName: reader.firstName,
        lastName: reader.lastName,
        email: reader.email
      }
    });
  } catch (error) {
    console.error('Preview reader report error:', error);
    return res.status(500).json({ error: 'Failed to generate preview' });
  }
};

/**
 * Preview compilation report (returns data for preview)
 */
export const previewCompilationReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { compilationId } = req.params;

    const compilation = await LeadReaderCompilation.findById(compilationId)
      .populate('leadReaderId', 'firstName lastName email');

    if (!compilation) {
      return res.status(404).json({ error: 'Compilation not found' });
    }

    // Check authorization
    if (
      (compilation.leadReaderId as any)._id.toString() !== req.user?.id &&
      req.user?.role !== 'admin'
    ) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const leadReader = compilation.leadReaderId as any;

    return res.json({
      compilation: {
        institutionName: compilation.institutionName,
        programName: compilation.programName,
        programLevel: compilation.programLevel,
        totalReaders: compilation.totalReaders,
        completedReviews: compilation.completedReviews,
        compiledAssessments: compilation.compiledAssessments,
        readerRecommendations: compilation.readerRecommendations,
        finalCompilation: compilation.finalCompilation,
        status: compilation.status
      },
      leadReader: {
        firstName: leadReader.firstName,
        lastName: leadReader.lastName,
        email: leadReader.email
      }
    });
  } catch (error) {
    console.error('Preview compilation report error:', error);
    return res.status(500).json({ error: 'Failed to generate preview' });
  }
};

/**
 * Reader Report (full self-study + AI verdicts) — compile PDF + DOCX and store
 * both in the submission's Supporting File Library (tagged `reader-report`).
 * Normally produced automatically when a submitted submission's background
 * validate-all finishes; this endpoint forces an immediate (re)build for
 * testing / on-demand refresh. Idempotent (upserts by tag).
 */
export const generateReaderReportNow = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(submissionId)) {
      return res.status(400).json({ error: 'Invalid submission id' });
    }
    const _sub = await requireSubmissionAccess(req as any, res, submissionId); if (!_sub) return;
    const result = await generateAndStoreReaderReport(submissionId, req.user?.id);
    if (!result.pdf && !result.docx) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    return res.json({ ok: true, generated: result });
  } catch (error) {
    console.error('Generate reader report error:', error);
    return res.status(500).json({ error: 'Failed to generate reader report' });
  }
};

/** The effective reviewer id (the impersonated user when a SU is impersonating). */
function effectiveReviewerId(req: AuthenticatedRequest): string {
  return (req.user as any)?.impersonation?.impersonatedUserId || req.user?.id || '';
}

async function readerMayAccess(req: AuthenticatedRequest, submissionId: string): Promise<boolean> {
  // CR-060 — Assignment is authoritative for WHICH submissions a reviewer may
  // work on. A user with an active assignment is authorized REGARDLESS of their
  // primary role (a PC@A who is also Reader@B and assigned to B's study passes
  // here for B). Admins always pass.
  if (isGlobalAdmin(req.user)) return true;
  const reviewerId = effectiveReviewerId(req);
  const assigned = await Assignment.exists({ submissionId, userId: reviewerId, status: 'active' });
  return !!assigned;
}

/** A lead reader (at any institution) or admin may oversee OTHER reviewers'
 *  completed reports. CR-060 — derive from roleAssignments, not the single role. */
function isLeadOrAdmin(req: AuthenticatedRequest): boolean {
  return isGlobalAdmin(req.user)
    || req.user?.role === 'lead_reader'
    || institutionIdsWithRole(req.user as any, 'lead_reader').length > 0;
}

/**
 * Resolve which reviewer's report the request targets and whether the caller is
 * allowed to see it. `?reviewerId=` lets a lead reader / admin open another
 * reader's report (read-only). The lead reader oversees the review while it is
 * IN PROGRESS, so — like an admin — they may read a reader's report as soon as
 * it exists (it does not need to be marked complete first).
 * Returns { reviewerId, readonly } or null when the caller may not view it.
 */
async function resolveTargetReviewer(
  req: AuthenticatedRequest, submissionId: string
): Promise<{ reviewerId: string; readonly: boolean; overrideMode: boolean } | null> {
  const self = effectiveReviewerId(req);
  const requested = String((req.query.reviewerId as string) || '').trim();
  if (!requested || requested === self) return { reviewerId: self, readonly: false, overrideMode: false };
  // Viewing someone else's report — only a lead reader (assigned) or admin may.
  if (!isLeadOrAdmin(req)) return null;
  if (!mongoose.Types.ObjectId.isValid(requested)) return null;
  const other = await ReaderReport.findOne({ submissionId, reviewerId: requested })
    .select('_id').lean();
  // The report must exist (the reader has started it); completion is NOT required.
  if (!other) return null;
  // A lead reader / admin viewing another reader's report may OVERRIDE it: the
  // checklist stays editable, but a lead's edits land on the reader's lead-
  // override layer (leadMark/leadComment) rather than the reader's own marks.
  return { reviewerId: requested, readonly: false, overrideMode: true };
}

/**
 * GET /api/reports/submission/:submissionId/reader-report-data
 * The editable Reader Report for the current reader: the AI-drafted per-standard
 * checklist merged with this reader's saved overrides. Reader/lead-reader only.
 */
export const getReaderReportData = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(submissionId)) return res.status(400).json({ error: 'Invalid submission id' });
    if (!(await readerMayAccess(req, submissionId))) return res.status(403).json({ error: 'Forbidden' });

    const target = await resolveTargetReviewer(req, submissionId);
    if (!target) return res.status(403).json({ error: 'Forbidden' });

    const structure = await getReaderReportStructure(submissionId);
    if (!structure) return res.status(404).json({ error: 'Submission not found' });

    const reviewerId = target.reviewerId;
    const saved = await ReaderReport.findOne({ submissionId, reviewerId }).lean();
    // Saved rows are stored per-SPECIFICATION (key = "std.spec"); legacy rows
    // with no specCode are keyed by standard alone.
    const savedByKey: Record<string, { mark: string; comment: string; leadMark?: string; leadComment?: string; overriddenBy?: string }> = {};
    for (const r of saved?.rows || []) {
      const key = r.specCode ? `${r.standardCode}.${r.specCode}` : r.standardCode;
      savedByKey[key] = {
        mark: r.mark, comment: r.comment,
        leadMark: (r as any).leadMark || '', leadComment: (r as any).leadComment || '',
        overriddenBy: (r as any).overriddenBy || '',
      };
    }

    const standards = structure.standards.map((s) => ({
      ...s,
      // Each SPECIFICATION carries its own checklist: the reader's CHECK MARK
      // defaults to the AI's per-spec verdict so the checklist starts drafted;
      // the reader's COMMENT starts BLANK (the AI assessment is shown separately
      // as the read-only tag) so the reader writes their own.
      specs: s.specs.map((sp) => {
        const key = `${s.code}.${sp.specCode}`;
        return {
          ...sp,
          readerMark: savedByKey[key]?.mark ?? (sp.aiMark || ''),
          readerComment: savedByKey[key]?.comment ?? '',
          // Lead-reader override layer (drives the "Lead override" badge + the
          // effective mark in the printed report). Blank when no override.
          leadMark: savedByKey[key]?.leadMark ?? '',
          leadComment: savedByKey[key]?.leadComment ?? '',
          overriddenBy: savedByKey[key]?.overriddenBy ?? '',
        };
      }),
      // Standard-level fields kept for the AI tag / legacy fallback.
      readerMark: savedByKey[s.code]?.mark ?? (s.aiMark || ''),
      readerComment: savedByKey[s.code]?.comment ?? '',
    }));

    // Name the reviewer when a lead reader is viewing someone else's report.
    let reviewerName: string | undefined;
    if (target.readonly) {
      const u = await User.findById(reviewerId).select('firstName lastName email').lean();
      if (u) reviewerName = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email;
    }

    return res.json({
      institutionName: structure.institutionName,
      programName: structure.programName,
      levelTitle: structure.levelTitle,
      standards,
      recommendation: saved?.recommendation || '',
      acceptanceVote: saved?.acceptanceVote || '',
      updatedAt: saved?.updatedAt || null,
      completedAt: saved?.completedAt || null,
      readonly: target.readonly,
      overrideMode: target.overrideMode,
      reviewerId,
      reviewerName,
    });
  } catch (error) {
    console.error('Get reader report data error:', error);
    return res.status(500).json({ error: 'Failed to load reader report' });
  }
};

/**
 * PUT /api/reports/submission/:submissionId/reader-report-data
 * Save the current reader's edits (per-standard mark + comment + recommendation).
 */
export const saveReaderReportData = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(submissionId)) return res.status(400).json({ error: 'Invalid submission id' });
    if (!(await readerMayAccess(req, submissionId))) return res.status(403).json({ error: 'Forbidden' });

    const target = await resolveTargetReviewer(req, submissionId);
    if (!target) return res.status(403).json({ error: 'Forbidden' });

    const body = req.body || {};
    const incoming = Array.isArray(body.rows) ? body.rows.map((r: any) => ({
      standardCode: String(r.standardCode || ''),
      specCode: String(r.specCode || ''),
      mark: ['compliant', 'noncompliant', ''].includes(r.mark) ? r.mark : '',
      comment: String(r.comment || ''),
    })).filter((r: any) => r.standardCode) : [];

    // LEAD-OVERRIDE MODE — a lead reader / admin editing another reader's report.
    // Merge the lead's marks/comments onto the reader's rows as a distinct
    // override layer (leadMark/leadComment/overriddenBy); the reader's own
    // mark/comment are preserved for provenance. The board report uses the
    // override when present (lead wins).
    if (target.overrideMode) {
      const lu = await User.findById(effectiveReviewerId(req)).select('firstName lastName email').lean();
      const leadName = ([lu?.firstName, lu?.lastName].filter(Boolean).join(' ') || lu?.email || 'Lead Reader');
      const existing = await ReaderReport.findOne({ submissionId, reviewerId: target.reviewerId });
      if (!existing) return res.status(404).json({ error: 'Reader report not found' });
      const byKey = new Map<string, any>(existing.rows.map((r: any) => [`${r.standardCode}.${r.specCode || ''}`, r]));
      for (const inc of incoming) {
        const key = `${inc.standardCode}.${inc.specCode || ''}`;
        const row: any = byKey.get(key);
        if (row) {
          row.leadMark = inc.mark; row.leadComment = inc.comment;
          row.overriddenBy = leadName; row.overriddenAt = new Date();
        } else {
          existing.rows.push({
            standardCode: inc.standardCode, specCode: inc.specCode, mark: '', comment: '',
            leadMark: inc.mark, leadComment: inc.comment, overriddenBy: leadName, overriddenAt: new Date(),
          } as any);
        }
      }
      existing.markModified('rows');
      await existing.save();
      return res.json({ ok: true, overrideMode: true, updatedAt: (existing as any).updatedAt });
    }

    const reviewerId = target.reviewerId;
    const rows = incoming;
    const recommendation = typeof body.recommendation === 'string' ? body.recommendation : '';
    const VOTES = ['accept', 'conditional', 'deny', 'hold', ''];

    // Completion gate: when the reader marks the report COMPLETE it becomes
    // visible to the lead reader. `completed` is optional — when omitted the
    // existing completion state is preserved (a plain autosave doesn't flip it).
    const update: Record<string, any> = { $set: { rows, recommendation } };
    if (typeof body.acceptanceVote === 'string' && VOTES.includes(body.acceptanceVote)) {
      update.$set.acceptanceVote = body.acceptanceVote;
    }
    if (typeof body.completed === 'boolean') {
      if (body.completed) {
        const existing = await ReaderReport.findOne({ submissionId, reviewerId }).select('completedAt').lean();
        update.$set.completedAt = existing?.completedAt || new Date();
      } else {
        update.$set.completedAt = null;
      }
    }

    const doc = await ReaderReport.findOneAndUpdate(
      { submissionId, reviewerId },
      update,
      { upsert: true, new: true }
    );
    return res.json({ ok: true, updatedAt: doc?.updatedAt, completedAt: doc?.completedAt || null });
  } catch (error) {
    console.error('Save reader report data error:', error);
    return res.status(500).json({ error: 'Failed to save reader report' });
  }
};

/**
 * GET /api/reports/submission/:submissionId/reader-report/download?format=pdf|docx
 * Stream the official-template Reader Report (PDF or editable Word) filled with
 * the current reader's marks/comments (over the AI draft). Reader/lead-reader
 * (assigned) or admin only — readers can't reach the evidence library directly.
 */
export const downloadReaderReport = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId } = req.params;
    const format = String(req.query.format || 'pdf').toLowerCase() === 'docx' ? 'docx' : 'pdf';
    if (!mongoose.Types.ObjectId.isValid(submissionId)) return res.status(400).json({ error: 'Invalid submission id' });
    if (!(await readerMayAccess(req, submissionId))) return res.status(403).json({ error: 'Forbidden' });

    const target = await resolveTargetReviewer(req, submissionId);
    if (!target) return res.status(403).json({ error: 'Forbidden' });
    const reviewerId = target.reviewerId;
    const saved = await ReaderReport.findOne({ submissionId, reviewerId }).lean();
    // The official .docx template has one checklist cell per STANDARD, so roll
    // the reader's per-SPECIFICATION marks/comments up to the standard: the
    // standard is Non-Compliant if ANY spec is, else Compliant if any spec is;
    // the comment concatenates each spec's note (labelled by spec).
    // ALL inline margin comments (reader + lead + PC replies), grouped by
    // std.spec, so the printed board/PC report includes them alongside the
    // checklist — not just the checklist comment.
    const inlineComments: any[] = await Comment.find({ submissionId })
      .select('standardCode specCode authorName authorRole selectedText content replies createdAt')
      .sort({ createdAt: 1 }).lean();
    const roleLabel = (r?: string) =>
      r === 'lead_reader' ? 'Lead Reader' : r === 'program_coordinator' ? 'Program Coordinator' : 'Reader';
    const inlineBySpec = new Map<string, any[]>();
    for (const c of inlineComments) {
      const key = `${c.standardCode || ''}.${c.specCode || ''}`;
      const arr = inlineBySpec.get(key) || [];
      arr.push(c); inlineBySpec.set(key, arr);
    }
    const fmtInline = (c: any): string => {
      const sel = String(c.selectedText || '').trim();
      const who = `${c.authorName || roleLabel(c.authorRole)} (${roleLabel(c.authorRole)})`;
      let s = `  • ${who}${sel ? ` on “${sel.slice(0, 70)}${sel.length > 70 ? '…' : ''}”` : ''}: ${String(c.content || '').trim()}`;
      for (const rep of (c.replies || [])) {
        s += `\n      ↳ ${rep.authorName || roleLabel(rep.authorRole)} (${roleLabel(rep.authorRole)}): ${String(rep.content || '').trim()}`;
      }
      return s;
    };

    // Effective per-spec decision = lead override when present, else reader mark.
    const byStd = new Map<string, { specs: Array<{ spec: string; mark: string; comment: string; overriddenBy?: string }> }>();
    const touchStd = (std: string) => { const g = byStd.get(std) || { specs: [] }; byStd.set(std, g); return g; };
    for (const r of saved?.rows || []) {
      const effMark = (r as any).leadMark || r.mark || '';
      const effComment = ((r as any).leadComment && String((r as any).leadComment).trim())
        ? String((r as any).leadComment) : (r.comment || '');
      const hasInline = inlineBySpec.has(`${r.standardCode}.${r.specCode || ''}`);
      if (!effMark && !(effComment && effComment.trim()) && !hasInline) continue;
      touchStd(r.standardCode).specs.push({
        spec: r.specCode || '', mark: effMark, comment: effComment, overriddenBy: (r as any).overriddenBy,
      });
    }
    // Include specs that have inline comments but no checklist row.
    for (const c of inlineComments) {
      const std = c.standardCode || ''; if (!std) continue;
      const g = touchStd(std);
      if (!g.specs.some((s) => s.spec === (c.specCode || ''))) {
        g.specs.push({ spec: c.specCode || '', mark: '', comment: '' });
      }
    }
    const overrides = new Map<string, { mark: '' | 'compliant' | 'noncompliant'; comment: string }>();
    for (const [stdCode, g] of byStd) {
      const anyNon = g.specs.some((s) => s.mark === 'noncompliant');
      const anyComp = g.specs.some((s) => s.mark === 'compliant');
      const mark: '' | 'compliant' | 'noncompliant' = anyNon ? 'noncompliant' : anyComp ? 'compliant' : '';
      const blocks: string[] = [];
      for (const s of [...g.specs].sort((a, b) => a.spec.localeCompare(b.spec))) {
        const label = s.spec ? `${stdCode}.${s.spec}` : stdCode;
        const head: string[] = [];
        if (s.mark) head.push(`[${s.mark === 'compliant' ? 'Compliant' : 'Non-Compliant'}${s.overriddenBy ? ` — lead override by ${s.overriddenBy}` : ''}]`);
        if (s.comment && s.comment.trim()) head.push(s.comment.trim());
        let block = `${label}${head.length ? ': ' + head.join(' — ') : ''}`;
        const inl = (inlineBySpec.get(`${stdCode}.${s.spec}`) || []).map(fmtInline).join('\n');
        if (inl) block += `\nComments:\n${inl}`;
        blocks.push(block);
      }
      overrides.set(stdCode, { mark, comment: blocks.join('\n\n') });
    }

    const wantHtml = String(req.query.format || '').toLowerCase() === 'html';
    const buffers = await renderReaderReportBuffers(submissionId, overrides);
    if (!buffers) return res.status(404).json({ error: 'Submission not found' });

    // Formatted in-browser view: convert the FILLED official template (DOCX) to
    // HTML so the reader sees the actual template, formatted, without Word.
    if (wantHtml) {
      const mammoth = (await import('mammoth')).default || (await import('mammoth'));
      const result = await (mammoth as any).convertToHtml({ buffer: buffers.docx });
      return res.json({ html: result.value });
    }

    const buf = format === 'docx' ? buffers.docx : buffers.pdf;
    const mime = format === 'docx'
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/pdf';
    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Disposition', `attachment; filename="Reader-Report.${format}"`);
    return res.end(buf);
  } catch (error) {
    console.error('Download reader report error:', error);
    return res.status(500).json({ error: 'Failed to download reader report' });
  }
};

/**
 * GET /api/reports/submission/:submissionId/reader-reports
 * List every reader's Reader Report for a submission with reviewer name and
 * completion status, so a lead reader (or admin) can oversee all of them and
 * open each one once the reader has marked it complete. Lead reader / admin only.
 */
export const listReaderReports = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { submissionId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(submissionId)) return res.status(400).json({ error: 'Invalid submission id' });
    if (!(await readerMayAccess(req, submissionId))) return res.status(403).json({ error: 'Forbidden' });
    if (!isLeadOrAdmin(req)) return res.status(403).json({ error: 'Forbidden' });

    const self = effectiveReviewerId(req);

    // Everyone assigned to read this submission (so we can show readers who
    // haven't started their report yet), plus anyone who already has a report.
    const assignments = await Assignment.find({ submissionId, status: 'active' })
      .select('userId assignmentType').lean();
    const reports = await ReaderReport.find({ submissionId })
      .select('reviewerId completedAt updatedAt rows recommendation acceptanceVote').lean();
    const reportByReviewer = new Map(reports.map((r) => [String(r.reviewerId), r]));
    // The lead reader IS a reader (own report) but is distinguished in the
    // roster — derive the badge from the authoritative Assignment.assignmentType,
    // not the user's primary role (a multi-role user's primary role may differ).
    const assignmentTypeByUser = new Map(assignments.map((a) => [String(a.userId), a.assignmentType]));

    const reviewerIds = new Set<string>();
    for (const a of assignments) reviewerIds.add(String(a.userId));
    for (const r of reports) reviewerIds.add(String(r.reviewerId));

    const users = await User.find({ _id: { $in: Array.from(reviewerIds) } })
      .select('firstName lastName email role').lean();
    const userById = new Map(users.map((u) => [String(u._id), u]));

    const items = Array.from(reviewerIds).map((rid) => {
      const u = userById.get(rid);
      const rep = reportByReviewer.get(rid);
      const completed = !!rep?.completedAt;
      const hasContent = !!rep && ((rep.rows || []).some((x: any) => x.mark || (x.comment || '').trim()) || (rep.recommendation || '').trim().length > 0);
      // The lead reader oversees the review in progress: a report is OPENABLE as
      // soon as it exists (the reader has started it). No completion gate.
      const viewable = !!rep;
      return {
        reviewerId: rid,
        reviewerName: u ? (`${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email) : 'Unknown reviewer',
        role: assignmentTypeByUser.get(rid) || u?.role || 'reader',
        isSelf: rid === self,
        completedAt: rep?.completedAt || null,
        updatedAt: rep?.updatedAt || null,
        started: hasContent,
        viewable,
        // The lead reader sees each reader's current vote while the review is in
        // progress (it travels with the report they can already open).
        acceptanceVote: rep?.acceptanceVote || '',
      };
    }).sort((a, b) => {
      // Completed first, then started, then by name.
      if (!!a.completedAt !== !!b.completedAt) return a.completedAt ? -1 : 1;
      if (a.started !== b.started) return a.started ? -1 : 1;
      return a.reviewerName.localeCompare(b.reviewerName);
    });

    // The poll: tally completed readers' acceptance votes.
    const tally = { accept: 0, conditional: 0, deny: 0, hold: 0 } as Record<string, number>;
    for (const it of items) {
      if (it.completedAt && it.acceptanceVote && tally[it.acceptanceVote] !== undefined) tally[it.acceptanceVote] += 1;
    }

    return res.json({ reports: items, tally });
  } catch (error) {
    console.error('List reader reports error:', error);
    return res.status(500).json({ error: 'Failed to list reader reports' });
  }
};
