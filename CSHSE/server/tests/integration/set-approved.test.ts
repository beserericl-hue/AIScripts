/**
 * POST /api/submissions/:id/review/set-approved — persist the approved-id set.
 *
 * Regression guard for the reported bug: Approve / Approve-all marks lived only
 * in the browser store and vanished on reload. This endpoint persists them.
 * Pins:
 *   1. The posted set replaces aiReviewState.approvedIds and survives GET.
 *   2. Approving clears a matching prior discard.
 *   3. An empty array clears all approvals.
 *   4. Owner-only.
 */
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { createUser, signTokenFor } from '../helpers/factories';

let _c = 0;
async function seed(pcId: mongoose.Types.ObjectId, overrides: any = {}) {
  _c += 1;
  return (await Submission.create({
    submissionId: `APR-${Date.now().toString(36)}-${_c}`,
    institutionName: 'Approve U',
    programName: 'HS',
    programLevel: 'bachelors',
    submitterId: pcId,
    type: 'initial',
    status: 'in_progress',
    aiReviewState: {
      buckets: {},
      tags: [],
      cvs: [],
      evidenceDocs: [],
      introductions: {},
      placeholderSections: [],
      approvedIds: overrides.approvedIds ?? [],
      discardedIds: overrides.discardedIds ?? [],
      itemSources: {},
      mergeLog: [],
      lastUpdatedAt: new Date(),
    },
  })) as any;
}

describe('POST /review/set-approved', () => {
  it('replaces approvedIds and the set survives a GET /review reload', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const sub = await seed(pc._id);

    const res = await request(app)
      .post(`/api/submissions/${sub._id}/review/set-approved`)
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`)
      .send({ approvedIds: ['a', 'b', 'b', 'c'] }); // dups collapse
    expect(res.status).toBe(200);
    expect(res.body.approvedIds.sort()).toEqual(['a', 'b', 'c']);

    const reload = await request(app)
      .get(`/api/submissions/${sub._id}/review`)
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`);
    expect(reload.body.aiReviewState.approvedIds.sort()).toEqual(['a', 'b', 'c']);
  });

  it('approving clears a matching prior discard', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const sub = await seed(pc._id, { discardedIds: ['x', 'y'] });
    await request(app)
      .post(`/api/submissions/${sub._id}/review/set-approved`)
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`)
      .send({ approvedIds: ['x'] })
      .expect(200);
    const fresh: any = await Submission.findById(sub._id);
    expect(fresh.aiReviewState.approvedIds).toContain('x');
    expect(fresh.aiReviewState.discardedIds).not.toContain('x');
    expect(fresh.aiReviewState.discardedIds).toContain('y');
  });

  it('an empty array clears all approvals', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const sub = await seed(pc._id, { approvedIds: ['a', 'b'] });
    await request(app)
      .post(`/api/submissions/${sub._id}/review/set-approved`)
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`)
      .send({ approvedIds: [] })
      .expect(200);
    const fresh: any = await Submission.findById(sub._id);
    expect(fresh.aiReviewState.approvedIds).toEqual([]);
  });

  it('a different PC cannot set approvals on someone else\'s submission', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const { user: other } = await createUser({ role: 'program_coordinator' });
    const sub = await seed(pc._id);
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/review/set-approved`)
      .set('Authorization', `Bearer ${signTokenFor(other as any)}`)
      .send({ approvedIds: ['a'] });
    expect(res.status).toBeGreaterThanOrEqual(403);
  });
});
