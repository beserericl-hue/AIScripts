/**
 * CR-022 follow-on / Sprint 13c — lead-reader "Request change from admin".
 *
 * Once a self-study is locked, lead readers cannot re-assign readers (they
 * get a 403 from POST /assign). The governed escape hatch is to ASK an admin.
 *
 * Pins:
 *   - a lead reader can POST a request (200) → every active admin is notified
 *     and an append-only audit entry is written with the reason
 *   - a missing/blank reason → 400
 *   - a plain reader cannot use the affordance → 403
 *   - an admin cannot use the affordance (they act directly) → 403
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { Notification } from '../../src/models/Notification';
import { AuditLogEntry } from '../../src/models/AuditLogEntry';
import { createUser, signTokenFor } from '../helpers/factories';

async function waitForNote(query: Record<string, unknown>, tries = 60): Promise<any> {
  for (let i = 0; i < tries; i++) {
    const hit = await Notification.findOne(query);
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 25));
  }
  return null;
}

async function waitForAudit(query: Record<string, unknown>, tries = 60): Promise<any> {
  for (let i = 0; i < tries; i++) {
    const hit = await AuditLogEntry.findOne(query);
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 25));
  }
  return null;
}

let _c = 0;
async function seedSubmission(status = 'under_review'): Promise<any> {
  _c += 1;
  return Submission.create({
    submissionId: `RAC-${Date.now().toString(36)}-${_c}`,
    institutionName: 'Locked U',
    programName: 'Human Services',
    programLevel: 'bachelors',
    submitterId: new mongoose.Types.ObjectId(),
    type: 'initial',
    status
  });
}

describe('CR-022 / S13c — POST /reviews/submissions/:id/request-assignment-change', () => {
  it('lead reader request notifies every admin + writes an audit entry with the reason', async () => {
    const { user: lead } = await createUser({ role: 'lead_reader' });
    const { user: adminA } = await createUser({ role: 'admin' });
    const { user: adminB } = await createUser({ role: 'admin' });
    const sub = await seedSubmission('under_review');

    const res = await request(app)
      .post(`/api/reviews/submissions/${String(sub._id)}/request-assignment-change`)
      .send({ reason: 'Reader Dr. Smith has a conflict of interest with this institution.' })
      .set('Authorization', `Bearer ${signTokenFor(lead as any)}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const noteA = await waitForNote({ recipientId: adminA._id, type: 'reader.assignment_change_requested' });
    const noteB = await waitForNote({ recipientId: adminB._id, type: 'reader.assignment_change_requested' });
    expect(noteA).toBeTruthy();
    expect(noteB).toBeTruthy();
    expect(noteA.body).toContain('conflict of interest');

    const audit = await waitForAudit({
      action: 'reader.assignment_change_requested',
      targetId: String(sub._id),
    });
    expect(audit).toBeTruthy();
    expect(audit.reason).toContain('conflict of interest');
    expect(String(audit.actorId)).toBe(String(lead._id));
  });

  it('rejects a blank reason with 400', async () => {
    const { user: lead } = await createUser({ role: 'lead_reader' });
    const sub = await seedSubmission('under_review');
    const res = await request(app)
      .post(`/api/reviews/submissions/${String(sub._id)}/request-assignment-change`)
      .send({ reason: '   ' })
      .set('Authorization', `Bearer ${signTokenFor(lead as any)}`);
    expect(res.status).toBe(400);
  });

  it('a plain reader cannot use the affordance (403)', async () => {
    const { user: reader } = await createUser({ role: 'reader' });
    const sub = await seedSubmission('under_review');
    const res = await request(app)
      .post(`/api/reviews/submissions/${String(sub._id)}/request-assignment-change`)
      .send({ reason: 'please reassign' })
      .set('Authorization', `Bearer ${signTokenFor(reader as any)}`);
    expect(res.status).toBe(403);
  });

  it('an admin cannot use the affordance — they act directly (403)', async () => {
    const { user: admin } = await createUser({ role: 'admin' });
    const sub = await seedSubmission('under_review');
    const res = await request(app)
      .post(`/api/reviews/submissions/${String(sub._id)}/request-assignment-change`)
      .send({ reason: 'changing it myself' })
      .set('Authorization', `Bearer ${signTokenFor(admin as any)}`);
    expect(res.status).toBe(403);
  });
});
