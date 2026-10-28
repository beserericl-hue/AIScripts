/**
 * Per-reader Reader Report download (Lauri, Oct 2026).
 *
 * The lead reader sends EACH reader's report to the Council. The download used
 * to roll every specification up to one Compliant/Non-Compliant box per
 * standard and pull in every reviewer's (and the PC's) margin comments. Now:
 * - each specification's row on the official form carries its own mark + comment;
 * - only the selected reader's own comments, name and recommendation appear;
 * - the PDF lists every specification and marks the recommendation;
 * - the Lead Reader Report prints only the non-compliance text the lead wrote.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import JSZip from 'jszip';
import pdfParse from 'pdf-parse';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { Institution } from '../../src/models/Institution';
import { ReaderReport } from '../../src/models/ReaderReport';
import { LeadReaderReport } from '../../src/models/LeadReaderReport';
import { Comment } from '../../src/models/Comment';
import { createUser, signTokenFor, assignToSubmission } from '../helpers/factories';

async function makeSubmission(level: 'associate' | 'bachelors' | 'masters') {
  const name = `KSU-${Math.random().toString(36).slice(2)}`;
  const inst = await Institution.create({
    name, type: 'university',
    address: { street: '1 St', city: 'C', state: 'ST', zip: '00000', country: 'US' },
    primaryContact: { name: 'C', email: `${name}@example.com`, title: 'Dir', phone: '555-0100' },
  } as any);
  const pc = (await createUser({ role: 'program_coordinator', institutionId: inst._id.toString() })).user;
  const sub = await Submission.create({
    submissionId: `sub-${Math.random().toString(36).slice(2)}`,
    institutionId: inst._id, institutionName: inst.name,
    programName: 'Human Services', programLevel: level,
    submitterId: pc._id, type: 'reaccreditation', status: 'submitted',
  } as any);
  return { inst, pc, sub };
}

const comment = (sub: any, author: any, role: string, std: string, spec: string, content: string) =>
  Comment.create({
    submissionId: sub._id, standardCode: std, specCode: spec, selectedText: 'narrative text',
    selectionStart: 0, selectionEnd: 5, authorId: author._id,
    authorName: `${author.firstName} ${author.lastName}`, authorRole: role, content,
  } as any);

/** Table rows of word/document.xml as arrays of cell text. */
async function docxRows(buf: Buffer): Promise<string[][]> {
  const xml = await (await JSZip.loadAsync(buf)).file('word/document.xml')!.async('string');
  const text = (frag: string) => (frag.match(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g) || [])
    .map((t) => t.replace(/<[^>]+>/g, '')).join('');
  return (xml.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) || [])
    .map((tr) => tr.split(/<w:tc[ >]/).slice(1).map(text));
}
const rowWith = (rows: string[][], needle: string) => rows.find((r) => r.join(' ').includes(needle));
async function docxText(buf: Buffer): Promise<string> {
  const xml = await (await JSZip.loadAsync(buf)).file('word/document.xml')!.async('string');
  return (xml.match(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g) || []).map((t) => t.replace(/<[^>]+>/g, '')).join('');
}
const binary = (r: any) => r.buffer(true).parse((res: any, cb: any) => {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
});

