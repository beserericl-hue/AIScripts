/** The institutions list carries reader names (the dashboard's deadlines table shows them). */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { Institution } from '../../src/models/Institution';
import { createUser, signTokenFor } from '../helpers/factories';

describe('GET /api/institutions — readers', () => {
  it('POSITIVE: assigned readers come back with their names, not bare ids', async () => {
    const { user: admin } = await createUser({ role: 'admin' });
    const { user: r1 } = await createUser({ role: 'reader', firstName: 'Ada', lastName: 'Reader' });
    const name = `Readers U ${Date.now()}`;
    await Institution.create({
      name, type: 'university',
      address: { street: '1 Test St', city: 'Test', state: 'CA', zip: '90000', country: 'USA' },
      primaryContact: { name: 'Admin', email: 'admin@test.local', phone: '555-0100' },
      assignedReaderIds: [r1._id],
    } as any);
    const res = await request(app).get('/api/institutions?limit=500').set('Authorization', `Bearer ${signTokenFor(admin as any)}`);
    expect(res.status).toBe(200);
    const inst = (res.body.institutions || []).find((i: any) => i.name === name);
    expect(inst.assignedReaderIds[0]).toMatchObject({ firstName: 'Ada', lastName: 'Reader' });
  });
  it('NEGATIVE: an institution with no readers returns an empty list (nothing to print)', async () => {
    const { user: admin } = await createUser({ role: 'admin' });
    const name = `No Readers U ${Date.now()}`;
    await Institution.create({
      name, type: 'university',
      address: { street: '1 Test St', city: 'Test', state: 'CA', zip: '90000', country: 'USA' },
      primaryContact: { name: 'Admin', email: 'admin@test.local', phone: '555-0100' },
    } as any);
    const res = await request(app).get('/api/institutions?limit=500').set('Authorization', `Bearer ${signTokenFor(admin as any)}`);
    const inst = (res.body.institutions || []).find((i: any) => i.name === name);
    expect(inst.assignedReaderIds || []).toEqual([]);
  });
});
