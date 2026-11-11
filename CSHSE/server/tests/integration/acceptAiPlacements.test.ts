/**
 * POST /api/submissions/:id/evidence/accept-ai-placements
 *   - default: only AI picks at ≥ 75% are filed
 *   - all: true ("Use Recommended"): EVERY AI-recommended placement is filed,
 *     whatever its confidence; working material (no recommendation) and files
 *     the coordinator already filed are left alone.
 */
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { SupportingEvidence } from '../../src/models/SupportingEvidence';
import { createUser, signTokenFor } from '../helpers/factories';

async function seed() {
  const { user: pc } = await createUser({ role: 'program_coordinator' });
  const institutionId = (pc as any).institutionId || new mongoose.Types.ObjectId();
  const sub: any = await Submission.create({
    submissionId: `AIP-${Date.now().toString(36)}`,
    institutionName: 'Test U',
    institutionId,
    programName: 'Human Services',
    programLevel: 'bachelors',
    submitterId: pc._id,
    type: 'initial',
    status: 'draft',
  });
  const mk = (name: string, extra: any = {}) =>
    SupportingEvidence.create({
      institutionId,
      submissionId: sub._id,
      uploadedBy: pc._id,
      evidenceType: 'document',
      file: { filename: name, originalName: name, mimeType: 'application/pdf', size: 10, uploadedBy: pc._id },
      ...extra,
    });
  const hi = await mk('hi.pdf', { metadata: { aiPlacement: { kind: 'evidence', standardCode: '4', specCode: 'a', confidence: 0.9 } } });
  const lo = await mk('lo.pdf', { metadata: { aiPlacement: { kind: 'evidence', standardCode: '1', specCode: 'f', confidence: 0.35 } } });
  const noConf = await mk('noconf.pdf', { metadata: { aiPlacement: { kind: 'evidence', standardCode: '12', specCode: 'b' } } });
  const work = await mk('work.docx', { metadata: { aiPlacement: { kind: 'working_file', standardCode: null, confidence: 0.9 } } });
  const filed = await mk('filed.pdf', { standardCode: '7', specCode: 'b', metadata: { aiPlacement: { kind: 'evidence', standardCode: '3', specCode: 'a', confidence: 0.9 } } });
  return { token: signTokenFor(pc as any), sub, hi, lo, noConf, work, filed };
}
const get = async (id: any) => (await SupportingEvidence.findById(id).lean()) as any;

describe('accept-ai-placements', () => {
  it('default accepts only ≥75% picks', async () => {
    const s = await seed();
    const r = await request(app).post(`/api/submissions/${s.sub._id}/evidence/accept-ai-placements`).set('Authorization', `Bearer ${s.token}`).send({ minConfidence: 0.75 });
    expect(r.status).toBe(200);
    expect(r.body.accepted).toBe(1);
    expect((await get(s.lo._id)).standardCode).toBeFalsy();
  });

  it('all: true ("Use Recommended") files every recommended file at its recommended standard + spec', async () => {
    const s = await seed();
    const r = await request(app).post(`/api/submissions/${s.sub._id}/evidence/accept-ai-placements`).set('Authorization', `Bearer ${s.token}`).send({ all: true });
    expect(r.status).toBe(200);
    expect(r.body.accepted).toBe(3);
    expect(await get(s.hi._id)).toMatchObject({ standardCode: '4', specCode: 'a' });
    expect(await get(s.lo._id)).toMatchObject({ standardCode: '1', specCode: 'f' });
    expect(await get(s.noConf._id)).toMatchObject({ standardCode: '12', specCode: 'b' });
    expect((await get(s.lo._id)).tags).toContain('ai-placed');
  });

  it('NEGATIVE: working material and files already filed by the coordinator are not moved', async () => {
    const s = await seed();
    await request(app).post(`/api/submissions/${s.sub._id}/evidence/accept-ai-placements`).set('Authorization', `Bearer ${s.token}`).send({ all: true });
    expect((await get(s.work._id)).standardCode).toBeFalsy();
    expect(await get(s.filed._id)).toMatchObject({ standardCode: '7', specCode: 'b' });
  });

  it('NEGATIVE: another program coordinator cannot use it on this submission', async () => {
    const s = await seed();
    const { user: other } = await createUser({ role: 'program_coordinator' });
    const r = await request(app).post(`/api/submissions/${s.sub._id}/evidence/accept-ai-placements`).set('Authorization', `Bearer ${signTokenFor(other as any)}`).send({ all: true });
    expect(r.status).toBeGreaterThanOrEqual(403);
    expect((await get(s.lo._id)).standardCode).toBeFalsy();
  });
});
