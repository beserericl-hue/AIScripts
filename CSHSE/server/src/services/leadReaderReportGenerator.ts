/**
 * Lead Reader Report to VPA to Request Board Action — DOCX + PDF generator.
 *
 * This is the CSHSE board-facing document a lead reader completes once all
 * readers have independently evaluated the Self-Study (and the site visit, if
 * mandated). It merges the system-generated sections (program metadata,
 * required-courses list from the curriculum matrix, compiled non-compliance)
 * assembled by `buildSystemSections` in leadReaderReportController with the
 * lead-reader-authored fields stored in the LeadReaderReport model.
 *
 * Distinct from the combined Reader Report (readerReportGenerator.ts). Both are
 * emitted as a `docx`-built DOCX and a `pdfkit` PDF, sharing the same CSHSE
 * branding (logo + header/footer chrome) so the two documents look consistent.
 * The DOCX is built PROGRAMMATICALLY — no binary template file required.
 */
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  ImageRun,
} from 'docx';
import { Submission } from '../models/Submission';
import { LeadReaderReport } from '../models/LeadReaderReport';
import { buildSystemSections } from '../controllers/leadReaderReportController';
import { brandedSectionChrome } from './docxBranding';

const ORG_NAME = 'Council for Standards in Human Service Education';
const ORG_TAGLINE = 'Accrediting excellence in human service education';
const ORG_URL = 'https://cshse.org';
const BRAND_COLOR = '1F3864'; // navy (matches docxBranding)
const BRAND_HEX = '#1F3864';

const LOGO_PATH = path.join(__dirname, '..', 'assets', 'cshse-logo.png');
let logoBuffer: Buffer | null = null;
try {
  logoBuffer = fs.readFileSync(LOGO_PATH);
} catch {
  logoBuffer = null;
}

const CHECKED = '☒';
const UNCHECKED = '☐';
const box = (on: boolean) => (on ? CHECKED : UNCHECKED);

const DEGREE_MATCH: Record<string, 'associate' | 'bachelors' | 'masters'> = {
  associate: 'associate',
  bachelors: 'bachelors',
  masters: 'masters',
};

/** Editable-report defaults when no LeadReaderReport is saved yet. */
function emptyReport() {
  return {
    vpaRecipients: '',
    contactInfo: '',
    accreditationStatus: '' as '' | 'initial' | 'reaccreditation' | 'interim',
    initialAccreditationDate: '',
    lastReaccreditationDate: '',
    siteVisitDate: '',
    noSiteVisitRequired: false,
    programDescription: '',
    strengthsFromSelfStudy: '',
    strengthsFromSiteVisit: '',
    nonComplianceText: '',
    requiredCoursesOverride: '',
    recommendation: '' as '' | 'accredit_no_conditions' | 'conditional' | 'deny' | 'hold',
    conditionalRequirements: '',
    holdExplanation: '',
    additionalRecommendations: '',
    nextSelfStudySuggestions: '',
    submittedByName: '',
    submissionDate: '',
  };
}

type SystemSections = Awaited<ReturnType<typeof buildSystemSections>>;
type ReportFields = ReturnType<typeof emptyReport>;

/** Load submission + system sections + saved editable fields. */
async function loadData(
  submissionId: string
): Promise<{ submission: any; system: SystemSections; report: ReportFields } | null> {
  const submission: any = await Submission.findById(submissionId);
  if (!submission) return null;
  const system = await buildSystemSections(submission);
  const saved: any = await LeadReaderReport.findOne({ submissionId: submission._id }).lean();
  const report = { ...emptyReport(), ...(saved || {}) } as ReportFields;
  return { submission, system, report };
}

const NOTE_LINE =
  'This form is to be completed once all readers have independently evaluated the Self-Study, and completed the necessary site visit if mandated, for its compliance with the Standards and Specifications.';
const RECS_REF_LINE =
  '(See CSHSE Policy for Board Accreditation/Reaccreditation Decisions … Member Handbook, Appendix I …)';