describe('Per-reader Reader Report download', () => {
  let ctx: any;

  beforeEach(async () => {
    const { pc, sub } = await makeSubmission('associate');
    const lead = (await createUser({ role: 'lead_reader', firstName: 'Lauri', lastName: 'Lead' })).user;
    const readerA = (await createUser({ role: 'reader', firstName: 'Nancy', lastName: 'Reader' })).user;
    const readerB = (await createUser({ role: 'reader', firstName: 'Annie', lastName: 'Other' })).user;
    await assignToSubmission(sub, lead, 'lead_reader');
    await assignToSubmission(sub, readerA, 'reader');
    await assignToSubmission(sub, readerB, 'reader');

    // Reader A: Std 4 split decision — 4.a compliant, 4.b NON-compliant, 4.c compliant.
    await ReaderReport.create({
      submissionId: sub._id, reviewerId: readerA._id, completedAt: new Date('2026-10-20'),
      acceptanceVote: 'accept', recommendation: 'Strong program; recommend reaccreditation.',
      rows: [
        { standardCode: '4', specCode: 'a', mark: 'compliant', comment: 'SLOs are clear.' },
        { standardCode: '4', specCode: 'b', mark: 'noncompliant', comment: 'No formal evaluation in 5 yrs.' },
        { standardCode: '4', specCode: 'c', mark: 'compliant', comment: '' },
      ],
    } as any);
    await ReaderReport.create({
      submissionId: sub._id, reviewerId: readerB._id, acceptanceVote: 'deny',
      rows: [{ standardCode: '4', specCode: 'a', mark: 'noncompliant', comment: 'READER-B-ONLY verdict' }],
    } as any);
    await comment(sub, readerA, 'reader', '4', 'b', 'READER-A margin note');
    await comment(sub, readerB, 'reader', '4', 'b', 'READER-B margin note');
    await comment(sub, pc, 'program_coordinator', '4', 'b', 'PC-NOTE link is on the college website');

    ctx = { sub, lead, readerA, readerB, leadToken: signTokenFor(lead), aToken: signTokenFor(readerA) };
  });

  const download = (token: string, fmt: 'docx' | 'pdf', reviewerId?: string) =>
    binary(request(app)
      .get(`/api/reports/submission/${ctx.sub._id}/reader-report/download?format=${fmt}${reviewerId ? `&reviewerId=${reviewerId}` : ''}`)
      .set('Authorization', `Bearer ${token}`));

  it('POSITIVE: Word report marks each specification on its own row of the official form', async () => {
    const res = await download(ctx.leadToken, 'docx', String(ctx.readerA._id));
    expect(res.status).toBe(200);
    const rows = await docxRows(res.body);
    const r4a = rowWith(rows, 'clearly stated measurable')!;
    const r4b = rowWith(rows, 'formal program evaluation')!;
    // [..text.., compliant, non-compliant, comments]
    expect(r4a.slice(-3, -1)).toEqual(['☒', '☐']);
    expect(r4b.slice(-3, -1)).toEqual(['☐', '☒']);
    expect(r4b.join(' ')).toContain('No formal evaluation in 5 yrs.');
    expect(r4b.join(' ')).toContain('READER-A margin note');
    // The standard's own box is the roll-up and names the non-compliant spec.
    const std4 = rowWith(rows, 'Standard 4')!;
    expect(std4.join(' ')).toContain('Non-Compliant: 4.b');
  });

  it('POSITIVE: Word report names the reader and marks their recommendation', async () => {
    const res = await download(ctx.leadToken, 'docx', String(ctx.readerA._id));
    const text = await docxText(res.body);
    expect(text).toContain('Nancy Reader');
    expect(text).toContain('☒ Accreditation with no conditions.');
    expect(text).toContain('☐ Deny accreditation');
    expect(text).toContain('recommend reaccreditation');
    expect(text).not.toMatch(/\{\{[a-z_0-9]+\}\}/);
    expect(res.headers['content-disposition']).toContain('Reader-Report-Nancy-Reader.docx');
    // The form's own "Accreditation with no conditions" checkbox control is ticked.
    const xml = await (await JSZip.loadAsync(res.body)).file('word/document.xml')!.async('string');
    const rec = xml.slice(xml.indexOf('Indicate your recommendation'));
    const box = rec.slice(rec.lastIndexOf('<w:sdt>', rec.indexOf('Accreditation with no conditions', rec.indexOf('If yes'))));
    expect(box.slice(0, box.indexOf('</w:sdt>'))).toContain('w14:checked w14:val="1"');
    const deny = rec.slice(rec.lastIndexOf('<w:sdt>', rec.indexOf('Deny accreditation due', rec.indexOf('If yes'))));
    expect(deny.slice(0, deny.indexOf('</w:sdt>'))).toContain('w14:checked w14:val="0"');
  });

  it('NEGATIVE: another reader’s marks/comments and PC notes never appear in this reader’s report', async () => {
    const res = await download(ctx.leadToken, 'docx', String(ctx.readerA._id));
    const text = await docxText(res.body);
    expect(text).not.toContain('READER-B');
    expect(text).not.toContain('PC-NOTE');
    const pdf = await download(ctx.leadToken, 'pdf', String(ctx.readerA._id));
    const ptext = (await pdfParse(pdf.body)).text;
    expect(ptext).not.toContain('READER-B');
    expect(ptext).not.toContain('PC-NOTE');
  });

  it('POSITIVE: PDF lists each specification separately with the reader’s recommendation', async () => {
    const res = await download(ctx.aToken, 'pdf');
    expect(res.status).toBe(200);
    const text = (await pdfParse(res.body)).text;
    for (const s of ['4.a', '4.b', '4.c']) expect(text).toContain(s);
    expect(text).toContain('No formal evaluation in 5 yrs.');
    expect(text).toContain('Nancy Reader');
    expect(text).toContain('Accreditation with no conditions.');
    expect(text).toContain('recommend reaccreditation');
    // No unrenderable checkbox glyphs (boxes are drawn as vectors now).
    expect(text).not.toMatch(/[☐☒]/);
  });

  it('NEGATIVE: a lead merely opening/autosaving a reader’s report is NOT printed as a "lead override"', async () => {
    // The editor autosaves every row in lead mode with empty lead marks.
    const put = await request(app)
      .put(`/api/reports/submission/${ctx.sub._id}/reader-report-data?reviewerId=${ctx.readerA._id}`)
      .set('Authorization', `Bearer ${ctx.leadToken}`)
      .send({ rows: [{ standardCode: '4', specCode: 'a', mark: '', comment: '' }, { standardCode: '4', specCode: 'b', mark: '', comment: '' }] });
    expect(put.status).toBe(200);
    const saved: any = await ReaderReport.findOne({ submissionId: ctx.sub._id, reviewerId: ctx.readerA._id }).lean();
    expect(saved.rows.filter((r: any) => r.overriddenBy)).toHaveLength(0);
    // Stale stamps from before the fix (overriddenBy without a lead mark) don't print either.
    await ReaderReport.updateOne({ _id: saved._id }, { $set: { 'rows.0.overriddenBy': 'Lauri Lead' } });
    const res = await download(ctx.leadToken, 'docx', String(ctx.readerA._id));
    expect(await docxText(res.body)).not.toContain('Lead override');
  });

  it('POSITIVE: a real lead override is printed with the lead’s name', async () => {
    await request(app)
      .put(`/api/reports/submission/${ctx.sub._id}/reader-report-data?reviewerId=${ctx.readerA._id}`)
      .set('Authorization', `Bearer ${ctx.leadToken}`)
      .send({ rows: [{ standardCode: '4', specCode: 'a', mark: 'noncompliant', comment: 'Lead disagrees' }] });
    const rows = await docxRows((await download(ctx.leadToken, 'docx', String(ctx.readerA._id))).body);
    const r4a = rowWith(rows, 'clearly stated measurable')!;
    expect(r4a.slice(-3, -1)).toEqual(['☐', '☒']);
    expect(r4a.join(' ')).toContain('Lead override by Lauri Lead');
    expect(r4a.join(' ')).toContain('Lead disagrees');
  });

  it('NEGATIVE: a reader cannot download another reader’s report', async () => {
    const res = await download(ctx.aToken, 'docx', String(ctx.readerB._id));
    expect(res.status).toBe(403);
  });
});

