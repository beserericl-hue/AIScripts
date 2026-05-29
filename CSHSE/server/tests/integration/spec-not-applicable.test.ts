/**
 * CR-050 — Intentionally-omitted specs must not block submission.
 *
 *   POST   /api/submissions/:id/standards/:std/specs/:spec/not-applicable
 *   DELETE /api/submissions/:id/standards/:std/specs/:spec/not-applicable
 *
 * Covers:
 *   1. PC marks a spec N/A → submission stores excluded + reason + audit.
 *   2. submitSelfStudy succeeds when every spec is pass OR excluded.
 *   3. submitSelfStudy still 400s when even one spec is neither.
 *   4. Clear-N/A reverts state back to un-triaged (spec re-blocks submit).
 *   5. Cross-PC cannot mark a spec N/A (403).
 *   6. Lockout (post-submit) refuses N/A toggling for non-admin (409).
 *   7. Unknown spec returns 404.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { AuditLogEntry } from '../../src/models/AuditLogEntry';
import { getAllStandards } from '../../src/data/standards';
import { createUser, signTokenFor } from '../helpers/factories';

let _c = 0;
async function seedSubmission(overrides: any = {}) {
  _c += 1;
  return (await Submission.create({
    submissionId: `NA-${Date.now().toString(36)}-${_c}`,
    institutionName: 'NA Test U',
    institutionId: overrides.institutionId,
    programName: 'Human Services',
    programLevel: 'bachelors',
    submitterId: overrides.submitterId ?? new mongoose.Types.ObjectId(),
    type: 'initial',
    status: overrides.status ?? 'in_progress',
    standardsStatus: overrides.standardsStatus,
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

describe('CR-050 — mark spec not applicable', () => {
  it('PC marks a spec N/A: persists excluded + reason + audit entry', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({ submitterId: user._id });
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/standards/1/specs/a/not-applicable`)
      .set('Authorization', `Bearer ${signTokenFor(user as any)}`)
      .send({ reason: 'No PhD faculty applicable to this program level.' });

    expect(res.status).toBe(200);
    expect(res.body.excluded).toBe(true);
    expect(res.body.excludedReason).toMatch(/PhD faculty/);

    const fresh: any = await Submission.findById(sub._id);
    const row = fresh.standardsStatus.get('1_a');
    expect(row?.excluded).toBe(true);
    expect(row?.excludedReason).toMatch(/PhD faculty/);
    expect(row?.excludedAt).toBeTruthy();
    expect(row?.excludedBy?.toString()).toBe(String((user as any)._id));

    const audit = await waitForAudit({
      action: 'submission.spec_marked_na',
      targetId: String(sub._id),
    });
    expect(audit).not.toBeNull();
    expect(audit.payload).toMatchObject({ standardCode: '1', specCode: 'a' });
  });

  it('submitSelfStudy succeeds when one spec is excluded and the rest are pass', async () => {
    // Seed: every spec validated 'pass' EXCEPT 1.a which is excluded.
    const allStandards = getAllStandards();
    const standardsStatus: Record<string, any> = {};
    for (const std of allStandards) {
      for (const spec of std.specifications || []) {
        standardsStatus[`${std.code}_${spec.code}`] = {
          status: 'validated',
          validationStatus: 'pass',
          completionPercentage: 100,
        };
      }
    }
    // Wipe pass on 1.a; mark excluded instead.
    standardsStatus['1_a'] = {
      status: 'in_progress',
      excluded: true,
      excludedReason: 'Not applicable to bachelors',
      excludedAt: new Date(),
      completionPercentage: 0,
    };

    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({ submitterId: user._id, standardsStatus });

    const res = await request(app)
      .post(`/api/submissions/${sub._id}/submit`)
      .set('Authorization', `Bearer ${signTokenFor(user as any)}`)
      .send({});
    expect(res.status).toBe(200);

    const fresh: any = await Submission.findById(sub._id);
    expect(fresh.status).toBe('submitted');
    expect(fresh.submittedAt).toBeTruthy();
  });

  it('submitSelfStudy still 400s when an excluded spec is missing (one un-triaged gap)', async () => {
    const allStandards = getAllStandards();
    const standardsStatus: Record<string, any> = {};
    for (const std of allStandards) {
      for (const spec of std.specifications || []) {
        standardsStatus[`${std.code}_${spec.code}`] = {
          status: 'validated',
          validationStatus: 'pass',
          completionPercentage: 100,
        };
      }
    }
    // 2.a: neither passed nor excluded — accidental gap.
    standardsStatus['2_a'] = { status: 'in_progress', completionPercentage: 0 };

    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({ submitterId: user._id, standardsStatus });

    const res = await request(app)
      .post(`/api/submissions/${sub._id}/submit`)
      .set('Authorization', `Bearer ${signTokenFor(user as any)}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.missingValidations.join(' ')).toMatch(/Standard 2.*Spec a/);
  });

  it('DELETE clears the N/A flag and the spec re-blocks submission', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({
      submitterId: user._id,
      standardsStatus: { '1_a': { excluded: true, excludedReason: 'x', status: 'in_progress', completionPercentage: 0 } },
    });
    const res = await request(app)
      .delete(`/api/submissions/${sub._id}/standards/1/specs/a/not-applicable`)
      .set('Authorization', `Bearer ${signTokenFor(user as any)}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.excluded).toBe(false);

    const fresh: any = await Submission.findById(sub._id);
    const row = fresh.standardsStatus.get('1_a');
    expect(row?.excluded).toBeFalsy();
    expect(row?.excludedReason).toBeFalsy();
  });

  it('cross-institution PC cannot mark another PC\'s spec N/A (403)', async () => {
    const { user: owner } = await createUser({ role: 'program_coordinator' });
    const { user: intruder } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({ submitterId: owner._id });
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/standards/1/specs/a/not-applicable`)
      .set('Authorization', `Bearer ${signTokenFor(intruder as any)}`)
      .send({});
    expect(res.status).toBe(403);
  });

  it('rejects N/A on an unknown spec code (404)', async () => {
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({ submitterId: user._id });
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/standards/999/specs/zz/not-applicable`)
      .set('Authorization', `Bearer ${signTokenFor(user as any)}`)
      .send({});
    expect(res.status).toBe(404);
  });

  it('submissionLockout middleware refuses N/A on a locked submission (403)', async () => {
    // The route is wrapped in submissionLockout — once the submission is
    // post-submit, a non-admin PC cannot toggle N/A.
    const { user } = await createUser({ role: 'program_coordinator' });
    const sub = await seedSubmission({ submitterId: user._id, status: 'submitted' });
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/standards/1/specs/a/not-applicable`)
      .set('Authorization', `Bearer ${signTokenFor(user as any)}`)
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('LOCKED');
  });

  it('admin can mark N/A even on a locked submission', async () => {
    const { user: admin } = await createUser({ role: 'admin' });
    const sub = await seedSubmission({ status: 'submitted' });
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/standards/1/specs/a/not-applicable`)
      .set('Authorization', `Bearer ${signTokenFor(admin as any)}`)
      .send({ reason: 'Reader-coordinated correction' });
    expect(res.status).toBe(200);
    expect(res.body.excluded).toBe(true);
  });
});
