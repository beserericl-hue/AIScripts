/**
 * Site-Visit Review consensus + second-site-visitor (SV2) selection.
 *
 * - CONSENSUS is a lead/admin-only popup tool on the Reader Report, served by
 *   GET /site-visit-review: per standard, which readers marked it non-compliant
 *   (agreed it's a problem) vs compliant (disagreed). It is NOT on the
 *   compilation page and NOT on / in the Lead Reader Report.
 * - SITE VISITORS: lead is always SV1; the lead designates ONE additional
 *   reader as SV2 (`secondSiteVisitorName`), printed on the report.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { Institution } from '../../src/models/Institution';
import { ReaderReport } from '../../src/models/ReaderReport';
import { createUser, signTokenFor, assignToSubmission } from '../helpers/factories';

async function makeInstitution(name: string) {
  return Institution.create({
    name, type: 'university',
    address: { street: '1 St', city: 'C', state: 'ST', zip: '00000', country: 'US' },
    primaryContact: { name: 'C', email: `${name}@example.com`, title: 'Dir', phone: '555-0100' },
  } as any);
}
async function makeSubmission(institution: any, submitter: any, status = 'submitted') {
  return Submission.create({
    submissionId: `sub-${Math.random().toString(36).slice(2)}`,
    institutionId: institution._id, institutionName: institution.name,
    programName: 'Human Services', programLevel: 'associate',
    submitterId: submitter._id, type: 'initial', status,
  } as any);
}
function rows(marks: Array<[string, string, 'compliant' | 'noncompliant']>) {
  return marks.map(([standardCode, specCode, mark]) => ({ standardCode, specCode, mark, comment: '' }));
}

describe('Site-Visit Review consensus + SV2 selection', () => {
  let token: string;
  let readerToken: string;
  let submissionId: string;

  beforeEach(async () => {
    const inst = await makeInstitution(`AACC-${Math.random().toString(36).slice(2)}`);
    const pc = (await createUser({ role: 'program_coordinator', institutionId: inst._id.toString() })).user;
    const submission = await makeSubmission(inst, pc, 'submitted');
    submissionId = submission._id.toString();

    const lead = (await createUser({ role: 'lead_reader', firstName: 'Lauri', lastName: 'Lead', institutionId: inst._id.toString() })).user;
    const readerA = (await createUser({ role: 'reader', firstName: 'Nancy', lastName: 'Reader' })).user;
    const readerB = (await createUser({ role: 'reader', firstName: 'Annie', lastName: 'Reader' })).user;

    await assignToSubmission(submission, lead, 'lead_reader');
    await assignToSubmission(submission, readerA, 'reader');
    await assignToSubmission(submission, readerB, 'reader');

    // Std 11 → all three non-compliant; Std 8 → lead + B; Std 3 → B.
    // Std 1 → lead + B compliant; Std 2 → A compliant.
    await ReaderReport.create({ submissionId: submission._id, reviewerId: lead._id, completedAt: null,
      rows: rows([['11', 'a', 'noncompliant'], ['8', 'a', 'noncompliant'], ['1', 'a', 'compliant']]) } as any);
    await ReaderReport.create({ submissionId: submission._id, reviewerId: readerA._id, completedAt: null,
      rows: rows([['11', 'a', 'noncompliant'], ['2', 'a', 'compliant']]) } as any);
    await ReaderReport.create({ submissionId: submission._id, reviewerId: readerB._id, completedAt: new Date(),
      rows: rows([['11', 'b', 'noncompliant'], ['8', 'a', 'noncompliant'], ['3', 'a', 'noncompliant'], ['1', 'a', 'compliant']]) } as any);

    token = signTokenFor(lead);
    readerToken = signTokenFor(readerA);
  });

  it('GET /site-visit-review ranks non-compliant first and names who agreed / who disagreed', async () => {
    const res = await request(app)
      .get(`/api/submissions/${submissionId}/site-visit-review`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.totalReaders).toBe(3);
    expect(res.body.completedReaders).toBe(1);

    const codes = res.body.standards.map((s: any) => s.standardCode);
    expect(codes).toEqual(['11', '8', '3', '1', '2']); // NC ranked, then compliant by number
    const by: Record<string, any> = Object.fromEntries(res.body.standards.map((s: any) => [s.standardCode, s]));

    expect(by['11'].verdict).toBe('noncompliant');
    expect(by['11'].nonCompliantCount).toBe(3);
    expect(by['11'].nonCompliantReaders).toEqual(expect.arrayContaining(['Lauri Lead', 'Nancy Reader', 'Annie Reader']));
    expect(by['11'].specs).toEqual(expect.arrayContaining(['11a', '11b']));

    expect(by['8'].nonCompliantReaders).toEqual(expect.arrayContaining(['Lauri Lead', 'Annie Reader']));
    expect(by['8'].nonCompliantReaders).not.toContain('Nancy Reader');

    expect(by['1'].verdict).toBe('compliant');
    expect(by['1'].nonCompliantCount).toBe(0);
    expect(by['1'].compliantReaders).toEqual(expect.arrayContaining(['Lauri Lead', 'Annie Reader']));
  });

  it('GET /site-visit-review is lead/admin only (a reader is 403)', async () => {
    const res = await request(app)
      .get(`/api/submissions/${submissionId}/site-visit-review`)
      .set('Authorization', `Bearer ${readerToken}`);
    expect(res.status).toBe(403);
  });

  it('consensus is NOT on the compilation page or the Lead Reader Report', async () => {
    const comp = await request(app)
      .get(`/api/submissions/${submissionId}/compilation`)
      .set('Authorization', `Bearer ${token}`);
    expect(comp.status).toBe(200);
    expect(comp.body.consensus).toBeUndefined();

    const lrr = await request(app)
      .get(`/api/submissions/${submissionId}/lead-reader-report`)
      .set('Authorization', `Bearer ${token}`);
    expect(lrr.body.system.consensus).toBeUndefined();
  });

  it('SV2 selection persists and prints on the DOCX; no consensus in the report', async () => {
    await request(app)
      .put(`/api/submissions/${submissionId}/lead-reader-report`)
      .set('Authorization', `Bearer ${token}`)
      .send({ secondSiteVisitorName: 'Nancy Reader' });

    const dl = await request(app)
      .get(`/api/submissions/${submissionId}/lead-reader-report/download?format=docx`)
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse((r, cb) => { const c: Buffer[] = []; r.on('data', (x: Buffer) => c.push(Buffer.from(x))); r.on('end', () => cb(null, Buffer.concat(c))); });
    expect(dl.status).toBe(200);
    let JSZip: any = null;
    try { JSZip = (await import('jszip')).default; } catch { /* optional */ }
    if (JSZip) {
      const xml = await (await JSZip.loadAsync(dl.body as Buffer)).file('word/document.xml')!.async('string');
      expect(xml).toContain('Site Visitor (SV1)');
      expect(xml).toContain('Second Site Visitor (SV2)');
      expect(xml).toContain('Nancy Reader');
      expect(xml).not.toContain('Reader Consensus');
    }
  });

  it('empty consensus when no reader has marked anything (no crash)', async () => {
    const inst = await makeInstitution(`Quiet-${Math.random().toString(36).slice(2)}`);
    const pc = (await createUser({ role: 'program_coordinator', institutionId: inst._id.toString() })).user;
    const sub = await makeSubmission(inst, pc, 'submitted');
    const l2 = (await createUser({ role: 'lead_reader', firstName: 'Quiet', lastName: 'Lead', institutionId: inst._id.toString() })).user;
    await assignToSubmission(sub, l2, 'lead_reader');
    const r = (await createUser({ role: 'reader', firstName: 'Blank', lastName: 'Reader' })).user;
    await assignToSubmission(sub, r, 'reader');
    await ReaderReport.create({ submissionId: sub._id, reviewerId: r._id, rows: [{ standardCode: '5', specCode: 'a', mark: '', comment: '' }] } as any);

    const res = await request(app)
      .get(`/api/submissions/${sub._id}/site-visit-review`)
      .set('Authorization', `Bearer ${signTokenFor(l2)}`);
    expect(res.status).toBe(200);
    expect(res.body.totalReaders).toBe(0);
    expect(res.body.standards).toEqual([]);
  });
});
