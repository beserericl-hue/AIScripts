/**
 * Settings → Users search runs on the server across every user (not just the
 * loaded page) and never escapes the caller's role-based scope.
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/index';
import { createUser, signTokenFor } from '../helpers/factories';

const tag = () => `Zq${Date.now().toString(36)}${Math.floor(Math.random() * 1e5)}`;

describe('GET /api/users?search=', () => {
  it('POSITIVE: finds a user who is not on the first page, by name words in any order or by email', async () => {
    const { user: admin } = await createUser({ role: 'admin' });
    const t = tag();
    // 3 decoys sort before the target; with limit=2 the target is not on page 1
    for (let i = 0; i < 3; i++) await createUser({ role: 'reader', firstName: 'Aaa', lastName: `${t}Decoy${i}` });
    const { user: target } = await createUser({ role: 'reader', firstName: 'Reader', lastName: `${t}Two`, email: `${t.toLowerCase()}@example.org` });
    const tok = `Bearer ${signTokenFor(admin as any)}`;
    const page1 = await request(app).get(`/api/users?limit=2&search=${t}`).set('Authorization', tok);
    expect(page1.body.pagination.total).toBe(4);

    const byName = await request(app).get(`/api/users?limit=2&search=${encodeURIComponent(`${t}Two reader`)}`).set('Authorization', tok);
    expect(byName.status).toBe(200);
    expect(byName.body.users.map((u: any) => String(u._id))).toEqual([String(target._id)]);
    const byEmail = await request(app).get(`/api/users?search=${t.toLowerCase()}@example`).set('Authorization', tok);
    expect(byEmail.body.users.map((u: any) => String(u._id))).toEqual([String(target._id)]);
  });

  it('NEGATIVE: regex characters are literal, and no match returns an empty list (not an error)', async () => {
    const { user: admin } = await createUser({ role: 'admin' });
    const tok = `Bearer ${signTokenFor(admin as any)}`;
    const r = await request(app).get(`/api/users?search=${encodeURIComponent('.*(')}`).set('Authorization', tok);
    expect(r.status).toBe(200);
    expect(r.body.users).toEqual([]);
  });

  it('NEGATIVE: a coordinator searching for an admin outside their institution finds nothing', async () => {
    const inst = new mongoose.Types.ObjectId();
    const { user: pc } = await createUser({ role: 'program_coordinator', institutionId: inst as any });
    (pc as any).roleAssignments = [{ role: 'program_coordinator', institutionId: inst }];
    await pc.save();
    const t = tag();
    await createUser({ role: 'admin', firstName: 'Hidden', lastName: `${t}Admin` });
    const r = await request(app).get(`/api/users?search=${t}`).set('Authorization', `Bearer ${signTokenFor(pc as any)}`);
    expect(r.status).toBe(200);
    expect(r.body.users).toEqual([]);
  });
});
