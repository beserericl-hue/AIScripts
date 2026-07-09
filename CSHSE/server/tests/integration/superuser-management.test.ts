/**
 * Superuser management — grant/revoke superuser from the admin role screen.
 *
 * Endpoints (all superuser-only, gated by requireSuperuser):
 *   GET    /api/users/superusers
 *   POST   /api/users/:id/superuser
 *   DELETE /api/users/:id/superuser
 *
 * Guards under test:
 *  - a plain admin (not superuser) is 403'd on all three.
 *  - a superuser can list, grant, and revoke.
 *  - grant makes the target a functional superuser (isSuperuser + admin role).
 *  - a superuser cannot revoke THEMSELVES (no accidental lockout).
 *  - the env-bootstrap superuser (SU_EMAIL) cannot be revoked here.
 *
 * tests/setup.ts wipes collections between tests; each test seeds its own.
 */
import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { User } from '../../src/models/User';
import { createUser, signTokenFor } from '../helpers/factories';

async function superuser(email?: string) {
  const { user } = await createUser({ role: 'admin', isSuperuser: true, ...(email ? { email } : {}) });
  return { user, token: signTokenFor(user) };
}
async function admin() {
  const { user } = await createUser({ role: 'admin', isSuperuser: false });
  return { user, token: signTokenFor(user) };
}

describe('Superuser management', () => {
  const prevSuEmail = process.env.SU_EMAIL;
  afterEach(() => {
    if (prevSuEmail === undefined) delete process.env.SU_EMAIL;
    else process.env.SU_EMAIL = prevSuEmail;
  });

  it('a plain admin (not superuser) is 403 on all superuser routes', async () => {
    const { token } = await admin();
    const { user: target } = await createUser({ role: 'reader' });

    const list = await request(app).get('/api/users/superusers').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(403);

    const grant = await request(app)
      .post(`/api/users/${target._id}/superuser`)
      .set('Authorization', `Bearer ${token}`);
    expect(grant.status).toBe(403);

    // The target must not have been escalated.
    const fresh = await User.findById(target._id).lean();
    expect(fresh?.isSuperuser).not.toBe(true);
  });

  it('a superuser lists superusers (including self)', async () => {
    const { user: su, token } = await superuser();
    const res = await request(app).get('/api/users/superusers').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const emails = (res.body.superusers || []).map((s: any) => s.email);
    expect(emails).toContain(su.email);
  });

  it('a superuser grants superuser — target becomes a functional superuser', async () => {
    const { token } = await superuser();
    const { user: target } = await createUser({ role: 'program_coordinator', isSuperuser: false });

    const res = await request(app)
      .post(`/api/users/${target._id}/superuser`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const fresh = await User.findById(target._id).lean();
    expect(fresh?.isSuperuser).toBe(true);
    expect(fresh?.role).toBe('admin');
  });

  it('a superuser revokes a granted superuser', async () => {
    const { token } = await superuser();
    const { user: target } = await createUser({ role: 'admin', isSuperuser: true });

    const res = await request(app)
      .delete(`/api/users/${target._id}/superuser`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const fresh = await User.findById(target._id).lean();
    expect(fresh?.isSuperuser).toBe(false);
  });

  it('a superuser cannot revoke their OWN superuser access', async () => {
    const { user: su, token } = await superuser();
    const res = await request(app)
      .delete(`/api/users/${su._id}/superuser`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);

    const fresh = await User.findById(su._id).lean();
    expect(fresh?.isSuperuser).toBe(true); // unchanged
  });

  it('the env-bootstrap superuser (SU_EMAIL) cannot be revoked here', async () => {
    const { token } = await superuser();
    const bootstrapEmail = `bootstrap-${Date.now()}@example.com`;
    process.env.SU_EMAIL = bootstrapEmail;
    const { user: boot } = await createUser({ role: 'admin', isSuperuser: true, email: bootstrapEmail });

    const res = await request(app)
      .delete(`/api/users/${boot._id}/superuser`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);

    const fresh = await User.findById(boot._id).lean();
    expect(fresh?.isSuperuser).toBe(true); // still a superuser
  });
});
