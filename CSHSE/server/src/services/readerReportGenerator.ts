/**
 * Reader Report generator (2026-06-09, template-driven).
 *
 * The CSHSE Reader Report is the official compliance checklist — one template per
 * degree level (associate / baccalaureate / masters), each a per-standard grid
 * with Compliant / Non-Compliant columns and a Reader's Comments column, ending
 * in a recommendation + signature block.
 *
 * On submit (after the background validate-all finishes), this fills the ACTUAL
 * template for the submission's degree level: header fields (institution, program)
 * + per-standard AI verdict mark (Compliant / Non-Compliant, rolled up from the
 * spec verdicts) + the AI rationale in Reader's Comments — producing an AI-DRAFTED
 * reader report the reader reviews and edits. Emitted as the template-filled DOCX
 * (via docx.patchDocument over a placeholder-tagged copy of the official file) and
 * a matching checklist PDF (pdfkit). Both are stored in the Supporting File Library
 * (tags reader-report:pdf / reader-report:docx). Idempotent (upsert by tag).
 *
 * The placeholder-tagged template copies live in
 * src/assets/reader-report-templates/<level>.docx and are produced by
 * scripts/prepare_reader_report_templates.py.
 */
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, patchDocument, PatchType } from 'docx';
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

// Degree level -> templated file + the ordered standard keys the template marks.
// (Mirrors scripts/prepare_reader_report_templates.py.) Masters has no template
// yet → procedural fallback.
const STDS_1_20 = Array.from({ length: 20 }, (_, i) => String(i + 1));
const STDS_1_18 = Array.from({ length: 18 }, (_, i) => String(i + 1));
const LEVELS: Record<string, { file: string; stds: string[]; title: string }> = {
  baccalaureate: { file: 'baccalaureate.docx', stds: [...STDS_1_20, '22'], title: "Baccalaureate Degree" },
  associate: { file: 'associate.docx', stds: [...STDS_1_20], title: 'Associate Degree' },
  masters: { file: 'masters.docx', stds: [...STDS_1_18], title: "Master's Degree" },
};
function resolveLevel(programLevel?: string): { key: string; cfg?: { file: string; stds: string[]; title: string } } {
  const pl = String(programLevel || '').toLowerCase();
  if (pl === 'associate') return { key: 'associate', cfg: LEVELS.associate };
  if (pl === 'masters' || pl === 'master' || pl === "master's") return { key: 'masters', cfg: LEVELS.masters };
  // bachelors / baccalaureate / default
  return { key: 'baccalaureate', cfg: LEVELS.baccalaureate };
}
function templatePath(file: string): string {
  return path.join(__dirname, '..', 'assets', 'reader-report-templates', file);
}

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
  std: string; spec: string; title: string;
  narrative: string; evidence: string;
  narrativeHtml: string; evidenceHtml: string;
  verdict?: string; rationale?: string; suggestions: string[]; excluded: boolean;
}
export interface StandardRollup { mark: 'compliant' | 'noncompliant' | null; comment: string }
interface ReportData {
  institutionName: string; programName: string; programLevel: string;
  submittedAt?: Date;
  standards: Array<{ code: string; title: string; specs: SpecBlock[] }>;
  matrices: Array<{ title: string; text: string }>;
}

/** Gather the full self-study + AI verdicts + matrices. */
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

  const results: any[] = await ValidationResult.find({ submissionId })
    .sort({ validatedAt: -1, createdAt: -1 }).lean();
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
        std: std.code, spec: sp.code, title: sp.title || '',
        narrative: stripHtml(n?.content), evidence: stripHtml(n?.supportingEvidenceText),
        narrativeHtml: (n?.content as string) || '', evidenceHtml: (n?.supportingEvidenceText as string) || '',
        verdict: res?.verdict, rationale: res?.rationale || res?.feedback,
        suggestions: res?.suggestions || res?.missingElements || [],
        excluded: st?.excluded === true,
      });
    }
    standards.push({ code: std.code, title: std.title || '', specs });
  }

  const cms: any[] = await CurriculumMatrix.find({ submissionId }).lean();
  const matrices: ReportData['matrices'] = [];
  for (const cm of cms) for (const rc of cm.rawContent || []) {
    matrices.push({ title: rc.title || cm.name || 'Curriculum Matrix', text: stripHtml(rc.content) });
  }

  return {
    institutionName: submission?.institutionName || 'Institution',
    programName: submission?.programName || '',
    programLevel: submission?.programLevel || '',
    submittedAt: submission?.submittedAt,
    standards, matrices,
  };
}

