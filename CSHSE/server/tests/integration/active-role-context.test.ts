/**
 * Multi-role ACTIVE CONTEXT — a user who is Program Coordinator at A and Reader
 * at B (typical of CSHSE board members) picks the role they are working as; the
 * client sends X-Active-Role + X-Active-Institution-Id.
 *
 * Positive:
 *  - reader@B context → reader-only actions on B succeed (comment create), and
 *    the submissions list shows only B's assigned study.
 *  - PC@A context → the list shows only A's own studies.
 *  - ?institutionId=A (no header) never returns B's assigned study — the
 *    "Guttman dashboard shows AACC's submission" leak.
 *  - superuser viewing as the multi-role user can switch context too.
 *  - login returns roleAssignments so the switcher is available immediately.
 * Negative (never elevates):
 *  - a context the user doesn't hold (reader@A, PC@B), admin, a bogus
 *    institution, or a half-specified header is ignored → primary role applies.
 *  - role-only superuser impersonation ignores the header.
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { Institution } from '../../src/models/Institution';
import { Assignment } from '../../src/models/Assignment';
import { createUser, signTokenFor } from '../helpers/factories';

let _c = 0;
async function makeInstitution(name: string) {
  _c += 1;
  return Institution.create({
    name: `${name}-${Date.now().toString(36)}-${_c}`,
    type: 'college',
    address: { street: '1 Test St', city: 'Test', state: 'MD', zip: '21000', country: 'USA' },
    primaryContact: { name: 'Admin', email: 'admin@test.local', phone: '555-0100' },
  });
}
async function makeSubmission(inst: any, status = 'draft') {
  _c += 1;
  return Submission.create({
    submissionId: `ARC-${Date.now().toString(36)}-${_c}`,
    institutionName: inst.name, institutionId: inst._id,
    programName: 'Human Services', programLevel: 'associate',
    submitterId: (await createUser({ role: 'program_coordinator' })).user._id,
    type: 'initial', status,
  });
}

/** PC@A (primary) + Reader@B with an active Assignment on B's submitted study. */
async function boardMember() {
  const A = await makeInstitution('Guttman');
  const B = await makeInstitution('AACC');
  const draftA = await makeSubmission(A, 'draft');
  const subB = await makeSubmission(B, 'submitted');
  const { user } = await createUser({ role: 'program_coordinator', institutionId: String(A._id) });
  (user as any).roleAssignments = [
    { role: 'reader', institutionId: B._id, institutionName: B.name },
    { role: 'program_coordinator', institutionId: A._id, institutionName: A.name },
  ];
  await user.save();
  await Assignment.create({
    submissionId: subB._id, institutionId: B._id, institutionName: B.name,
    userId: user._id, userName: 'Nicole', userEmail: user.email,
    assignmentType: 'reader', assignedBy: user._id, assignedByName: 'sys', assignedByRole: 'admin',
    status: 'active', notificationSent: false,
  });
  // Mirror production: the assigned reader is also on the study's reader list.
  (subB as any).assignedReaders = [user._id];
  await subB.save();
  return { A, B, draftA, subB, user, token: signTokenFor(user) };
}

const ids = (res: any) => (res.body.submissions || res.body || []).map((s: any) => String(s._id));
const comment = { standardCode: '1', specCode: 'a', selectedText: 'x', selectionStart: 0, selectionEnd: 1, content: 'Reader note' };

