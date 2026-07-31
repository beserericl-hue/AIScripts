/**
 * PATCH /api/submissions/:id/program-level — correct a submission's degree level.
 *
 * Fixes the reported bug where an associate program stored as 'bachelors' (the
 * old blind import default) showed phantom subsection rows (Std 12 a–h instead
 * of a–f) and was graded against the baccalaureate rubric. Pins:
 *   1. Owner can set the level; it persists.
 *   2. Invalid levels are rejected.
 *   3. A different PC cannot change someone else's submission.
 */
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { createUser, signTokenFor } from '../helpers/factories';

let _c = 0;
async function seed(pcId: mongoose.Types.ObjectId, level = 'bachelors') {
  _c += 1;
  return (await Submission.create({
    submissionId: `PLV-${Date.now().toString(36)}-${_c}`,
    institutionName: 'Level U',
    programName: 'ASSOCIATE DEGREE IN HUMAN SERVICES',
    programLevel: level,
    submitterId: pcId,
    type: 'initial',
    status: 'in_progress',
  })) as any;
}

describe('PATCH /program-level', () => {
  it('owner corrects bachelors -> associate and it persists', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const sub = await seed(pc._id, 'bachelors');

    const res = await request(app)
      .patch(`/api/submissions/${sub._id}/program-level`)
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`)
      .send({ programLevel: 'associate' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, programLevel: 'associate', previous: 'bachelors' });

    const fresh: any = await Submission.findById(sub._id);
    expect(fresh.programLevel).toBe('associate');
  });

  it('rejects an invalid level', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const sub = await seed(pc._id);
    const res = await request(app)
      .patch(`/api/submissions/${sub._id}/program-level`)
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`)
      .send({ programLevel: 'phd' });
    expect(res.status).toBe(400);
  });

  it('a different PC cannot change someone else\'s submission', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const { user: other } = await createUser({ role: 'program_coordinator' });
    const sub = await seed(pc._id);
    const res = await request(app)
      .patch(`/api/submissions/${sub._id}/program-level`)
      .set('Authorization', `Bearer ${signTokenFor(other as any)}`)
      .send({ programLevel: 'associate' });
    expect(res.status).toBeGreaterThanOrEqual(403);
  });
});
