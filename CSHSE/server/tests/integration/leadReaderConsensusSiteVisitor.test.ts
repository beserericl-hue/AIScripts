/**
 * Reader-consensus ranking + second-site-visitor (SV2) selection.
 *
 * After Lauri's feedback:
 *  1. CONSENSUS lives on the Lead Reader COMPILATION page (a working tool to
 *     review and address at the site visit), NOT on the board-facing Lead
 *     Reader Report. So it comes back on GET /compilation and is ABSENT from
 *     the Lead Reader Report (response + generated DOCX).
 *  2. There are exactly TWO site visitors: the lead reader is always SV1, and
 *     the lead designates ONE additional reader as SV2 (`secondSiteVisitorName`).
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
    name,
    type: 'university',
    address: { street: '1 St', city: 'C', state: 'ST', zip: '00000', country: 'US' },
    primaryContact: { name: 'C', email: `${name}@example.com`, title: 'Dir', phone: '555-0100' },
  } as any);
}

async function makeSubmission(institution: any, submitter: any, status = 'submitted') {
  return Submission.create({
    submissionId: `sub-${Math.random().toString(36).slice(2)}`,
    institutionId: institution._id,
    institutionName: institution.name,
    programName: 'Human Services',
    programLevel: 'associate',
    submitterId: submitter._id,
    type: 'initial',
    status,
  } as any);
}

function rows(marks: Array<[string, string, 'compliant' | 'noncompliant']>) {
  return marks.map(([standardCode, specCode, mark]) => ({ standardCode, specCode, mark, comment: '' }));
}

describe('Reader consensus (compilation) + SV2 selection', () => {
  let token: string;
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

    // Std 11 → all three (3/3); Std 8 → lead + readerB (2/3); Std 3 → readerB (1/3).
    await ReaderReport.create({ submissionId: submission._id, reviewerId: lead._id, completedAt: null,
      rows: rows([['11', 'a', 'noncompliant'], ['8', 'a', 'noncompliant'], ['1', 'a', 'compliant']]) } as any);
    await ReaderReport.create({ submissionId: submission._id, reviewerId: readerA._id, completedAt: null,
      rows: rows([['11', 'a', 'noncompliant'], ['2', 'a', 'compliant']]) } as any);
    await ReaderReport.create({ submissionId: submission._id, reviewerId: readerB._id, completedAt: new Date(),
      rows: rows([['11', 'b', 'noncompliant'], ['8', 'a', 'noncompliant'], ['3', 'a', 'noncompliant'], ['1', 'a', 'compliant']]) } as any);

    token = signTokenFor(lead);
  });

  it('consensus is on the COMPILATION endpoint, ranked most-flagged first', async () => {
    const res = await request(app)
      .get(`/api/submissions/${submissionId}/compilation`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const c = res.body.consensus;
    expect(c).toBeTruthy();
    expect(c.totalReaders).toBe(3);
    expect(c.completedReaders).toBe(1);
    expect(c.standards.map((s: any) => s.standardCode)).toEqual(['11', '8', '3']);
    const byCode: Record<string, any> = Object.fromEntries(c.standards.map((s: any) => [s.standardCode, s]));
    expect(byCode['11'].nonCompliantCount).toBe(3);
    expect(byCode['11'].readerNames).toEqual(expect.arrayContaining(['Lauri Lead', 'Nancy Reader', 'Annie Reader']));
    expect(byCode['8'].nonCompliantCount).toBe(2);
    expect(byCode['8'].readerNames).not.toContain('Nancy Reader');
    expect(byCode['3'].nonCompliantCount).toBe(1);
  });

  it('the Lead Reader Report no longer carries consensus', async () => {
    const res = await request(app)
      .get(`/api/submissions/${submissionId}/lead-reader-report`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.system.consensus).toBeUndefined();
    // but the roster the SV2 selector needs is still present
    expect(res.body.system.leadReaderName).toBe('Lauri Lead');
    expect(res.body.system.additionalReaders).toEqual(expect.arrayContaining(['Nancy Reader', 'Annie Reader']));
  });

  it('SV2 selection (secondSiteVisitorName) persists and prints on the DOCX; no consensus in the report', async () => {
    const save = await request(app)
      .put(`/api/submissions/${submissionId}/lead-reader-report`)
      .set('Authorization', `Bearer ${token}`)
      .send({ secondSiteVisitorName: 'Nancy Reader' });
    expect(save.status).toBe(200);

    const read = await request(app)
      .get(`/api/submissions/${submissionId}/lead-reader-report`)
      .set('Authorization', `Bearer ${token}`);
    expect(read.body.report.secondSiteVisitorName).toBe('Nancy Reader');

    const dl = await request(app)
      .get(`/api/submissions/${submissionId}/lead-reader-report/download?format=docx`)
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(Buffer.from(c)));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(dl.status).toBe(200);
    const buf: Buffer = dl.body;
    let JSZip: any = null;
    try { JSZip = (await import('jszip')).default; } catch { /* optional */ }
    if (JSZip) {
      const zip = await JSZip.loadAsync(buf);
      const xml = await zip.file('word/document.xml')!.async('string');
      expect(xml).toContain('Site Visitor (SV1)');
      expect(xml).toContain('Second Site Visitor (SV2)');
      expect(xml).toContain('Nancy Reader');
      expect(xml).not.toContain('Reader Consensus'); // consensus must NOT be in the board report
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
      .get(`/api/submissions/${sub._id}/compilation`)
      .set('Authorization', `Bearer ${signTokenFor(l2)}`);
    expect(res.status).toBe(200);
    expect(res.body.consensus.totalReaders).toBe(0);
    expect(res.body.consensus.standards).toEqual([]);
  });
});
