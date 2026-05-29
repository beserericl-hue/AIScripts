/**
 * S2A.2 / CR-008 — GET /api/submissions/:id/preflight
 *
 * Structured "what's missing" + "what's worth knowing" the FinalSubmitModal
 * renders before the PC presses Submit. Mirrors the submit-gate predicate
 * exactly (pass-OR-excluded) so the popup and submitSelfStudy never
 * disagree on what "ready" means.
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { getAllStandards } from '../../src/data/standards';
import { createUser, signTokenFor } from '../helpers/factories';

let _c = 0;
async function seedSubmission(overrides: any = {}) {
  _c += 1;
  return (await Submission.create({
    submissionId: `PRE-${Date.now().toString(36)}-${_c}`,
    institutionName: 'Preflight U',
    programName: 'HS',
    programLevel: 'bachelors',
    submitterId: overrides.submitterId ?? new mongoose.Types.ObjectId(),
    type: 'initial',
    status: overrides.status ?? 'in_progress',
    standardsStatus: overrides.standardsStatus,
    narratives: overrides.narratives,
  })) as any;
}

function allPassing(): Record<string, any> {
  const out: Record<string, any> = {};
  for (const std of getAllStandards()) {
    for (const spec of std.specifications || []) {
      out[`${std.code}_${spec.code}`] = {
        status: 'validated',
        validationStatus: 'pass',
        completionPercentage: 100,
      };
    }
  }
  return out;
}

describe('CR-008 / S2A.2 — preflight endpoint', () => {
  it('returns submitDisabled=true with one NOT_EVALUATED error per missing spec on a fresh submission', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({ submitterId: user._id });
    const res = await request(app)
      .get(`/api/submissions/${sub._id}/preflight`)
      .set('Authorization', `Bearer ${signTokenFor(user as any)}`);
    expect(res.status).toBe(200);
    expect(res.body.submitDisabled).toBe(true);
    expect(res.body.errors.length).toBeGreaterThan(0);
    // Codes correctly identify "narrative missing" since the doc is empty.
    expect(res.body.errors[0].code).toBe('NARRATIVE_MISSING');
    expect(res.body.counts.missing).toBe(res.body.errors.length);
    expect(res.body.counts.satisfied).toBe(0);
  });

  it('returns submitDisabled=false when every spec is pass OR excluded', async () => {
    const ss = allPassing();
    // Mark 1.a excluded with no narrative — must NOT show as an error.
    ss['1_a'] = {
      status: 'in_progress',
      excluded: true,
      excludedReason: 'No PhD faculty',
      completionPercentage: 0,
    };
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({ submitterId: user._id, standardsStatus: ss });
    const res = await request(app)
      .get(`/api/submissions/${sub._id}/preflight`)
      .set('Authorization', `Bearer ${signTokenFor(user as any)}`);
    expect(res.status).toBe(200);
    expect(res.body.submitDisabled).toBe(false);
    expect(res.body.errors).toEqual([]);
    expect(res.body.counts.excluded).toBe(1);
    expect(res.body.counts.passed).toBeGreaterThan(0);
  });

  it('produces a VALIDATION_FAILED error code for a spec with narrative + fail verdict', async () => {
    const ss = allPassing();
    ss['2_a'] = { status: 'in_progress', validationStatus: 'fail', completionPercentage: 50 };
    const narratives = { '2': { a: { content: '<p>real text</p>', lastModified: new Date(), isComplete: false, linkedDocuments: [] } } };
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({ submitterId: user._id, standardsStatus: ss, narratives });
    const res = await request(app)
      .get(`/api/submissions/${sub._id}/preflight`)
      .set('Authorization', `Bearer ${signTokenFor(user as any)}`);
    expect(res.status).toBe(200);
    const err = res.body.errors.find((e: any) => e.standardCode === '2' && e.specCode === 'a');
    expect(err?.code).toBe('VALIDATION_FAILED');
  });

  it('emits a MANY_EXCLUDED warning when >25% of specs are N/A', async () => {
    const ss = allPassing();
    // Mark first ~40% of specs as excluded.
    const keys = Object.keys(ss);
    const toExclude = Math.ceil(keys.length * 0.4);
    for (let i = 0; i < toExclude; i++) {
      ss[keys[i]] = {
        status: 'in_progress',
        excluded: true,
        excludedReason: 'r',
        completionPercentage: 0,
      };
    }
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({ submitterId: user._id, standardsStatus: ss });
    const res = await request(app)
      .get(`/api/submissions/${sub._id}/preflight`)
      .set('Authorization', `Bearer ${signTokenFor(user as any)}`);
    expect(res.status).toBe(200);
    expect(res.body.submitDisabled).toBe(false);
    expect(res.body.warnings.some((w: any) => w.code === 'MANY_EXCLUDED')).toBe(true);
  });

  it('rejects a cross-institution PC (403)', async () => {
    const { user: owner } = await createUser({ role: 'program_coordinator' });
    const { user: intruder } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({ submitterId: owner._id });
    const res = await request(app)
      .get(`/api/submissions/${sub._id}/preflight`)
      .set('Authorization', `Bearer ${signTokenFor(intruder as any)}`);
    expect(res.status).toBe(403);
  });

  it('admin can read any submission preflight', async () => {
    const { user: admin } = await createUser({ role: 'admin' });
    const sub = await seedSubmission();
    const res = await request(app)
      .get(`/api/submissions/${sub._id}/preflight`)
      .set('Authorization', `Bearer ${signTokenFor(admin as any)}`);
    expect(res.status).toBe(200);
  });

  it('the preflight predicate matches the server submitSelfStudy gate exactly', async () => {
    // A submission the preflight says is ready (submitDisabled=false) MUST
    // actually be acceptable to POST /submit. This pins the two paths
    // together so a future refactor can't drift them.
    const { user } = await createUser({ role: 'program_coordinator' });
    const ss = allPassing();
    const sub = await seedSubmission({ submitterId: user._id, standardsStatus: ss });
    const pre = await request(app)
      .get(`/api/submissions/${sub._id}/preflight`)
      .set('Authorization', `Bearer ${signTokenFor(user as any)}`);
    expect(pre.body.submitDisabled).toBe(false);

    const submit = await request(app)
      .post(`/api/submissions/${sub._id}/submit`)
      .set('Authorization', `Bearer ${signTokenFor(user as any)}`)
      .send({});
    expect(submit.status).toBe(200);
  });
});
