/**
 * CR-022 / Sprint 6.3 — reader assignment lockout after submit.
 *
 * Pins:
 *   - lead_reader assigning on a fresh ("submitted") submission → 403
 *     (locked-phase admin-only)
 *   - admin assigning without a reason on a locked-phase submission → 400
 *   - admin assigning with a reason → 200; audit entry carries `reason`
 *     and `payload.submissionStatusAtChange`
 *   - lead_reader / admin assigning on a `draft` submission (pre-submit)
 *     still 200 with no reason required (back-compat with existing flow)
 *
 * Note: tests/setup.ts wipes collections per-test, so we seed inside each it.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { AuditLogEntry } from '../../src/models/AuditLogEntry';
import { createUser, signTokenFor } from '../helpers/factories';

afterEach(() => vi.restoreAllMocks());

async function waitForAudit(query: Record<string, unknown>, tries = 60): Promise<any> {
  for (let i = 0; i < tries; i++) {
    const hit = await AuditLogEntry.findOne(query);
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 50));
  }
  return null;
}

async function seedSubmission(status: string) {
  const { user: pc } = await createUser({ role: 'program_coordinator' });
  return Submission.create({
    submissionId: `LOCK-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6)}`,
    institutionName: 'Lockout U',
    programName: 'HS',
    programLevel: 'bachelors',
    submitterId: pc._id,
    type: 'initial',
    status
  }) as any;
}

describe('CR-022 — reader assignment lockout after submit', () => {
  it('lead_reader cannot assign once status >= submitted (403)', async () => {
    const { user: lead } = await createUser({ role: 'lead_reader' });
    const { user: r1 } = await createUser({ role: 'reader' });
    const sub = await seedSubmission('submitted');

    const res = await request(app)
      .post(`/api/reviews/submissions/${sub._id}/assign`)
      .set('Authorization', `Bearer ${signTokenFor(lead as any)}`)
      .send({ readerIds: [String(r1._id)] });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/locked|administrator/i);
  });

  it('admin assigning on a submitted submission WITHOUT reason → 400', async () => {
    const { user: admin } = await createUser({ role: 'admin' });
    const { user: r1 } = await createUser({ role: 'reader' });
    const sub = await seedSubmission('submitted');

    const res = await request(app)
      .post(`/api/reviews/submissions/${sub._id}/assign`)
      .set('Authorization', `Bearer ${signTokenFor(admin as any)}`)
      .send({ readerIds: [String(r1._id)] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/reason/i);
  });

  it('admin assigning on a submitted submission WITH reason → 200; audit carries reason + priorStatus', async () => {
    const { user: admin } = await createUser({ role: 'admin' });
    const { user: r1 } = await createUser({ role: 'reader' });
    const sub = await seedSubmission('submitted');

    const res = await request(app)
      .post(`/api/reviews/submissions/${sub._id}/assign`)
      .set('Authorization', `Bearer ${signTokenFor(admin as any)}`)
      .send({ readerIds: [String(r1._id)], reason: 'Replacing the original reader (conflict of interest)' });

    expect(res.status).toBe(200);

    const audit = await waitForAudit({
      action: 'reader.assigned',
      targetId: String(sub._id),
      'payload.readerId': String(r1._id)
    });
    expect(audit).not.toBeNull();
    expect(audit.reason).toMatch(/conflict of interest/);
    expect(audit.payload?.submissionStatusAtChange).toBe('submitted');
    expect(audit.payload?.lockedPhase).toBe(true);
  });

  it('lead_reader CAN assign on a draft submission (pre-submit; back-compat)', async () => {
    const { user: lead } = await createUser({ role: 'lead_reader' });
    const { user: r1 } = await createUser({ role: 'reader' });
    const sub = await seedSubmission('draft');

    const res = await request(app)
      .post(`/api/reviews/submissions/${sub._id}/assign`)
      .set('Authorization', `Bearer ${signTokenFor(lead as any)}`)
      .send({ readerIds: [String(r1._id)] });
    expect(res.status).toBe(200);

    // Audit carries no `reason` (not in locked phase).
    const audit = await waitForAudit({
      action: 'reader.assigned',
      targetId: String(sub._id),
      'payload.readerId': String(r1._id)
    });
    expect(audit).not.toBeNull();
    expect(audit.payload?.lockedPhase).toBe(false);
    expect(audit.payload?.submissionStatusAtChange).toBe('draft');
  });

  it('admin assigning on a `under_review` submission still requires a reason', async () => {
    const { user: admin } = await createUser({ role: 'admin' });
    const { user: r1 } = await createUser({ role: 'reader' });
    const sub = await seedSubmission('under_review');

    const noReason = await request(app)
      .post(`/api/reviews/submissions/${sub._id}/assign`)
      .set('Authorization', `Bearer ${signTokenFor(admin as any)}`)
      .send({ readerIds: [String(r1._id)] });
    expect(noReason.status).toBe(400);

    const withReason = await request(app)
      .post(`/api/reviews/submissions/${sub._id}/assign`)
      .set('Authorization', `Bearer ${signTokenFor(admin as any)}`)
      .send({ readerIds: [String(r1._id)], reason: 'Original reader unavailable.' });
    expect(withReason.status).toBe(200);
  });
});
