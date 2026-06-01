/**
 * CR-055 — assignReaders is the Assignment producer.
 *
 * Assignment is the access source-of-truth: listSubmissions, getSubmission and
 * getFinalScoresForReader all gate reader-shaped roles on an ACTIVE Assignment
 * record. Historically assignReaders created only Review docs +
 * submission.assignedReaders, so an assigned reader still 403'd on every read
 * path. This pins that POST /assign now reconciles Assignment docs.
 *
 * Pins:
 *   - assigning readers + a lead creates one ACTIVE Assignment per user, with
 *     the right assignmentType, and stamps submission.leadReader
 *   - re-assigning a different reader set marks dropped readers 'removed' and
 *     keeps/creates the new set 'active' (one active per user)
 *   - the lead reader's Assignment carries leadReaderId/leadReaderName
 *
 * Each test seeds + asserts within itself to survive the per-test collection
 * wipe in tests/setup.ts.
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { Assignment } from '../../src/models/Assignment';
import { createUser, signTokenFor } from '../helpers/factories';

let _c = 0;
async function seedSubmission(status = 'submitted'): Promise<any> {
  _c += 1;
  return Submission.create({
    submissionId: `CR055-${Date.now().toString(36)}-${_c}`,
    institutionName: 'Assignment U',
    programName: 'Human Services',
    programLevel: 'bachelors',
    submitterId: (await createUser({ role: 'program_coordinator' })).user._id,
    type: 'initial',
    status
  });
}

describe('CR-055 — POST /api/reviews/submissions/:id/assign creates Assignment docs', () => {
  it('creates one ACTIVE Assignment per reader + lead, with the right type and lead stamp', async () => {
    const { user: admin } = await createUser({ role: 'admin' });
    const { user: r1 } = await createUser({ role: 'reader', firstName: 'Reader', lastName: 'Alpha' });
    const { user: r2 } = await createUser({ role: 'reader', firstName: 'Reader', lastName: 'Bravo' });
    const { user: lead } = await createUser({ role: 'lead_reader', firstName: 'Lead', lastName: 'Reader' });
    const sub = await seedSubmission('submitted');

    const res = await request(app)
      .post(`/api/reviews/submissions/${String(sub._id)}/assign`)
      .send({ readerIds: [String(r1._id), String(r2._id), String(lead._id)], reason: 'initial reader panel' })
      .set('Authorization', `Bearer ${signTokenFor(admin as any)}`);

    expect(res.status).toBe(200);

    const active = await Assignment.find({ submissionId: sub._id, status: 'active' });
    expect(active.length).toBe(3);

    const byUser = (id: any) => active.find((a) => String(a.userId) === String(id));
    expect(byUser(r1._id)?.assignmentType).toBe('reader');
    expect(byUser(r2._id)?.assignmentType).toBe('reader');
    expect(byUser(lead._id)?.assignmentType).toBe('lead_reader');

    // Reader assignments carry the lead reader pointer.
    expect(String(byUser(r1._id)?.leadReaderId)).toBe(String(lead._id));
    expect(byUser(r1._id)?.leadReaderName).toBe('Lead Reader');

    // Submission records the lead + flips to readers_assigned.
    const fresh = await Submission.findById(sub._id);
    expect(String(fresh?.leadReader)).toBe(String(lead._id));
    expect(fresh?.status).toBe('readers_assigned');
  });

  it('re-assigning a new set removes the dropped reader and keeps one active per user', async () => {
    const { user: admin } = await createUser({ role: 'admin' });
    const { user: r1 } = await createUser({ role: 'reader', firstName: 'Reader', lastName: 'Alpha' });
    const { user: r2 } = await createUser({ role: 'reader', firstName: 'Reader', lastName: 'Bravo' });
    const { user: r3 } = await createUser({ role: 'reader', firstName: 'Reader', lastName: 'Charlie' });
    const sub = await seedSubmission('submitted');

    // First panel: r1 + r2.
    await request(app)
      .post(`/api/reviews/submissions/${String(sub._id)}/assign`)
      .send({ readerIds: [String(r1._id), String(r2._id)], reason: 'first panel' })
      .set('Authorization', `Bearer ${signTokenFor(admin as any)}`);

    // Re-assign: drop r2, add r3.
    const res = await request(app)
      .post(`/api/reviews/submissions/${String(sub._id)}/assign`)
      .send({ readerIds: [String(r1._id), String(r3._id)], reason: 'swap r2 for r3' })
      .set('Authorization', `Bearer ${signTokenFor(admin as any)}`);
    expect(res.status).toBe(200);

    const active = await Assignment.find({ submissionId: sub._id, status: 'active' });
    expect(active.map((a) => String(a.userId)).sort()).toEqual(
      [String(r1._id), String(r3._id)].sort()
    );

    // r2 is removed, not deleted.
    const r2doc = await Assignment.findOne({ submissionId: sub._id, userId: r2._id });
    expect(r2doc?.status).toBe('removed');
    expect(r2doc?.removalReason).toBeTruthy();

    // r1 keeps a single active record (re-activated/refreshed, not duplicated).
    const r1docs = await Assignment.find({ submissionId: sub._id, userId: r1._id, status: 'active' });
    expect(r1docs.length).toBe(1);
  });

  it('a lead_reader can assign on a not-yet-locked submission (no reason needed)', async () => {
    const { user: lead } = await createUser({ role: 'lead_reader' });
    const { user: r1 } = await createUser({ role: 'reader' });
    const sub = await seedSubmission('in_progress');

    const res = await request(app)
      .post(`/api/reviews/submissions/${String(sub._id)}/assign`)
      .send({ readerIds: [String(r1._id)] })
      .set('Authorization', `Bearer ${signTokenFor(lead as any)}`);
    expect(res.status).toBe(200);

    const active = await Assignment.find({ submissionId: sub._id, status: 'active' });
    expect(active.length).toBe(1);
    expect(String(active[0].userId)).toBe(String(r1._id));
  });
});
