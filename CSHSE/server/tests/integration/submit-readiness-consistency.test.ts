/**
 * One definition of progress + readiness across the PC dashboard (workflow
 * summary), the Final Submit dialog (preflight + needs-improvement list) and
 * the submit gate — services/submitReadiness.
 *
 * Regressions pinned (found while filming the help videos):
 *  1. dashboard "98 of 83 · 118%": intro / standard-level status rows were
 *     counted and the flat catalog (83) used instead of the level one (96).
 *  2. dashboard "Not ready" vs editor "ready": needs-improvement verdicts and
 *     unassigned files were judged differently.
 *  3. dialog "25 unassigned" vs checks "55": the 25-name list was counted.
 *  4. dialog listed 15 Needs-Improvement items vs 4 statuses (stale / errored
 *     stored AI results).
 *  5. queue "Submitted — awaiting assignment" with readers assigned.
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { Institution } from '../../src/models/Institution';
import { SupportingEvidence } from '../../src/models/SupportingEvidence';
import { ValidationResult } from '../../src/models/ValidationResult';
import { getLevelStandards } from '../../src/data/levelStandards';
import { ensureInstitutionReaderAssignments } from '../../src/services/readerAssignmentService';
import { createUser, signTokenFor, allPartsApproved } from '../helpers/factories';

const LEVEL_SPECS = (getLevelStandards('bachelors') || []).flatMap((s) => (s.specifications || []).map((sp) => `${s.code}_${sp.code}`));

function statuses(fill: (key: string, i: number) => any): Record<string, any> {
  const out: Record<string, any> = {};
  LEVEL_SPECS.forEach((k, i) => {
    const v = fill(k, i);
    if (v) out[k] = v;
  });
  return out;
}

let n = 0;
async function seed(pcId: any, standardsStatus: Record<string, any>, extra: any = {}) {
  n += 1;
  return (await Submission.create({
    submissionId: `RDY-${Date.now().toString(36)}-${n}`,
    institutionName: 'Ready U',
    programName: 'HS',
    programLevel: 'bachelors',
    submitterId: pcId,
    type: 'initial',
    status: 'in_progress',
    standardsStatus,
    specPartApprovals: allPartsApproved('bachelors'),
    ...extra,
  })) as any;
}

async function evidence(sub: any, pcId: any, count: number, extra: any = {}) {
  for (let i = 0; i < count; i++) {
    await SupportingEvidence.create({
      institutionId: new mongoose.Types.ObjectId(),
      submissionId: sub._id,
      uploadedBy: pcId,
      evidenceType: 'document',
      file: { filename: `f${i}.pdf`, originalName: `File ${i}.pdf`, mimeType: 'application/pdf', size: 10, uploadedBy: pcId },
      ...extra,
    });
  }
}

const ADDR = {
  address: { street: '1 Test St', city: 'Test', state: 'CA', zip: '90000', country: 'USA' },
  primaryContact: { name: 'Admin', email: 'admin@test.local', phone: '555-0100' },
};
const get = (path: string, user: any) => request(app).get(path).set('Authorization', `Bearer ${signTokenFor(user)}`);

describe('submit readiness — one rule everywhere', () => {
  it('1. validated never exceeds the level catalog: intro / standard-level rows are not specs', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const ss = statuses(() => ({ verdict: 'pass', validationStatus: 'pass' }));
    // Non-spec rows that used to be counted.
    ss['1'] = { status: 'complete' };
    ss['intro_document'] = { status: 'validated', validationStatus: 'pass' };
    ss['99_z'] = { verdict: 'pass', validationStatus: 'pass' };
    const sub = await seed(user._id, ss);
    const res = await get(`/api/submissions/${sub._id}/workflow-summary`, user);
    expect(res.status).toBe(200);
    expect(res.body.selfStudy.specsTotal).toBe(LEVEL_SPECS.length); // 96 for bachelors, not 83
    expect(res.body.selfStudy.specsValidated).toBe(LEVEL_SPECS.length);
    expect(res.body.selfStudy.specsValidated).toBeLessThanOrEqual(res.body.selfStudy.specsTotal);
    expect(res.body.submit.ready).toBe(true);
  });

  it('1. Not Applicable leaves the denominator; needs improvement counts as validated', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seed(user._id, statuses((_, i) =>
      i < 3 ? { excluded: true } : i < 7 ? { verdict: 'needs_improvement', validationStatus: 'fail' } : { verdict: 'pass', validationStatus: 'pass' }
    ));
    const res = await get(`/api/submissions/${sub._id}/workflow-summary`, user);
    expect(res.body.selfStudy.specsTotal).toBe(LEVEL_SPECS.length - 3);
    expect(res.body.selfStudy.specsValidated).toBe(LEVEL_SPECS.length - 3);
    expect(res.body.submit.ready).toBe(true);
  });

  it('2. NEGATIVE: one unassigned file makes the dashboard, preflight and submit gate all say not ready', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seed(user._id, statuses(() => ({ verdict: 'pass', validationStatus: 'pass' })));
    await evidence(sub, user._id, 1);
    const wf = await get(`/api/submissions/${sub._id}/workflow-summary`, user);
    expect(wf.body.submit.ready).toBe(false);
    expect(wf.body.submit.unassignedFiles).toBe(1);
    const pf = await get(`/api/submissions/${sub._id}/preflight`, user);
    expect(pf.body.submitDisabled).toBe(true);
    expect(pf.body.counts.unassignedFiles).toBe(1);
    const submit = await request(app).post(`/api/submissions/${sub._id}/submit`).set('Authorization', `Bearer ${signTokenFor(user)}`).send({});
    expect(submit.status).toBe(400);
    expect(submit.body.error).toBe('UNASSIGNED_FILES');
  });

  it('2. POSITIVE: a deleted file, a filed file and a curriculum matrix do not block', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seed(user._id, statuses(() => ({ verdict: 'pass', validationStatus: 'pass' })));
    await evidence(sub, user._id, 1, { isDeleted: true });
    await evidence(sub, user._id, 1, { standardCode: '4', specCode: 'a' });
    await evidence(sub, user._id, 1, { tags: ['excluded:curriculum-matrix'] });
    const wf = await get(`/api/submissions/${sub._id}/workflow-summary`, user);
    expect(wf.body.submit.unassignedFiles).toBe(0);
    expect(wf.body.submit.ready).toBe(true);
    const pf = await get(`/api/submissions/${sub._id}/preflight`, user);
    expect(pf.body.counts.unassignedFiles).toBe(0);
  });

  it('3. preflight reports the TOTAL unassigned count (55), not the 25-name sample', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seed(user._id, statuses(() => ({ verdict: 'pass', validationStatus: 'pass' })));
    await evidence(sub, user._id, 55);
    const pf = await get(`/api/submissions/${sub._id}/preflight`, user);
    expect(pf.body.unassignedFiles.length).toBe(25);
    expect(pf.body.counts.unassignedFiles).toBe(55);
    const wf = await get(`/api/submissions/${sub._id}/workflow-summary`, user);
    expect(wf.body.submit.unassignedFiles).toBe(55);
  });

  it('4. Needs-Improvement list = the specs whose status verdict is needs_improvement; errored / stale results are ignored', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const ni = new Set(LEVEL_SPECS.slice(0, 4));
    const sub = await seed(user._id, statuses((k) =>
      ni.has(k) ? { verdict: 'needs_improvement', validationStatus: 'fail' } : { verdict: 'pass', validationStatus: 'pass' }
    ));
    // Stale stored AI results claiming needs-improvement on PASSING specs,
    // incl. a cloned errored evaluation — must not appear in the list.
    for (const k of LEVEL_SPECS.slice(10, 21)) {
      const [standardCode, specCode] = k.split('_');
      await ValidationResult.create({
        submissionId: sub._id, standardCode, specCode, validationType: 'ai',
        status: 'fail', score: 40, result: { verdict: 'needs_improvement', feedback: 'evaluation error (NotFoundError)' },
      } as any).catch(() => undefined);
    }
    const res = await get(`/api/submissions/${sub._id}/needs-improvement`, user);
    expect(res.status).toBe(200);
    expect(res.body.items.map((i: any) => `${i.standardCode}_${i.specCode}`).sort()).toEqual([...ni].sort());
    for (const it of res.body.items) expect(it.rationale).not.toMatch(/NotFoundError|evaluation error/);
    const pf = await get(`/api/submissions/${sub._id}/preflight`, user);
    expect(pf.body.counts.needsImprovement).toBe(4);
  });

  it('5. auto-assigning institution reviewers advances submitted → readers_assigned', async () => {
    const { user: lead } = await createUser({ role: 'lead_reader' });
    const { user: reader } = await createUser({ role: 'reader' });
    const inst: any = await Institution.create({
      name: `Assign U ${Date.now()}`, type: 'college', ...ADDR,
      assignedLeadReaderId: lead._id, assignedReaderIds: [reader._id],
    } as any);
    const sub: any = await seed(new mongoose.Types.ObjectId(), {}, { status: 'submitted', institutionId: inst._id });
    const r = await ensureInstitutionReaderAssignments(sub, { role: 'system' });
    expect(r.assignedUsers.length).toBe(2);
    expect(sub.status).toBe('readers_assigned');
  });

  it('5. NEGATIVE: no reviewers → stays submitted; a later status is never moved back', async () => {
    const inst: any = await Institution.create({ name: `Empty U ${Date.now()}`, type: 'college', ...ADDR } as any);
    const sub: any = await seed(new mongoose.Types.ObjectId(), {}, { status: 'submitted', institutionId: inst._id });
    await ensureInstitutionReaderAssignments(sub, { role: 'system' });
    expect(sub.status).toBe('submitted');
    const { user: lead } = await createUser({ role: 'lead_reader' });
    const inst2: any = await Institution.create({ name: `Busy U ${Date.now()}`, type: 'college', ...ADDR, assignedLeadReaderId: lead._id } as any);
    const later: any = await seed(new mongoose.Types.ObjectId(), {}, { status: 'under_review', institutionId: inst2._id });
    await ensureInstitutionReaderAssignments(later, { role: 'system' });
    expect(later.status).toBe('under_review');
  });

  it('5. a readers_assigned study cannot be submitted again', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seed(user._id, statuses(() => ({ verdict: 'pass', validationStatus: 'pass' })), { status: 'readers_assigned' });
    const res = await request(app).post(`/api/submissions/${sub._id}/submit`).set('Authorization', `Bearer ${signTokenFor(user)}`).send({});
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect((await Submission.findById(sub._id).lean() as any).status).toBe('readers_assigned');
  });
});