/** Roll up per-spec verdicts to a per-standard Compliant/Non-Compliant + comment. */
function rollupByStandard(data: ReportData): Map<string, StandardRollup> {
  const out = new Map<string, StandardRollup>();
  for (const std of data.standards) {
    const graded = std.specs.filter((s) => !s.excluded && (s.verdict || s.narrative || s.evidence));
    if (graded.length === 0) { out.set(std.code, { mark: null, comment: '' }); continue; }
    const anyFail = graded.some((s) => s.verdict === 'fail' || s.verdict === 'needs_improvement');
    const anyPass = graded.some((s) => s.verdict === 'pass');
    const mark: StandardRollup['mark'] = anyFail ? 'noncompliant' : anyPass ? 'compliant' : null;
    const lines: string[] = [];
    for (const s of graded) {
      if (!s.verdict && !s.rationale) continue;
      const v = s.verdict ? (VERDICT_LABEL[s.verdict] || s.verdict) : 'not evaluated';
      let line = `${s.std}.${s.spec} — ${v}`;
      const why = (s.rationale || '').trim();
      if (why) line += `: ${why.length > 320 ? why.slice(0, 317) + '…' : why}`;
      if (s.suggestions?.length) line += ` (Suggestions: ${s.suggestions.slice(0, 3).join('; ')})`;
      lines.push(line);
    }
    out.set(std.code, { mark, comment: lines.join('\n') });
  }
  return out;
}

/** Build the template-filled DOCX (the official checklist, AI-drafted). */
async function buildTemplatedDocx(
  cfg: { file: string; stds: string[] }, data: ReportData, rollup: Map<string, StandardRollup>
): Promise<Buffer> {
  const tpl = fs.readFileSync(templatePath(cfg.file));
  const mk = (text: string) => ({ type: PatchType.PARAGRAPH, children: [new TextRun(text || '')] });
  const mkMulti = (text: string) => ({
    type: PatchType.PARAGRAPH,
    children: (text ? text.split('\n') : ['']).map((ln, i) => new TextRun({ text: ln, break: i === 0 ? 0 : 1 })),
  });
  const patches: Record<string, any> = {
    inst_name: mk(data.institutionName),
    prog_name: mk(data.programName),
  };
  for (const code of cfg.stds) {
    const r = rollup.get(code) || { mark: null, comment: '' };
    patches[`c_${code}`] = mk(r.mark === 'compliant' ? '☒' : '☐');
    patches[`n_${code}`] = mk(r.mark === 'noncompliant' ? '☒' : '☐');
    patches[`cm_${code}`] = mkMulti(r.comment || '');
  }
  return patchDocument({ outputType: 'nodebuffer', data: tpl, patches, keepOriginalStyles: true }) as Promise<Buffer>;
}

/** Procedural fallback DOCX (masters — no template yet). Same checklist shape. */
async function buildProceduralDocx(data: ReportData, rollup: Map<string, StandardRollup>, levelTitle: string): Promise<Buffer> {
  const children: Paragraph[] = [];
  children.push(new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(`CSHSE Self-Study Reader Report — ${levelTitle}`)] }));
  children.push(new Paragraph({ children: [new TextRun({ text: `Institution's Name: ${data.institutionName}`, bold: true })] }));
  children.push(new Paragraph({ children: [new TextRun({ text: `Program's Name: ${data.programName}`, bold: true })] }));
  children.push(new Paragraph({ children: [new TextRun("Reader's Name and Credential: ____________________    Date: ____________")] }));
  for (const std of data.standards) {
    const r = rollup.get(std.code) || { mark: null, comment: '' };
    if (r.mark === null && !r.comment) continue;
    const box = r.mark === 'compliant' ? '☒ Compliant   ☐ Non-Compliant'
      : r.mark === 'noncompliant' ? '☐ Compliant   ☒ Non-Compliant' : '☐ Compliant   ☐ Non-Compliant';
    children.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(`Standard ${std.code}: ${std.title}`)] }));
    children.push(new Paragraph({ children: [new TextRun({ text: box, bold: true })] }));
    for (const ln of (r.comment || '').split('\n')) if (ln) children.push(new Paragraph({ children: [new TextRun(ln)] }));
  }
  children.push(new Paragraph({ children: [new TextRun('')] }));
  children.push(new Paragraph({ children: [new TextRun({ text: 'Recommendation to the Council:', bold: true })] }));
  children.push(new Paragraph({ children: [new TextRun('☐ Accreditation with no conditions   ☐ Conditional accreditation   ☐ Deny accreditation   ☐ Hold a decision')] }));
  children.push(new Paragraph({ children: [new TextRun('Self-Study Reader Signature: ____________________    Date: ____________')] }));
  const doc = new Document({ sections: [{ properties: {}, ...brandedSectionChrome(), children }] } as any);
  return Packer.toBuffer(doc);
}

