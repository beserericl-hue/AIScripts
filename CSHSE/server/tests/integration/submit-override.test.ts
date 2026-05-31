/**
 * Sprint 10 / S10.3 — CR-008 override-with-reason on final submit.
 *
 * Before this work, `submitSelfStudy` hard-blocked any submission with
 * unresolved specs (no pass / not excluded) — a PC could never force a
 * submit, and there was no audited bypass. The CR's "Sprint 2B" gap.
 *
 * This pins the new behaviour:
 *   - Unresolved specs + no override  → 400 {error, canOverride:true}.
 *   - Unresolved specs + override but no/short reason → 400 OVERRIDE_REASON_REQUIRED.
 *   - Unresolved specs + override + reason(>=10) → 200, override recorded.
 *   - A fully-validated submission still submits cleanly (no override flag).
 *   - The override path writes a `submission.final_submit_override` audit event
 *     carrying the reason; a clean submit writes `submission.final_submit`.
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { AuditLogEntry } from '../../src/models/AuditLogEntry';
import { getAllStandards } from '../../src/data/standards';
import { createUser, signTokenFor } from '../helpers/factories';

// recordAuditEvent is fire-and-forget (void) in submitSelfStudy — poll briefly
// so the assertion isn't racing the async write.
async function waitForAudit(query: Record<string, any>, tries = 20): Promise<any> {
  for (let i = 0; i < tries; i++) {
    const doc = await AuditLogEntry.findOne(query).lean();
    if (doc) return doc;
    await new Promise((r) => setTimeout(r, 25));
  }
  return null;
}

let _c = 0;
async function seedSubmission(overrides: any = {}) {
  _c += 1;
  return (await Submission.create({
    submissionId: `OVR-${Date.now().toString(36)}-${_c}`,
    institutionName: 'Override U',
    programName: 'HS',
    programLevel: 'bachelors',
    submitterId: overrides.submitterId ?? new mongoose.Types.ObjectId(),
    type: 'initial',
    status: overrides.status ?? 'in_progress',
    standardsStatus: overrides.standardsStatus,
  })) as any;
}

function allPassing(): Record<string, any> {
  const out: Record<string, any> = {};
  for (const std of getAllStandards()) {
    for (const spec of std.specifications || []) {
      out[`${std.code}_${spec.code}`] = {
        status: 'validated',
        validationStatus: 'pass',
        completionPercentage: 100,
      };
    }
  }
  return out;
}

describe('S10.3 — CR-008 override-with-reason on final submit', () => {
  it('hard-blocks an incomplete submit with no override (400 + canOverride)', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({ submitterId: user._id });
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/submit`)
      .set('Authorization', `Bearer ${signTokenFor(user as any)}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.canOverride).toBe(true);
    expect(res.body.totalMissing).toBeGreaterThan(0);
  });

  it('rejects an override with no reason (OVERRIDE_REASON_REQUIRED)', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({ submitterId: user._id });
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/submit`)
      .set('Authorization', `Bearer ${signTokenFor(user as any)}`)
      .send({ override: true });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('OVERRIDE_REASON_REQUIRED');
  });

  it('rejects an override whose reason is shorter than 10 chars', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({ submitterId: user._id });
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/submit`)
      .set('Authorization', `Bearer ${signTokenFor(user as any)}`)
      .send({ override: true, overrideReason: 'too short' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('OVERRIDE_REASON_REQUIRED');
  });

  it('allows an incomplete submit with override + a sufficient reason (200, override flagged)', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({ submitterId: user._id });
    const reason = 'Site visit deadline; remaining specs covered by appendix B.';
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/submit`)
      .set('Authorization', `Bearer ${signTokenFor(user as any)}`)
      .send({ override: true, overrideReason: reason });
    expect(res.status).toBe(200);
    expect(res.body.override).toBe(true);
    expect(res.body.submission.status).toBe('submitted');

    // Audit trail: a dedicated override event carrying the reason.
    const evt = await waitForAudit({
      submissionId: sub._id,
      action: 'submission.final_submit_override',
    });
    expect(evt).toBeTruthy();
    expect(evt.reason).toBe(reason);
    expect(evt.payload?.override).toBe(true);
    expect(evt.payload?.unresolvedCount).toBeGreaterThan(0);
  });

  it('a fully-validated submission still submits cleanly (no override flag, plain audit action)', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({ submitterId: user._id, standardsStatus: allPassing() });
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/submit`)
      .set('Authorization', `Bearer ${signTokenFor(user as any)}`)
      .send({ submissionNote: 'all good' });
    expect(res.status).toBe(200);
    expect(res.body.override).toBe(false);

    const plain = await waitForAudit({
      submissionId: sub._id,
      action: 'submission.final_submit',
    });
    expect(plain).toBeTruthy();
    const override = await AuditLogEntry.findOne({
      submissionId: sub._id,
      action: 'submission.final_submit_override',
    }).lean();
    expect(override).toBeNull();
  });
});
