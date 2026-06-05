/**
 * POST /api/submissions/:id/matrix-state — persist a matrix per-row edit.
 *
 * The endpoint existed but the client never called it (audit gap). Now the
 * store's retag/remove/restore actions POST here. Pins the persistence:
 *   1. A retag edit lands on aiMatrixState.matrixRowEdits and survives GET.
 *   2. edit:null (restore) removes it.
 *   3. Owner-only.
 */
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { createUser, signTokenFor } from '../helpers/factories';

let _c = 0;
async function seed(ownerId: any) {
  _c += 1;
  return (await Submission.create({
    submissionId: `MTX-${Date.now().toString(36)}-${_c}`,
    institutionName: 'Matrix U',
    programName: 'HS',
    programLevel: 'bachelors',
    submitterId: ownerId,
    type: 'initial',
    status: 'in_progress',
    aiMatrixState: { matrices: [], matrixRowEdits: {}, lastUpdatedAt: new Date() },
  })) as any;
}

describe('POST /matrix-state — per-row edit persistence', () => {
  it('persists a retag edit and survives a GET', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const sub = await seed(pc._id);
    const token = signTokenFor(pc as any);

    await request(app)
      .post(`/api/submissions/${sub._id}/matrix-state`)
      .set('Authorization', `Bearer ${token}`)
      .send({ matrixSlug: 'm1', rowAnchor: 'r1', edit: { kind: 'retag', newStd: '11', newSpec: 'a' } })
      .expect(200);

    const reload = await request(app)
      .get(`/api/submissions/${sub._id}/matrix-state`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const edits = reload.body.aiMatrixState?.matrixRowEdits ?? reload.body.matrixRowEdits ?? {};
    expect(edits['m1|r1']).toMatchObject({ kind: 'retag', newStd: '11', newSpec: 'a' });
  });

  it('edit:null removes the persisted row edit (restore)', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const sub = await seed(pc._id);
    const token = signTokenFor(pc as any);
    await request(app).post(`/api/submissions/${sub._id}/matrix-state`).set('Authorization', `Bearer ${token}`)
      .send({ matrixSlug: 'm1', rowAnchor: 'r1', edit: { kind: 'remove' } }).expect(200);
    await request(app).post(`/api/submissions/${sub._id}/matrix-state`).set('Authorization', `Bearer ${token}`)
      .send({ matrixSlug: 'm1', rowAnchor: 'r1', edit: null }).expect(200);

    const reload = await request(app)
      .get(`/api/submissions/${sub._id}/matrix-state`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(reload.body.aiMatrixState?.matrixRowEdits?.['m1|r1']).toBeUndefined();
  });

  it('a different PC cannot edit the matrix', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const { user: other } = await createUser({ role: 'program_coordinator' });
    const sub = await seed(pc._id);
    const res = await request(app)
      .post(`/api/submissions/${sub._id}/matrix-state`)
      .set('Authorization', `Bearer ${signTokenFor(other as any)}`)
      .send({ matrixSlug: 'm1', rowAnchor: 'r1', edit: { kind: 'remove' } });
    expect(res.status).toBeGreaterThanOrEqual(403);
  });
});
