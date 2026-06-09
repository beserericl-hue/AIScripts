/**
 * Reader Report generator (2026-06-09).
 *
 * At submit, the self-study + AI verdicts are compiled into a single reviewer
 * packet — every standard/spec with the program's narrative, supporting evidence,
 * and the AI verdict (pass / needs improvement / fail) + rationale + suggestions,
 * plus the curriculum matrices. Emitted as BOTH a CSHSE-branded PDF and DOCX and
 * stored in the submission's Supporting File Library (tagged `reader-report`) so
 * assigned readers can download them.
 *
 * generateAndStoreReaderReport() is idempotent — it upserts the two files (by
 * tag) so re-running after more evaluations land just refreshes them.
 */
import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import mongoose from 'mongoose';
import { Submission } from '../models/Submission';
import { ValidationResult } from '../models/ValidationResult';
import { CurriculumMatrix } from '../models/CurriculumMatrix';
import { SupportingEvidence } from '../models/SupportingEvidence';
import { getAllStandards } from '../data/standards';
import { brandedSectionChrome } from './docxBranding';

const VERDICT_LABEL: Record<string, string> = {
  pass: 'PASS',
  needs_improvement: 'NEEDS IMPROVEMENT',
  fail: 'FAIL',
};

function stripHtml(html?: string | null): string {
  return String(html || '')
    .replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6]|tr)\s*\/?>/gi, '\n')
    .replace(/<\s*(td|th)\b[^>]*>/gi, '  ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

interface SpecBlock {
  std: string;
  spec: string;
  title: string;
  narrative: string;
  evidence: string;
  verdict?: string;
  rationale?: string;
  suggestions: string[];
  excluded: boolean;
}
interface ReportData {
  institutionName: string;
  programName: string;
  programLevel: string;
  submittedAt?: Date;
  standards: Array<{ code: string; title: string; specs: SpecBlock[] }>;
  matrices: Array<{ title: string; text: string }>;
}

/** Gather the full self-study + AI verdicts + matrices for the report. */
async function gatherReportData(submissionId: string): Promise<ReportData> {
  const submission: any = await Submission.findById(submissionId);
  const narratives: any = submission?.narratives;
  const standardsStatus: any = submission?.standardsStatus || new Map();
  const getStatus = (std: string, spec: string) => {
    const k = `${std}_${spec}`;
    return standardsStatus instanceof Map ? standardsStatus.get(k) : standardsStatus[k];
  };
  const narrFor = (std: string, spec: string) => {
    const stdMap = narratives instanceof Map ? narratives.get(std) : narratives?.[std];
    const entry = stdMap instanceof Map ? stdMap.get(spec) : stdMap?.[spec];
    return entry || {};
  };

  // Latest ValidationResult per spec.
  const results: any[] = await ValidationResult.find({ submissionId })
    .sort({ validatedAt: -1, createdAt: -1 })
    .lean();
  const latest = new Map<string, any>();
  for (const r of results) {
    const k = `${r.standardCode}.${r.specCode}`;
    if (!latest.has(k)) latest.set(k, r.result || r);
  }

  const standards: ReportData['standards'] = [];
  for (const std of getAllStandards()) {
    const specs: SpecBlock[] = [];
    for (const sp of std.specifications || []) {
      const n = narrFor(std.code, sp.code);
      const res = latest.get(`${std.code}.${sp.code}`);
      const st = getStatus(std.code, sp.code);
      specs.push({
        std: std.code,
        spec: sp.code,
        title: sp.title || '',
        narrative: stripHtml(n?.content),
        evidence: stripHtml(n?.supportingEvidenceText),
        verdict: res?.verdict,
        rationale: res?.rationale || res?.feedback,
        suggestions: res?.suggestions || res?.missingElements || [],
        excluded: st?.excluded === true,
      });
    }
    standards.push({ code: std.code, title: std.title || '', specs });
  }

  const cms: any[] = await CurriculumMatrix.find({ submissionId }).lean();
  const matrices: ReportData['matrices'] = [];
  for (const cm of cms) {
    for (const rc of cm.rawContent || []) {
      matrices.push({ title: rc.title || cm.name || 'Curriculum Matrix', text: stripHtml(rc.content) });
    }
  }

  return {
    institutionName: submission?.institutionName || 'Institution',
    programName: submission?.programName || '',
    programLevel: submission?.programLevel || '',
    submittedAt: submission?.submittedAt,
    standards,
    matrices,
  };
}

/** Build the CSHSE-branded PDF. */
function buildPdf(data: ReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 54 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).fillColor('#0f766e').text('CSHSE Self-Study — Reader Report', { align: 'left' });
    doc.moveDown(0.3);
    doc.fontSize(12).fillColor('#111827').text(data.institutionName);
    doc.fontSize(11).fillColor('#374151').text(`${data.programName}${data.programLevel ? ` (${data.programLevel})` : ''}`);
    if (data.submittedAt) doc.fontSize(9).fillColor('#6b7280').text(`Submitted ${new Date(data.submittedAt).toLocaleDateString()}`);
    doc.moveDown(1);

    for (const std of data.standards) {
      const anyContent = std.specs.some((s) => s.narrative || s.evidence || s.verdict);
      if (!anyContent) continue;
      doc.addPage();
      doc.fontSize(15).fillColor('#0f766e').text(`Standard ${std.code}: ${std.title}`);
      doc.moveDown(0.4);
      for (const s of std.specs) {
        if (s.excluded) {
          doc.fontSize(11).fillColor('#6b7280').text(`${s.std}.${s.spec} ${s.title} — Marked Not Applicable`);
          doc.moveDown(0.4);
          continue;
        }
        if (!s.narrative && !s.evidence && !s.verdict) continue;
        doc.fontSize(12).fillColor('#111827').text(`${s.std}.${s.spec}  ${s.title}`, { underline: false });
        if (s.verdict) {
          const color = s.verdict === 'pass' ? '#15803d' : s.verdict === 'needs_improvement' ? '#b45309' : '#b91c1c';
          doc.fontSize(10).fillColor(color).text(`AI verdict: ${VERDICT_LABEL[s.verdict] || s.verdict}`);
        }
        if (s.narrative) {
          doc.fontSize(9).fillColor('#374151').text('Narrative:', { continued: false });
          doc.fontSize(9).fillColor('#111827').text(s.narrative, { paragraphGap: 4 });
        }
        if (s.evidence) {
          doc.fontSize(9).fillColor('#374151').text('Supporting evidence:');
          doc.fontSize(9).fillColor('#111827').text(s.evidence, { paragraphGap: 4 });
        }
        if (s.rationale) {
          doc.fontSize(9).fillColor('#374151').text('AI rationale:');
          doc.fontSize(9).fillColor('#111827').text(s.rationale, { paragraphGap: 4 });
        }
        if (s.suggestions?.length) {
          doc.fontSize(9).fillColor('#374151').text('Suggestions:');
          for (const sug of s.suggestions) doc.fontSize(9).fillColor('#111827').text(`• ${sug}`);
        }
        doc.moveDown(0.6);
      }
    }

    if (data.matrices.length) {
      doc.addPage();
      doc.fontSize(15).fillColor('#0f766e').text('Curriculum Matrices');
      doc.moveDown(0.4);
      for (const m of data.matrices) {
        doc.fontSize(12).fillColor('#111827').text(m.title);
        doc.fontSize(8).fillColor('#374151').text(m.text, { paragraphGap: 4 });
        doc.moveDown(0.6);
      }
    }

    doc.end();
  });
}

