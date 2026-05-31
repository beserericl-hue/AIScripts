/**
 * CR-053 follow-on / Sprint 9.2 — board cycle reminders.
 *
 * Pins:
 *   - admin-only (non-admin → 403)
 *   - notifies every admin/superuser about accept decisions expiring in window
 *   - notifies about tabled decisions due for reconsideration in window
 *   - submissions outside the window are NOT reminded
 *   - idempotent: a second run creates no new notifications (dedupeKey)
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { Notification } from '../../src/models/Notification';
import { createUser, signTokenFor } from '../helpers/factories';

afterEach(() => vi.restoreAllMocks());

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

async function seed() {
  const { user: admin1 } = await createUser({ role: 'admin', firstName: 'Admin', lastName: 'One' });
  const { user: admin2 } = await createUser({ role: 'admin', firstName: 'Admin', lastName: 'Two' });
  const { user: reader } = await createUser({ role: 'reader' });
  const { user: pc } = await createUser({ role: 'program_coordinator' });

  // Expiring within 30 days (accept).
  const expiringSoon: any = await Submission.create({
    submissionId: `CR-EXP-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`,
    institutionName: 'Soon U',
    programName: 'HS',
    programLevel: 'bachelors',
    submitterId: pc._id,
    type: 'initial',
    status: 'compliant',
    decision: { outcome: 'accept', decidedBy: new mongoose.Types.ObjectId(), decidedAt: new Date(), comments: 'ok', expiresAt: daysFromNow(30) }
  });

  // Expiring far in the future (accept) — outside default 180d window.
  const expiringFar: any = await Submission.create({
    submissionId: `CR-FAR-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`,
    institutionName: 'Far U',
    programName: 'HS',
    programLevel: 'bachelors',
    submitterId: pc._id,
    type: 'initial',
    status: 'compliant',
    decision: { outcome: 'accept', decidedBy: new mongoose.Types.ObjectId(), decidedAt: new Date(), comments: 'ok', expiresAt: daysFromNow(900) }
  });

  // Tabled, reconsider within window.
  const tabled: any = await Submission.create({
    submissionId: `CR-TAB-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`,
    institutionName: 'Tabled U',
    programName: 'HS',
    programLevel: 'bachelors',
    submitterId: pc._id,
    type: 'initial',
    status: 'review_complete',
    decision: { outcome: 'table', decidedBy: new mongoose.Types.ObjectId(), decidedAt: new Date(), comments: 'wait', reconsiderAt: daysFromNow(20) }
  });

  return {
    adminTok: signTokenFor(admin1 as any),
    readerTok: signTokenFor(reader as any),
    admin1Id: String(admin1._id),
    admin2Id: String(admin2._id),
    expiringSoon,
    expiringFar,
    tabled
  };
}

describe('CR-053 — cycle reminders', () => {
  it('non-admin is 403', async () => {
    const { readerTok } = await seed();
    const res = await request(app)
      .post('/api/board/run-cycle-reminders')
      .set('Authorization', `Bearer ${readerTok}`);
    expect(res.status).toBe(403);
  });

  it('notifies both admins about the expiring + tabled submissions in window, skipping the far one', async () => {
    const { adminTok, admin1Id, admin2Id, expiringSoon, expiringFar, tabled } = await seed();
    const res = await request(app)
      .post('/api/board/run-cycle-reminders')
      .set('Authorization', `Bearer ${adminTok}`);
    expect(res.status).toBe(200);
    // 1 expiring + 1 tabled in window, 2 admin recipients → 4 created.
    expect(res.body.scanned.expiring).toBe(1);
    expect(res.body.scanned.tabled).toBe(1);
    expect(res.body.adminRecipients).toBe(2);
    expect(res.body.notificationsCreated).toBe(4);

    const a1 = await Notification.find({ recipientId: admin1Id }).lean();
    expect(a1.length).toBe(2);
    const types = a1.map((n) => n.type).sort();
    expect(types).toEqual(['board.cycle_reminder', 'board.reconsider_reminder']);
    expect(a1.every((n) => n.link === '/admin/board')).toBe(true);

    const a2 = await Notification.find({ recipientId: admin2Id }).lean();
    expect(a2.length).toBe(2);

    // The far-future submission must NOT have produced any notification.
    const farRefs = await Notification.find({ submissionId: expiringFar._id }).lean();
    expect(farRefs.length).toBe(0);
    // Sanity: the in-window ones did.
    expect((await Notification.find({ submissionId: expiringSoon._id }).lean()).length).toBe(2);
    expect((await Notification.find({ submissionId: tabled._id }).lean()).length).toBe(2);
  });

  it('is idempotent — a second run creates nothing new', async () => {
    const { adminTok } = await seed();
    const first = await request(app)
      .post('/api/board/run-cycle-reminders')
      .set('Authorization', `Bearer ${adminTok}`);
    expect(first.body.notificationsCreated).toBe(4);
    const totalAfterFirst = await Notification.countDocuments({});

    const second = await request(app)
      .post('/api/board/run-cycle-reminders')
      .set('Authorization', `Bearer ${adminTok}`);
    expect(second.body.notificationsCreated).toBe(0);
    expect(await Notification.countDocuments({})).toBe(totalAfterFirst);
  });
});
