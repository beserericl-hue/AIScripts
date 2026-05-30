/**
 * S2A.1 (CR-006) — every workflow transition writes a structured audit
 * entry. Final Submit, submit/revert-standard, reader-lock/unlock,
 * send-back, sent-back-cleared, and reader-assignment all need a single
 * "who did what when" row so the timeline can reconstruct the path the
 * submission took.
 *
 * These tests pin the transition → audit-action contract so a future
 * refactor can't silently drop an audit write.
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
    submissionId: `AUD-${Date.now().toString(36)}-${_c}`,
    institutionName: 'Audit U',
    institutionId: overrides.institutionId,
    programName: 'HS',
    programLevel: 'bachelors',
    submitterId: overrides.submitterId ?? new mongoose.Types.ObjectId(),
    type: 'initial',
    status: overrides.status ?? 'under_review',
    assignedReaders: overrides.assignedReaders,
    leadReader: overrides.leadReader,
    readerLock: overrides.readerLock,
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

describe('S2A.1 — audit on every reader-lock transition (CR-006)', () => {
  it('reader.lock writes a submission.reader_lock entry with role + reason', async () => {
    const { user: reader } = await createUser({ role: 'reader' });
    const sub = await seedSubmission({
      assignedReaders: [reader._id],
      status: 'submitted',
    });
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/lock`)
      .set('Authorization', `Bearer ${signTokenFor(reader as any)}`)
      .send({ reason: 'reader_review' });
    expect(res.status).toBe(200);

    const audit = await waitForAudit({
      action: 'submission.reader_lock',
      targetId: String(sub._id),
    });
    expect(audit).not.toBeNull();
    expect(audit.payload?.lockReason).toBe('reader_review');
    expect(audit.payload?.lockedByRole).toBe('reader');
  });

  it('reader.unlock writes a submission.reader_unlock entry referencing the prior lock', async () => {
    const { user: reader } = await createUser({ role: 'reader' });
    const sub = await seedSubmission({
      assignedReaders: [reader._id],
      readerLock: {
        isLocked: true,
        lockedBy: reader._id,
        lockedByName: (reader as any).name,
        lockedByRole: 'reader',
        lockedAt: new Date(),
        lockReason: 'reader_review',
      },
    });
    const res = await request(app)
      .delete(`/api/submissions/${sub._id}/lock`)
      .set('Authorization', `Bearer ${signTokenFor(reader as any)}`);
    expect(res.status).toBe(200);

    const audit = await waitForAudit({
      action: 'submission.reader_unlock',
      targetId: String(sub._id),
    });
    expect(audit).not.toBeNull();
    expect(audit.payload?.priorLockReason).toBe('reader_review');
  });

  it('send-back writes a submission.send_back entry with the reason', async () => {
    const { user: reader } = await createUser({ role: 'reader' });
    const sub = await seedSubmission({
      assignedReaders: [reader._id],
      readerLock: {
        isLocked: true,
        lockedBy: reader._id,
        lockedByName: (reader as any).name,
        lockedByRole: 'reader',
        lockedAt: new Date(),
        lockReason: 'reader_review',
      },
    });
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/send-back`)
      .set('Authorization', `Bearer ${signTokenFor(reader as any)}`)
      .send({ reason: 'Standard 3 narrative omits the org chart link.' });
    expect(res.status).toBe(200);

    const audit = await waitForAudit({
      action: 'submission.send_back',
      targetId: String(sub._id),
    });
    expect(audit).not.toBeNull();
    expect(audit.reason).toMatch(/org chart/);
  });

  it('clear-sent-back writes a submission.sent_back_cleared entry', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({
      submitterId: pc._id,
      status: 'under_review',
      readerLock: {
        isLocked: false,
        lockReason: 'sent_back_for_correction',
        sentBackAt: new Date(),
        sentBackReason: 'Add missing CV.',
      },
    });
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/clear-sent-back`)
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`);
    expect(res.status).toBe(200);

    const audit = await waitForAudit({
      action: 'submission.sent_back_cleared',
      targetId: String(sub._id),
    });
    expect(audit).not.toBeNull();
    expect(audit.payload?.priorSentBackReason).toBe('Add missing CV.');
  });
});

describe('S2A.1 — audit on reader assignment (CR-006)', () => {
  it('assignReaders writes one reader.assigned entry per reader', async () => {
    const { user: admin } = await createUser({ role: 'admin' });
    const { user: r1 } = await createUser({ role: 'reader' });
    const { user: r2 } = await createUser({ role: 'reader' });
    const sub = await seedSubmission({ status: 'submitted' });

    // CR-022 — a `submitted` submission is in the locked phase. Admins
    // can assign but must pass a reason. (Pinned independently by
    // reader-assignment-lockout.test.ts; this test stays on the per-reader
    // fan-out invariant.)
    const res = await request(app)
      .post(`/api/reviews/submissions/${sub._id}/assign`)
      .set('Authorization', `Bearer ${signTokenFor(admin as any)}`)
      .send({ readerIds: [String(r1._id), String(r2._id)], reason: 'Initial assignment.' });
    expect(res.status).toBe(200);

    const entries = await AuditLogEntry.find({
      action: 'reader.assigned',
      targetId: String(sub._id),
    });
    // poll if not yet flushed
    let tries = 0;
    let finalEntries = entries;
    while (finalEntries.length < 2 && tries < 60) {
      await new Promise((r) => setTimeout(r, 50));
      finalEntries = await AuditLogEntry.find({
        action: 'reader.assigned',
        targetId: String(sub._id),
      });
      tries++;
    }
    expect(finalEntries.length).toBe(2);
    const readerIds = finalEntries.map((e) => (e.payload as any)?.readerId).sort();
    expect(readerIds).toEqual([String(r1._id), String(r2._id)].sort());
  });
});