/** Matching checklist PDF (mirrors the template's structure). */
function buildChecklistPdf(data: ReportData, rollup: Map<string, StandardRollup>, levelTitle: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 54 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).fillColor('#0f766e').text(`CSHSE Self-Study Reader Report — ${levelTitle}`);
    doc.moveDown(0.4);
    doc.fontSize(11).fillColor('#111827').text(`Institution's Name: ${data.institutionName}`);
    doc.text(`Program's Name: ${data.programName}`);
    doc.fontSize(9).fillColor('#6b7280').text("Reader's Name and Credential: ____________________________     Date: ______________");
    doc.moveDown(0.3);
    doc.fontSize(8).fillColor('#6b7280').text('Compliance marks below are an AI-generated DRAFT rolled up from the per-specification AI verdicts. The assigned reader reviews and adjusts each mark and comment.');
    doc.moveDown(0.6);

    for (const std of data.standards) {
      const r = rollup.get(std.code) || { mark: null, comment: '' };
      if (r.mark === null && !r.comment) continue;
      doc.fontSize(11).fillColor('#111827').text(`Standard ${std.code}: ${std.title}`);
      const compMark = r.mark === 'compliant' ? '☒' : '☐';
      const nonMark = r.mark === 'noncompliant' ? '☒' : '☐';
      const color = r.mark === 'compliant' ? '#15803d' : r.mark === 'noncompliant' ? '#b91c1c' : '#6b7280';
      doc.fontSize(10).fillColor(color).text(`${compMark} Compliant     ${nonMark} Non-Compliant`);
      if (r.comment) {
        doc.fontSize(9).fillColor('#374151').text('Reader’s Comments:');
        doc.fontSize(9).fillColor('#111827').text(r.comment, { paragraphGap: 3 });
      }
      doc.moveDown(0.5);
    }

    if (data.matrices.length) {
      doc.addPage();
      doc.fontSize(13).fillColor('#0f766e').text('Curriculum Matrices');
      doc.moveDown(0.3);
      for (const m of data.matrices) {
        doc.fontSize(11).fillColor('#111827').text(m.title);
        doc.fontSize(8).fillColor('#374151').text(m.text, { paragraphGap: 3 });
        doc.moveDown(0.4);
      }
    }

    doc.addPage();
    doc.fontSize(12).fillColor('#111827').text('Recommendation to the Council');
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#374151').text('☐ Accreditation with no conditions');
    doc.text('☐ Conditional accreditation (correctable noncompliance)');
    doc.text('☐ Deny accreditation due to significant noncompliance');
    doc.text('☐ Hold a decision');
    doc.moveDown(1);
    doc.text('Self-Study Reader Signature: ____________________________     Date: ______________');
    doc.end();
  });
}

/** Upsert one reader-report file (by tag) into the Supporting File Library. */
async function upsertReportFile(submission: any, userId: any, fmt: 'pdf' | 'docx', buffer: Buffer): Promise<void> {
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
    existing.description = 'Reader Report (official CSHSE template, AI-drafted)';
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
    description: 'Reader Report (official CSHSE template, AI-drafted)',
    metadata: { description: `Auto-generated reader report (${fmt.toUpperCase()})` },
    versionNumber: 1, isCurrentVersion: true, isDeleted: false,
    linkedNarratives: [],
    tags: ['ai-import', 'reader-report', tag],
  });
}

/** Build BOTH formats from the official template and store them. Idempotent. */
export async function generateAndStoreReaderReport(
  submissionId: string, userId?: any
): Promise<{ pdf: boolean; docx: boolean; level: string; templated: boolean }> {
  const submission: any = await Submission.findById(submissionId)
    .select('_id institutionId institutionName submitterId programLevel');
  if (!submission) return { pdf: false, docx: false, level: '', templated: false };

  const data = await gatherReportData(submissionId);
  const rollup = rollupByStandard(data);
  const { key, cfg } = resolveLevel(data.programLevel || submission.programLevel);
  const levelTitle = cfg?.title || "Master's Degree";

  let docxBuf: Buffer;
  let templated = false;
  if (cfg && fs.existsSync(templatePath(cfg.file))) {
    docxBuf = await buildTemplatedDocx(cfg, data, rollup);
    templated = true;
  } else {
    // masters (or missing template) → procedural checklist fallback
    docxBuf = await buildProceduralDocx(data, rollup, levelTitle);
  }
  const pdfBuf = await buildChecklistPdf(data, rollup, levelTitle);

  await upsertReportFile(submission, userId, 'pdf', pdfBuf);
  await upsertReportFile(submission, userId, 'docx', docxBuf);
  return { pdf: true, docx: true, level: key, templated };
}

