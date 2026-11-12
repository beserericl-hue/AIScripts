/**
 * CSHSE Board role — READ-ONLY access to COMPLETED Lead Reader Reports across
 * every institution (+ Word/PDF download). Nothing else.
 *
 * "Completed" = the submission has left lead review (status review_complete,
 * set by the lead's "Complete review & send to board", or a board decision
 * compliant / non_compliant).
 *
 * POSITIVE: board lists completed LRRs from several institutions, opens one,
 *   downloads DOCX + PDF; a reader+board user switches to "Board · CSHSE" via
 *   X-Active-Role and gets the same; admin can assign board via role-assignments.
 * NEGATIVE: board cannot see an incomplete LRR, cannot PUT/save an LRR, cannot
 *   use the lead LRR endpoints, cannot open the self-study editor / evidence /
 *   review state, cannot see reader reports, cannot list submissions; a board
 *   member acting as board loses their reader assignments; a PC / reader / lead
 *   cannot use the board endpoints; forged board header is ignored.
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { Submission } from '../../src/models/Submission';
import { Institution } from '../../src/models/Institution';
import { LeadReaderReport } from '../../src/models/LeadReaderReport';
import { User } from '../../src/models/User';
import { createUser, signTokenFor, assignToSubmission } from '../helpers/factories';

let _c = 0;
async function makeInstitution(name: string) {
  _c += 1;
  return Institution.create({
    name: `${name}-${_c}`,
    type: 'university',
    address: { street: '1 Test St', city: 'Test', state: 'CA', zip: '90000', country: 'USA' },
    primaryContact: { name: 'Admin', email: 'admin@test.local', phone: '555-0100' },
  });
}
async function makeSubmission(inst: any, status: string) {
  _c += 1;
  const pc = (await createUser({ role: 'program_coordinator', institutionId: String(inst._id) })).user;
  (pc as any).roleAssignments = [{ role: 'program_coordinator', institutionId: inst._id }];
  await pc.save();
  const sub = await Submission.create({
    submissionId: `BOARD-${_c}`,
    institutionName: inst.name,
    institutionId: inst._id,
    programName: 'Human Services',
    programLevel: 'bachelors',
    submitterId: pc._id,
    type: 'initial',
    status,
  });
  return { sub, pc };
}
const binary = (r: any) =>
  r.buffer(true).parse((res: any, cb: any) => {
    const chunks: Buffer[] = [];
    res.on('data', (c: Buffer) => chunks.push(c));
    res.on('end', () => cb(null, Buffer.concat(chunks)));
  });

async function boardUser() {
  const { user } = await createUser({ role: 'board', firstName: 'Bea', lastName: 'Board' });
  return { user, token: signTokenFor(user) };
}

async function seed() {
  const A = await makeInstitution('Alpha College');
  const B = await makeInstitution('Beta University');
  const done = await makeSubmission(A, 'review_complete');
  const decided = await makeSubmission(B, 'compliant');
  const inProgress = await makeSubmission(B, 'readers_assigned');
  await LeadReaderReport.create({ submissionId: done.sub._id, recommendation: 'conditional', programDescription: 'DONE-DESC' } as any);
  await LeadReaderReport.create({ submissionId: decided.sub._id, recommendation: 'accredit_no_conditions' } as any);
  await LeadReaderReport.create({ submissionId: inProgress.sub._id, recommendation: 'deny', programDescription: 'SECRET-WIP' } as any);
  return { A, B, done, decided, inProgress };
}

describe('Board role — completed Lead Reader Reports (positive)', () => {
  it('board lists ONLY completed LRRs across institutions', async () => {
    const s = await seed();
    const { token } = await boardUser();
    const res = await request(app).get('/api/board/lead-reader-reports').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const ids = res.body.reports.map((r: any) => r.submissionId).sort();
    expect(ids).toEqual([String(s.done.sub._id), String(s.decided.sub._id)].sort());
    const row = res.body.reports.find((r: any) => r.submissionId === String(s.done.sub._id));
    expect(row).toMatchObject({
      institutionName: s.A.name,
      programName: 'Human Services',
      programLevel: 'bachelors',
      status: 'review_complete',
      recommendation: 'conditional',
    });
    expect(row.completedAt).toBeTruthy();
  });

  it('board opens a completed LRR read-only and downloads DOCX + PDF', async () => {
    const s = await seed();
    const { token } = await boardUser();
    const get = await request(app)
      .get(`/api/board/lead-reader-reports/${s.done.sub._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(get.status).toBe(200);
    expect(get.body.readOnly).toBe(true);
    expect(get.body.system.institutionName).toBe(s.A.name);
    expect(get.body.report.programDescription).toBe('DONE-DESC');

    const docx = await binary(
      request(app).get(`/api/board/lead-reader-reports/${s.done.sub._id}/download?format=docx`).set('Authorization', `Bearer ${token}`)
    );
    expect(docx.status).toBe(200);
    expect(docx.headers['content-type']).toContain('wordprocessingml');
    expect(docx.body.slice(0, 2).toString()).toBe('PK');
    const pdf = await binary(
      request(app).get(`/api/board/lead-reader-reports/${s.decided.sub._id}/download?format=pdf`).set('Authorization', `Bearer ${token}`)
    );
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(pdf.body.slice(0, 4).toString()).toBe('%PDF');
  });

  it('a reader who is ALSO a board member switches to "Board · CSHSE" via the active-role headers', async () => {
    const s = await seed();
    const { user } = await createUser({ role: 'reader' });
    (user as any).roleAssignments = [{ role: 'reader', institutionId: s.B._id }];
    (user as any).isBoardMember = true;
    await user.save();
    const token = signTokenFor(user);
    // As a reader (no header) the board list is closed…
    const asReader = await request(app).get('/api/board/lead-reader-reports').set('Authorization', `Bearer ${token}`);
    expect(asReader.status).toBe(403);
    // …as Board · CSHSE it opens.
    const asBoard = await request(app)
      .get('/api/board/lead-reader-reports')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Active-Role', 'board')
      .set('X-Active-Institution-Id', 'cshse');
    expect(asBoard.status).toBe(200);
    expect(asBoard.body.reports).toHaveLength(2);
  });

  it('admin assigns / removes board membership through role-assignments', async () => {
    const { user: admin } = await createUser({ role: 'admin' });
    const { user } = await createUser({ role: 'reader' });
    const on = await request(app)
      .put(`/api/users/${user._id}/role-assignments`)
      .set('Authorization', `Bearer ${signTokenFor(admin)}`)
      .send({ roleAssignments: [], isBoardMember: true });
    expect(on.status).toBe(200);
    expect(on.body.user.isBoardMember).toBe(true);
    let fresh: any = await User.findById(user._id).lean();
    expect(fresh.role).toBe('board');
    expect(fresh.isBoardMember).toBe(true);
    const list = await request(app).get('/api/users?role=board').set('Authorization', `Bearer ${signTokenFor(admin)}`);
    expect(list.body.users.map((u: any) => String(u._id))).toContain(String(user._id));

    const off = await request(app)
      .put(`/api/users/${user._id}/role-assignments`)
      .set('Authorization', `Bearer ${signTokenFor(admin)}`)
      .send({ roleAssignments: [], isBoardMember: false });
    expect(off.status).toBe(200);
    fresh = await User.findById(user._id).lean();
    expect(fresh.role).not.toBe('board');
    expect(fresh.isBoardMember).toBe(false);
  });

  it('/api/auth/me reports isBoardMember for a board user', async () => {
    const { token } = await boardUser();
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(me.body.user.role).toBe('board');
    expect(me.body.user.isBoardMember).toBe(true);
  });
});

describe('Board role — everything else is closed (negative)', () => {
  it('board cannot open or download an INCOMPLETE LRR (404, no content leak)', async () => {
    const s = await seed();
    const { token } = await boardUser();
    const get = await request(app)
      .get(`/api/board/lead-reader-reports/${s.inProgress.sub._id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(get.status).toBe(404);
    expect(JSON.stringify(get.body)).not.toContain('SECRET-WIP');
    const dl = await request(app)
      .get(`/api/board/lead-reader-reports/${s.inProgress.sub._id}/download?format=pdf`)
      .set('Authorization', `Bearer ${token}`);
    expect(dl.status).toBe(404);
  });

  it('board cannot save (PUT) an LRR, nor use the lead/admin LRR endpoints', async () => {
    const s = await seed();
    const { token } = await boardUser();
    const put = await request(app)
      .put(`/api/submissions/${s.done.sub._id}/lead-reader-report`)
      .set('Authorization', `Bearer ${token}`)
      .send({ programDescription: 'HACKED' });
    expect(put.status).toBe(403);
    const lrr = await LeadReaderReport.findOne({ submissionId: s.done.sub._id }).lean();
    expect((lrr as any).programDescription).toBe('DONE-DESC');
    for (const path of [
      `/api/submissions/${s.done.sub._id}/lead-reader-report`,
      `/api/submissions/${s.done.sub._id}/lead-reader-report/download?format=pdf`,
      `/api/submissions/${s.done.sub._id}/site-visit-review`,
    ]) {
      const r = await request(app).get(path).set('Authorization', `Bearer ${token}`);
      expect(r.status, path).toBe(403);
    }
  });

  it('board cannot open the self-study editor, evidence, review state, or reader reports', async () => {
    const s = await seed();
    const { token } = await boardUser();
    const id = String(s.done.sub._id);
    for (const path of [
      `/api/submissions/${id}`,
      `/api/submissions/${id}/review`,
      `/api/submissions/${id}/progress`,
      `/api/evidence/submissions/${id}/evidence`,
      `/api/submissions/${id}/evidence`,
      `/api/reports/submission/${id}/reader-report-data`,
      `/api/reports/submission/${id}/reader-reports`,
      `/api/reports/submission/${id}/reader-report/download?format=pdf`,
    ]) {
      const r = await request(app).get(path).set('Authorization', `Bearer ${token}`);
      expect([403, 404], `${path} -> ${r.status}`).toContain(r.status);
    }
    const save = await request(app)
      .post(`/api/submissions/${id}/review/save-state`)
      .set('Authorization', `Bearer ${token}`)
      .send({ state: {} });
    expect([403, 404, 423]).toContain(save.status);
    // Default-deny: every non-board API route is 403 for a board session.
    const list = await request(app).get('/api/submissions').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(403);
    const users = await request(app).get('/api/users').set('Authorization', `Bearer ${token}`);
    expect(users.status).toBe(403);
    // …while the session plumbing still works.
    const notes = await request(app).get('/api/notifications/unread-count').set('Authorization', `Bearer ${token}`);
    expect(notes.status).toBe(200);
    const queue = await request(app).get('/api/board/queue').set('Authorization', `Bearer ${token}`);
    expect(queue.status).toBe(403);
  });

  it('a reader+board user ACTING AS BOARD loses their reader assignment access', async () => {
    const s = await seed();
    const { user } = await createUser({ role: 'reader' });
    (user as any).roleAssignments = [{ role: 'reader', institutionId: s.A._id }];
    (user as any).isBoardMember = true;
    await user.save();
    await assignToSubmission(s.done.sub, user, 'reader');
    const token = signTokenFor(user);
    const id = String(s.done.sub._id);
    // As reader they can open the study…
    const asReader = await request(app).get(`/api/submissions/${id}`).set('Authorization', `Bearer ${token}`);
    expect(asReader.status).toBe(200);
    // …as Board · CSHSE they cannot, and their reader report / list are hidden.
    const hdr = (r: any) => r.set('Authorization', `Bearer ${token}`).set('X-Active-Role', 'board').set('X-Active-Institution-Id', 'cshse');
    expect((await hdr(request(app).get(`/api/submissions/${id}`))).status).toBe(403);
    expect((await hdr(request(app).get(`/api/reports/submission/${id}/reader-report-data`))).status).toBe(403);
    expect((await hdr(request(app).get('/api/submissions'))).status).toBe(403);
    expect((await hdr(request(app).get('/api/reports/reader-dashboard'))).status).toBe(403);
  });

  it('PC / reader / lead reader cannot use the board endpoints; a forged board header is ignored', async () => {
    const s = await seed();
    const lead = (await createUser({ role: 'lead_reader' })).user;
    (lead as any).roleAssignments = [{ role: 'lead_reader', institutionId: s.A._id }];
    await lead.save();
    await assignToSubmission(s.done.sub, lead, 'lead_reader');
    for (const u of [s.done.pc, lead]) {
      const token = signTokenFor(u as any);
      const list = await request(app).get('/api/board/lead-reader-reports').set('Authorization', `Bearer ${token}`);
      expect(list.status).toBe(403);
      const forged = await request(app)
        .get('/api/board/lead-reader-reports')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Active-Role', 'board')
        .set('X-Active-Institution-Id', 'cshse');
      expect(forged.status).toBe(403);
      const one = await request(app)
        .get(`/api/board/lead-reader-reports/${s.done.sub._id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(one.status).toBe(403);
    }
  });

  it('a PC cannot grant themselves board membership', async () => {
    const s = await seed();
    const token = signTokenFor(s.done.pc as any);
    const r = await request(app)
      .put(`/api/users/${s.done.pc._id}/role-assignments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ roleAssignments: [], isBoardMember: true });
    expect(r.status).toBe(403);
    const fresh: any = await User.findById(s.done.pc._id).lean();
    expect(fresh.isBoardMember).not.toBe(true);
  });
});
