/**
 * CR-053 follow-on / Sprint 12.1 — reaccreditation workflow auto-creation.
 *
 * POST /api/board/spin-up-reaccreditations?withinDays=N
 *
 * Pins:
 *   - admin-only (non-admin → 403)
 *   - an accept decision expiring in window spins up a new draft
 *     `type: 'reaccreditation'` submission linked via reaccreditationOf,
 *     for the same institution/program/coordinator
 *   - the PC (prior submitter) gets a 'reaccreditation.opened' notification
 *   - submissions expiring outside the window are NOT spun up
 *   - idempotent: a second run creates no new submissions (reaccreditationOf)
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { Notification } from '../../src/models/Notification';
import { AuditLogEntry } from '../../src/models/AuditLogEntry';
import { createUser, signTokenFor } from '../helpers/factories';

afterEach(() => vi.restoreAllMocks());

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

async function waitForAudit(query: Record<string, unknown>, tries = 40): Promise<any> {
  for (let i = 0; i < tries; i++) {
    const hit = await AuditLogEntry.findOne(query);
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 25));
  }
  return null;
}

async function seed() {
  const { user: admin } = await createUser({ role: 'admin' });
  const { user: reader } = await createUser({ role: 'reader' });
  const { user: pc } = await createUser({ role: 'program_coordinator' });
  const institutionId = new mongoose.Types.ObjectId();

  // Accept, expiring within ~1 year (inside default 365d window).
  const expiringSoon: any = await Submission.create({
    submissionId: `RA-EXP-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`,
    institutionId,
    institutionName: 'Renewal U',
    programName: 'Human Services',
    programLevel: 'bachelors',
    submitterId: pc._id,
    type: 'initial',
    status: 'compliant',
    decision: { outcome: 'accept', decidedBy: new mongoose.Types.ObjectId(), decidedAt: new Date(), comments: 'ok', expiresAt: daysFromNow(200) }
  });

  // Accept, expiring far out (outside default 365d window).
  const expiringFar: any = await Submission.create({
    submissionId: `RA-FAR-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`,
    institutionName: 'Distant U',
    programName: 'HS',
    programLevel: 'masters',
    submitterId: pc._id,
    type: 'initial',
    status: 'compliant',
    decision: { outcome: 'accept', decidedBy: new mongoose.Types.ObjectId(), decidedAt: new Date(), comments: 'ok', expiresAt: daysFromNow(1500) }
  });

  return {
    adminTok: signTokenFor(admin as any),
    readerTok: signTokenFor(reader as any),
    pcId: String(pc._id),
    institutionId: String(institutionId),
    expiringSoon,
    expiringFar
  };
}

describe('CR-053 — reaccreditation auto-spin-up', () => {
  it('non-admin is 403', async () => {
    const { readerTok } = await seed();
    const res = await request(app)
      .post('/api/board/spin-up-reaccreditations')
      .set('Authorization', `Bearer ${readerTok}`);
    expect(res.status).toBe(403);
  });

  it('spins up a reaccreditation draft for an in-window accept, skips the far one, notifies the PC', async () => {
    const { adminTok, pcId, institutionId, expiringSoon, expiringFar } = await seed();
    const res = await request(app)
      .post('/api/board/spin-up-reaccreditations')
      .set('Authorization', `Bearer ${adminTok}`);

    expect(res.status).toBe(200);
    expect(res.body.scanned).toBe(1); // only the in-window accept
    expect(res.body.created).toBe(1);
    expect(res.body.notificationsCreated).toBe(1);

    // A new draft reaccreditation submission, linked back to the prior cycle.
    const child = await Submission.findOne({ reaccreditationOf: expiringSoon._id }).lean();
    expect(child).not.toBeNull();
    expect(child!.type).toBe('reaccreditation');
    expect(child!.status).toBe('draft');
    expect(child!.institutionName).toBe('Renewal U');
    expect(child!.programName).toBe('Human Services');
    expect(child!.programLevel).toBe('bachelors');
    expect(String(child!.submitterId)).toBe(pcId);
    expect(String(child!.institutionId)).toBe(institutionId);

    // The far-future accept must NOT have spawned a child.
    expect(await Submission.exists({ reaccreditationOf: expiringFar._id })).toBeNull();

    // The PC was notified to begin the new cycle.
    const notes = await Notification.find({ recipientId: pcId, type: 'reaccreditation.opened' }).lean();
    expect(notes.length).toBe(1);
    expect(notes[0].link).toBe(`/self-study/${String(child!._id)}`);

    // Audit event recorded.
    const audit = await waitForAudit({
      action: 'submission.reaccreditation_spun_up',
      targetId: String(child!._id)
    });
    expect(audit).not.toBeNull();
    expect(audit.payload?.reaccreditationOf).toBe(String(expiringSoon._id));
  });

  it('is idempotent — a second run creates no new submissions or notifications', async () => {
    const { adminTok } = await seed();
    const first = await request(app)
      .post('/api/board/spin-up-reaccreditations')
      .set('Authorization', `Bearer ${adminTok}`);
    expect(first.body.created).toBe(1);
    const subCountAfterFirst = await Submission.countDocuments({ type: 'reaccreditation' });

    const second = await request(app)
      .post('/api/board/spin-up-reaccreditations')
      .set('Authorization', `Bearer ${adminTok}`);
    expect(second.body.created).toBe(0);
    expect(second.body.skippedExisting).toBe(1);
    expect(await Submission.countDocuments({ type: 'reaccreditation' })).toBe(subCountAfterFirst);
  });
});