describe('Baccalaureate Field Experience (form "Standard 22" = catalog 21)', () => {
  it('POSITIVE: a reader’s 21.a mark lands on the form’s Field Experience rows', async () => {
    const { sub } = await makeSubmission('bachelors');
    const reader = (await createUser({ role: 'reader', firstName: 'Fe', lastName: 'Reader' })).user;
    await assignToSubmission(sub, reader, 'reader');
    await ReaderReport.create({
      submissionId: sub._id, reviewerId: reader._id,
      rows: [{ standardCode: '21', specCode: 'a', mark: 'noncompliant', comment: 'FIELD-EXP gap' }],
    } as any);
    const res = await binary(request(app)
      .get(`/api/reports/submission/${sub._id}/reader-report/download?format=docx`)
      .set('Authorization', `Bearer ${signTokenFor(reader)}`));
    const rows = await docxRows(res.body);
    const std22 = rowWith(rows, 'Standard 22')!;
    expect(std22.join(' ')).toContain('☒ Non');
    const r21a = rowWith(rows, 'overall process')!;
    expect(r21a.slice(-3, -1)).toEqual(['☐', '☒']);
    expect(r21a.join(' ')).toContain('FIELD-EXP gap');
  });
});

describe("Master's form", () => {
  it('POSITIVE: per-spec marks, reader line and no leftover tokens', async () => {
    const { sub } = await makeSubmission('masters');
    const reader = (await createUser({ role: 'reader', firstName: 'Ma', lastName: 'Reader' })).user;
    await assignToSubmission(sub, reader, 'reader');
    await ReaderReport.create({
      submissionId: sub._id, reviewerId: reader._id, acceptanceVote: 'conditional',
      rows: [{ standardCode: '12', specCode: 'b', mark: 'noncompliant', comment: 'MASTERS-12b gap' }],
    } as any);
    const res = await binary(request(app)
      .get(`/api/reports/submission/${sub._id}/reader-report/download?format=docx`)
      .set('Authorization', `Bearer ${signTokenFor(reader)}`));
    expect(res.status).toBe(200);
    const rows = await docxRows(res.body);
    const r12b = rowWith(rows, 'organizational structures')!;
    expect(r12b.join(' ')).toContain('MASTERS-12b gap');
    expect(r12b.filter((c) => c === '☒')).toHaveLength(1);
    const text = await docxText(res.body);
    expect(text).toContain('Ma Reader');
    expect(text).toContain('☒ Conditional accreditation');
    expect(text).not.toMatch(/\{\{[a-z_0-9]+\}\}/);
  });
});

