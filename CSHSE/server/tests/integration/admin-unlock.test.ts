/**
 * S2A.4 (CR-005) — admin-only unlock that fully reverses Final Submit.
 *
 *   POST /api/submissions/:id/unlock  (admin / superuser only)
 *
 * Reverses the post-submit system lock the PC themselves cannot lift:
 *   - status: submitted/under_review/readers_assigned/review_complete →
 *     in_progress
 *   - readerLock cleared
 *   - audit entry written so the override is on the timeline
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { AuditLogEntry } from '../../src/models/AuditLogEntry';
import { createUser, signTokenFor } from '../helpers/factories';

let _c = 0;
async function seedSubmission(overrides: any = {}) {
  _c += 1;
  return (await Submission.create({
    submissionId: `UNL-${Date.now().toString(36)}-${_c}`,
    institutionName: 'Unlock U',
    programName: 'HS',
    programLevel: 'bachelors',
    submitterId: overrides.submitterId ?? new mongoose.Types.ObjectId(),
    type: 'initial',
    status: overrides.status ?? 'submitted',
    submittedAt: overrides.submittedAt ?? new Date(),
    readerLock: overrides.readerLock ?? {
      isLocked: true,
      lockedByName: 'System',
      lockedAt: new Date(),
      lockReason: 'submission_complete',
    },
  })) as any;
}

async function waitForAudit(query: Record<string, unknown>, tries = 60): Promise<any> {
  for (let i = 0; i < tries; i++) {
    const hit = await AuditLogEntry.findOne(query);
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 50));
  }
  return null;
}

afterEach(() => vi.restoreAllMocks());

describe('S2A.4 — admin unlock (CR-005)', () => {
  it('admin reverts a submitted submission to in_progress and clears the lock', async () => {
    const { user: admin } = await createUser({ role: 'admin' });
    const sub = await seedSubmission({ status: 'submitted' });

    const res = await request(app)
      .post(`/api/submissions/${sub._id}/unlock`)
      .set('Authorization', `Bearer ${signTokenFor(admin as any)}`)
      .send({ reason: 'PC submitted in error; rolling back' });
    expect(res.status).toBe(200);
    expect(res.body.submission.status).toBe('in_progress');
    expect(res.body.submission.readerLock.isLocked).toBe(false);

    const fresh: any = await Submission.findById(sub._id);
    expect(fresh.status).toBe('in_progress');
    expect(fresh.submittedAt).toBeFalsy();
    expect(fresh.readerLock?.isLocked).toBeFalsy();
  });

  it('admin can unlock a reader-locked submission (status: under_review)', async () => {
    const { user: admin } = await createUser({ role: 'admin' });
    const { user: reader } = await createUser({ role: 'reader' });
    const sub = await seedSubmission({
      status: 'under_review',
      readerLock: {
        isLocked: true,
        lockedBy: reader._id,
        lockedByName: 'Reader',
        lockedByRole: 'reader',
        lockedAt: new Date(),
        lockReason: 'reader_review',
      },
    });

    const res = await request(app)
      .post(`/api/submissions/${sub._id}/unlock`)
      .set('Authorization', `Bearer ${signTokenFor(admin as any)}`)
      .send({ reason: 'Reader review stuck; reassigning' });
    expect(res.status).toBe(200);

    const fresh: any = await Submission.findById(sub._id);
    expect(fresh.status).toBe('in_progress');
    expect(fresh.readerLock?.isLocked).toBeFalsy();
  });

  it('PC cannot unlock their own submission (403)', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({ submitterId: pc._id, status: 'submitted' });
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/unlock`)
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`)
      .send({});
    expect(res.status).toBe(403);
  });

  it('reader cannot unlock a submission via the admin endpoint (403)', async () => {
    const { user: reader } = await createUser({ role: 'reader' });
    const sub = await seedSubmission({ status: 'submitted' });
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/unlock`)
      .set('Authorization', `Bearer ${signTokenFor(reader as any)}`)
      .send({});
    expect(res.status).toBe(403);
  });

  it('writes a submission.unlock audit entry with the reason + prior status', async () => {
    const { user: admin } = await createUser({ role: 'admin' });
    const sub = await seedSubmission({ status: 'under_review' });
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/unlock`)
      .set('Authorization', `Bearer ${signTokenFor(admin as any)}`)
      .send({ reason: 'Production support: PC asked' });
    expect(res.status).toBe(200);

    const audit = await waitForAudit({
      action: 'submission.unlock',
      targetId: String(sub._id),
    });
    expect(audit).not.toBeNull();
    expect(audit.reason).toMatch(/Production support/);
    expect(audit.payload?.priorStatus).toBe('under_review');
  });

  it('PC can edit again after admin unlock (lockout middleware lifts)', async () => {
    const { user: admin } = await createUser({ role: 'admin' });
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({ submitterId: pc._id, status: 'submitted' });

    // Pre-unlock: PC write is 403 LOCKED.
    const blocked = await request(app)
      .patch(`/api/submissions/${sub._id}/narrative`)
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`)
      .send({ standardCode: '1', specCode: 'a', content: '<p>x</p>' });
    expect(blocked.status).toBe(403);

    // Admin unlocks.
    await request(app)
      .post(`/api/submissions/${sub._id}/unlock`)
      .set('Authorization', `Bearer ${signTokenFor(admin as any)}`)
      .send({ reason: 'rollback' });

    // Now the PC write succeeds.
    const after = await request(app)
      .patch(`/api/submissions/${sub._id}/narrative`)
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`)
      .send({ standardCode: '1', specCode: 'a', content: '<p>edited</p>' });
    expect(after.status).not.toBe(403);
    expect(after.status).toBeLessThan(300);
  });
});
