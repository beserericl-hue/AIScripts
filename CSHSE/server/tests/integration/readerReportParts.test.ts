/**
 * Reader Report: every numbered PART of a specification and every Introduction
 * row is marked (Lauri, Oct 2026: "It has 4a1, 4a2, 4a3, etc and each of those
 * has to be marked compliant, not just 4a"; "the pdf doesn't include the
 * introductory information at all").
 * - Word: each part row gets its own boxes — the reader's part mark, else the spec's.
 * - Word: each Introduction row is marked from its own item; certification = Included Yes/No.
 * - PDF: an Introduction section, and each part under its spec.
 * - API: readers (and leads, as an override) can mark a part differently.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import JSZip from 'jszip';
import pdfParse from 'pdf-parse';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { Institution } from '../../src/models/Institution';
import { ReaderReport } from '../../src/models/ReaderReport';
import { createUser, signTokenFor, assignToSubmission } from '../helpers/factories';

async function makeSubmission(level: 'associate' | 'bachelors' | 'masters') {
  const name = `PRT-${Math.random().toString(36).slice(2)}`;
  const inst = await Institution.create({
    name, type: 'university',
    address: { street: '1 St', city: 'C', state: 'ST', zip: '00000', country: 'US' },
    primaryContact: { name: 'C', email: `${name}@example.com`, title: 'Dir', phone: '555-0100' },
  } as any);
  const pc = (await createUser({ role: 'program_coordinator', institutionId: inst._id.toString() })).user;
  return Submission.create({
    submissionId: `sub-${Math.random().toString(36).slice(2)}`,
    institutionId: inst._id, institutionName: inst.name,
    programName: 'Human Services', programLevel: level,
    submitterId: pc._id, type: 'reaccreditation', status: 'submitted',
  } as any);
}

const binary = (r: any) => r.buffer(true).parse((res: any, cb: any) => {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
});

/** Table rows of word/document.xml as arrays of (non-empty) cell text. */
async function docxRows(buf: Buffer): Promise<string[][]> {
  const xml = await (await JSZip.loadAsync(buf)).file('word/document.xml')!.async('string');
  const text = (frag: string) => (frag.match(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g) || [])
    .map((t) => t.replace(/<[^>]+>/g, '')).join('').trim();
  return (xml.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) || [])
    .map((tr) => tr.split(/<w:tc[ >]/).slice(1).map(text).filter(Boolean));
}
/** The [compliant, non-compliant] boxes of the row whose text starts with `label`. */
const boxes = (rows: string[][], label: string) => {
  const r = rows.find((row) => row.some((c) => c.replace(/\s+/g, ' ').startsWith(label)));
  if (!r) throw new Error(`no row "${label}"`);
  return r.filter((c) => c === '☒' || c === '☐');
};