/** Build the CSHSE-branded DOCX. */
async function buildDocx(data: ReportData): Promise<Buffer> {
  const children: Paragraph[] = [];
  children.push(new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun('CSHSE Self-Study — Reader Report')] }));
  children.push(new Paragraph({ children: [new TextRun({ text: data.institutionName, bold: true })] }));
  children.push(new Paragraph({ children: [new TextRun(`${data.programName}${data.programLevel ? ` (${data.programLevel})` : ''}`)] }));
  if (data.submittedAt) children.push(new Paragraph({ children: [new TextRun({ text: `Submitted ${new Date(data.submittedAt).toLocaleDateString()}`, italics: true, size: 18 })] }));

  for (const std of data.standards) {
    const anyContent = std.specs.some((s) => s.narrative || s.evidence || s.verdict);
    if (!anyContent) continue;
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(`Standard ${std.code}: ${std.title}`)] }));
    for (const s of std.specs) {
      if (s.excluded) {
        children.push(new Paragraph({ children: [new TextRun({ text: `${s.std}.${s.spec} ${s.title} — Marked Not Applicable`, italics: true })] }));
        continue;
      }
      if (!s.narrative && !s.evidence && !s.verdict) continue;
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(`${s.std}.${s.spec}  ${s.title}`)] }));
      if (s.verdict) children.push(new Paragraph({ children: [new TextRun({ text: `AI verdict: ${VERDICT_LABEL[s.verdict] || s.verdict}`, bold: true })] }));
      if (s.narrative) {
        children.push(new Paragraph({ children: [new TextRun({ text: 'Narrative:', bold: true })] }));
        for (const line of s.narrative.split('\n')) children.push(new Paragraph({ children: [new TextRun(line)] }));
      }
      if (s.evidence) {
        children.push(new Paragraph({ children: [new TextRun({ text: 'Supporting evidence:', bold: true })] }));
        for (const line of s.evidence.split('\n')) children.push(new Paragraph({ children: [new TextRun(line)] }));
      }
      if (s.rationale) {
        children.push(new Paragraph({ children: [new TextRun({ text: 'AI rationale:', bold: true })] }));
        children.push(new Paragraph({ children: [new TextRun(s.rationale)] }));
      }
      for (const sug of s.suggestions || []) children.push(new Paragraph({ children: [new TextRun(`• ${sug}`)] }));
    }
  }

  if (data.matrices.length) {
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun('Curriculum Matrices')] }));
    for (const m of data.matrices) {
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(m.title)] }));
      for (const line of m.text.split('\n')) children.push(new Paragraph({ children: [new TextRun(line)] }));
    }
  }

  const doc = new Document({ sections: [{ properties: {}, ...brandedSectionChrome(), children }] } as any);
  return Packer.toBuffer(doc);
}

