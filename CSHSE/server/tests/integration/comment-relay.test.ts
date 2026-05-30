/**
 * Sprint 4 / CR-004 + CR-023 — comment relay endpoint integration tests.
 *
 * The critical contract: a PC viewer never sees an unrelayed comment, and
 * even when they see a relayed comment, reader identity is wiped. The
 * relay/unrelay/escalate transitions write audit entries so the timeline
 * is recoverable.
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { Comment } from '../../src/models/Comment';
import { Submission } from '../../src/models/Submission';
import { AuditLogEntry } from '../../src/models/AuditLogEntry';
import { createUser, signTokenFor } from '../helpers/factories';

let _c = 0;
async function seedSubmission(submitterId: mongoose.Types.ObjectId) {
  _c += 1;
  return (await Submission.create({
    submissionId: `CR4-${Date.now().toString(36)}-${_c}`,
    institutionName: 'CR4 U',
    programName: 'HS',
    programLevel: 'bachelors',
    submitterId,
    type: 'initial',
    status: 'under_review',
  })) as any;
}

async function seedComment(submissionId: any, authorId: any, authorName: string, overrides: any = {}) {
  return (await Comment.create({
    submissionId,
    standardCode: '1',
    specCode: 'a',
    selectedText: 'governance',
    selectionStart: 0,
    selectionEnd: 10,
    authorId,
    authorName,
    authorRole: 'reader',
    content: 'Original raw reader content with potentially sensitive phrasing.',
    relayed: false,
    boardEscalated: false,
    ...overrides,
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

describe('CR-004 — PC visibility of comments', () => {
  it('PC does NOT see an unrelayed comment in the listing', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const { user: reader } = await createUser({ role: 'reader' });
    const sub = await seedSubmission(pc._id as any);
    await seedComment(sub._id, reader._id, `${(reader as any).firstName} ${(reader as any).lastName}`);

    const res = await request(app)
      .get(`/api/submissions/${sub._id}/comments`)
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`);
    expect(res.status).toBe(200);
    expect(res.body.comments).toHaveLength(0);
  });

  it('reader sees the comment fully (no redaction)', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const { user: reader } = await createUser({ role: 'reader' });
    const sub = await seedSubmission(pc._id as any);
    await seedComment(sub._id, reader._id, 'Jane Reader');

    const res = await request(app)
      .get(`/api/submissions/${sub._id}/comments`)
      .set('Authorization', `Bearer ${signTokenFor(reader as any)}`);
    expect(res.status).toBe(200);
    expect(res.body.comments).toHaveLength(1);
    expect(res.body.comments[0].authorName).toBe('Jane Reader');
    expect(res.body.comments[0].content).toMatch(/Original raw reader content/);
  });

  it('PC sees a relayed comment with identity wiped + relayedText substituted', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const { user: reader } = await createUser({ role: 'reader' });
    const sub = await seedSubmission(pc._id as any);
    await seedComment(sub._id, reader._id, 'Jane Reader', {
      relayed: true,
      relayedText: 'Please strengthen the governance section with an org chart.',
      pcLabel: 'Reader A',
      originalReaderId: reader._id,
    });

    const res = await request(app)
      .get(`/api/submissions/${sub._id}/comments`)
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`);
    expect(res.status).toBe(200);
    expect(res.body.comments).toHaveLength(1);
    const c = res.body.comments[0];
    // identity wiped
    expect(c.authorName).toBe('Reader A');
    expect(c.authorId).toBeUndefined();
    expect(c.originalReaderId).toBeUndefined();
    expect(c.relayedBy).toBeUndefined();
    // sanitized text replaces raw content
    expect(c.content).toBe('Please strengthen the governance section with an org chart.');
    // raw reader name + raw content never leak anywhere in the response
    expect(JSON.stringify(res.body)).not.toContain('Jane Reader');
    expect(JSON.stringify(res.body)).not.toContain('Original raw reader content');
  });
});

describe('CR-023 — relay/unrelay/escalate transitions', () => {
  it('lead_reader can relay a comment → PC can now see it', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const { user: reader } = await createUser({ role: 'reader' });
    const { user: lead } = await createUser({ role: 'lead_reader' });
    const sub = await seedSubmission(pc._id as any);
    const cmt = await seedComment(sub._id, reader._id, 'Jane Reader');

    const relay = await request(app)
      .post(`/api/comments/${cmt._id}/relay`)
      .set('Authorization', `Bearer ${signTokenFor(lead as any)}`)
      .send({ relayedText: 'Sanitized version.', pcLabel: 'Reader A', reason: 'OK to share' });
    expect(relay.status).toBe(200);

    const fresh = await Comment.findById(cmt._id).lean();
    expect((fresh as any)?.relayed).toBe(true);
    expect((fresh as any)?.pcLabel).toBe('Reader A');

    // PC now sees it
    const pcList = await request(app)
      .get(`/api/submissions/${sub._id}/comments`)
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`);
    expect(pcList.body.comments).toHaveLength(1);
    expect(pcList.body.comments[0].content).toBe('Sanitized version.');

    // audit
    const audit = await waitForAudit({ action: 'comment.relayed', targetId: String(cmt._id) });
    expect(audit).not.toBeNull();
    expect(audit.reason).toBe('OK to share');
  });

  it('lead_reader can unrelay → PC loses visibility again', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const { user: reader } = await createUser({ role: 'reader' });
    const { user: lead } = await createUser({ role: 'lead_reader' });
    const sub = await seedSubmission(pc._id as any);
    const cmt = await seedComment(sub._id, reader._id, 'Jane', { relayed: true, pcLabel: 'Reader A' });

    const res = await request(app)
      .delete(`/api/comments/${cmt._id}/relay`)
      .set('Authorization', `Bearer ${signTokenFor(lead as any)}`);
    expect(res.status).toBe(200);

    const pcList = await request(app)
      .get(`/api/submissions/${sub._id}/comments`)
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`);
    expect(pcList.body.comments).toHaveLength(0);

    const audit = await waitForAudit({ action: 'comment.unrelayed', targetId: String(cmt._id) });
    expect(audit).not.toBeNull();
  });

  it('reader cannot relay (403)', async () => {
    const { user: reader } = await createUser({ role: 'reader' });
    const sub = await seedSubmission(new mongoose.Types.ObjectId() as any);
    const cmt = await seedComment(sub._id, reader._id, 'Jane');
    const res = await request(app)
      .post(`/api/comments/${cmt._id}/relay`)
      .set('Authorization', `Bearer ${signTokenFor(reader as any)}`)
      .send({});
    expect(res.status).toBe(403);
  });

  it('PC cannot relay (403)', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission(pc._id as any);
    const cmt = await seedComment(sub._id, new mongoose.Types.ObjectId() as any, 'X');
    const res = await request(app)
      .post(`/api/comments/${cmt._id}/relay`)
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`)
      .send({});
    expect(res.status).toBe(403);
  });

  it('lead_reader can escalate to board; flag persists', async () => {
    const { user: lead } = await createUser({ role: 'lead_reader' });
    const { user: reader } = await createUser({ role: 'reader' });
    const sub = await seedSubmission(new mongoose.Types.ObjectId() as any);
    const cmt = await seedComment(sub._id, reader._id, 'Jane');

    const res = await request(app)
      .post(`/api/comments/${cmt._id}/escalate`)
      .set('Authorization', `Bearer ${signTokenFor(lead as any)}`)
      .send({ reason: 'Readers disagree' });
    expect(res.status).toBe(200);

    const fresh = await Comment.findById(cmt._id).lean();
    expect((fresh as any)?.boardEscalated).toBe(true);
  });

  it('GET /relay-queue returns unrelayed + escalated comments to lead_reader; PC is 403', async () => {
    const { user: lead } = await createUser({ role: 'lead_reader' });
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const { user: reader } = await createUser({ role: 'reader' });
    const sub = await seedSubmission(pc._id as any);
    await seedComment(sub._id, reader._id, 'A'); // unrelayed
    await seedComment(sub._id, reader._id, 'B', { relayed: true, pcLabel: 'Reader B' }); // relayed
    await seedComment(sub._id, reader._id, 'C', { relayed: true, boardEscalated: true }); // escalated

    const leadRes = await request(app)
      .get(`/api/submissions/${sub._id}/comments/relay-queue`)
      .set('Authorization', `Bearer ${signTokenFor(lead as any)}`);
    expect(leadRes.status).toBe(200);
    // 1 unrelayed + 1 escalated; the plain relayed (not escalated) does NOT appear.
    expect(leadRes.body.comments.length).toBe(2);

    const pcRes = await request(app)
      .get(`/api/submissions/${sub._id}/comments/relay-queue`)
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`);
    expect(pcRes.status).toBe(403);
  });
});