describe('Reader Report — numbered parts and Introduction rows', () => {
  let ctx: any;
  beforeEach(async () => {
    const sub = await makeSubmission('associate');
    const reader = (await createUser({ role: 'reader', firstName: 'Pat', lastName: 'Parts' })).user;
    const lead = (await createUser({ role: 'lead_reader', firstName: 'Lee', lastName: 'Lead' })).user;
    await assignToSubmission(sub, reader, 'reader');
    await assignToSubmission(sub, lead, 'lead_reader');
    await ReaderReport.create({
      submissionId: sub._id, reviewerId: reader._id, acceptanceVote: 'accept',
      rows: [
        { standardCode: 'introduction', specCode: 'cert', mark: 'compliant', comment: '' },
        { standardCode: 'introduction', specCode: 'a', mark: 'compliant', comment: 'Degree named.' },
        { standardCode: 'introduction', specCode: 'b', mark: 'noncompliant', comment: 'INTRO-B missing org chart' },
        // 4.a compliant, but its 2nd part (Assessment plan) is NOT.
        { standardCode: '4', specCode: 'a', mark: 'compliant', comment: '', parts: [{ n: 2, mark: 'noncompliant' }] },
        { standardCode: '4', specCode: 'b', mark: 'noncompliant', comment: 'No evaluation.' },
      ],
    } as any);
    ctx = { sub, reader, lead, token: signTokenFor(reader), leadToken: signTokenFor(lead) };
  });
  const download = (fmt: 'docx' | 'pdf', token = ctx.token, reviewerId?: string) =>
    binary(request(app)
      .get(`/api/reports/submission/${ctx.sub._id}/reader-report/download?format=${fmt}${reviewerId ? `&reviewerId=${reviewerId}` : ''}`)
      .set('Authorization', `Bearer ${token}`));

  it('POSITIVE: Word marks every numbered part — the reader’s part mark, else the spec’s', async () => {
    const res = await download('docx');
    expect(res.status).toBe(200);
    const rows = await docxRows(res.body);
    expect(boxes(rows, 'Measurable student learning outcomes')).toEqual(['☒', '☐']);
    expect(boxes(rows, 'Assessment plan')).toEqual(['☐', '☒']); // marked differently
    expect(boxes(rows, 'Examples of assessment tools')).toEqual(['☒', '☐']);
    for (const p of ['A history of program evaluations', 'A description of the methodology', 'A summative analysis']) {
      expect(boxes(rows, p), p).toEqual(['☐', '☒']); // 4.b non-compliant → its parts
    }
  });

  it('NEGATIVE: parts of a spec the reader has not marked stay unticked', async () => {
    const rows = await docxRows((await download('docx')).body);
    expect(boxes(rows, 'An active link to student achievement indicators')).toEqual(['☐', '☐']); // 4.c
  });

  it('POSITIVE: Word marks each Introduction row from its own item, with its comment', async () => {
    const res = await download('docx');
    const rows = await docxRows(res.body);
    expect(boxes(rows, 'Specify the degree(s) offered')).toEqual(['☒', '☐']);
    const inst = rows.find((r) => r.some((c) => c.startsWith('Describe the institution')))!;
    expect(inst.filter((c) => c === '☒' || c === '☐')).toEqual(['☐', '☒']);
    expect(inst.join(' ')).toContain('INTRO-B missing org chart');
    expect(boxes(rows, 'Describe the institutional context')).toEqual(['☐', '☐']); // not marked
    const xml = await (await JSZip.loadAsync(res.body)).file('word/document.xml')!.async('string');
    expect(xml.replace(/<[^>]+>/g, '')).toMatch(/Included: Yes\/No\s*☒ Yes\s+☐ No/);
    // The comment now sits on its own row, not repeated in the Introduction roll-up.
    const intro = rows.find((r) => r.some((c) => c.startsWith('A. Introduction')))!;
    expect(intro.join(' ')).not.toContain('INTRO-B missing org chart');
    expect(xml).not.toMatch(/\{\{[a-z_0-9]+\}\}/);
  });

  it('POSITIVE: PDF has the Introduction section and every part under its spec', async () => {
    const res = await download('pdf');
    expect(res.status).toBe(200);
    const t = (await pdfParse(res.body)).text.replace(/\s+/g, ' ');
    expect(t).toContain('Introduction');
    expect(t).toContain('Certification of Self-Study Page');
    expect(t).toContain('Included — Yes');
    expect(t).toContain('INTRO-B missing org chart');
    expect(t).toContain('1. Measurable student learning outcomes');
    expect(t).toContain('2. Assessment plan');
    expect(t.indexOf('Introduction')).toBeLessThan(t.indexOf('Standard 4'));
  });

  it('POSITIVE: the save API stores a reader’s part marks and returns them with the part text', async () => {
    // The screen lists specs that have self-study content.
    await Submission.updateOne({ _id: ctx.sub._id }, { $set: { 'narratives.4.a': { content: '<p>Our SLOs …</p>' } } });
    const put = await request(app).put(`/api/reports/submission/${ctx.sub._id}/reader-report-data`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ rows: [{ standardCode: '4', specCode: 'a', mark: 'compliant', comment: '', parts: [{ n: 3, mark: 'noncompliant' }] }] });
    expect(put.status).toBe(200);
    const get = await request(app).get(`/api/reports/submission/${ctx.sub._id}/reader-report-data`).set('Authorization', `Bearer ${ctx.token}`);
    const a = get.body.standards.find((s: any) => s.code === '4').specs.find((s: any) => s.specCode === 'a');
    expect(a.parts.map((p: any) => p.text)).toEqual(expect.arrayContaining(['Assessment plan.']));
    expect(a.parts.length).toBe(4);
    expect(a.parts.find((p: any) => p.n === 3).mark).toBe('noncompliant');
    expect(a.parts.find((p: any) => p.n === 1).mark).toBe(''); // takes the spec's mark
  });

  it('NEGATIVE: malformed part marks are dropped, not stored', async () => {
    await request(app).put(`/api/reports/submission/${ctx.sub._id}/reader-report-data`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .send({ rows: [{ standardCode: '4', specCode: 'a', mark: 'compliant', comment: '',
        parts: [{ n: 0, mark: 'noncompliant' }, { n: 'x', mark: 'compliant' }, { n: 2, mark: 'maybe' }, { n: 1, mark: 'compliant' }] }] });
    const doc: any = await ReaderReport.findOne({ submissionId: ctx.sub._id, reviewerId: ctx.reader._id }).lean();
    expect(doc.rows[0].parts).toEqual([{ n: 1, mark: 'compliant' }]);
  });

  it('POSITIVE: a lead’s part mark is an override — the reader’s own part mark is kept', async () => {
    const put = await request(app).put(`/api/reports/submission/${ctx.sub._id}/reader-report-data?reviewerId=${ctx.reader._id}`)
      .set('Authorization', `Bearer ${ctx.leadToken}`)
      .send({ rows: [{ standardCode: '4', specCode: 'a', mark: '', comment: '', parts: [{ n: 1, mark: 'noncompliant' }] }] });
    expect(put.status).toBe(200);
    const doc: any = await ReaderReport.findOne({ submissionId: ctx.sub._id, reviewerId: ctx.reader._id }).lean();
    const row = doc.rows.find((r: any) => r.standardCode === '4' && r.specCode === 'a');
    expect(row.parts).toEqual([{ n: 2, mark: 'noncompliant' }]);
    expect(row.leadParts).toEqual([{ n: 1, mark: 'noncompliant' }]);
    expect(row.overriddenBy).toBe('Lee Lead');
    const rows = await docxRows((await download('docx', ctx.leadToken, String(ctx.reader._id))).body);
    expect(boxes(rows, 'Measurable student learning outcomes')).toEqual(['☐', '☒']); // lead wins
    expect(boxes(rows, 'Assessment plan')).toEqual(['☐', '☒']);
  });
});