const NONCOMPLIANCE_INSTRUCTION =
  'Include relevant comments from all readers and/or from the site visit for all concerns noted.';

// ---------------------------------------------------------------------------
// DOCX
// ---------------------------------------------------------------------------

function docxParagraphsFor(text: string): Paragraph[] {
  const v = String(text ?? '').trim();
  if (!v) return [new Paragraph({ children: [new TextRun('')] })];
  return v.split('\n').map((ln) => new Paragraph({ children: [new TextRun(ln)] }));
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 80 },
    children: [new TextRun({ text, bold: true, color: BRAND_COLOR })],
  });
}

function subHeading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 120, after: 40 },
    children: [new TextRun({ text, bold: true, italics: true })],
  });
}

function labelValue(label: string, value: string): Paragraph {
  return new Paragraph({
    spacing: { after: 40 },
    children: [
      new TextRun({ text: `${label}: `, bold: true }),
      new TextRun({ text: String(value ?? '').trim() }),
    ],
  });
}

function checkboxLine(on: boolean, text: string, bold = false): Paragraph {
  return new Paragraph({
    spacing: { after: 40 },
    children: [new TextRun({ text: `${box(on)} ${text}`, bold })],
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({ bullet: { level: 0 }, children: [new TextRun(text)] });
}

async function buildDocx(system: SystemSections, report: ReportFields): Promise<Buffer> {
  const children: Paragraph[] = [];

  // Letterhead (logo + org name + tagline + url), then title.
  if (logoBuffer) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            type: 'png',
            data: logoBuffer,
            transformation: { width: 64, height: 64 },
          }),
        ],
      })
    );
  }
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: ORG_NAME, bold: true, color: BRAND_COLOR, size: 26 })],
    })
  );
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: ORG_TAGLINE, italics: true, color: '808080', size: 18 })],
    })
  );
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 160 },
      children: [new TextRun({ text: ORG_URL, color: BRAND_COLOR, size: 18 })],
    })
  );
  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: 'Lead Reader Report to VPA to Request Board Action',
          bold: true,
          color: BRAND_COLOR,
        }),
      ],
    })
  );
  children.push(
    new Paragraph({
      spacing: { after: 160 },
      children: [new TextRun({ text: NOTE_LINE, italics: true, size: 18 })],
    })
  );

  // --- Program Information ---
  children.push(sectionHeading('Program Information'));
  children.push(labelValue('Institution name', system.institutionName));
  children.push(labelValue('Program name', system.programName));
  children.push(labelValue('Individuals to whom VPA letter will be sent (names/titles)', report.vpaRecipients));
  children.push(labelValue('Email/mailing address for contact', report.contactInfo));

  const accr = report.accreditationStatus || system.accreditationStatusDefault;
  children.push(new Paragraph({ spacing: { before: 80, after: 20 }, children: [new TextRun({ text: 'Accreditation status:', bold: true })] }));
  children.push(checkboxLine(accr === 'initial', 'Initial'));
  children.push(checkboxLine(accr === 'reaccreditation', 'Reaccreditation'));
  children.push(checkboxLine(accr === 'interim', 'Interim Report and Review'));

  children.push(labelValue('Date of initial accreditation', report.initialAccreditationDate));
  children.push(labelValue('Date of last reaccreditation', report.lastReaccreditationDate));

  const level = DEGREE_MATCH[String(system.programLevel || '').toLowerCase()];
  children.push(new Paragraph({ spacing: { before: 80, after: 20 }, children: [new TextRun({ text: 'Degree level:', bold: true })] }));
  children.push(checkboxLine(level === 'associate', 'Associate'));
  children.push(checkboxLine(level === 'bachelors', 'Baccalaureate'));
  children.push(checkboxLine(level === 'masters', "Master's"));

  children.push(labelValue('Site visit date', report.siteVisitDate || system.siteVisitDateDefault));
  children.push(checkboxLine(report.noSiteVisitRequired === true, 'No site visit required'));
  children.push(new Paragraph({ spacing: { before: 80, after: 20 }, children: [new TextRun({ text: 'Brief description of the program:', bold: true })] }));
  children.push(...docxParagraphsFor(report.programDescription));

  // --- Reader Information ---
  children.push(sectionHeading('Reader Information'));
  children.push(labelValue('Lead Reader/Site Visitor (SV1)', system.leadReaderName));
  children.push(labelValue('Additional Readers', (system.additionalReaders || []).join(', ')));

  // --- Required Courses ---
  children.push(sectionHeading('List of Required Courses used to meet compliance of Standards'));
  if (String(report.requiredCoursesOverride || '').trim()) {
    children.push(...docxParagraphsFor(report.requiredCoursesOverride));
  } else {
    children.push(subHeading('General Education Courses:'));
    const gen = system.generalEducationCourses || [];
    if (gen.length) gen.forEach((c) => children.push(bullet(c)));
    else children.push(new Paragraph({ children: [new TextRun('')] }));
    children.push(subHeading('Program Courses:'));
    const prog = system.programCourses || [];
    if (prog.length) prog.forEach((c) => children.push(bullet(c)));
    else children.push(new Paragraph({ children: [new TextRun('')] }));
  }

  // --- Strengths ---
  children.push(sectionHeading('Identify Standards and Strengths of the Program'));
  children.push(subHeading('From Self-Study'));
  children.push(...docxParagraphsFor(report.strengthsFromSelfStudy));
  children.push(subHeading('From Site Visit'));
  children.push(...docxParagraphsFor(report.strengthsFromSiteVisit));

  // --- Non-compliance ---
  children.push(sectionHeading('Identify Standards and Specifications in question related to non-compliance'));
  children.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: NONCOMPLIANCE_INSTRUCTION, italics: true, size: 18 })] }));
  if (String(report.nonComplianceText || '').trim()) {
    children.push(...docxParagraphsFor(report.nonComplianceText));
  } else {
    const items = system.nonCompliance || [];
    if (items.length) {
      for (const it of items) {
        children.push(new Paragraph({ spacing: { before: 60 }, children: [new TextRun({ text: it.spec, bold: true })] }));
        for (const cm of it.comments || []) children.push(new Paragraph({ children: [new TextRun(cm)] }));
        if (!(it.comments || []).length) children.push(new Paragraph({ children: [new TextRun('')] }));
      }
    } else {
      children.push(new Paragraph({ children: [new TextRun('')] }));
    }
  }

  // --- Recommendations ---
  children.push(sectionHeading('Recommendations'));
  children.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: RECS_REF_LINE, italics: true, size: 18 })] }));
  const rec = report.recommendation;
  children.push(checkboxLine(rec === 'accredit_no_conditions', 'Accreditation with no conditions.'));
  children.push(
    checkboxLine(
      rec === 'conditional',
      'Conditional accreditation because the program had a few noncompliance issues that require correction.'
    )
  );
  if (rec === 'conditional' && String(report.conditionalRequirements || '').trim()) {
    children.push(...docxParagraphsFor(report.conditionalRequirements));
  }
  children.push(checkboxLine(rec === 'deny', 'Deny accreditation due to significant noncompliance.'));
  children.push(checkboxLine(rec === 'hold', 'Hold a decision. Please explain.'));
  if (rec === 'hold' && String(report.holdExplanation || '').trim()) {
    children.push(...docxParagraphsFor(report.holdExplanation));
  }

  // --- Additional recommendations ---
  children.push(sectionHeading('Additional Reader Recommendations not required by or related to the Standards'));
  children.push(...docxParagraphsFor(report.additionalRecommendations));

  // --- Next self-study suggestions ---
  children.push(sectionHeading('Suggestions for developing the next Self-Study.'));
  children.push(...docxParagraphsFor(report.nextSelfStudySuggestions));

  // --- Submission block ---
  children.push(
    new Paragraph({
      spacing: { before: 200 },
      children: [
        new TextRun({ text: 'Report submitted by: ', bold: true }),
        new TextRun({ text: String(report.submittedByName ?? '').trim() }),
        new TextRun({ text: '     Date of submission of report: ', bold: true }),
        new TextRun({ text: String(report.submissionDate ?? '').trim() }),
      ],
    })
  );

  const doc = new Document({ sections: [{ properties: {}, ...brandedSectionChrome(), children }] } as any);
  return Packer.toBuffer(doc);
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

