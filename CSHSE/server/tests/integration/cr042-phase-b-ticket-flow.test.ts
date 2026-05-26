/**
 * CR-042 Phase B — ticket flow + MemberClick relay + OpenAPI integration.
 *
 * Pins:
 *   1. /api/v1/auth/sso-mint-ticket requires a valid sso-login API key.
 *   2. Wrong scope (general-api) → 401/403.
 *   3. Valid mint returns a single-use ticket.
 *   4. /sso/v1/start consumes the ticket + 303-redirects with #token=<JWT>.
 *   5. Re-redeem of the same ticket → 401 (single-use).
 *   6. /sso/v1/from-memberclick rejects when MEMBERCLICK_SHARED_SECRET
 *      is set but signature is missing/bad.
 *   7. /sso/v1/from-memberclick respects the auto-derived domain allowlist.
 *   8. /api/v1/openapi.json returns the spec with the four endpoints documented.
 *   9. /api/v1/docs returns an HTML page referencing the openapi.json.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import app from '../../src/index';
import { APIKey } from '../../src/models/APIKey';
import { User } from '../../src/models/User';

async function mintSSOKey(scope: 'sso-login' | 'general-api' = 'sso-login') {
  const raw = `key_${crypto.randomBytes(12).toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(raw).digest('hex');
  const k = await APIKey.create({
    name: `test-${scope}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    keyPrefix: raw.slice(0, 8),
    keySuffix: raw.slice(-4),
    keyHash,
    scope,
    // Allowed enum: webhook_callback | webhook_outbound | api_access | integration.
    purpose: scope === 'sso-login' ? 'integration' : 'api_access',
    isActive: true,
    createdBy: new (require('mongoose').Types.ObjectId)(),
    createdByName: 'Phase B Test',
  } as any);
  return { raw, k };
}

async function seedActiveUser(email: string) {
  return User.create({
    email,
    firstName: 'Test',
    lastName: 'User',
    role: 'program_coordinator',
    status: 'active',
    isActive: true,
    institutionName: 'CR-042 Phase B Test U',
    provisionedBy: { type: 'invitation', at: new Date() },
  } as any);
}

describe('CR-042 Phase B — /api/v1/auth/sso-mint-ticket', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-must-be-at-least-32-chars-long-xxxx';
  });

  it('rejects missing x-cshse-api-key with 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/sso-mint-ticket')
      .send({ email: 'a@example.test' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('missing-api-key');
  });

  it('rejects an unknown api key with 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/sso-mint-ticket')
      .set('x-cshse-api-key', 'unknown-key-value')
      .send({ email: 'a@example.test' });
    expect(res.status).toBe(401);
  });

  it('rejects a general-api key (wrong scope) with 401', async () => {
    const { raw } = await mintSSOKey('general-api');
    const res = await request(app)
      .post('/api/v1/auth/sso-mint-ticket')
      .set('x-cshse-api-key', raw)
      .send({ email: 'a@example.test' });
    expect(res.status).toBe(401);
  });

  it('rejects invalid email format with 400', async () => {
    const { raw } = await mintSSOKey('sso-login');
    const res = await request(app)
      .post('/api/v1/auth/sso-mint-ticket')
      .set('x-cshse-api-key', raw)
      .send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('invalid-email');
  });

  it('returns a ticket on valid mint', async () => {
    const { raw } = await mintSSOKey('sso-login');
    const res = await request(app)
      .post('/api/v1/auth/sso-mint-ticket')
      .set('x-cshse-api-key', raw)
      .send({ email: 'mint@example.test', returnTo: '/self-study' });
    expect(res.status).toBe(200);
    expect(typeof res.body.ticket).toBe('string');
    expect(res.body.ticket.length).toBeGreaterThan(32);
    expect(new Date(res.body.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });
});

describe('CR-042 Phase B — GET /sso/v1/start', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-must-be-at-least-32-chars-long-xxxx';
  });

  it('400 when ticket query param is missing', async () => {
    const res = await request(app).get('/sso/v1/start');
    expect(res.status).toBe(400);
  });

  it('401 when ticket is unknown / expired', async () => {
    const res = await request(app).get('/sso/v1/start?ticket=does-not-exist');
    expect(res.status).toBe(401);
  });

  it('303-redirects with #token=<JWT> on valid ticket', async () => {
    await seedActiveUser('redeem@example.test');
    const { raw } = await mintSSOKey('sso-login');
    const mint = await request(app)
      .post('/api/v1/auth/sso-mint-ticket')
      .set('x-cshse-api-key', raw)
      .send({ email: 'redeem@example.test', returnTo: '/dashboard' });
    expect(mint.status).toBe(200);
    const ticket = mint.body.ticket;

    const redeem = await request(app).get(`/sso/v1/start?ticket=${ticket}`);
    expect(redeem.status).toBe(303);
    const location = redeem.headers.location || '';
    expect(location).toMatch(/^\/dashboard#token=/);
    // The JWT is URL-encoded after #token=. Decoded + jwt.decode should
    // surface the email.
    const tokenStr = decodeURIComponent(location.split('#token=')[1]);
    const jwt = require('jsonwebtoken');
    const decoded: any = jwt.decode(tokenStr);
    expect(decoded.email).toBe('redeem@example.test');
    expect(decoded.auth_method).toBe('sso-ticket');
  });

  it('a second redeem of the same ticket is rejected (single-use)', async () => {
    await seedActiveUser('once@example.test');
    const { raw } = await mintSSOKey('sso-login');
    const mint = await request(app)
      .post('/api/v1/auth/sso-mint-ticket')
      .set('x-cshse-api-key', raw)
      .send({ email: 'once@example.test', returnTo: '/dashboard' });
    const ticket = mint.body.ticket;

    const first = await request(app).get(`/sso/v1/start?ticket=${ticket}`);
    expect(first.status).toBe(303);
    const second = await request(app).get(`/sso/v1/start?ticket=${ticket}`);
    expect(second.status).toBe(401);
  });

  it('redeem with a ticket whose email has no active user → 403', async () => {
    const { raw } = await mintSSOKey('sso-login');
    const mint = await request(app)
      .post('/api/v1/auth/sso-mint-ticket')
      .set('x-cshse-api-key', raw)
      .send({ email: 'ghost@nobody.test' });
    const res = await request(app).get(`/sso/v1/start?ticket=${mint.body.ticket}`);
    expect(res.status).toBe(403);
  });
});

describe('CR-042 Phase B — /sso/v1/from-memberclick relay', () => {
  beforeEach(() => {
    delete process.env.MEMBERCLICK_REFERER_ALLOWLIST;
    delete process.env.MEMBERCLICK_IP_ALLOWLIST;
    delete process.env.MEMBERCLICK_SHARED_SECRET;
  });

  it('rejects an email whose domain is NOT on the auto-derived allowlist', async () => {
    const res = await request(app)
      .post('/sso/v1/from-memberclick')
      .send({ email: 'someone@unknown-domain.test' });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/sso-domain-not-yet-trusted/);
  });

  it('rejects when MEMBERCLICK_SHARED_SECRET is set + signature missing', async () => {
    process.env.MEMBERCLICK_SHARED_SECRET = 'shared-test-secret';
    await seedActiveUser('mcuser@trusted-domain.test');
    const res = await request(app)
      .post('/sso/v1/from-memberclick')
      .send({ email: 'mcuser@trusted-domain.test', timestamp: Math.floor(Date.now() / 1000) });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/bad-signature/);
  });

  it('rejects when timestamp is stale (>5 min)', async () => {
    process.env.MEMBERCLICK_SHARED_SECRET = 'shared-test-secret';
    await seedActiveUser('stale@trusted-domain.test');
    const ts = Math.floor(Date.now() / 1000) - 6 * 60;
    const sig = crypto
      .createHmac('sha256', 'shared-test-secret')
      .update(`stale@trusted-domain.test.${ts}`)
      .digest('hex');
    const res = await request(app)
      .post('/sso/v1/from-memberclick')
      .send({ email: 'stale@trusted-domain.test', timestamp: ts, signature: sig });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/stale-timestamp/);
  });

  it('303-redirects to /sso/v1/start when all four defenses pass', async () => {
    // For this test we disable Referer + IP defenses (env-empty) but
    // require HMAC + domain. The user is seeded so its domain is on
    // the derived allowlist.
    process.env.MEMBERCLICK_SHARED_SECRET = 'shared-test-secret';
    const { invalidateSsoAllowlistCache } = await import('../../src/controllers/ssoController');
    await seedActiveUser('good@allowed.test');
    invalidateSsoAllowlistCache(); // flush 30s cache so the new user counts immediately
    const ts = Math.floor(Date.now() / 1000);
    const sig = crypto
      .createHmac('sha256', 'shared-test-secret')
      .update(`good@allowed.test.${ts}`)
      .digest('hex');
    const res = await request(app)
      .post('/sso/v1/from-memberclick')
      .send({ email: 'good@allowed.test', timestamp: ts, signature: sig });
    expect(res.status).toBe(303);
    expect(res.headers.location).toMatch(/\/sso\/v1\/start\?ticket=/);
  });
});

describe('CR-042 Phase B — OpenAPI spec', () => {
  it('GET /api/v1/openapi.json returns a 3.1 spec with all four endpoints', async () => {
    const res = await request(app).get('/api/v1/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toMatch(/^3\.1/);
    expect(res.body.info.title).toMatch(/CSHSE/);
    expect(res.body.paths['/api/v1/auth/sso-login']).toBeDefined();
    expect(res.body.paths['/api/v1/auth/sso-mint-ticket']).toBeDefined();
    expect(res.body.paths['/sso/v1/start']).toBeDefined();
    expect(res.body.paths['/sso/v1/from-memberclick']).toBeDefined();
  });

  it('GET /api/v1/docs serves a Redoc HTML page that loads the spec', async () => {
    const res = await request(app).get('/api/v1/docs');
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/redoc/i);
    expect(res.text).toContain('/api/v1/openapi.json');
  });
});
