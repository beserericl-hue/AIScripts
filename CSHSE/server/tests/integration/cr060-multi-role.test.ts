/**
 * CR-060 — multi-role per user (role-by-institution).
 *
 * One test path per requirement:
 *  - Admin can edit a user and assign roles (PUT /users/:id/role-assignments).
 *  - Rule 1: PC + reviewer at the SAME institution is rejected; PC@A + reader@B
 *    (cross-institution) is allowed.
 *  - Rule 2: multiple users may be PC at the same institution.
 *  - Enforcement: a PC at the submission's institution may edit/submit; a PC at a
 *    DIFFERENT institution may not; a SECOND PC of the same institution may.
 *  - Visibility: PC sees own-institution submissions; an assigned reviewer sees a
 *    submitted study, an unassigned one is 403'd; a PC@A+reader@B user sees BOTH
 *    A's drafts and B's assigned studies in the list.
 *  - getUsers is scoped to a PC's institution(s).
 *
 * Each test seeds + asserts within itself (tests/setup.ts wipes collections
 * between tests).
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { Institution } from '../../src/models/Institution';
import { Assignment } from '../../src/models/Assignment';
import { User } from '../../src/models/User';
import { createUser, signTokenFor } from '../helpers/factories';

let _c = 0;

async function makeInstitution(name: string) {
  _c += 1;
  return Institution.create({
    name: `${name}-${Date.now().toString(36)}-${_c}`,
    type: 'university',
    address: { street: '1 Test St', city: 'Test', state: 'CA', zip: '90000', country: 'USA' },
    primaryContact: { name: 'Admin', email: 'admin@test.local', phone: '555-0100' },
  });
}

async function makeSubmission(institution: any, status = 'draft', submitterId?: any) {
  _c += 1;
  return Submission.create({
    submissionId: `CR060-${Date.now().toString(36)}-${_c}`,
    institutionName: institution.name,
    institutionId: institution._id,
    programName: 'Human Services',
    programLevel: 'bachelors',
    submitterId: submitterId ?? (await createUser({ role: 'program_coordinator' })).user._id,
    type: 'initial',
    status,
  });
}

/** Create a user and stamp per-institution role assignments. */
async function userWithRoles(assignments: Array<{ role: string; institutionId: any }>, role = 'program_coordinator') {
  const { user } = await createUser({ role: role as any });
  (user as any).roleAssignments = assignments.map((a) => ({ role: a.role, institutionId: a.institutionId }));
  await user.save();
  return user;
}

async function admin() {
  const { user } = await createUser({ role: 'admin' });
  return { user, token: signTokenFor(user) };
}