function buildPdf(system: SystemSections, report: ReportFields): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 54 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const val = (v: any) => {
      const s = String(v ?? '').trim();
      return s || '';
    };
    const heading = (t: string) => {
      doc.moveDown(0.6);
      doc.fontSize(13).fillColor(BRAND_HEX).text(t);
      doc.moveDown(0.2);
    };
    const sub = (t: string) => {
      doc.fontSize(10).fillColor('#374151').font('Helvetica-BoldOblique').text(t);
      doc.font('Helvetica');
    };
    const lv = (label: string, value: any) => {
      doc.fontSize(10).fillColor('#111827');
      doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
      doc.font('Helvetica').text(val(value) || ' ');
    };
    const para = (value: any) => {
      const v = val(value);
      doc.fontSize(10).fillColor('#111827').font('Helvetica').text(v || ' ', { paragraphGap: 2 });
    };
    const check = (on: boolean, text: string) => {
      doc.fontSize(10).fillColor('#111827').font('Helvetica').text(`${box(on)} ${text}`);
    };

    // Letterhead
    if (logoBuffer) {
      try {
        const w = 60;
        doc.image(logoBuffer, (doc.page.width - w) / 2, doc.y, { width: w });
        doc.moveDown(0.2);
        doc.y += w - 8;
      } catch {
        /* ignore image errors */
      }
    }
    doc.fontSize(15).fillColor(BRAND_HEX).font('Helvetica-Bold').text(ORG_NAME, { align: 'center' });
    doc.fontSize(9).fillColor('#808080').font('Helvetica-Oblique').text(ORG_TAGLINE, { align: 'center' });
    doc.fontSize(9).fillColor(BRAND_HEX).font('Helvetica').text(ORG_URL, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(16).fillColor(BRAND_HEX).font('Helvetica-Bold').text('Lead Reader Report to VPA to Request Board Action', { align: 'center' });
    doc.font('Helvetica');
    doc.moveDown(0.4);
    doc.fontSize(9).fillColor('#374151').font('Helvetica-Oblique').text(NOTE_LINE);
    doc.font('Helvetica');

    // Program Information
    heading('Program Information');
    lv('Institution name', system.institutionName);
    lv('Program name', system.programName);
    lv('Individuals to whom VPA letter will be sent (names/titles)', report.vpaRecipients);
    lv('Email/mailing address for contact', report.contactInfo);
    const accr = report.accreditationStatus || system.accreditationStatusDefault;
    doc.moveDown(0.2);
    doc.fontSize(10).fillColor('#111827').font('Helvetica-Bold').text('Accreditation status:');
    doc.font('Helvetica');
    check(accr === 'initial', 'Initial');
    check(accr === 'reaccreditation', 'Reaccreditation');
    check(accr === 'interim', 'Interim Report and Review');
    lv('Date of initial accreditation', report.initialAccreditationDate);
    lv('Date of last reaccreditation', report.lastReaccreditationDate);
    const level = DEGREE_MATCH[String(system.programLevel || '').toLowerCase()];
    doc.moveDown(0.2);
    doc.fontSize(10).fillColor('#111827').font('Helvetica-Bold').text('Degree level:');
    doc.font('Helvetica');
    check(level === 'associate', 'Associate');
    check(level === 'bachelors', 'Baccalaureate');
    check(level === 'masters', "Master's");
    lv('Site visit date', report.siteVisitDate || system.siteVisitDateDefault);
    check(report.noSiteVisitRequired === true, 'No site visit required');
    doc.moveDown(0.2);
    doc.fontSize(10).fillColor('#111827').font('Helvetica-Bold').text('Brief description of the program:');
    doc.font('Helvetica');
    para(report.programDescription);

    // Reader Information
    heading('Reader Information');
    lv('Lead Reader/Site Visitor (SV1)', system.leadReaderName);
    lv('Additional Readers', (system.additionalReaders || []).join(', '));

    // Required Courses
    heading('List of Required Courses used to meet compliance of Standards');
    if (val(report.requiredCoursesOverride)) {
      para(report.requiredCoursesOverride);
    } else {
      sub('General Education Courses:');
      const gen = system.generalEducationCourses || [];
      if (gen.length) gen.forEach((c) => doc.fontSize(10).fillColor('#111827').text(`•  ${c}`));
      else para('');
      sub('Program Courses:');
      const prog = system.programCourses || [];
      if (prog.length) prog.forEach((c) => doc.fontSize(10).fillColor('#111827').text(`•  ${c}`));
      else para('');
    }

    // Strengths
    heading('Identify Standards and Strengths of the Program');
    sub('From Self-Study');
    para(report.strengthsFromSelfStudy);
    sub('From Site Visit');
    para(report.strengthsFromSiteVisit);

    // Non-compliance
    heading('Identify Standards and Specifications in question related to non-compliance');
    doc.fontSize(9).fillColor('#374151').font('Helvetica-Oblique').text(NONCOMPLIANCE_INSTRUCTION);
    doc.font('Helvetica');
    if (val(report.nonComplianceText)) {
      para(report.nonComplianceText);
    } else {
      const items = system.nonCompliance || [];
      if (items.length) {
        for (const it of items) {
          doc.moveDown(0.2);
          doc.fontSize(10).fillColor('#111827').font('Helvetica-Bold').text(it.spec);
          doc.font('Helvetica');
          for (const cm of it.comments || []) doc.fontSize(10).fillColor('#111827').text(cm);
        }
      } else {
        para('');
      }
    }

    // Recommendations
    heading('Recommendations');
    doc.fontSize(9).fillColor('#374151').font('Helvetica-Oblique').text(RECS_REF_LINE);
    doc.font('Helvetica');
    const rec = report.recommendation;
    check(rec === 'accredit_no_conditions', 'Accreditation with no conditions.');
    check(
      rec === 'conditional',
      'Conditional accreditation because the program had a few noncompliance issues that require correction.'
    );
    if (rec === 'conditional' && val(report.conditionalRequirements)) para(report.conditionalRequirements);
    check(rec === 'deny', 'Deny accreditation due to significant noncompliance.');
    check(rec === 'hold', 'Hold a decision. Please explain.');
    if (rec === 'hold' && val(report.holdExplanation)) para(report.holdExplanation);

    // Additional recommendations
    heading('Additional Reader Recommendations not required by or related to the Standards');
    para(report.additionalRecommendations);

    // Next self-study suggestions
    heading('Suggestions for developing the next Self-Study.');
    para(report.nextSelfStudySuggestions);

    // Submission block
    doc.moveDown(0.8);
    doc.fontSize(10).fillColor('#111827');
    doc.font('Helvetica-Bold').text('Report submitted by: ', { continued: true });
    doc.font('Helvetica').text(val(report.submittedByName) || ' ', { continued: true });
    doc.font('Helvetica-Bold').text('     Date of submission of report: ', { continued: true });
    doc.font('Helvetica').text(val(report.submissionDate) || ' ');

    doc.end();
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function generateLeadReaderReportDocx(submissionId: string): Promise<Buffer> {
  const loaded = await loadData(submissionId);
  if (!loaded) throw new Error('Submission not found');
  return buildDocx(loaded.system, loaded.report);
}

export async function generateLeadReaderReportPdf(submissionId: string): Promise<Buffer> {
  const loaded = await loadData(submissionId);
  if (!loaded) throw new Error('Submission not found');
  return buildPdf(loaded.system, loaded.report);
}
