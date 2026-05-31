/**
 * Sprint 10 — CR-005 BUG-B regression: supporting-evidence mutation routes
 * must honour the submission lockout, exactly like the narrative routes.
 *
 * The 2026-05-31 verification sweep found `routes/evidence.ts` mounted
 * upload/url/update/delete/link/unlink with NO `submissionLockout`, so a PC
 * whose self-study was final-submitted/locked could still add, edit, delete
 * and (un)link supporting evidence. This spec pins the fix: every mutation
 * route returns 403 LOCKED for a locked PC, admin bypasses, and an
 * in_progress submission is still mutable (no 403 from the guard).
 *
 * Read routes (GET list/stats/get/preview/download) are intentionally NOT
 * locked — a locked PC may still view + print their evidence.
 */
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { Institution } from '../../src/models/Institution';
import { createUser, signTokenFor } from '../helpers/factories';

let _c = 0;
async function seedSubmission(overrides: any = {}) {
  _c += 1;
  return (await Submission.create({
    submissionId: `EVLOCK-${Date.now().toString(36)}-${_c}`,
    institutionName: 'Evidence Lock U',
    programName: 'Human Services',
    programLevel: 'bachelors',
    submitterId: overrides.submitterId ?? new mongoose.Types.ObjectId(),
    institutionId: overrides.institutionId,
    type: 'initial',
    status: overrides.status ?? 'in_progress',
  })) as any;
}

// The evidence controller's own access check requires an Institution whose
// programCoordinatorId === the PC and whose currentSubmissionId === the
// submission. Build that link so the "allows" tests exercise the lockout
// guard rather than tripping access control.
async function seedSubmissionForPc(pcId: any, overrides: any = {}) {
  const inst = await Institution.create({
    name: 'Evidence Lock U',
    type: 'university',
    address: { street: '1 Test St', city: 'Test', state: 'TS', zip: '00000', country: 'US' },
    primaryContact: { name: 'Test Contact', email: 'tc@example.com', title: 'Director', phone: '555-0100' },
    programCoordinatorId: pcId,
  } as any);
  const sub = await seedSubmission({ ...overrides, submitterId: pcId, institutionId: inst._id });
  await Institution.updateOne({ _id: inst._id }, { $set: { currentSubmissionId: sub._id } });
  return sub;
}

const LOCKED_STATUSES = ['submitted', 'under_review', 'readers_assigned', 'review_complete'];
const randomId = () => new mongoose.Types.ObjectId().toString();

describe('Sprint 10 — evidence mutation lockout (CR-005 BUG-B)', () => {
  it('401 without auth on the url-add route', async () => {
    const sub = await seedSubmission({ status: 'submitted' });
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/evidence/url`)
      .send({ url: 'https://example.com', standardCode: '1', specCode: 'a' });
    expect(res.status).toBe(401);
  });

  it.each(LOCKED_STATUSES)('blocks PC url-add with 403 LOCKED when status=%s', async (status) => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({ submitterId: user._id, status });
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/evidence/url`)
      .set('Authorization', `Bearer ${signTokenFor(user as any)}`)
      .send({ url: 'https://example.com', standardCode: '1', specCode: 'a', description: 'x' });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('LOCKED');
    expect(res.body.lock?.status).toBe(status);
  });

  it.each(LOCKED_STATUSES)('blocks PC delete with 403 LOCKED when status=%s', async (status) => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({ submitterId: user._id, status });
    const res = await request(app)
      .delete(`/api/submissions/${sub._id}/evidence/${randomId()}`)
      .set('Authorization', `Bearer ${signTokenFor(user as any)}`)
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('LOCKED');
  });

  it('blocks PC link + unlink + patch with 403 LOCKED on a submitted submission', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({ submitterId: user._id, status: 'submitted' });
    const token = `Bearer ${signTokenFor(user as any)}`;
    const evId = randomId();

    const link = await request(app)
      .post(`/api/submissions/${sub._id}/evidence/${evId}/link`)
      .set('Authorization', token).send({ standardCode: '1', specCode: 'a' });
    expect(link.status).toBe(403);

    const unlink = await request(app)
      .post(`/api/submissions/${sub._id}/evidence/${evId}/unlink`)
      .set('Authorization', token).send({ standardCode: '1', specCode: 'a' });
    expect(unlink.status).toBe(403);

    const patch = await request(app)
      .patch(`/api/submissions/${sub._id}/evidence/${evId}`)
      .set('Authorization', token).send({ description: 'new' });
    expect(patch.status).toBe(403);
  });

  it('admin bypasses the lockout (no 403 from the guard) on a submitted submission', async () => {
    const { user: admin } = await createUser({ role: 'admin' });
    const sub = await seedSubmission({ status: 'submitted' });
    const res = await request(app)
      .delete(`/api/submissions/${sub._id}/evidence/${randomId()}`)
      .set('Authorization', `Bearer ${signTokenFor(admin as any)}`)
      .send({});
    expect(res.status).not.toBe(403);
  });

  it('allows a PC to reach the controller on an in_progress submission (no 403 from the guard)', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmissionForPc(user._id, { status: 'in_progress' });
    const res = await request(app)
      .delete(`/api/submissions/${sub._id}/evidence/${randomId()}`)
      .set('Authorization', `Bearer ${signTokenFor(user as any)}`)
      .send({});
    // The guard calls next(); the controller then 404s (evidence not found).
    // Either way the lockout did not block it.
    expect(res.status).not.toBe(403);
  });

  it('does NOT lock read routes — a PC may still list evidence on a submitted submission', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmissionForPc(user._id, { status: 'submitted' });
    const res = await request(app)
      .get(`/api/submissions/${sub._id}/evidence`)
      .set('Authorization', `Bearer ${signTokenFor(user as any)}`);
    expect(res.status).not.toBe(403);
  });
});
