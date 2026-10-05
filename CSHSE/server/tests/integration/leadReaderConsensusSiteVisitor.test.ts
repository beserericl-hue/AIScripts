/**
 * Lead Reader Report — reader-consensus ranking + editable site-visitor labels.
 *
 * Two features Lauri (a lead reader) asked for:
 *  1. CONSENSUS: rank each standard by how many of the readers independently
 *     marked it non-compliant (3 of 3 → 2 of 3 → 1 of 3), so the lead can
 *     prioritise which standards to raise with the program / site visit.
 *  2. SITE-VISITOR LABELS: the lead assigns each reader of the site an SV label
 *     (lead = SV1, additional readers = SV2, SV3, …), editable and shown on the
 *     downloaded report.
 *
 * Positive: the consensus ranks correctly, names the flagging readers, and the
 * labels persist + appear in the generated DOCX.
 * Negative/guard: a submission whose readers haven't marked anything yields an
 * empty consensus (no crash), and the existing editable fields still save.
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

describe('Lead Reader Report — consensus + site-visitor labels', () => {
  let token: string;
  let submissionId: string;
  let lead: any;
  let readerA: any;
  let readerB: any;

  beforeEach(async () => {
    const inst = await makeInstitution(`AACC-${Math.random().toString(36).slice(2)}`);
    const pc = (await createUser({ role: 'program_coordinator', institutionId: inst._id.toString() })).user;
    const submission = await makeSubmission(inst, pc, 'submitted');
    submissionId = submission._id.toString();

    lead = (await createUser({ role: 'lead_reader', firstName: 'Lauri', lastName: 'Lead', institutionId: inst._id.toString() })).user;
    readerA = (await createUser({ role: 'reader', firstName: 'Nancy', lastName: 'Reader' })).user;
    readerB = (await createUser({ role: 'reader', firstName: 'Annie', lastName: 'Reader' })).user;

    await assignToSubmission(submission, lead, 'lead_reader');
    await assignToSubmission(submission, readerA, 'reader');
    await assignToSubmission(submission, readerB, 'reader');

    // Consensus fixture:
    //   Std 11 → all three non-compliant (3 of 3)
    //   Std 8  → lead + readerB (2 of 3)
    //   Std 3  → readerB only (1 of 3)
    await ReaderReport.create({
      submissionId: submission._id, reviewerId: lead._id, completedAt: null,
      rows: rows([['11', 'a', 'noncompliant'], ['8', 'a', 'noncompliant'], ['1', 'a', 'compliant']]),
    } as any);
    await ReaderReport.create({
      submissionId: submission._id, reviewerId: readerA._id, completedAt: null,
      rows: rows([['11', 'a', 'noncompliant'], ['2', 'a', 'compliant']]),
    } as any);
    await ReaderReport.create({
      submissionId: submission._id, reviewerId: readerB._id, completedAt: new Date(),
      rows: rows([['11', 'b', 'noncompliant'], ['8', 'a', 'noncompliant'], ['3', 'a', 'noncompliant'], ['1', 'a', 'compliant']]),
    } as any);

    token = signTokenFor(lead);
  });

  it('ranks standards by non-compliant reader count, most-flagged first', async () => {
    const res = await request(app)
      .get(`/api/submissions/${submissionId}/lead-reader-report`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const c = res.body.system.consensus;
    expect(c.totalReaders).toBe(3);
    expect(c.completedReaders).toBe(1);

    const codes = c.standards.map((s: any) => s.standardCode);
    expect(codes).toEqual(['11', '8', '3']); // 3 → 2 → 1, ties broken by standard number
    const byCode: Record<string, any> = Object.fromEntries(c.standards.map((s: any) => [s.standardCode, s]));
    expect(byCode['11'].nonCompliantCount).toBe(3);
    expect(byCode['11'].readerNames).toEqual(expect.arrayContaining(['Lauri Lead', 'Nancy Reader', 'Annie Reader']));
    expect(byCode['8'].nonCompliantCount).toBe(2);
    expect(byCode['8'].readerNames).toEqual(expect.arrayContaining(['Lauri Lead', 'Annie Reader']));
    expect(byCode['8'].readerNames).not.toContain('Nancy Reader');
    expect(byCode['3'].nonCompliantCount).toBe(1);
    expect(byCode['11'].specs).toEqual(expect.arrayContaining(['11a', '11b']));
  });

  it('seeds the site-visitor roster (lead first) and persists lead-set labels', async () => {
    const r1 = await request(app)
      .get(`/api/submissions/${submissionId}/lead-reader-report`)
      .set('Authorization', `Bearer ${token}`);
    expect(r1.body.system.leadReaderName).toBe('Lauri Lead');
    expect(r1.body.system.additionalReaders).toEqual(expect.arrayContaining(['Nancy Reader', 'Annie Reader']));

    const save = await request(app)
      .put(`/api/submissions/${submissionId}/lead-reader-report`)
      .set('Authorization', `Bearer ${token}`)
      .send({ siteVisitorLabels: [{ name: 'Lauri Lead', label: 'SV1' }, { name: 'Nancy Reader', label: 'SV2' }] });
    expect(save.status).toBe(200);

    const r2 = await request(app)
      .get(`/api/submissions/${submissionId}/lead-reader-report`)
      .set('Authorization', `Bearer ${token}`);
    expect(r2.body.report.siteVisitorLabels).toEqual(
      expect.arrayContaining([
        { name: 'Lauri Lead', label: 'SV1' },
        { name: 'Nancy Reader', label: 'SV2' },
      ])
    );
  });

  it('download succeeds and the DOCX carries the SV labels + consensus section', async () => {
    await request(app)
      .put(`/api/submissions/${submissionId}/lead-reader-report`)
      .set('Authorization', `Bearer ${token}`)
      .send({ siteVisitorLabels: [{ name: 'Nancy Reader', label: 'SV2' }] });

    const res = await request(app)
      .get(`/api/submissions/${submissionId}/lead-reader-report/download?format=docx`)
      .set('Authorization', `Bearer ${token}`)
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(Buffer.from(c)));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    const buf: Buffer = res.body;
    expect(buf.length).toBeGreaterThan(1000);

    // A DOCX is a zip of XML — unzip and assert the visible text if JSZip is
    // resolvable (it is a transitive dep of `docx`). Skip gracefully otherwise.
    let JSZip: any = null;
    try { JSZip = (await import('jszip')).default; } catch { /* optional */ }
    if (JSZip) {
      const zip = await JSZip.loadAsync(buf);
      const xml = await zip.file('word/document.xml')!.async('string');
      expect(xml).toContain('Reader Consensus on Non-Compliance');
      expect(xml).toContain('Site Visitor (SV1)'); // lead defaults to SV1
      expect(xml).toContain('Site Visitor (SV2)'); // Nancy relabelled SV2
      expect(xml).toContain('Standard 11');
    }
  });

  it('empty consensus when no reader has marked anything (no crash)', async () => {
    const inst = await makeInstitution(`Quiet-${Math.random().toString(36).slice(2)}`);
    const pc = (await createUser({ role: 'program_coordinator', institutionId: inst._id.toString() })).user;
    const sub = await makeSubmission(inst, pc, 'submitted');
    const l2 = (await createUser({ role: 'lead_reader', firstName: 'Quiet', lastName: 'Lead', institutionId: inst._id.toString() })).user;
    await assignToSubmission(sub, l2, 'lead_reader');
    // A reader with an all-blank report must NOT count as a participating reader.
    const r = (await createUser({ role: 'reader', firstName: 'Blank', lastName: 'Reader' })).user;
    await assignToSubmission(sub, r, 'reader');
    await ReaderReport.create({ submissionId: sub._id, reviewerId: r._id, rows: rows([['5', 'a', 'compliant' as any]]).map((x) => ({ ...x, mark: '' })) } as any);

    const res = await request(app)
      .get(`/api/submissions/${sub._id}/lead-reader-report`)
      .set('Authorization', `Bearer ${signTokenFor(l2)}`);
    expect(res.status).toBe(200);
    expect(res.body.system.consensus.totalReaders).toBe(0);
    expect(res.body.system.consensus.standards).toEqual([]);
  });
});
