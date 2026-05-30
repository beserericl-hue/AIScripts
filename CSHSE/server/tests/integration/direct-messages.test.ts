/**
 * CR-010 / Sprint 5.4 — Portal direct messaging.
 *
 * Pins:
 *   - PCs are 403 on every endpoint (list / create / read / post)
 *   - readers can create threads; rejected if they try to add a PC as a participant
 *   - non-participant reader → 403 on read + post
 *   - admin / superuser bypass the participant check
 *   - validation: subject + message required; participantIds must be array
 *   - POST message updates thread.lastMessageAt
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { DirectMessageThread, DirectMessage } from '../../src/models/DirectMessage';
import { createUser, signTokenFor } from '../helpers/factories';

afterEach(() => vi.restoreAllMocks());

async function seed() {
  const { user: admin } = await createUser({ role: 'admin' });
  const { user: lead } = await createUser({ role: 'lead_reader', firstName: 'Lead', lastName: 'Linda' });
  const { user: r1 } = await createUser({ role: 'reader', firstName: 'Reader', lastName: 'Alpha' });
  const { user: r2 } = await createUser({ role: 'reader', firstName: 'Reader', lastName: 'Bravo' });
  const { user: pc } = await createUser({ role: 'program_coordinator' });

  const sub: any = await Submission.create({
    submissionId: `DM-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`,
    institutionName: 'DM U',
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
    r2Id: String(r2._id),
    pcId: String(pc._id)
  };
}

describe('CR-010 — DM thread create + access', () => {
  it('lead reader creates a thread with another reader; both can read it', async () => {
    const { sid, leadTok, r2Tok, r2Id } = await seed();
    const res = await request(app)
      .post(`/api/submissions/${sid}/messages`)
      .set('Authorization', `Bearer ${leadTok}`)
      .send({
        subject: 'Question about 1.b',
        participantIds: [r2Id],
        message: 'Bob, could you clarify your 1.b score?'
      });
    expect(res.status).toBe(201);
    const threadId = res.body.thread._id;

    const r2Read = await request(app)
      .get(`/api/messages/${threadId}`)
      .set('Authorization', `Bearer ${r2Tok}`);
    expect(r2Read.status).toBe(200);
    expect(r2Read.body.messages.length).toBe(1);
    expect(r2Read.body.messages[0].content).toMatch(/clarify your 1\.b/);
  });

  it('rejects a PC as participant (400)', async () => {
    const { sid, leadTok, pcId } = await seed();
    const res = await request(app)
      .post(`/api/submissions/${sid}/messages`)
      .set('Authorization', `Bearer ${leadTok}`)
      .send({ subject: 's', participantIds: [pcId], message: 'm' });
    expect(res.status).toBe(400);
  });

  it('400 when subject or message missing', async () => {
    const { sid, leadTok, r1Id } = await seed();
    const noSubject = await request(app)
      .post(`/api/submissions/${sid}/messages`)
      .set('Authorization', `Bearer ${leadTok}`)
      .send({ participantIds: [r1Id], message: 'm' });
    expect(noSubject.status).toBe(400);
    const noMessage = await request(app)
      .post(`/api/submissions/${sid}/messages`)
      .set('Authorization', `Bearer ${leadTok}`)
      .send({ subject: 's', participantIds: [r1Id] });
    expect(noMessage.status).toBe(400);
  });
});

describe('CR-010 — PC is 403 everywhere', () => {
  it('GET threads list → 403', async () => {
    const { sid, pcTok } = await seed();
    const res = await request(app)
      .get(`/api/submissions/${sid}/messages`)
      .set('Authorization', `Bearer ${pcTok}`);
    expect(res.status).toBe(403);
  });

  it('POST create thread → 403', async () => {
    const { sid, pcTok, r1Id } = await seed();
    const res = await request(app)
      .post(`/api/submissions/${sid}/messages`)
      .set('Authorization', `Bearer ${pcTok}`)
      .send({ subject: 's', participantIds: [r1Id], message: 'm' });
    expect(res.status).toBe(403);
  });

  it('GET thread + POST message → 403 even if id is known', async () => {
    const { sid, leadTok, r2Id, pcTok } = await seed();
    const created = await request(app)
      .post(`/api/submissions/${sid}/messages`)
      .set('Authorization', `Bearer ${leadTok}`)
      .send({ subject: 's', participantIds: [r2Id], message: 'm' });
    const threadId = created.body.thread._id;

    const getRes = await request(app)
      .get(`/api/messages/${threadId}`)
      .set('Authorization', `Bearer ${pcTok}`);
    expect(getRes.status).toBe(403);

    const postRes = await request(app)
      .post(`/api/messages/${threadId}`)
      .set('Authorization', `Bearer ${pcTok}`)
      .send({ message: 'sneaky' });
    expect(postRes.status).toBe(403);
  });
});

describe('CR-010 — non-participant + admin behavior', () => {
  it('non-participant reader sees 403 reading and posting; admin can bypass', async () => {
    const { sid, leadTok, r1Tok, r2Tok, r2Id, adminTok } = await seed();
    const created = await request(app)
      .post(`/api/submissions/${sid}/messages`)
      .set('Authorization', `Bearer ${leadTok}`)
      .send({ subject: 's', participantIds: [r2Id], message: 'hi' });
    const threadId = created.body.thread._id;

    // r1 is NOT a participant.
    const r1Read = await request(app)
      .get(`/api/messages/${threadId}`)
      .set('Authorization', `Bearer ${r1Tok}`);
    expect(r1Read.status).toBe(403);

    const r1Post = await request(app)
      .post(`/api/messages/${threadId}`)
      .set('Authorization', `Bearer ${r1Tok}`)
      .send({ message: 'intruder' });
    expect(r1Post.status).toBe(403);

    // Admin bypasses participant check.
    const adminRead = await request(app)
      .get(`/api/messages/${threadId}`)
      .set('Authorization', `Bearer ${adminTok}`);
    expect(adminRead.status).toBe(200);

    // r2 (participant) can post.
    const r2Post = await request(app)
      .post(`/api/messages/${threadId}`)
      .set('Authorization', `Bearer ${r2Tok}`)
      .send({ message: 'Sure, here is more context.' });
    expect(r2Post.status).toBe(201);
  });

  it('POST message updates thread.lastMessageAt', async () => {
    const { sid, leadTok, r2Tok, r2Id } = await seed();
    const created = await request(app)
      .post(`/api/submissions/${sid}/messages`)
      .set('Authorization', `Bearer ${leadTok}`)
      .send({ subject: 's', participantIds: [r2Id], message: 'first' });
    const threadId = created.body.thread._id;
    const beforeThread = await DirectMessageThread.findById(threadId);
    const before = beforeThread!.lastMessageAt.getTime();

    await new Promise((r) => setTimeout(r, 25));

    const post = await request(app)
      .post(`/api/messages/${threadId}`)
      .set('Authorization', `Bearer ${r2Tok}`)
      .send({ message: 'second' });
    expect(post.status).toBe(201);

    const afterThread = await DirectMessageThread.findById(threadId);
    expect(afterThread!.lastMessageAt.getTime()).toBeGreaterThan(before);

    const total = await DirectMessage.countDocuments({ threadId });
    expect(total).toBe(2);
  });
});

describe('CR-010 — list filters by participant for non-elevated', () => {
  it('reader sees only their own threads; admin sees all on the submission', async () => {
    const { sid, leadTok, r1Tok, r1Id, r2Id, r2Tok, adminTok } = await seed();
    // Thread A: lead + r1
    await request(app)
      .post(`/api/submissions/${sid}/messages`)
      .set('Authorization', `Bearer ${leadTok}`)
      .send({ subject: 'A', participantIds: [r1Id], message: 'hello A' });
    // Thread B: lead + r2 (r1 is NOT a participant)
    await request(app)
      .post(`/api/submissions/${sid}/messages`)
      .set('Authorization', `Bearer ${leadTok}`)
      .send({ subject: 'B', participantIds: [r2Id], message: 'hello B' });

    const r1List = await request(app)
      .get(`/api/submissions/${sid}/messages`)
      .set('Authorization', `Bearer ${r1Tok}`);
    expect(r1List.status).toBe(200);
    const r1Subjects = r1List.body.threads.map((t: any) => t.subject).sort();
    expect(r1Subjects).toEqual(['A']);

    const r2List = await request(app)
      .get(`/api/submissions/${sid}/messages`)
      .set('Authorization', `Bearer ${r2Tok}`);
    const r2Subjects = r2List.body.threads.map((t: any) => t.subject).sort();
    expect(r2Subjects).toEqual(['B']);

    const adminList = await request(app)
      .get(`/api/submissions/${sid}/messages`)
      .set('Authorization', `Bearer ${adminTok}`);
    const adminSubjects = adminList.body.threads.map((t: any) => t.subject).sort();
    expect(adminSubjects).toEqual(['A', 'B']);
  });
});
