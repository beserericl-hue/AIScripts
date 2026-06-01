/**
 * CR-056 — lead-reader "Complete review & send to board".
 *
 * The board queue reads submissions in `review_complete`. Nothing in the
 * Score-based compilation surface advanced a submission to that status, so the
 * reader → lead-reader → board chain dead-ended. POST
 * /api/submissions/:id/compilation/finalize flips the status (lead/admin only).
 *
 * Pins:
 *   - lead_reader finalizes an under_review/submitted/readers_assigned
 *     submission → 200, status review_complete, leadReader stamped, audit
 *     `compilation.finalized`, every admin gets a `board.ready` notification
 *   - idempotent on an already-complete submission (200, alreadyComplete)
 *   - 409 from a non-advanceable status (draft) or a decided one (compliant)
 *   - PC / reader → 403
 *   - 404 for an unknown submission
 *
 * Each test seeds + asserts within itself to survive the per-test collection
 * wipe in tests/setup.ts.
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
  const { user: pc } = await createUser({ role: 'program_coordinator' });
  return Submission.create({
    submissionId: `CR056-${Date.now().toString(36)}-${_c}`,
    institutionName: 'Finalize U',
    programName: 'Human Services',
    programLevel: 'bachelors',
    submitterId: pc._id,
    type: 'initial',
    status
  });
}

describe('CR-056 — POST /api/submissions/:id/compilation/finalize', () => {
  it('lead_reader sends to board: status→review_complete, leadReader stamped, audit + admin notifications', async () => {
    const { user: lead } = await createUser({ role: 'lead_reader' });
    const { user: adminA } = await createUser({ role: 'admin' });
    const { user: adminB } = await createUser({ role: 'admin' });
    const sub = await seedSubmission('under_review');

    const res = await request(app)
      .post(`/api/submissions/${String(sub._id)}/compilation/finalize`)
      .set('Authorization', `Bearer ${signTokenFor(lead as any)}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.status).toBe('review_complete');

    const fresh = await Submission.findById(sub._id);
    expect(fresh?.status).toBe('review_complete');
    expect(String(fresh?.leadReader)).toBe(String(lead._id));

    const audit = await waitForAudit({ action: 'compilation.finalized', targetId: String(sub._id) });
    expect(audit).toBeTruthy();
    expect(audit.payload?.priorStatus).toBe('under_review');
    expect(audit.payload?.newStatus).toBe('review_complete');

    const noteA = await waitForNote({ recipientId: adminA._id, type: 'board.ready' });
    const noteB = await waitForNote({ recipientId: adminB._id, type: 'board.ready' });
    expect(noteA).toBeTruthy();
    expect(noteB).toBeTruthy();
    expect(noteA.body).toContain('Finalize U');
  });

  it('admin can finalize a submitted submission (200)', async () => {
    const { user: admin } = await createUser({ role: 'admin' });
    const sub = await seedSubmission('submitted');
    const res = await request(app)
      .post(`/api/submissions/${String(sub._id)}/compilation/finalize`)
      .set('Authorization', `Bearer ${signTokenFor(admin as any)}`);
    expect(res.status).toBe(200);
    expect((await Submission.findById(sub._id))?.status).toBe('review_complete');
  });

  it('is idempotent on an already review_complete submission', async () => {
    const { user: lead } = await createUser({ role: 'lead_reader' });
    const sub = await seedSubmission('review_complete');
    const res = await request(app)
      .post(`/api/submissions/${String(sub._id)}/compilation/finalize`)
      .set('Authorization', `Bearer ${signTokenFor(lead as any)}`);
    expect(res.status).toBe(200);
    expect(res.body.alreadyComplete).toBe(true);
  });

  it('409 from a non-advanceable status (draft)', async () => {
    const { user: lead } = await createUser({ role: 'lead_reader' });
    const sub = await seedSubmission('draft');
    const res = await request(app)
      .post(`/api/submissions/${String(sub._id)}/compilation/finalize`)
      .set('Authorization', `Bearer ${signTokenFor(lead as any)}`);
    expect(res.status).toBe(409);
  });

  it('409 when the board has already decided (compliant)', async () => {
    const { user: lead } = await createUser({ role: 'lead_reader' });
    const sub = await seedSubmission('compliant');
    const res = await request(app)
      .post(`/api/submissions/${String(sub._id)}/compilation/finalize`)
      .set('Authorization', `Bearer ${signTokenFor(lead as any)}`);
    expect(res.status).toBe(409);
  });

  it('rejects a PC (403)', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission('under_review');
    const res = await request(app)
      .post(`/api/submissions/${String(sub._id)}/compilation/finalize`)
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`);
    expect(res.status).toBe(403);
  });

  it('rejects a reader (403)', async () => {
    const { user: reader } = await createUser({ role: 'reader' });
    const sub = await seedSubmission('under_review');
    const res = await request(app)
      .post(`/api/submissions/${String(sub._id)}/compilation/finalize`)
      .set('Authorization', `Bearer ${signTokenFor(reader as any)}`);
    expect(res.status).toBe(403);
  });

  it('404 for an unknown submission', async () => {
    const { user: lead } = await createUser({ role: 'lead_reader' });
    const bogus = new mongoose.Types.ObjectId();
    const res = await request(app)
      .post(`/api/submissions/${String(bogus)}/compilation/finalize`)
      .set('Authorization', `Bearer ${signTokenFor(lead as any)}`);
    expect(res.status).toBe(404);
  });
});