/** Upsert one reader-report file (by tag) into the Supporting File Library. */
async function upsertReportFile(
  submission: any,
  userId: any,
  fmt: 'pdf' | 'docx',
  buffer: Buffer
): Promise<void> {
  const tag = `reader-report:${fmt}`;
  const filename = `Reader-Report-${String(submission.institutionName || 'submission').replace(/[^a-z0-9]+/gi, '-')}.${fmt}`;
  const mimeType = fmt === 'pdf'
    ? 'application/pdf'
    : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const uploadedBy = userId ? new mongoose.Types.ObjectId(String(userId)) : submission.submitterId;
  const fileData = {
    filename, originalName: filename, mimeType, size: buffer.byteLength,
    data: buffer.toString('base64'), encoding: 'base64', storageType: 'base64',
    uploadedAt: new Date(), uploadedBy,
  };
  const existing: any = await SupportingEvidence.findOne({ submissionId: submission._id, tags: tag, isDeleted: false });
  if (existing) {
    existing.file = fileData as any;
    existing.description = 'Reader Report (full self-study + AI verdicts)';
    existing.markModified('file');
    await existing.save();
    return;
  }
  await SupportingEvidence.create({
    institutionId: submission.institutionId,
    submissionId: submission._id,
    uploadedBy,
    evidenceType: 'document',
    file: fileData as any,
    description: 'Reader Report (full self-study + AI verdicts)',
    metadata: { description: `Auto-generated reader report (${fmt.toUpperCase()})` },
    versionNumber: 1, isCurrentVersion: true, isDeleted: false,
    linkedNarratives: [],
    tags: ['ai-import', 'reader-report', tag],
  });
}

/** Build BOTH formats and store them in the library. Idempotent (upsert by tag). */
export async function generateAndStoreReaderReport(
  submissionId: string,
  userId?: any
): Promise<{ pdf: boolean; docx: boolean }> {
  const submission: any = await Submission.findById(submissionId).select('_id institutionId institutionName submitterId');
  if (!submission) return { pdf: false, docx: false };
  const data = await gatherReportData(submissionId);
  const [pdfBuf, docxBuf] = await Promise.all([buildPdf(data), buildDocx(data)]);
  await upsertReportFile(submission, userId, 'pdf', pdfBuf);
  await upsertReportFile(submission, userId, 'docx', docxBuf);
  return { pdf: true, docx: true };
}
