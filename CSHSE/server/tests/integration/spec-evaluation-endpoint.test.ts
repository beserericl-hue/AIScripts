/**
 * CR-049 Phase 3 — editor AI-review endpoints.
 *   GET  /api/submissions/:id/standards/:std/specs/:spec/evaluation  (latest)
 *   POST /api/submissions/:id/standards/:std/specs/:spec/evaluate     (run now)
 *
 * cshse-ai is spied (isolate=false → no vi.mock); restored in afterEach.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import * as cshseAiClient from '../../src/services/cshseAiClient';
import { createUser, signTokenFor } from '../helpers/factories';

let _c = 0;
async function seedSubmission(inst: mongoose.Types.ObjectId, submitterId: mongoose.Types.ObjectId) {
  _c += 1;
  return (await Submission.create({
    submissionId: `EVAL-${Date.now().toString(36)}-${_c}`,
    institutionName: 'Eval U',
    institutionId: inst,
    programName: 'Human Services',
    programLevel: 'bachelors',
    submitterId,
    type: 'initial',
    status: 'in_progress',
    narratives: { '1': { a: { content: '<p>We are accredited by MSCHE.</p>' } } },
  })) as any;
}

afterEach(() => vi.restoreAllMocks());

describe('CR-049 Phase 3 — spec evaluation endpoints', () => {
  it('GET evaluation returns null before any review', async () => {
    const inst = new mongoose.Types.ObjectId();
    const { user } = await createUser({ role: 'program_coordinator', institutionId: inst.toString() });
    const sub = await seedSubmission(inst, user._id as any);
    const res = await request(app)
      .get(`/api/submissions/${sub._id}/standards/1/specs/a/evaluation`)
      .set('Authorization', `Bearer ${signTokenFor(user as any)}`);
    expect(res.status).toBe(200);
    expect(res.body.evaluation).toBeNull();
  });

  it('POST evaluate runs the AI, returns the verdict, and GET then reflects it', async () => {
    vi.spyOn(cshseAiClient, 'evaluateSection').mockResolvedValue({
      perSpec: [{
        standardCode: '1', specCode: 'a', verdict: 'pass',
        rationale: 'Regional accreditation is documented.',
        criteriaCoverage: [{ criterion: 'regionally accredited', met: true }],
        improvementSuggestions: [], sourcesUsed: {},
      }],
      links: [],
    } as any);

    const inst = new mongoose.Types.ObjectId();
    const { user } = await createUser({ role: 'program_coordinator', institutionId: inst.toString() });
    const sub = await seedSubmission(inst, user._id as any);
    const tok = signTokenFor(user as any);

    const run = await request(app)
      .post(`/api/submissions/${sub._id}/standards/1/specs/a/evaluate`)
      .set('Authorization', `Bearer ${tok}`)
      .send({});
    expect(run.status).toBe(200);
    expect(run.body.evaluation.verdict).toBe('pass');
    expect(run.body.evaluation.rationale).toMatch(/accreditation/i);

    const get = await request(app)
      .get(`/api/submissions/${sub._id}/standards/1/specs/a/evaluation`)
      .set('Authorization', `Bearer ${tok}`);
    expect(get.status).toBe(200);
    expect(get.body.evaluation.verdict).toBe('pass');
  });

  it('POST evaluate is 403 for a cross-institution PC', async () => {
    vi.spyOn(cshseAiClient, 'evaluateSection').mockResolvedValue({ perSpec: [], links: [] } as any);
    const inst = new mongoose.Types.ObjectId();
    const { user: owner } = await createUser({ role: 'program_coordinator', institutionId: inst.toString() });
    const sub = await seedSubmission(inst, owner._id as any);
    const { user: intruder } = await createUser({
      role: 'program_coordinator',
      institutionId: new mongoose.Types.ObjectId().toString(),
    });
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/standards/1/specs/a/evaluate`)
      .set('Authorization', `Bearer ${signTokenFor(intruder as any)}`)
      .send({});
    expect(res.status).toBe(403);
  });
});
