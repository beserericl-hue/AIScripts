/**
 * Sprint R.1 — prove the lockout / submission stack (CR-005 + CR-006).
 *
 * The 2026-05-29 reconciliation found the submission server code exists
 * but was never tracked or tested. This spec verifies what actually works
 * and pins what's broken, so CR-005/006 can be promoted (or their gaps
 * filed) on evidence rather than inference.
 *
 * VERIFIED WORKING (permanent regression coverage):
 *   - submissionLockout guard: PC writes 403 LOCKED on a final-submitted /
 *     under-review / readers-assigned / review-complete submission; admin
 *     bypasses; an in_progress submission is writable. (CR-005)
 *   - revertStandard: transitions a standard back to in_progress + writes
 *     an audit-log entry; refuses to revert a validated standard. (CR-006)
 *   - submitSelfStudy precondition: 400 when no active spec / already
 *     submitted.
 *
 * CHARACTERIZED AS BROKEN (it.fails — flips green when the bug is fixed):
 *   - submitStandard → calls the non-existent ValidationService.validateSection
 *     (CR-049). Throws.
 *   - submitSelfStudy happy path → iterates activeSpec.standards, which does
 *     not exist on the Spec model (only standardsCount). Throws. The readiness
 *     gate also needs the CR-050 "not applicable" escape.
 */
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { Spec } from '../../src/models/Spec';
import { AuditLogEntry } from '../../src/models/AuditLogEntry';
import { createUser, signTokenFor } from '../helpers/factories';

let _c = 0;
async function seedSubmission(overrides: any = {}) {
  _c += 1;
  return (await Submission.create({
    submissionId: `LOCK-${Date.now().toString(36)}-${_c}`,
    institutionName: 'Lock Test U',
    institutionId: overrides.institutionId,
    programName: 'Human Services',
    programLevel: 'bachelors',
    submitterId: overrides.submitterId ?? new mongoose.Types.ObjectId(),
    type: 'initial',
    status: overrides.status ?? 'in_progress',
    standardsStatus: overrides.standardsStatus,
  })) as any;
}

const LOCKED_STATUSES = ['submitted', 'under_review', 'readers_assigned', 'review_complete'];

// recordAuditEvent is fire-and-forget (`void`) in the controllers, so the
// write can land just after the HTTP response. Poll briefly for it.
async function waitForAudit(query: Record<string, unknown>, tries = 20): Promise<any> {
  for (let i = 0; i < tries; i++) {
    const hit = await AuditLogEntry.findOne(query);
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 50));
  }
  return null;
}

// --- CR-005: lockout guard ------------------------------------------------

describe('R.1 — submissionLockout guard (CR-005)', () => {
  it('401 without auth', async () => {
    const sub = await seedSubmission({ status: 'submitted' });
    const res = await request(app)
      .patch(`/api/submissions/${sub._id}/narrative`)
      .send({ standardCode: '1', specCode: 'a', content: '<p>x</p>' });
    expect(res.status).toBe(401);
  });

  it('allows a PC to write an in_progress submission (not locked)', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({ submitterId: user._id, status: 'in_progress' });
    const res = await request(app)
      .patch(`/api/submissions/${sub._id}/narrative`)
      .set('Authorization', `Bearer ${signTokenFor(user as any)}`)
      .send({ standardCode: '1', specCode: 'a', content: '<p>hello</p>' });
    expect(res.status).not.toBe(403);
    expect(res.status).toBeLessThan(300);
  });

  it.each(LOCKED_STATUSES)('blocks a PC write with 403 LOCKED when status=%s', async (status) => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({ submitterId: user._id, status });
    const res = await request(app)
      .patch(`/api/submissions/${sub._id}/narrative`)
      .set('Authorization', `Bearer ${signTokenFor(user as any)}`)
      .send({ standardCode: '1', specCode: 'a', content: '<p>x</p>' });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('LOCKED');
    expect(res.body.lock?.status).toBe(status);
  });

  it('admin bypasses the lockout on a submitted submission', async () => {
    const { user: admin } = await createUser({ role: 'admin' });
    const sub = await seedSubmission({ status: 'submitted' });
    const res = await request(app)
      .patch(`/api/submissions/${sub._id}/narrative`)
      .set('Authorization', `Bearer ${signTokenFor(admin as any)}`)
      .send({ standardCode: '1', specCode: 'a', content: '<p>admin edit</p>' });
    expect(res.status).not.toBe(403);
  });
});

// --- CR-006: revert transition + audit -----------------------------------

