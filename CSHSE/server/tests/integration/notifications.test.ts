/**
 * Notification pass — in-app inbox + CR-010 DM notification fan-out.
 *
 * Pins:
 *   - inbox is strictly per-recipient (no cross-user read)
 *   - unread count + mark-read + mark-all-read
 *   - posting a DM notifies the OTHER participants (not the sender)
 *   - notification service is fail-soft (email off in tests; in-app still written)
 *   - dedupeKey idempotency (no double-deliver)
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { Notification } from '../../src/models/Notification';
import { notify } from '../../src/services/notificationService';
import { createUser, signTokenFor } from '../helpers/factories';

afterEach(() => vi.restoreAllMocks());

async function seed() {
  const { user: admin } = await createUser({ role: 'admin' });
  const { user: lead } = await createUser({ role: 'lead_reader', firstName: 'Lead', lastName: 'Linda' });
  const { user: r1 } = await createUser({ role: 'reader', firstName: 'Reader', lastName: 'Alpha' });
  const { user: r2 } = await createUser({ role: 'reader', firstName: 'Reader', lastName: 'Bravo' });
  const { user: pc } = await createUser({ role: 'program_coordinator' });

  const sub: any = await Submission.create({
    submissionId: `NOTIF-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`,
    institutionName: 'Notif U',
    programName: 'HS',
    programLevel: 'bachelors',
    submitterId: pc._id,
    type: 'initial',
    status: 'under_review'
  });

  return {
    sid: String(sub._id),
    adminTok: signTokenFor(admin as any),
    leadTok: signTokenFor(lead as any),
    r1Tok: signTokenFor(r1 as any),
    r2Tok: signTokenFor(r2 as any),
    pcTok: signTokenFor(pc as any),
    leadId: String(lead._id),
    r1Id: String(r1._id),
    r2Id: String(r2._id)
  };
}

describe('Notification inbox', () => {
  it('lists only the caller own notifications, newest first', async () => {
    const { r1Id, r2Id, r1Tok } = await seed();
    await notify({ recipientId: r1Id, type: 'dm.new_message', title: 'older', body: 'b1' });
    await new Promise((r) => setTimeout(r, 15));
    await notify({ recipientId: r1Id, type: 'dm.new_message', title: 'newer', body: 'b2' });
    await notify({ recipientId: r2Id, type: 'dm.new_message', title: 'r2-only', body: 'b3' });

    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${r1Tok}`);
    expect(res.status).toBe(200);
    const titles = res.body.notifications.map((n: any) => n.title);
    expect(titles).toEqual(['newer', 'older']);
    expect(res.body.unreadCount).toBe(2);
  });

  it('unread-count endpoint reflects unread only', async () => {
    const { r1Id, r1Tok } = await seed();
    await notify({ recipientId: r1Id, type: 'dm.new_message', title: 'a', body: 'a' });
    await notify({ recipientId: r1Id, type: 'dm.new_message', title: 'b', body: 'b' });
    const res = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${r1Tok}`);
    expect(res.status).toBe(200);
    expect(res.body.unreadCount).toBe(2);
  });

  it('unreadOnly filter returns only unread', async () => {
    const { r1Id, r1Tok } = await seed();
    const n = await notify({ recipientId: r1Id, type: 'dm.new_message', title: 'read-me', body: 'x' });
    await notify({ recipientId: r1Id, type: 'dm.new_message', title: 'keep-unread', body: 'y' });
    await request(app)
      .post(`/api/notifications/${n!._id}/read`)
      .set('Authorization', `Bearer ${r1Tok}`);
    const res = await request(app)
      .get('/api/notifications?unreadOnly=true')
      .set('Authorization', `Bearer ${r1Tok}`);
    expect(res.body.notifications.map((x: any) => x.title)).toEqual(['keep-unread']);
  });

  it('mark-read only affects the caller own notification; foreign id is 404', async () => {
    const { r1Id, r2Id, r1Tok, r2Tok } = await seed();
    const r2n = await notify({ recipientId: r2Id, type: 'dm.new_message', title: 'r2', body: 'b' });
    // r1 tries to mark r2's notification read → 404 (scoped to recipient)
    const foreign = await request(app)
      .post(`/api/notifications/${r2n!._id}/read`)
      .set('Authorization', `Bearer ${r1Tok}`);
    expect(foreign.status).toBe(404);

    const own = await notify({ recipientId: r1Id, type: 'dm.new_message', title: 'r1', body: 'b' });
    const ok = await request(app)
      .post(`/api/notifications/${own!._id}/read`)
      .set('Authorization', `Bearer ${r1Tok}`);
    expect(ok.status).toBe(200);
    expect(ok.body.notification.read).toBe(true);

    // r2's notification still unread.
    const r2count = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${r2Tok}`);
    expect(r2count.body.unreadCount).toBe(1);
  });

  it('mark-all-read clears the caller unread set', async () => {
    const { r1Id, r1Tok } = await seed();
    await notify({ recipientId: r1Id, type: 'dm.new_message', title: 'a', body: 'a' });
    await notify({ recipientId: r1Id, type: 'dm.new_message', title: 'b', body: 'b' });
    const res = await request(app)
      .post('/api/notifications/read-all')
      .set('Authorization', `Bearer ${r1Tok}`);
    expect(res.status).toBe(200);
    expect(res.body.modified).toBe(2);
    const count = await request(app)
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${r1Tok}`);
    expect(count.body.unreadCount).toBe(0);
  });

  it('400 on invalid notification id', async () => {
    const { r1Tok } = await seed();
    const res = await request(app)
      .post('/api/notifications/not-an-id/read')
      .set('Authorization', `Bearer ${r1Tok}`);
    expect(res.status).toBe(400);
  });

  it('requires auth', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(401);
  });
});

describe('Notification service idempotency', () => {
  it('dedupeKey delivers at most once per recipient', async () => {
    const { r1Id } = await seed();
    const a = await notify({
      recipientId: r1Id,
      type: 'board.cycle_reminder',
      title: 'cycle',
      body: 'expiring soon',
      dedupeKey: 'cycle:sub123:2026'
    });
    const b = await notify({
      recipientId: r1Id,
      type: 'board.cycle_reminder',
      title: 'cycle',
      body: 'expiring soon',
      dedupeKey: 'cycle:sub123:2026'
    });
    expect(a).not.toBeNull();
    expect(b).toBeNull();
    const count = await Notification.countDocuments({
      recipientId: a!.recipientId,
      dedupeKey: 'cycle:sub123:2026'
    });
    expect(count).toBe(1);
  });
});

describe('CR-010 — DM notification fan-out', () => {
  it('creating a thread notifies the other participant but not the sender', async () => {
    const { sid, leadTok, r2Id, leadId } = await seed();
    const res = await request(app)
      .post(`/api/submissions/${sid}/messages`)
      .set('Authorization', `Bearer ${leadTok}`)
      .send({ subject: 'About 1.b', participantIds: [r2Id], message: 'Please clarify 1.b.' });
    expect(res.status).toBe(201);

    // give the fire-and-forget fan-out a tick to land
    await new Promise((r) => setTimeout(r, 50));

    const r2Notifs = await Notification.find({ recipientId: r2Id }).lean();
    expect(r2Notifs.length).toBe(1);
    expect(r2Notifs[0].type).toBe('dm.new_message');
    expect(r2Notifs[0].title).toMatch(/Lead Linda/);
    expect(r2Notifs[0].body).toMatch(/clarify 1\.b/);
    expect(r2Notifs[0].link).toBe(`/reader/${sid}`);

    // sender (lead) gets nothing
    const leadNotifs = await Notification.find({ recipientId: leadId }).lean();
    expect(leadNotifs.length).toBe(0);
  });

  it('posting a reply notifies the other participant', async () => {
    const { sid, leadTok, r2Tok, r2Id, leadId } = await seed();
    const created = await request(app)
      .post(`/api/submissions/${sid}/messages`)
      .set('Authorization', `Bearer ${leadTok}`)
      .send({ subject: 'Q', participantIds: [r2Id], message: 'first' });
    const threadId = created.body.thread._id;
    await new Promise((r) => setTimeout(r, 50));

    // r2 replies → lead should be notified
    const reply = await request(app)
      .post(`/api/messages/${threadId}`)
      .set('Authorization', `Bearer ${r2Tok}`)
      .send({ message: 'here is context' });
    expect(reply.status).toBe(201);
    await new Promise((r) => setTimeout(r, 50));

    const leadNotifs = await Notification.find({ recipientId: leadId }).lean();
    expect(leadNotifs.length).toBe(1);
    expect(leadNotifs[0].body).toMatch(/here is context/);
  });
});
