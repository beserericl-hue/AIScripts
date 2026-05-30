/**
 * Sprint R.2 — smoke the reader / lead-reader server endpoints.
 *
 * The reconciliation found the reader-side SERVER is extensively built
 * (reviews / scores / lead-reviews routers) but has NO client. Before
 * Sprint 3 builds that client, this walks the natural reader flow against
 * the real endpoints to record functional-vs-dead.
 *
 * NOTE: tests/setup.ts wipes all collections in afterEach, so the whole
 * flow lives in ONE test (shared state can't survive a test boundary).
 * Each endpoint's status is logged for the truth table in
 * submission-stack-verification-2026-05-29.md.
 */
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { createUser, signTokenFor } from '../helpers/factories';

async function seedFlow() {
  const inst = new mongoose.Types.ObjectId();
  const { user: admin } = await createUser({ role: 'admin' });
  const { user: reader } = await createUser({ role: 'reader', institutionId: inst.toString() });
  const { user: lead } = await createUser({ role: 'lead_reader', institutionId: inst.toString() });
  const sub: any = await Submission.create({
    submissionId: `R2-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`,
    institutionName: 'R2 U',
    institutionId: inst,
    programName: 'Human Services',
    programLevel: 'bachelors',
    submitterId: new mongoose.Types.ObjectId(),
    type: 'initial',
    status: 'submitted',
  });
  return {
    adminTok: signTokenFor(admin as any),
    readerTok: signTokenFor(reader as any),
    leadTok: signTokenFor(lead as any),
    readerId: String(reader._id),
    sid: String(sub._id),
  };
}

describe('R.2 — reader/lead-reader endpoint smoke (truth table)', () => {
  it('walks assign → review → score → submit → compile end-to-end', async () => {
    const { adminTok, readerTok, leadTok, readerId, sid } = await seedFlow();
    const truth: Record<string, number> = {};

    const assign = await request(app)
      .post(`/api/reviews/submissions/${sid}/assign`)
      .set('Authorization', `Bearer ${adminTok}`)
      // CR-022 — `submitted` is in the locked phase; admin must pass a reason.
      .send({ readerIds: [readerId], reason: 'R.2 smoke seed' });
    truth['POST /reviews/submissions/:id/assign'] = assign.status;

    const myReviews = await request(app).get('/api/reviews').set('Authorization', `Bearer ${readerTok}`);
    truth['GET /reviews (getMyReviews)'] = myReviews.status;
    const reviewId = myReviews.body?.reviews?.[0]?.id || myReviews.body?.reviews?.[0]?._id;

    const subReviews = await request(app)
      .get(`/api/reviews/submissions/${sid}`)
      .set('Authorization', `Bearer ${leadTok}`);
    truth['GET /reviews/submissions/:id'] = subReviews.status;

    const putScore = await request(app)
      .put(`/api/submissions/${sid}/scores`)
      .set('Authorization', `Bearer ${readerTok}`)
      .send({ standardCode: '1', specCode: 'a', score: 2 });
    truth['PUT /submissions/:id/scores'] = putScore.status;

    const getScores = await request(app)
      .get(`/api/submissions/${sid}/scores`)
      .set('Authorization', `Bearer ${readerTok}`);
    truth['GET /submissions/:id/scores'] = getScores.status;

    const summary = await request(app)
      .get(`/api/submissions/${sid}/scores/summary`)
      .set('Authorization', `Bearer ${readerTok}`);
    truth['GET /submissions/:id/scores/summary'] = summary.status;

    let submitStatus = -1;
    if (reviewId) {
      const sr = await request(app)
        .post(`/api/reviews/${reviewId}/submit`)
        .set('Authorization', `Bearer ${readerTok}`)
        .send({});
      submitStatus = sr.status;
    }
    truth['POST /reviews/:id/submit'] = submitStatus;

    const myComps = await request(app).get('/api/lead-reviews').set('Authorization', `Bearer ${leadTok}`);
    truth['GET /lead-reviews (getMyCompilations)'] = myComps.status;

    const comp = await request(app)
      .post(`/api/lead-reviews/submissions/${sid}`)
      .set('Authorization', `Bearer ${leadTok}`)
      .send({});
    truth['POST /lead-reviews/submissions/:id'] = comp.status;
    const compId = comp.body?.compilation?._id || comp.body?.compilation?.id;

    let comparisonStatus = -1;
    if (compId) {
      const cmp = await request(app)
        .get(`/api/lead-reviews/${compId}/comparison`)
        .set('Authorization', `Bearer ${leadTok}`);
      comparisonStatus = cmp.status;
    }
    truth['GET /lead-reviews/:id/comparison'] = comparisonStatus;

    // eslint-disable-next-line no-console
    console.log('R.2 reader-endpoint truth table:', JSON.stringify(truth, null, 2));

    // Core read endpoints must be alive (auth OK + controller runs).
    expect(myReviews.status).toBe(200);
    expect(getScores.status).toBe(200);
    expect(summary.status).toBe(200);
    expect(myComps.status).toBe(200);
    // Assign + score writes must not be dead (404) or crash (500).
    for (const [, code] of Object.entries(truth)) {
      if (code === -1) continue; // skipped (dependency not met) — recorded, not asserted
      expect(code).not.toBe(404);
      expect(code).toBeLessThan(500);
    }
  });

  it('scores: rejects a non-reader (403)', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const sub: any = await Submission.create({
      submissionId: `R2x-${Date.now().toString(36)}`,
      institutionName: 'R2 U',
      programName: 'HS',
      programLevel: 'bachelors',
      submitterId: new mongoose.Types.ObjectId(),
      type: 'initial',
      status: 'submitted',
    });
    const res = await request(app)
      .put(`/api/submissions/${sub._id}/scores`)
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`)
      .send({ standardCode: '1', specCode: 'a', score: 2 });
    expect(res.status).toBe(403);
  });
});
