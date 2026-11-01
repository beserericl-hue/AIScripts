/**
 * Numbered parts of a specification (Lauri, Nov 2026: "the specifications have
 * subspecs (a,b,c,...) and a few specifications have subspecs that also have
 * subspecs (1,2,3..)… each of those [must be] considered in the side bar for
 * import and review, for the self study editor, and for the reader report").
 * - Catalog: which specs have parts, per level, from the July 2025 Standards/forms.
 * - API: list parts + approve each; only real parts; only the program's PC.
 * - Submit gate: a spec with parts needs every part approved.
 * - Review rail: the baccalaureate's phantom 16.d/e/f (really 16.c's parts) are gone.
 * - AI rubric: lists the parts so the evaluator checks each one.
 * - Reader Report: the screen lists every part, incl. one that shares its spec's form row.
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { Institution } from '../../src/models/Institution';
import { getLevelStandards, getSpecParts, getSpecCriteria } from '../../src/data/levelStandards';
import { createUser, signTokenFor, allPartsApproved } from '../helpers/factories';

async function seed(level: 'associate' | 'bachelors' | 'masters', extra: any = {}) {
  const name = `SPP-${Math.random().toString(36).slice(2)}`;
  const inst = await Institution.create({
    name, type: 'university',
    address: { street: '1 St', city: 'C', state: 'ST', zip: '00000', country: 'US' },
    primaryContact: { name: 'C', email: `${name}@example.com`, title: 'Dir', phone: '555-0100' },
  } as any);
  const pc = (await createUser({ role: 'program_coordinator', institutionId: inst._id.toString() })).user;
  const allPass: Record<string, any> = {};
  for (const std of getLevelStandards(level) || []) for (const sp of std.specifications) {
    allPass[`${std.code}_${sp.code}`] = { status: 'validated', validationStatus: 'pass', verdict: 'pass' };
  }
  const sub = await Submission.create({
    submissionId: `sub-${Math.random().toString(36).slice(2)}`,
    institutionId: inst._id, institutionName: inst.name,
    programName: 'Human Services', programLevel: level,
    submitterId: pc._id, type: 'reaccreditation', status: 'in_progress',
    standardsStatus: allPass, ...extra,
  } as any);
  return { sub, pc, token: signTokenFor(pc as any), inst };
}
const keys = (level: string) => {
  const out: string[] = [];
  for (const std of getLevelStandards(level) || []) for (const sp of std.specifications) {
    for (const p of getSpecParts(level, std.code, sp.code)) out.push(`${std.code}.${sp.code}.${p.n}`);
  }
  return out;
};

describe('Specification parts — catalog', () => {
  it('POSITIVE: each level lists the numbered parts of the July 2025 Standards', () => {
    expect(keys('associate')).toHaveLength(33);
    expect(keys('bachelors')).toHaveLength(34);
    expect(keys('masters')).toHaveLength(33);
    // First parts that share their spec's row on the form are still parts.
    for (const k of ['8.a.1', '8.b.2', '12.b.3', '16.c.6', '20.h.3']) expect(keys('associate')).toContain(k);
    for (const k of ['16.c.1', '16.c.6', '21.h.4']) expect(keys('bachelors')).toContain(k);
    for (const k of ['3.c.3', '6.a.3', '18.c.5', '18.d.4', '18.e.3']) expect(keys('masters')).toContain(k);
    expect(getSpecParts('associate', '4', 'a').map((p) => p.text)[1]).toBe('Assessment plan (include timelines)');
  });
  it('NEGATIVE: specs without numbered items have no parts, and baccalaureate 16 is a–c only', () => {
    expect(getSpecParts('associate', '1', 'a')).toEqual([]);
    expect(getSpecParts('masters', '4', 'a')).toHaveLength(3); // masters 4.a has no 4th part
    const b16 = (getLevelStandards('bachelors') || []).find((s) => s.code === '16')!;
    expect(b16.specifications.map((s) => s.code)).toEqual(['a', 'b', 'c']);
  });
  it('POSITIVE: the AI rubric spells out every part; NEGATIVE: no next-standard context bleeds into it', () => {
    const c = getSpecCriteria('associate', '4', 'a')!.criteria;
    expect(c).toMatch(/4 numbered parts, and EACH must be addressed/);
    expect(c).toContain('2. Assessment plan (include timelines)');
    expect(getSpecCriteria('associate', '1', 'a')!.criteria).not.toMatch(/numbered parts/);
    expect(getSpecCriteria('bachelors', '12', 'h')!.criteria).not.toMatch(/Context:/);
  });
});

describe('Specification parts — approve each part', () => {
  it('POSITIVE: the PC lists the parts and approves one; it persists', async () => {
    const { sub, token } = await seed('associate');
    const list = await request(app).get(`/api/submissions/${sub._id}/spec-parts`).set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.parts['4_a'].map((p: any) => p.n)).toEqual([1, 2, 3, 4]);
    expect(list.body.parts['1_a']).toBeUndefined();
    const ok = await request(app).post(`/api/submissions/${sub._id}/spec-parts/approval`)
      .set('Authorization', `Bearer ${token}`).send({ standardCode: '4', specCode: 'a', n: 2, approved: true });
    expect(ok.status).toBe(200);
    const saved = (await Submission.findById(sub._id).lean()) as any;
    expect(Object.keys(saved.specPartApprovals['4_a'])).toEqual(['2']);
    const off = await request(app).post(`/api/submissions/${sub._id}/spec-parts/approval`)
      .set('Authorization', `Bearer ${token}`).send({ standardCode: '4', specCode: 'a', n: 2, approved: false });
    expect(off.body.specPartApprovals['4_a']).toEqual({});
  });
  it('NEGATIVE: a part that does not exist is refused', async () => {
    const { sub, token } = await seed('associate');
    for (const body of [{ standardCode: '4', specCode: 'a', n: 5 }, { standardCode: '1', specCode: 'a', n: 1 }, { standardCode: '16', specCode: 'd', n: 1 }]) {
      const r = await request(app).post(`/api/submissions/${sub._id}/spec-parts/approval`).set('Authorization', `Bearer ${token}`).send(body);
      expect(r.status).toBe(400);
    }
  });
  it('NEGATIVE: another institution’s coordinator cannot approve or read parts', async () => {
    const { sub } = await seed('associate');
    const other = await seed('associate');
    const r = await request(app).post(`/api/submissions/${sub._id}/spec-parts/approval`)
      .set('Authorization', `Bearer ${other.token}`).send({ standardCode: '4', specCode: 'a', n: 1 });
    expect(r.status).toBe(403);
    const g = await request(app).get(`/api/submissions/${sub._id}/spec-parts`).set('Authorization', `Bearer ${other.token}`);
    expect(g.status).toBe(403);
  });
});

describe('Specification parts — submit gate', () => {
  it('NEGATIVE: every spec passing is not enough while parts are unapproved', async () => {
    const { sub, token } = await seed('masters');
    const pre = await request(app).get(`/api/submissions/${sub._id}/preflight`).set('Authorization', `Bearer ${token}`);
    expect(pre.body.submitDisabled).toBe(true);
    const codes = pre.body.errors.map((e: any) => `${e.code}:${e.standardCode}.${e.specCode}`);
    expect(codes).toContain('PARTS_NOT_APPROVED:18.c');
    expect(codes).not.toContain('PARTS_NOT_APPROVED:1.a');
    const submit = await request(app).post(`/api/submissions/${sub._id}/submit`).set('Authorization', `Bearer ${token}`).send({});
    expect(submit.status).toBe(400);
    expect(JSON.stringify(submit.body.missingValidations)).toMatch(/parts .* not approved/);
  });
  it('POSITIVE: with every part approved the parts gate clears', async () => {
    const { sub, token } = await seed('masters', { specPartApprovals: allPartsApproved('masters') });
    const pre = await request(app).get(`/api/submissions/${sub._id}/preflight`).set('Authorization', `Bearer ${token}`);
    expect(pre.body.errors.filter((e: any) => e.code === 'PARTS_NOT_APPROVED')).toEqual([]);
  });
  it('POSITIVE: a spec marked Not Applicable needs no part approvals', async () => {
    const { sub, token } = await seed('associate');
    await Submission.updateOne({ _id: sub._id }, { $set: { 'standardsStatus.4_a.excluded': true } });
    const pre = await request(app).get(`/api/submissions/${sub._id}/preflight`).set('Authorization', `Bearer ${token}`);
    const codes = pre.body.errors.map((e: any) => `${e.code}:${e.standardCode}.${e.specCode}`);
    expect(codes).not.toContain('PARTS_NOT_APPROVED:4.a');
    expect(codes).toContain('PARTS_NOT_APPROVED:4.b');
  });
});

describe('Specification parts — Review rail', () => {
  const bucket = (std: string, spec: string, narratives: any[] = []) => ({
    standardCode: std, specCode: spec, standardTitle: 'T', specPrompt: '', narratives,
    evidenceText: [], evidenceFiles: [], matrixCells: [], coverageScore: null, coverageCovered: null, coverageGaps: [], coverageStrengths: [],
  });
  it('POSITIVE: an old baccalaureate import’s empty 16.d/e/f rows are not shown; NEGATIVE: one holding content is kept', async () => {
    const { sub, token } = await seed('bachelors', {
      aiReviewState: { buckets: {
        '16.c': bucket('16', 'c'), '16.d': bucket('16', 'd'), '16.e': bucket('16', 'e'),
        '16.f': bucket('16', 'f', [{ sectionId: 's1', text: 'kept' }]),
      } },
    });
    const r = await request(app).get(`/api/submissions/${sub._id}/review`).set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(200);
    expect(Object.keys(r.body.aiReviewState.buckets).sort()).toEqual(['16.c', '16.f']);
    const stored = (await Submission.findById(sub._id).lean()) as any;
    expect(Object.keys(stored.aiReviewState.buckets)).toContain('16.d'); // nothing deleted
  });
});