describe('CR-060 — multi-role per user', () => {
  // ---- Requirement: admin edits a user + assigns roles (cross-institution) ----
  it('admin assigns PC@A + Reader@B to one user (cross-institution allowed)', async () => {
    const { token } = await admin();
    const A = await makeInstitution('A');
    const B = await makeInstitution('B');
    const { user } = await createUser({ role: 'reader' });

    const res = await request(app)
      .put(`/api/users/${user._id}/role-assignments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ roleAssignments: [
        { role: 'program_coordinator', institutionId: A._id },
        { role: 'reader', institutionId: B._id },
      ] });

    expect(res.status).toBe(200);
    const saved = await User.findById(user._id).lean();
    const pairs = (saved!.roleAssignments || []).map((a: any) => `${a.role}@${a.institutionId}`);
    expect(pairs).toContain(`program_coordinator@${A._id}`);
    expect(pairs).toContain(`reader@${B._id}`);
  });

  // ---- Requirement: Rule 1 — no PC + reviewer in the SAME institution ----
  it('rejects PC + Reader at the SAME institution (Rule 1)', async () => {
    const { token } = await admin();
    const A = await makeInstitution('A');
    const { user } = await createUser({ role: 'reader' });

    const res = await request(app)
      .put(`/api/users/${user._id}/role-assignments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ roleAssignments: [
        { role: 'program_coordinator', institutionId: A._id },
        { role: 'reader', institutionId: A._id },
      ] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/same institution/i);
  });

  // ---- Requirement: Rule 2 — multiple PCs per institution ----
  it('allows multiple users to be PC at the same institution (Rule 2)', async () => {
    const { token } = await admin();
    const A = await makeInstitution('A');
    const { user: u1 } = await createUser({ role: 'program_coordinator' });
    const { user: u2 } = await createUser({ role: 'program_coordinator' });

    for (const u of [u1, u2]) {
      const r = await request(app)
        .put(`/api/users/${u._id}/role-assignments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ roleAssignments: [{ role: 'program_coordinator', institutionId: A._id }] });
      expect(r.status).toBe(200);
    }
    const pcs = await User.find({ 'roleAssignments.role': 'program_coordinator', 'roleAssignments.institutionId': A._id });
    expect(pcs.length).toBe(2);
  });

  // ---- Enforcement: PC-at-institution may edit; other PC may not; 2nd PC may ----
  it('PC@A edits A’s narrative; PC@B is 403; a second PC@A succeeds', async () => {
    const A = await makeInstitution('A');
    const B = await makeInstitution('B');
    const sub = await makeSubmission(A, 'draft');

    const pcA = await userWithRoles([{ role: 'program_coordinator', institutionId: A._id }]);
    const pcA2 = await userWithRoles([{ role: 'program_coordinator', institutionId: A._id }]);
    const pcB = await userWithRoles([{ role: 'program_coordinator', institutionId: B._id }]);

    const body = { standardCode: '1', specCode: 'a', content: '<p>hello</p>' };

    const rA = await request(app).patch(`/api/submissions/${sub._id}/narrative`)
      .set('Authorization', `Bearer ${signTokenFor(pcA)}`).send(body);
    expect(rA.status).toBe(200);

    const rB = await request(app).patch(`/api/submissions/${sub._id}/narrative`)
      .set('Authorization', `Bearer ${signTokenFor(pcB)}`).send(body);
    expect(rB.status).toBe(403);

    const rA2 = await request(app).patch(`/api/submissions/${sub._id}/narrative`)
      .set('Authorization', `Bearer ${signTokenFor(pcA2)}`).send(body);
    expect(rA2.status).toBe(200);
  });

  // ---- Visibility: PC list scoped to own institution ----
  it('PC@A sees A’s submissions in the list but not B’s', async () => {
    const A = await makeInstitution('A');
    const B = await makeInstitution('B');
    const subA = await makeSubmission(A, 'draft');
    await makeSubmission(B, 'draft');
    const pcA = await userWithRoles([{ role: 'program_coordinator', institutionId: A._id }]);

    const res = await request(app).get('/api/submissions')
      .set('Authorization', `Bearer ${signTokenFor(pcA)}`);
    expect(res.status).toBe(200);
    const ids = (res.body.submissions || res.body || []).map((s: any) => String(s._id));
    expect(ids).toContain(String(subA._id));
    expect(ids.length).toBe(1);
  });

  // ---- Visibility: assigned reviewer sees a submitted study; unassigned 403 ----
  it('an assigned reader can GET a submitted study; an unassigned reader cannot', async () => {
    const B = await makeInstitution('B');
    const sub = await makeSubmission(B, 'submitted');
    const readerB = await userWithRoles([{ role: 'reader', institutionId: B._id }], 'reader');
    const otherReader = await userWithRoles([{ role: 'reader', institutionId: B._id }], 'reader');
    await Assignment.create({
      submissionId: sub._id, institutionId: B._id, institutionName: B.name,
      userId: readerB._id, userName: 'R', userEmail: 'r@test.local',
      assignmentType: 'reader', assignedBy: readerB._id, assignedByName: 'sys', assignedByRole: 'admin',
      status: 'active', notificationSent: false,
    });

    const ok = await request(app).get(`/api/submissions/${sub._id}`)
      .set('Authorization', `Bearer ${signTokenFor(readerB)}`);
    expect(ok.status).toBe(200);

    const denied = await request(app).get(`/api/submissions/${sub._id}`)
      .set('Authorization', `Bearer ${signTokenFor(otherReader)}`);
    expect(denied.status).toBe(403);
  });

  // ---- Visibility: a cross-role user sees BOTH scopes ----
  it('a PC@A + Reader@B user sees A’s drafts AND B’s assigned study', async () => {
    const A = await makeInstitution('A');
    const B = await makeInstitution('B');
    const draftA = await makeSubmission(A, 'draft');
    const submittedB = await makeSubmission(B, 'submitted');
    const cross = await userWithRoles([
      { role: 'program_coordinator', institutionId: A._id },
      { role: 'reader', institutionId: B._id },
    ]);
    await Assignment.create({
      submissionId: submittedB._id, institutionId: B._id, institutionName: B.name,
      userId: cross._id, userName: 'X', userEmail: 'x@test.local',
      assignmentType: 'reader', assignedBy: cross._id, assignedByName: 'sys', assignedByRole: 'admin',
      status: 'active', notificationSent: false,
    });

    const res = await request(app).get('/api/submissions')
      .set('Authorization', `Bearer ${signTokenFor(cross)}`);
    expect(res.status).toBe(200);
    const ids = (res.body.submissions || res.body || []).map((s: any) => String(s._id));
    expect(ids).toContain(String(draftA._id));      // PC scope (draft)
    expect(ids).toContain(String(submittedB._id));  // reader scope (assigned, submitted)
  });

  // ---- getUsers scoped to a PC's institution ----
  it('a PC sees only users at their institution via GET /users', async () => {
    const A = await makeInstitution('A');
    const B = await makeInstitution('B');
    const pcA = await userWithRoles([{ role: 'program_coordinator', institutionId: A._id }]);
    (pcA as any).institutionId = A._id; await pcA.save();
    await createUser({ role: 'program_coordinator', institutionId: String(A._id) }); // same inst
    await createUser({ role: 'program_coordinator', institutionId: String(B._id) }); // other inst

    const res = await request(app).get('/api/users')
      .set('Authorization', `Bearer ${signTokenFor(pcA)}`);
    expect(res.status).toBe(200);
    const insts = (res.body.users || []).map((u: any) => String(u.institutionId));
    expect(insts.every((i: string) => i === String(A._id))).toBe(true);
  });
});
