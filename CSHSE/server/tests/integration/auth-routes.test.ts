import { describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../src/index';
import { createUser, signTokenFor } from '../helpers/factories';

describe('POST /api/auth/login', () => {
  it('returns a valid JWT for correct credentials', async () => {
    const { user, password } = await createUser({
      email: 'loginuser@example.com',
      password: 'super-secret-1',
      status: 'active',
    });

    const res = await request(app).post('/api/auth/login').send({
      email: 'loginuser@example.com',
      password,
    });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('loginuser@example.com');
    expect(res.body.user.id).toBe(user._id.toString());

    const decoded = jwt.verify(res.body.token, process.env.JWT_SECRET!) as any;
    expect(decoded.id).toBe(user._id.toString());
    expect(decoded.role).toBe(user.role);
  });

  it('matches email case-insensitively', async () => {
    await createUser({ email: 'mixed@example.com', password: 'pw1234567', status: 'active' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'MIXED@example.com', password: 'pw1234567' });
    expect(res.status).toBe(200);
  });

  it('returns 401 for wrong password (and never confirms the email exists)', async () => {
    await createUser({ email: 'real@example.com', password: 'correct', status: 'active' });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'real@example.com', password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid/i);
  });

  it('returns 401 for unknown user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'anything' });
    expect(res.status).toBe(401);
  });

  it('rejects login for disabled accounts', async () => {
    await createUser({
      email: 'disabled@example.com',
      password: 'pw',
      status: 'disabled',
      isActive: false,
    });
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'disabled@example.com', password: 'pw' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/disabled/i);
  });

  it('returns 400 when email or password is missing', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.com' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  it('returns the authenticated user when given a valid token', async () => {
    const { user } = await createUser({ email: 'me@example.com', status: 'active' });
    const token = signTokenFor(user);

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('me@example.com');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 for a forged token signed with a different secret', async () => {
    const forged = (jwt as any).sign({ id: 'whatever', role: 'admin' }, 'not-the-real-secret');
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/auth/change-password', () => {
  it('lets a user change their own password', async () => {
    const { user } = await createUser({ email: 'self@example.com', password: 'old1234567', status: 'active' });
    const token = signTokenFor(user);

    const res = await request(app)
      .put('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ newPassword: 'new1234567' });

    expect(res.status).toBe(200);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'self@example.com', password: 'new1234567' });
    expect(login.status).toBe(200);
  });

  it('rejects a non-admin user trying to change another user\'s password', async () => {
    const { user: target } = await createUser({ email: 'target@example.com', status: 'active' });
    const { user: actor } = await createUser({
      email: 'actor@example.com',
      role: 'reader',
      status: 'active',
    });
    const token = signTokenFor(actor);

    const res = await request(app)
      .put('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ newPassword: 'new1234567', userId: target._id.toString() });

    expect(res.status).toBe(403);
  });

  it('rejects passwords shorter than 8 characters', async () => {
    const { user } = await createUser({ status: 'active' });
    const token = signTokenFor(user);
    const res = await request(app)
      .put('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ newPassword: 'short' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/logout', () => {
  // NOTE — Documents the current (insecure) behavior. JWTs are stateless and
  // the server returns success without invalidating the token. See the
  // 2026-05-10 security audit, finding H2.
  it('returns 200 but does NOT invalidate the token (known issue)', async () => {
    const { user } = await createUser({ status: 'active' });
    const token = signTokenFor(user);

    const logoutRes = await request(app).post('/api/auth/logout');
    expect(logoutRes.status).toBe(200);

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(meRes.status).toBe(200);
  });
});

describe('GET /api/auth/me — preferences (CR-045)', () => {
  it('defaults hideLegacyImporter to true when the user has no preferences', async () => {
    const { user } = await createUser({ status: 'active' });
    const token = signTokenFor(user);
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    // CR-052 widened the echoed preferences blob with `tours: {}` (empty
    // by default). Defaults: hideLegacyImporter=true, tours={}.
    expect(res.body.user.preferences).toEqual({
      hideLegacyImporter: true,
      tours: {},
    });
  });
});

describe('PATCH /api/auth/me/preferences (CR-045)', () => {
  it('persists hideLegacyImporter=false and reflects it on next GET /me', async () => {
    const { user } = await createUser({ status: 'active' });
    const token = signTokenFor(user);

    const patch = await request(app)
      .patch('/api/auth/me/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ hideLegacyImporter: false });
    expect(patch.status).toBe(200);
    expect(patch.body.ok).toBe(true);
    // CR-052 — echoed blob now includes `tours: {}` (empty by default).
    expect(patch.body.preferences).toEqual({
      hideLegacyImporter: false,
      tours: {},
    });

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(me.body.user.preferences.hideLegacyImporter).toBe(false);
  });

  it('can toggle back to true', async () => {
    const { user } = await createUser({ status: 'active' });
    const token = signTokenFor(user);
    await request(app)
      .patch('/api/auth/me/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ hideLegacyImporter: false });
    const back = await request(app)
      .patch('/api/auth/me/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ hideLegacyImporter: true });
    expect(back.body.preferences.hideLegacyImporter).toBe(true);
  });

  it('rejects a non-boolean value with 400', async () => {
    const { user } = await createUser({ status: 'active' });
    const token = signTokenFor(user);
    const res = await request(app)
      .patch('/api/auth/me/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ hideLegacyImporter: 'yes' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/boolean/i);
  });

  it('returns 401 without a token', async () => {
    const res = await request(app)
      .patch('/api/auth/me/preferences')
      .send({ hideLegacyImporter: false });
    expect(res.status).toBe(401);
  });

  it('ignores unknown preference keys', async () => {
    const { user } = await createUser({ status: 'active' });
    const token = signTokenFor(user);
    const res = await request(app)
      .patch('/api/auth/me/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({ hideLegacyImporter: false, somethingElse: 42 });
    expect(res.status).toBe(200);
    // CR-052 — echoed blob also includes `tours: {}` (empty by default).
    // Unknown keys like `somethingElse` still must not survive.
    expect(res.body.preferences).toEqual({
      hideLegacyImporter: false,
      tours: {},
    });
    expect(res.body.preferences.somethingElse).toBeUndefined();
  });
});
