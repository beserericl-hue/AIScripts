/**
 * CR-010 follow-on / Sprint 12.2 — widen notification producers.
 *
 * Three user-facing actions now emit an in-app (+ fail-soft email) notification
 * through the shared `notify` service:
 *
 *   1. comment relay      → the PC (submission submitter) gets `comment.relayed`
 *   2. board decision     → the PC gets `board.decision`
 *   3. reader assignment  → each assigned reader gets `reader.assignment`
 *
 * Each producer is fail-soft (never breaks its action) and idempotent via a
 * dedupeKey, so we also pin that a duplicate action does not double-notify.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { Comment } from '../../src/models/Comment';
import { Notification } from '../../src/models/Notification';
import { createUser, signTokenFor } from '../helpers/factories';

afterEach(() => vi.restoreAllMocks());

async function waitForNote(query: Record<string, unknown>, tries = 60): Promise<any> {
  for (let i = 0; i < tries; i++) {
    const hit = await Notification.findOne(query);
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 25));
  }
  return null;
}

let _c = 0;
async function seedSubmission(submitterId: mongoose.Types.ObjectId, status = 'under_review'): Promise<any> {
  _c += 1;
  return Submission.create({
    submissionId: `NP-${Date.now().toString(36)}-${_c}`,
    institutionName: 'Notify U',
    programName: 'Human Services',
    programLevel: 'bachelors',
    submitterId,
    type: 'initial',
    status
  });
}

describe('CR-010 / S12.2 — comment relay notifies the PC', () => {
  it('relaying a reader comment creates a comment.relayed notification for the submitter', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const { user: reader } = await createUser({ role: 'reader' });
    const { user: lead } = await createUser({ role: 'lead_reader' });
    const sub = await seedSubmission(pc._id as any);
    const cmt: any = await Comment.create({
      submissionId: sub._id,
      standardCode: '1',
      specCode: 'a',
      selectedText: 'governance',
      selectionStart: 0,
      selectionEnd: 10,
      authorId: reader._id,
      authorName: 'Jane Reader',
      authorRole: 'reader',
      content: 'Raw reader content.',
      relayed: false,
      boardEscalated: false
    });

    const res = await request(app)
      .post(`/api/comments/${cmt._id}/relay`)
      .set('Authorization', `Bearer ${signTokenFor(lead as any)}`)
      .send({ relayedText: 'Please add an org chart.', pcLabel: 'Reader A' });
    expect(res.status).toBe(200);

    const note = await waitForNote({ recipientId: pc._id, type: 'comment.relayed' });
    expect(note).not.toBeNull();
    expect(note.link).toBe(`/self-study/${String(sub._id)}`);
    expect(note.dedupeKey).toBe(`comment.relayed:${String(cmt._id)}`);
  });

  it('re-relaying the same comment does not double-notify (dedupeKey)', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const { user: reader } = await createUser({ role: 'reader' });
    const { user: lead } = await createUser({ role: 'lead_reader' });
    const sub = await seedSubmission(pc._id as any);
    const cmt: any = await Comment.create({
      submissionId: sub._id, standardCode: '1', specCode: 'a', selectedText: 'g',
      selectionStart: 0, selectionEnd: 1, authorId: reader._id, authorName: 'J',
      authorRole: 'reader', content: 'x', relayed: false, boardEscalated: false
    });
    const tok = signTokenFor(lead as any);
    await request(app).post(`/api/comments/${cmt._id}/relay`).set('Authorization', `Bearer ${tok}`).send({});
    await waitForNote({ recipientId: pc._id, type: 'comment.relayed' });
    await request(app).post(`/api/comments/${cmt._id}/relay`).set('Authorization', `Bearer ${tok}`).send({});
    // brief settle for the second fire-and-forget
    await new Promise((r) => setTimeout(r, 150));
    const count = await Notification.countDocuments({ recipientId: pc._id, type: 'comment.relayed' });
    expect(count).toBe(1);
  });
});

describe('CR-010 / S12.2 — board decision notifies the PC', () => {
  it('recording a decision creates a board.decision notification for the submitter', async () => {
    const { user: admin } = await createUser({ role: 'admin' });
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission(pc._id as any, 'review_complete');

    const res = await request(app)
      .post(`/api/submissions/${sub._id}/decision`)
      .set('Authorization', `Bearer ${signTokenFor(admin as any)}`)
      .send({ outcome: 'accept', comments: 'All criteria met.' });
    expect(res.status).toBe(200);

    const note = await waitForNote({ recipientId: pc._id, type: 'board.decision' });
    expect(note).not.toBeNull();
    expect(note.title).toContain('accept');
    expect(note.link).toBe(`/self-study/${String(sub._id)}`);
  });
});

describe('CR-010 / S12.2 — reader assignment notifies the reader', () => {
  it('assigning readers creates a reader.assignment notification for each reader', async () => {
    const { user: admin } = await createUser({ role: 'admin' });
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const { user: reader } = await createUser({ role: 'reader' });
    // draft is not a locked phase → no reason required.
    const sub = await seedSubmission(pc._id as any, 'draft');

    const res = await request(app)
      .post(`/api/reviews/submissions/${sub._id}/assign`)
      .set('Authorization', `Bearer ${signTokenFor(admin as any)}`)
      .send({ readerIds: [String(reader._id)] });
    expect(res.status).toBe(200);

    const note = await waitForNote({ recipientId: reader._id, type: 'reader.assignment' });
    expect(note).not.toBeNull();
    expect(note.submissionId?.toString()).toBe(String(sub._id));
    expect(note.link).toBe(`/reader/${String(sub._id)}`);
  });
});