export interface ReaderReportSpec {
  specCode: string;
  specTitle: string;
  narrativeHtml: string;
  evidenceHtml: string;
  verdict?: string;
  // The AI's per-spec verdict mapped to the checklist mark (pass→compliant,
  // fail/needs_improvement→noncompliant) so each spec's checklist starts drafted.
  aiMark: 'compliant' | 'noncompliant' | null;
  excluded: boolean;
}

/** Map an AI per-spec verdict to a Compliant/Non-Compliant checklist mark. */
function verdictToMark(verdict?: string): 'compliant' | 'noncompliant' | null {
  if (verdict === 'pass') return 'compliant';
  if (verdict === 'fail' || verdict === 'needs_improvement') return 'noncompliant';
  return null;
}
export interface ReaderReportStandardRow {
  code: string;
  title: string;
  aiMark: 'compliant' | 'noncompliant' | null;
  aiComment: string;
  specs: ReaderReportSpec[];
}
export interface ReaderReportStructure {
  institutionName: string;
  programName: string;
  programLevel: string;
  levelTitle: string;
  standards: ReaderReportStandardRow[];
}

/**
 * Generate the official-template PDF + DOCX buffers for a submission.
 *
 * When `readerOverrides` is supplied (the reader's download/view) the template is
 * filled from the READER's data ONLY — their check mark + their comments. The AI
 * evaluation is NEVER written into the printed template (the reader sees it only
 * as the on-screen tag). Without overrides (the auto-generated draft stored in
 * the library) the AI rollup is used.
 */
export async function renderReaderReportBuffers(
  submissionId: string,
  readerOverrides?: Map<string, { mark: '' | 'compliant' | 'noncompliant'; comment: string }>
): Promise<{ pdf: Buffer; docx: Buffer } | null> {
  const submission: any = await Submission.findById(submissionId).select('_id programLevel');
  if (!submission) return null;
  const data = await gatherReportData(submissionId);
  let rollup: Map<string, StandardRollup>;
  if (readerOverrides) {
    // Reader's report: ONLY the reader's marks + comments (no AI text in print).
    rollup = new Map<string, StandardRollup>();
    for (const std of data.standards) {
      const ov = readerOverrides.get(std.code);
      rollup.set(std.code, {
        mark: ov?.mark === 'compliant' || ov?.mark === 'noncompliant' ? ov.mark : null,
        comment: ov?.comment || '',
      });
    }
  } else {
    rollup = rollupByStandard(data);
  }
  const { cfg } = resolveLevel(data.programLevel || submission.programLevel);
  const levelTitle = cfg?.title || "Master's Degree";
  const docx = (cfg && fs.existsSync(templatePath(cfg.file)))
    ? await buildTemplatedDocx(cfg, data, rollup)
    : await buildProceduralDocx(data, rollup, levelTitle);
  const pdf = await buildChecklistPdf(data, rollup, levelTitle);
  return { pdf, docx };
}

/**
 * Structured per-standard reader-report data (for the editable Reader Report
 * screen): the official checklist rolled up from the AI verdicts. The reader/
 * lead reader edits the mark + comment on top of this AI draft.
 */
export async function getReaderReportStructure(submissionId: string): Promise<ReaderReportStructure | null> {
  const data = await gatherReportData(submissionId);
  if (!data) return null;
  const rollup = rollupByStandard(data);
  const { cfg } = resolveLevel(data.programLevel);
  const standards: ReaderReportStandardRow[] = data.standards
    .filter((s) => s.specs.some((sp) => !sp.excluded && (sp.narrative || sp.evidence || sp.verdict)))
    .map((s) => {
      const r = rollup.get(s.code) || { mark: null, comment: '' };
      // Specs with self-study content, so the reader can read the narrative +
      // supporting evidence right on the report screen.
      const specs: ReaderReportSpec[] = s.specs
        .filter((sp) => !sp.excluded && (sp.narrativeHtml || sp.evidenceHtml))
        .map((sp) => ({
          specCode: sp.spec, specTitle: sp.title,
          narrativeHtml: sp.narrativeHtml, evidenceHtml: sp.evidenceHtml,
          verdict: sp.verdict, aiMark: verdictToMark(sp.verdict), excluded: sp.excluded,
        }));
      return { code: s.code, title: s.title, aiMark: r.mark, aiComment: r.comment, specs };
    });
  return {
    institutionName: data.institutionName,
    programName: data.programName,
    programLevel: data.programLevel,
    levelTitle: cfg?.title || "Master's Degree",
    standards,
  };
}