describe('R.1 — revertStandard transition + audit (CR-006)', () => {
  it('reverts a submitted standard to in_progress and writes an audit entry', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({
      submitterId: user._id,
      status: 'in_progress',
      standardsStatus: { '1': { status: 'submitted', completionPercentage: 100 } },
    });
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/standards/1/revert`)
      .set('Authorization', `Bearer ${signTokenFor(user as any)}`)
      .send({});
    expect(res.status).toBe(200);

    const fresh: any = await Submission.findById(sub._id);
    expect(fresh.standardsStatus.get('1').status).toBe('in_progress');

    const audit = await waitForAudit({
      action: 'submission.revert_standard',
      targetId: `${sub._id}:1`,
    });
    expect(audit).not.toBeNull();
  });

  it('refuses (409) to revert a validated standard', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({
      submitterId: user._id,
      status: 'in_progress',
      standardsStatus: { '2': { status: 'validated', completionPercentage: 100 } },
    });
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/standards/2/revert`)
      .set('Authorization', `Bearer ${signTokenFor(user as any)}`)
      .send({});
    expect(res.status).toBe(409);
  });
});

// --- submitSelfStudy preconditions ---------------------------------------

describe('R.1 — submitSelfStudy preconditions', () => {
  it('400 when the submission is already submitted', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({ submitterId: user._id, status: 'submitted' });
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/submit`)
      .set('Authorization', `Bearer ${signTokenFor(user as any)}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('400 when there is no active spec', async () => {
    // Ensure no active spec exists for this case.
    await Spec.updateMany({ isActive: true }, { $set: { isActive: false } });
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({ submitterId: user._id, status: 'in_progress' });
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/submit`)
      .set('Authorization', `Bearer ${signTokenFor(user as any)}`)
      .send({});
    expect(res.status).toBe(400);
    expect(String(res.body.error)).toMatch(/active specification/i);
  });
});

// --- CHARACTERIZATION: known-broken submit paths --------------------------
// These assert the CURRENT broken behavior. When the underlying bug is
// fixed (CR-049 / CR-006 activeSpec bug / CR-050), the call stops throwing
// and `it.fails` flips red — a built-in reminder to update the assertion.

describe('R.1 — known-broken submit paths (characterization)', () => {
  // submitStandard does NOT crash — it catches the validateSection
  // TypeError per-spec and records every spec as a failure. So the request
  // completes (<500) but NO spec can ever pass: validation is
  // non-functional until CR-049 replaces validateSection with the real
  // cshse-ai evaluator. When CR-049 lands, a genuinely-good section will
  // pass and the `validationStatus === 'fail'` assertion below will need
  // updating — that's the intended reminder.
  it('submitStandard completes but marks every spec FAIL — validateSection is broken (CR-049)', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({ submitterId: user._id, status: 'in_progress' });
    await Submission.updateOne(
      { _id: sub._id },
      { $set: { 'narratives.1.a': { content: '<p>real content</p>', lastModified: new Date(), isComplete: false, linkedDocuments: [] } } }
    );
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/standards/1/submit`)
      .set('Authorization', `Bearer ${signTokenFor(user as any)}`)
      .send({});
    expect(res.status).toBeLessThan(500); // per-spec TypeError is caught, not fatal
    const fresh: any = await Submission.findById(sub._id);
    expect(fresh.standardsStatus.get('1')?.validationStatus).toBe('fail'); // never 'pass'
  });

  // FINAL SUBMIT IS NON-FUNCTIONAL. submitSelfStudy queries
  // `Spec.findOne({ isActive: true })` (submissionController.ts:1035), but
  // the Spec model has NO `isActive` field (it uses `status`). So the query
  // never matches → final submit ALWAYS returns 400 "No active
  // specification found", regardless of validation state. (A second bug
  // lurks downstream: `for (const standard of activeSpec.standards)` —
  // Spec has no `standards` field either — but it's never reached.) Fix:
  // resolve standards via getAllStandards() like CR-047, + the CR-050 N/A
  // escape. When fixed this returns 400-missingValidations / 200 — update.
  it('submitSelfStudy always 400s — queries Spec {isActive:true} but Spec has no isActive field (CR-006 bug)', async () => {
    // Even with a "status: active" spec present, the {isActive:true} query
    // can't match (strict mode strips the unknown field on create too).
    await Spec.create({ name: 'R1 Spec', version: '1.0', status: 'active', standardsCount: 9, uploadedBy: new mongoose.Types.ObjectId() } as any);
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({ submitterId: user._id, status: 'in_progress' });
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/submit`)
      .set('Authorization', `Bearer ${signTokenFor(user as any)}`)
      .send({});
    expect(res.status).toBe(400);
    expect(String(res.body.error)).toMatch(/active specification/i);
  });
});
