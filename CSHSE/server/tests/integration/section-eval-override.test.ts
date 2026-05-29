/**
 * CR-049 Phase 4b — reader override → learning ingest.
 *   POST /api/submissions/:id/standards/:std/specs/:spec/override
 *
 * A reader overrides the AI verdict: the latest ValidationResult's verdict
 * becomes the reader's judgement (readerOverridden) AND the override is fed
 * to the institution's RAG store (section_eval_override) so future
 * evaluations learn from it. The ingest is spied (no real network).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { ValidationResult } from '../../src/models/ValidationResult';
import * as cshseAiClient from '../../src/services/cshseAiClient';
import { createUser, signTokenFor } from '../helpers/factories';

let _c = 0;
async function seed(inst: mongoose.Types.ObjectId) {
  _c += 1;
  const sub: any = await Submission.create({
    submissionId: `OVR-${Date.now().toString(36)}-${_c}`,
    institutionName: 'Override U',
    institutionId: inst,
    programName: 'HS',
    programLevel: 'bachelors',
    submitterId: new mongoose.Types.ObjectId(),
    type: 'initial',
    status: 'under_review',
  });
  // An existing AI verdict to override.
  await ValidationResult.create({
    submissionId: sub._id,
    standardCode: '1',
    specCode: 'a',
    validationType: 'submit',
    validatedAt: new Date(),
    result: { status: 'fail', verdict: 'fail', rationale: 'AI said fail' },
    attemptNumber: 1,
  });
  return sub;
}

afterEach(() => vi.restoreAllMocks());

describe('CR-049 Phase 4b — reader override endpoint', () => {
  it('a reader overrides the AI verdict → updates the result + ingests the correction', async () => {
    const ingest = vi.spyOn(cshseAiClient, 'ingestCorrection').mockResolvedValue({ ok: true });
    const inst = new mongoose.Types.ObjectId();
    const sub = await seed(inst);
    const { user: reader } = await createUser({ role: 'reader', institutionId: inst.toString() });

    const res = await request(app)
      .post(`/api/submissions/${sub._id}/standards/1/specs/a/override`)
      .set('Authorization', `Bearer ${signTokenFor(reader as any)}`)
      .send({ verdict: 'pass', note: 'Org chart link is valid; I opened it.' });

    expect(res.status).toBe(200);
    expect(res.body.verdict).toBe('pass');
    expect(res.body.readerOverridden).toBe(true);

    // The latest ValidationResult now carries the reader's verdict.
    const latest = await ValidationResult.findOne({ submissionId: sub._id, standardCode: '1', specCode: 'a' }).sort({ validatedAt: -1 });
    expect(latest?.result.verdict).toBe('pass');
    expect(latest?.result.readerOverridden).toBe(true);

    // …and the override was fed to the learning store.
    expect(ingest).toHaveBeenCalledOnce();
    expect(ingest.mock.calls[0][0]).toMatchObject({
      correctionType: 'section_eval_override',
      expectedStd: '1',
      expectedSpec: 'a',
      institutionId: inst.toString(),
    });
  });

  it('rejects a program_coordinator (403 — only readers override)', async () => {
    vi.spyOn(cshseAiClient, 'ingestCorrection').mockResolvedValue({ ok: true });
    const inst = new mongoose.Types.ObjectId();
    const sub = await seed(inst);
    const { user: pc } = await createUser({ role: 'program_coordinator', institutionId: inst.toString() });
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/standards/1/specs/a/override`)
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`)
      .send({ verdict: 'pass' });
    expect(res.status).toBe(403);
  });

  it('rejects an invalid verdict (400)', async () => {
    const inst = new mongoose.Types.ObjectId();
    const sub = await seed(inst);
    const { user: reader } = await createUser({ role: 'reader', institutionId: inst.toString() });
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/standards/1/specs/a/override`)
      .set('Authorization', `Bearer ${signTokenFor(reader as any)}`)
      .send({ verdict: 'maybe' });
    expect(res.status).toBe(400);
  });
});
