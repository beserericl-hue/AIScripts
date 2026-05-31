/**
 * Sprint 3 / S3.3 — Reader access hardening (CR-007).
 *
 * The submission listing + read endpoint MUST refuse reader access while
 * a submission is in draft, AND must not leak submissions from other
 * institutions even when the reader knows the id. This pins the truth
 * Sprint R.2 surfaced: server-side gating is the right place; the
 * client must not be allowed to bypass it by guessing ids.
 *
 * Sprint 10 / S10.2 — CR-007 hardened to **assigned-only (strict)**:
 * a reader sees/opens ONLY submissions where they have an active
 * Assignment. Two changes vs. the old permissive model:
 *   - `listSubmissions` scopes `_id` to the reader's active assignments.
 *   - `getSubmission` 403s unless an active Assignment exists for the
 *     reader on that submission.
 *   - `?status=` enumeration is intersected with the reader allow-list
 *     so a reader can never use the query param to enumerate drafts
 *     (BUG-A).
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { Assignment } from '../../src/models/Assignment';
import { createUser, signTokenFor } from '../helpers/factories';

let _c = 0;
async function seed(status: string, institutionId?: mongoose.Types.ObjectId) {
  _c += 1;
  return (await Submission.create({
    submissionId: `RA-${Date.now().toString(36)}-${_c}`,
    institutionName: 'RA U',
    institutionId: institutionId,
    programName: 'Human Services',
    programLevel: 'bachelors',
    submitterId: new mongoose.Types.ObjectId(),
    type: 'initial',
    status,
  })) as any;
}

// Create an active reader Assignment linking `reader` to `sub`. Assignment
// is the source of truth for reader↔submission scope (CR-007 assigned-only).
async function assign(reader: any, sub: any, assignmentType: 'reader' | 'lead_reader' = 'reader') {
  return Assignment.create({
    submissionId: sub._id,
    institutionId: sub.institutionId ?? new mongoose.Types.ObjectId(),
    institutionName: sub.institutionName ?? 'RA U',
    userId: reader._id,
    userName: reader.name ?? 'Reader',
    userEmail: reader.email,
    assignmentType,
    assignedBy: new mongoose.Types.ObjectId(),
    assignedByName: 'Lead Reader',
    assignedByRole: 'lead_reader',
    // status defaults to 'active'
  } as any);
}

describe('S3.3 / S10.2 — reader access hardening (CR-007, assigned-only)', () => {
  it('GET /api/submissions returns only the reader’s assigned submissions (never drafts)', async () => {
    const { user: reader } = await createUser({ role: 'reader' });
    await seed('draft'); // unassigned draft — must never appear
    const submitted = await seed('submitted');
    const underReview = await seed('under_review');
    await seed('submitted'); // assigned to nobody — must not appear under assigned-only
    await assign(reader, submitted);
    await assign(reader, underReview);

    const res = await request(app)
      .get('/api/submissions')
      .set('Authorization', `Bearer ${signTokenFor(reader as any)}`);
    expect(res.status).toBe(200);

    const ids = (res.body.submissions || []).map((s: any) => String(s._id)).sort();
    expect(ids).toEqual([String(submitted._id), String(underReview._id)].sort());

    const statuses = (res.body.submissions || []).map((s: any) => s.status);
    expect(statuses).not.toContain('draft');
    expect(statuses.some((s: string) => s === 'submitted' || s === 'under_review')).toBe(true);
  });

  it('BUG-A: a reader cannot enumerate drafts via ?status=draft', async () => {
    const { user: reader } = await createUser({ role: 'reader' });
    await seed('draft');
    await seed('draft');

    const res = await request(app)
      .get('/api/submissions')
      .query({ status: 'draft' })
      .set('Authorization', `Bearer ${signTokenFor(reader as any)}`);
    expect(res.status).toBe(200);
    expect((res.body.submissions || []).length).toBe(0);
  });

  it('reader cannot read a draft submission directly even when they know the id', async () => {
    const { user: reader } = await createUser({ role: 'reader' });
    const draft = await seed('draft');

    const res = await request(app)
      .get(`/api/submissions/${draft._id}`)
      .set('Authorization', `Bearer ${signTokenFor(reader as any)}`);
    // Either 403 (gated) or 404 (treated as if-not-found) — both are safe.
    expect([403, 404]).toContain(res.status);
  });

  it('reader cannot read a submitted submission they are NOT assigned to', async () => {
    // CR-007 assigned-only: knowing the id is not enough — without an
    // active Assignment the read endpoint must refuse.
    const { user: reader } = await createUser({ role: 'reader' });
    const sub = await seed('submitted', new mongoose.Types.ObjectId());

    const res = await request(app)
      .get(`/api/submissions/${sub._id}`)
      .set('Authorization', `Bearer ${signTokenFor(reader as any)}`);
    expect([403, 404]).toContain(res.status);
  });

  it('reader cannot read a submitted submission from a different institution', async () => {
    const myInst = new mongoose.Types.ObjectId();
    const otherInst = new mongoose.Types.ObjectId();
    const { user: reader } = await createUser({ role: 'reader', institutionId: myInst.toString() });
    const otherSub = await seed('submitted', otherInst);

    const res = await request(app)
      .get(`/api/submissions/${otherSub._id}`)
      .set('Authorization', `Bearer ${signTokenFor(reader as any)}`);
    // Reader is not assigned to this submission → must be refused.
    expect([403, 404]).toContain(res.status);
  });

  it('reader can read a submitted submission they ARE assigned to', async () => {
    const { user: reader } = await createUser({ role: 'reader' });
    const sub: any = await Submission.create({
      submissionId: `RA-asgn-${Date.now().toString(36)}-${++_c}`,
      institutionName: 'RA U',
      institutionId: new mongoose.Types.ObjectId(),
      programName: 'HS',
      programLevel: 'bachelors',
      submitterId: new mongoose.Types.ObjectId(),
      type: 'initial',
      status: 'under_review',
    });
    await assign(reader, sub);

    const res = await request(app)
      .get(`/api/submissions/${sub._id}`)
      .set('Authorization', `Bearer ${signTokenFor(reader as any)}`);
    expect(res.status).toBe(200);
    expect(String(res.body._id)).toBe(String(sub._id));
  });

  it('PC cannot enumerate other-institution submissions by passing ?institutionId=', async () => {
    // Pins CR-017 — server forces a PC's institutionId regardless of the
    // ?institutionId query param. (This is in here because the reader
    // dashboard reuses the same listing endpoint; the access boundary
    // must hold for PCs too.)
    const myInst = new mongoose.Types.ObjectId();
    const otherInst = new mongoose.Types.ObjectId();
    const { user: pc } = await createUser({ role: 'program_coordinator', institutionId: myInst.toString() });
    await seed('submitted', otherInst);

    const res = await request(app)
      .get('/api/submissions')
      .query({ institutionId: String(otherInst) })
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`);
    expect(res.status).toBe(200);
    const leaked = (res.body.submissions || []).filter(
      (s: any) => String(s.institutionId) === String(otherInst)
    );
    expect(leaked.length).toBe(0);
  });
});
