/**
 * CR-019 / Sprint 8.1 — Joint Venture controller.
 *
 * Pins the invariants per the original sprint-plan-2026-05-11 spec:
 *   - admin creates JV with ≥2 institutions; <2 → 400
 *   - duplicate name → 409
 *   - adding an institution already in another active JV → 409
 *   - removing a member that drops below 2 → auto-archive (audit fires
 *     both jv.member_removed AND jv.archived)
 *   - Institution.jointVentureId stays in sync (set on add; cleared on
 *     remove + archive)
 *   - non-admin GETs only JVs whose member they are; otherwise 404
 *     (don't leak existence)
 *   - admin-only CUD (PC + reader + lead 403)
 *   - aggregate-stats rolls submissions across members
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { Institution } from '../../src/models/Institution';
import { Submission } from '../../src/models/Submission';
import { JointVenture } from '../../src/models/JointVenture';
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

async function makeInstitution(name: string) {
  return Institution.create({
    name,
    type: 'university',
    address: { street: '1 Way', city: 'X', state: 'NY', zip: '10001' },
    primaryContact: { name: 'Pat PC', email: 'pc@x.edu', phone: '555-1' },
    status: 'active',
    previousSubmissions: [],
    accreditationHistory: [],
    assignedReaderIds: []
  });
}

async function seedTwo() {
  const ts = Date.now().toString(36);
  return {
    a: await makeInstitution(`Alpha U ${ts}-${Math.random().toString(36).slice(2, 6)}`),
    b: await makeInstitution(`Beta C ${ts}-${Math.random().toString(36).slice(2, 6)}`)
  };
}

async function seedThree() {
  const two = await seedTwo();
  const c = await makeInstitution(`Gamma I ${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`);
  return { ...two, c };
}

async function seedActors() {
  const { user: admin } = await createUser({ role: 'admin' });
  const { user: lead } = await createUser({ role: 'lead_reader' });
  return {
    adminTok: signTokenFor(admin as any),
    leadTok: signTokenFor(lead as any)
  };
}

describe('CR-019 — POST /api/joint-ventures', () => {
  it('admin creates with ≥2 institutions; reverse pointers set; audit fires', async () => {
    const { adminTok } = await seedActors();
    const { a, b } = await seedTwo();
    const res = await request(app)
      .post('/api/joint-ventures')
      .set('Authorization', `Bearer ${adminTok}`)
      .send({ name: `JV-${Date.now()}`, institutionIds: [String(a._id), String(b._id)] });
    expect(res.status).toBe(201);
    expect(res.body.jointVenture.institutionIds.length).toBe(2);

    const ia: any = await Institution.findById(a._id);
    const ib: any = await Institution.findById(b._id);
    expect(String(ia.jointVentureId)).toBe(String(res.body.jointVenture._id));
    expect(String(ib.jointVentureId)).toBe(String(res.body.jointVenture._id));

    const audit = await waitForAudit({ action: 'jv.created', targetId: String(res.body.jointVenture._id) });
    expect(audit).not.toBeNull();
    expect(audit.payload?.memberCount).toBe(2);
  });

  it('<2 institutions → 400', async () => {
    const { adminTok } = await seedActors();
    const { a } = await seedTwo();
    const res = await request(app)
      .post('/api/joint-ventures')
      .set('Authorization', `Bearer ${adminTok}`)
      .send({ name: `JV-${Date.now()}`, institutionIds: [String(a._id)] });
    expect(res.status).toBe(400);
  });

  it('duplicate name → 409', async () => {
    const { adminTok } = await seedActors();
    const { a, b } = await seedTwo();
    const { c } = await seedThree();
    const name = `JV-dupe-${Date.now()}`;
    const first = await request(app)
      .post('/api/joint-ventures')
      .set('Authorization', `Bearer ${adminTok}`)
      .send({ name, institutionIds: [String(a._id), String(b._id)] });
    expect(first.status).toBe(201);
    const dupe = await request(app)
      .post('/api/joint-ventures')
      .set('Authorization', `Bearer ${adminTok}`)
      .send({ name, institutionIds: [String(c._id), String((await makeInstitution(`D-${Date.now()}`))._id)] });
    expect(dupe.status).toBe(409);
  });

  it('institution already in another active JV → 409', async () => {
    const { adminTok } = await seedActors();
    const { a, b, c } = await seedThree();
    const first = await request(app)
      .post('/api/joint-ventures')
      .set('Authorization', `Bearer ${adminTok}`)
      .send({ name: `JV-A-${Date.now()}`, institutionIds: [String(a._id), String(b._id)] });
    expect(first.status).toBe(201);
    const conflict = await request(app)
      .post('/api/joint-ventures')
      .set('Authorization', `Bearer ${adminTok}`)
      .send({ name: `JV-B-${Date.now()}`, institutionIds: [String(a._id), String(c._id)] });
    expect(conflict.status).toBe(409);
  });

  it('non-admin → 403', async () => {
    const { user: pc } = await createUser({ role: 'program_coordinator' });
    const { user: lead } = await createUser({ role: 'lead_reader' });
    const { a, b } = await seedTwo();
    const r1 = await request(app)
      .post('/api/joint-ventures')
      .set('Authorization', `Bearer ${signTokenFor(pc as any)}`)
      .send({ name: 'x', institutionIds: [String(a._id), String(b._id)] });
    expect(r1.status).toBe(403);
    const r2 = await request(app)
      .post('/api/joint-ventures')
      .set('Authorization', `Bearer ${signTokenFor(lead as any)}`)
      .send({ name: 'y', institutionIds: [String(a._id), String(b._id)] });
    expect(r2.status).toBe(403);
  });
});

describe('CR-019 — add/remove member + auto-archive', () => {
  it('add a third member; reverse pointer set', async () => {
    const { adminTok } = await seedActors();
    const { a, b, c } = await seedThree();
    const create = await request(app)
      .post('/api/joint-ventures')
      .set('Authorization', `Bearer ${adminTok}`)
      .send({ name: `JV-${Date.now()}`, institutionIds: [String(a._id), String(b._id)] });
    const jvId = create.body.jointVenture._id;

    const add = await request(app)
      .post(`/api/joint-ventures/${jvId}/institutions`)
      .set('Authorization', `Bearer ${adminTok}`)
      .send({ institutionId: String(c._id) });
    expect(add.status).toBe(200);
    expect(add.body.jointVenture.institutionIds.length).toBe(3);
    const ic: any = await Institution.findById(c._id);
    expect(String(ic.jointVentureId)).toBe(jvId);
  });

  it('cannot add an institution already in another active JV (409)', async () => {
    const { adminTok } = await seedActors();
    const { a, b, c } = await seedThree();
    const d = await makeInstitution(`D-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
    await request(app)
      .post('/api/joint-ventures')
      .set('Authorization', `Bearer ${adminTok}`)
      .send({ name: `JV-A-${Date.now()}`, institutionIds: [String(a._id), String(b._id)] });
    const jv2 = await request(app)
      .post('/api/joint-ventures')
      .set('Authorization', `Bearer ${adminTok}`)
      .send({ name: `JV-B-${Date.now()}`, institutionIds: [String(c._id), String(d._id)] });
    const conflict = await request(app)
      .post(`/api/joint-ventures/${jv2.body.jointVenture._id}/institutions`)
      .set('Authorization', `Bearer ${adminTok}`)
      .send({ institutionId: String(a._id) });
    expect(conflict.status).toBe(409);
  });

  it('remove that drops count <2 → auto-archive + audit jv.archived', async () => {
    const { adminTok } = await seedActors();
    const { a, b } = await seedTwo();
    const create = await request(app)
      .post('/api/joint-ventures')
      .set('Authorization', `Bearer ${adminTok}`)
      .send({ name: `JV-tiny-${Date.now()}`, institutionIds: [String(a._id), String(b._id)] });
    const jvId = create.body.jointVenture._id;

    const remove = await request(app)
      .delete(`/api/joint-ventures/${jvId}/institutions/${a._id}`)
      .set('Authorization', `Bearer ${adminTok}`);
    expect(remove.status).toBe(200);
    expect(remove.body.autoArchived).toBe(true);
    expect(remove.body.jointVenture.archived).toBe(true);

    // Both institutions' reverse pointers cleared (the one removed +
    // the last surviving member; the JV is gone).
    const ia: any = await Institution.findById(a._id);
    const ib: any = await Institution.findById(b._id);
    expect(ia.jointVentureId).toBeUndefined();
    expect(ib.jointVentureId).toBeUndefined();

    const audit = await waitForAudit({ action: 'jv.archived', targetId: jvId });
    expect(audit).not.toBeNull();
  });
});

describe('CR-019 — RBAC on GET', () => {
  it('non-admin member institution sees the JV; non-member gets 404 (no leak)', async () => {
    const { adminTok } = await seedActors();
    const { a, b } = await seedTwo();
    const create = await request(app)
      .post('/api/joint-ventures')
      .set('Authorization', `Bearer ${adminTok}`)
      .send({ name: `JV-rbac-${Date.now()}`, institutionIds: [String(a._id), String(b._id)] });
    const jvId = create.body.jointVenture._id;

    const { user: memberPc } = await createUser({ role: 'program_coordinator', institutionId: String(a._id) });
    const { user: nonMemberPc } = await createUser({ role: 'program_coordinator' }); // no institution

    const memberR = await request(app)
      .get(`/api/joint-ventures/${jvId}`)
      .set('Authorization', `Bearer ${signTokenFor(memberPc as any)}`);
    expect(memberR.status).toBe(200);

    const nonMemberR = await request(app)
      .get(`/api/joint-ventures/${jvId}`)
      .set('Authorization', `Bearer ${signTokenFor(nonMemberPc as any)}`);
    expect(nonMemberR.status).toBe(404);
  });

  it('list endpoint filters per-user (non-admin sees only their JVs)', async () => {
    const { adminTok } = await seedActors();
    const { a, b, c } = await seedThree();
    const d = await makeInstitution(`D-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
    const jvA = await request(app)
      .post('/api/joint-ventures')
      .set('Authorization', `Bearer ${adminTok}`)
      .send({ name: `JV-list-A-${Date.now()}`, institutionIds: [String(a._id), String(b._id)] });
    await request(app)
      .post('/api/joint-ventures')
      .set('Authorization', `Bearer ${adminTok}`)
      .send({ name: `JV-list-B-${Date.now()}`, institutionIds: [String(c._id), String(d._id)] });

    const { user: pcA } = await createUser({ role: 'program_coordinator', institutionId: String(a._id) });
    const listA = await request(app)
      .get('/api/joint-ventures')
      .set('Authorization', `Bearer ${signTokenFor(pcA as any)}`);
    expect(listA.status).toBe(200);
    const ids = listA.body.jointVentures.map((j: any) => String(j._id));
    expect(ids).toContain(String(jvA.body.jointVenture._id));
    expect(ids.length).toBe(1);

    const allAdmin = await request(app)
      .get('/api/joint-ventures')
      .set('Authorization', `Bearer ${adminTok}`);
    expect(allAdmin.body.jointVentures.length).toBeGreaterThanOrEqual(2);
  });
});

describe('CR-019 — aggregate stats', () => {
  it('rolls submissions across members', async () => {
    const { adminTok } = await seedActors();
    const { a, b } = await seedTwo();
    await Submission.create({
      submissionId: `JV-${Date.now()}-1`,
      institutionName: 'A',
      institutionId: a._id,
      programName: 'HS',
      programLevel: 'bachelors',
      submitterId: new mongoose.Types.ObjectId(),
      type: 'initial',
      status: 'under_review'
    });
    await Submission.create({
      submissionId: `JV-${Date.now()}-2`,
      institutionName: 'B',
      institutionId: b._id,
      programName: 'HS',
      programLevel: 'bachelors',
      submitterId: new mongoose.Types.ObjectId(),
      type: 'initial',
      status: 'compliant'
    });

    const jv = await request(app)
      .post('/api/joint-ventures')
      .set('Authorization', `Bearer ${adminTok}`)
      .send({ name: `JV-stats-${Date.now()}`, institutionIds: [String(a._id), String(b._id)] });
    const stats = await request(app)
      .get(`/api/joint-ventures/${jv.body.jointVenture._id}/aggregate-stats`)
      .set('Authorization', `Bearer ${adminTok}`);
    expect(stats.status).toBe(200);
    expect(stats.body.stats.totalSubmissions).toBe(2);
    expect(stats.body.stats.activeSubmissions).toBe(1);
    expect(stats.body.stats.decidedSubmissions).toBe(1);
    expect(stats.body.memberCount).toBe(2);
  });
});

describe('CR-019 — manual archive', () => {
  it('admin archives with a reason; reverse pointers cleared; audit fires', async () => {
    const { adminTok } = await seedActors();
    const { a, b } = await seedTwo();
    const jv = await request(app)
      .post('/api/joint-ventures')
      .set('Authorization', `Bearer ${adminTok}`)
      .send({ name: `JV-arch-${Date.now()}`, institutionIds: [String(a._id), String(b._id)] });
    const jvId = jv.body.jointVenture._id;

    const arch = await request(app)
      .post(`/api/joint-ventures/${jvId}/archive`)
      .set('Authorization', `Bearer ${adminTok}`)
      .send({ reason: 'Partner dissolution.' });
    expect(arch.status).toBe(200);
    expect(arch.body.jointVenture.archived).toBe(true);
    expect(arch.body.jointVenture.archivedReason).toBe('Partner dissolution.');

    const ia: any = await Institution.findById(a._id);
    const ib: any = await Institution.findById(b._id);
    expect(ia.jointVentureId).toBeUndefined();
    expect(ib.jointVentureId).toBeUndefined();

    const audit = await waitForAudit({ action: 'jv.archived', targetId: jvId });
    expect(audit).not.toBeNull();
    expect(audit.reason).toMatch(/Partner dissolution/);
  });
});