describe('Multi-role active context (X-Active-Role / X-Active-Institution-Id)', () => {
  // ---------------- positive ----------------
  it('reader@B context lets a PC-primary user comment on B as a reader', async () => {
    const { B, subB, token } = await boardMember();
    const res = await request(app).post(`/api/submissions/${subB._id}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Active-Role', 'reader').set('X-Active-Institution-Id', String(B._id))
      .send(comment);
    if (![200, 201].includes(res.status)) console.log('BODY', res.status, JSON.stringify(res.body));
    expect([200, 201]).toContain(res.status);
  });

  it('reader@B context lists only B’s assigned study', async () => {
    const { B, draftA, subB, token } = await boardMember();
    const res = await request(app).get('/api/submissions')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Active-Role', 'reader').set('X-Active-Institution-Id', String(B._id));
    expect(res.status).toBe(200);
    expect(ids(res)).toContain(String(subB._id));
    expect(ids(res)).not.toContain(String(draftA._id));
  });

  it('PC@A context lists only A’s own studies', async () => {
    const { A, draftA, subB, token } = await boardMember();
    const res = await request(app).get('/api/submissions')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Active-Role', 'program_coordinator').set('X-Active-Institution-Id', String(A._id));
    expect(res.status).toBe(200);
    expect(ids(res)).toContain(String(draftA._id));
    expect(ids(res)).not.toContain(String(subB._id));
  });

  it('?institutionId=A without a header never returns B’s assigned study (dashboard leak)', async () => {
    const { A, draftA, subB, token } = await boardMember();
    const res = await request(app).get(`/api/submissions?institutionId=${A._id}&limit=1`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(ids(res)).not.toContain(String(subB._id));
    expect(ids(res)).toEqual([String(draftA._id)]);
  });

  it('PC institution with no study yet returns an empty list, not another institution’s study', async () => {
    const { A, subB, token } = await boardMember();
    await Submission.deleteMany({ institutionId: A._id });
    const res = await request(app).get(`/api/submissions?institutionId=${A._id}&limit=1`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(ids(res)).not.toContain(String(subB._id));
    expect(ids(res)).toEqual([]);
  });

  it('no header keeps the existing union (both scopes) — backwards compatible', async () => {
    const { draftA, subB, token } = await boardMember();
    const res = await request(app).get('/api/submissions').set('Authorization', `Bearer ${token}`);
    expect(ids(res)).toEqual(expect.arrayContaining([String(draftA._id), String(subB._id)]));
  });

  it('a superuser viewing as the board member can switch to reader@B too', async () => {
    const { B, subB, user } = await boardMember();
    const { user: su } = await createUser({ role: 'admin', isSuperuser: true });
    const res = await request(app).post(`/api/submissions/${subB._id}/comments`)
      .set('Authorization', `Bearer ${signTokenFor(su)}`)
      .set('X-Impersonated-Role', 'program_coordinator').set('X-Impersonated-User-Id', String(user._id))
      .set('X-Active-Role', 'reader').set('X-Active-Institution-Id', String(B._id))
      .send(comment);
    if (![200, 201].includes(res.status)) console.log('BODY', res.status, JSON.stringify(res.body));
    expect([200, 201]).toContain(res.status);
  });

  it('login returns roleAssignments so the switcher is available immediately', async () => {
    const A = await makeInstitution('A'); const B = await makeInstitution('B');
    const { user, password } = await createUser({ role: 'program_coordinator', institutionId: String(A._id) }) as any;
    (user as any).roleAssignments = [{ role: 'program_coordinator', institutionId: A._id }, { role: 'reader', institutionId: B._id }];
    await user.save();
    const res = await request(app).post('/api/auth/login').send({ email: user.email, password: password || 'test-password-1234' });
    expect(res.status).toBe(200);
    expect((res.body.user.roleAssignments || []).map((a: any) => a.role).sort()).toEqual(['program_coordinator', 'reader']);
  });

  // ---------------- negative ----------------
  it('primary PC role (no header) still cannot comment as a reader', async () => {
    const { subB, token } = await boardMember();
    const res = await request(app).post(`/api/submissions/${subB._id}/comments`)
      .set('Authorization', `Bearer ${token}`).send(comment);
    expect(res.status).toBe(403);
  });

  it.each([
    ['reader at the PC institution (not held)', (c: any) => ['reader', String(c.A._id)]],
    ['PC at the reader institution (not held)', (c: any) => ['program_coordinator', String(c.B._id)]],
    ['admin (never an assignment)', (c: any) => ['admin', String(c.B._id)]],
    ['a bogus institution', () => ['reader', '64b000000000000000000000']],
  ])('forged context — %s — is ignored and grants nothing', async (_label, pick) => {
    const ctx = await boardMember();
    const [role, inst] = (pick as any)(ctx);
    const res = await request(app).post(`/api/submissions/${ctx.subB._id}/comments`)
      .set('Authorization', `Bearer ${ctx.token}`)
      .set('X-Active-Role', role).set('X-Active-Institution-Id', inst)
      .send(comment);
    expect(res.status).toBe(403);
  });

  it('a half-specified header (role only) is ignored', async () => {
    const { subB, token } = await boardMember();
    const res = await request(app).post(`/api/submissions/${subB._id}/comments`)
      .set('Authorization', `Bearer ${token}`).set('X-Active-Role', 'reader').send(comment);
    expect(res.status).toBe(403);
  });

  it('forged admin context does not open admin-only data', async () => {
    const { B, token } = await boardMember();
    const res = await request(app).get('/api/admin/audit-log?limit=5')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Active-Role', 'admin').set('X-Active-Institution-Id', String(B._id));
    expect([401, 403]).toContain(res.status);
  });

  it('role-only superuser impersonation ignores the active-context header', async () => {
    const { B, subB } = await boardMember();
    const { user: su } = await createUser({ role: 'admin', isSuperuser: true });
    const res = await request(app).get('/api/submissions')
      .set('Authorization', `Bearer ${signTokenFor(su)}`)
      .set('X-Impersonated-Role', 'program_coordinator')
      .set('X-Active-Role', 'reader').set('X-Active-Institution-Id', String(B._id));
    expect(res.status).toBe(200);
    expect(ids(res)).not.toContain(String(subB._id));
  });
});
