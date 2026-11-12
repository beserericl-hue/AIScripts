/**
 * Institution lead-reader slot stays in step with the role-by-institution
 * roster: assigning via the slot also adds the lead_reader assignment; clearing
 * removes both. Admin only.
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { Institution } from '../../src/models/Institution';
import { User } from '../../src/models/User';
import { createUser, signTokenFor } from '../helpers/factories';

async function seed() {
  const inst: any = await Institution.create({
    name: `Slot U ${Date.now()}-${Math.random()}`,
    type: 'university',
    address: { street: '1 Test St', city: 'Test', state: 'CA', zip: '90000', country: 'USA' },
    primaryContact: { name: 'Admin', email: 'admin@test.local', phone: '555-0100' },
  } as any);
  const { user: admin } = await createUser({ role: 'admin' });
  const { user: lead } = await createUser({ role: 'lead_reader' });
  const { user: lead2 } = await createUser({ role: 'lead_reader' });
  return { inst, admin, lead, lead2 };
}
const leadAt = async (uid: any, instId: any) =>
  ((await User.findById(uid).lean()) as any).roleAssignments.some((a: any) => a.role === 'lead_reader' && String(a.institutionId) === String(instId));

describe('institution lead-reader slot ↔ roster', () => {
  it('POSITIVE: POST /lead-reader sets the slot AND adds the lead_reader assignment', async () => {
    const s = await seed();
    const r = await request(app).post(`/api/institutions/${s.inst._id}/lead-reader`).set('Authorization', `Bearer ${signTokenFor(s.admin as any)}`).send({ leadReaderId: String(s.lead._id) });
    expect(r.status).toBe(200);
    expect(String(((await Institution.findById(s.inst._id).lean()) as any).assignedLeadReaderId)).toBe(String(s.lead._id));
    expect(await leadAt(s.lead._id, s.inst._id)).toBe(true);
  });

  it('POSITIVE: DELETE /lead-reader clears the slot and that lead_reader assignment only', async () => {
    const s = await seed();
    const tok = `Bearer ${signTokenFor(s.admin as any)}`;
    await request(app).post(`/api/institutions/${s.inst._id}/lead-reader`).set('Authorization', tok).send({ leadReaderId: String(s.lead._id) });
    const d = await request(app).delete(`/api/institutions/${s.inst._id}/lead-reader`).set('Authorization', tok);
    expect(d.status).toBe(200);
    expect(((await Institution.findById(s.inst._id).lean()) as any).assignedLeadReaderId).toBeFalsy();
    expect(await leadAt(s.lead._id, s.inst._id)).toBe(false);
    expect(await leadAt(s.lead2._id, s.inst._id)).toBe(false);
  });

  it('NEGATIVE: a lead reader cannot clear or set the slot (admin only)', async () => {
    const s = await seed();
    const tok = `Bearer ${signTokenFor(s.lead as any)}`;
    expect((await request(app).delete(`/api/institutions/${s.inst._id}/lead-reader`).set('Authorization', tok)).status).toBe(403);
    expect((await request(app).post(`/api/institutions/${s.inst._id}/lead-reader`).set('Authorization', tok).send({ leadReaderId: String(s.lead._id) })).status).toBe(403);
  });
});