describe('Reader Report parts on the other forms', () => {
  for (const [level, label] of [['bachelors', 'Assessment plan'], ['masters', 'Assessment plan, and']] as const) {
    it(`POSITIVE (${level}): parts take the spec’s mark and the Introduction rows are marked`, async () => {
      const sub = await makeSubmission(level);
      const reader = (await createUser({ role: 'reader', firstName: 'L', lastName: 'Evel' })).user;
      await assignToSubmission(sub, reader, 'reader');
      await ReaderReport.create({
        submissionId: sub._id, reviewerId: reader._id,
        rows: [
          { standardCode: 'introduction', specCode: 'cert', mark: 'compliant', comment: '' },
          { standardCode: 'introduction', specCode: 'c', mark: 'noncompliant', comment: '' },
          { standardCode: '4', specCode: 'a', mark: 'compliant', comment: '' },
        ],
      } as any);
      const res = await binary(request(app).get(`/api/reports/submission/${sub._id}/reader-report/download?format=docx`)
        .set('Authorization', `Bearer ${signTokenFor(reader)}`));
      expect(res.status).toBe(200);
      const rows = await docxRows(res.body);
      const strip = (r: string[][]) => r.map((row) => row.map((c) => c.replace(/^(\d+|[a-z])[.)]\s*/, '')));
      expect(boxes(strip(rows), label)).toEqual(['☒', '☐']);
      expect(boxes(strip(rows), 'Describe the institutional context')).toEqual(['☐', '☒']);
      if (level === 'bachelors') {
        // Program Information rows follow the certification check (Yes), not the
        // Introduction's overall mark (Non-Compliant here because of item c).
        for (const l of ['Certification Page uploaded', 'Person responsible signed off']) {
          expect(boxes(strip(rows), l), l).toEqual(['☒', '☐']);
        }
      }
      const xml = await (await JSZip.loadAsync(res.body)).file('word/document.xml')!.async('string');
      expect(xml).not.toMatch(/\{\{[a-z_0-9]+\}\}/);
    });
  }
});