describe('Lead Reader Report non-compliance section', () => {
  it('NEGATIVE: with the field left blank, the compiled reference (PC notes etc.) is NOT printed', async () => {
    const { sub, pc } = await makeSubmission('associate');
    const lead = (await createUser({ role: 'lead_reader', firstName: 'Lauri', lastName: 'Lead' })).user;
    await assignToSubmission(sub, lead, 'lead_reader');
    await Submission.updateOne({ _id: sub._id }, { $set: { 'standardsStatus.5_c': { validationStatus: 'fail' } } });
    await comment(sub, pc, 'program_coordinator', '5', 'c', 'PC-NOTE Academic Regulation link is on the website');
    await LeadReaderReport.create({ submissionId: sub._id, recommendation: 'accredit_no_conditions', nonComplianceText: '' } as any);
    const token = signTokenFor(lead);
    const docx = await binary(request(app).get(`/api/submissions/${sub._id}/lead-reader-report/download?format=docx`).set('Authorization', `Bearer ${token}`));
    expect(docx.status).toBe(200);
    expect(await docxText(docx.body)).not.toContain('PC-NOTE');
    const pdf = await binary(request(app).get(`/api/submissions/${sub._id}/lead-reader-report/download?format=pdf`).set('Authorization', `Bearer ${token}`));
    const ptext = (await pdfParse(pdf.body)).text;
    expect(ptext).not.toContain('PC-NOTE');
    expect(ptext).toContain('Accreditation with no conditions.');
    expect(ptext).not.toMatch(/[☐☒]/);
    // …while the on-screen reference list (which the lead may copy from) DOES
    // show it, along with the program details.
    const scr = await request(app).get(`/api/submissions/${sub._id}/lead-reader-report`).set('Authorization', `Bearer ${token}`);
    expect(scr.status).toBe(200);
    expect(scr.body.system.nonCompliance.map((n: any) => n.spec)).toContain('5c');
    expect(JSON.stringify(scr.body.system.nonCompliance)).toContain('PC-NOTE');
    expect(scr.body.system.programName).toBe('Human Services');
  });

  it('POSITIVE: Word-pasted bullets/tabs in the lead’s text print cleanly in the PDF (no garbage glyphs)', async () => {
    const { sub } = await makeSubmission('associate');
    const lead = (await createUser({ role: 'lead_reader', firstName: 'Lauri', lastName: 'Lead' })).user;
    await assignToSubmission(sub, lead, 'lead_reader');
    const bullet = String.fromCodePoint(0xf0b7), tab = String.fromCodePoint(9);
    await LeadReaderReport.create({ submissionId: sub._id, recommendation: 'accredit_no_conditions',
      nonComplianceText: `9b${'\n'}${bullet}${tab}Provide evidence of training schedules and attendance records.` } as any);
    const pdf = await binary(request(app).get(`/api/submissions/${sub._id}/lead-reader-report/download?format=pdf`).set('Authorization', `Bearer ${signTokenFor(lead)}`));
    const t = (await pdfParse(pdf.body)).text.replace(/\s+/g, ' ');
    expect(t).toContain('• Provide evidence of training schedules');
    expect(t).not.toMatch(/[æÇ]|VFRP/);
  });

  it('POSITIVE: the forms carry the July 2025 footer, not 2022/2023/2020', async () => {
    for (const level of ['associate', 'bachelors', 'masters'] as const) {
      const { sub } = await makeSubmission(level);
      const reader = (await createUser({ role: 'reader', firstName: 'F', lastName: 'Ooter' })).user;
      await assignToSubmission(sub, reader, 'reader');
      await ReaderReport.create({ submissionId: sub._id, reviewerId: reader._id, rows: [] } as any);
      const res = await binary(request(app).get(`/api/reports/submission/${sub._id}/reader-report/download?format=docx`).set('Authorization', `Bearer ${signTokenFor(reader)}`));
      const zip = await JSZip.loadAsync(res.body);
      const footer = (await zip.file('word/footer1.xml')!.async('string')).replace(/<[^>]+>/g, '');
      expect(footer, level).toContain('July 2025');
      expect(footer, level).not.toMatch(/July 20(20|22|23)/);
      if (level === 'bachelors') expect(footer).toContain('Baccalaureate');
    }
  });

  it('POSITIVE: what the lead wrote is printed', async () => {
    const { sub } = await makeSubmission('associate');
    const lead = (await createUser({ role: 'lead_reader', firstName: 'Lauri', lastName: 'Lead' })).user;
    await assignToSubmission(sub, lead, 'lead_reader');
    await LeadReaderReport.create({ submissionId: sub._id, nonComplianceText: 'LEAD-WROTE 5c: provide policy PDF' } as any);
    const docx = await binary(request(app).get(`/api/submissions/${sub._id}/lead-reader-report/download?format=docx`).set('Authorization', `Bearer ${signTokenFor(lead)}`));
    expect(await docxText(docx.body)).toContain('LEAD-WROTE 5c');
  });
});
