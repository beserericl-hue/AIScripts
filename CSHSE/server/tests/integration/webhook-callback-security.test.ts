import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/index';

/**
 * CR-054 — secured-state assertions for the 2026-05-10 security audit, finding C2.
 *
 * Previously `POST /api/webhooks/n8n/callback` and its sibling callback
 * endpoints were mounted before the `authenticate` middleware, so any external
 * caller could POST arbitrary validation results (e.g. flip a failing section
 * to "pass"). The CR-054 fix:
 *   - the n8n *validation* callback was DELETED entirely (validation is now
 *     in-process via cshse-ai) — the route now 404s.
 *   - the spec-loader / document-matcher callbacks are guarded by
 *     `verifyN8nCallback`, which requires the shared secret (X-Callback-Secret
 *     or X-API-Key) when `N8N_CALLBACK_SECRET` is configured -> 401 without it.
 *   - the help/upload callback verifies a per-document `callbackToken` and the
 *     document's existence -> never a silent accept for a bogus payload.
 *
 * (The middleware reads `process.env.N8N_CALLBACK_SECRET` at request time, so
 * setting it here exercises the enforced path without re-importing the app.)
 */
describe('Webhook callback authentication (CR-054 — audit C2 fixed)', () => {
  const SECRET = 'test-callback-secret-cr054';
  const prev = process.env.N8N_CALLBACK_SECRET;

  beforeAll(() => {
    process.env.N8N_CALLBACK_SECRET = SECRET;
  });
  afterAll(() => {
    if (prev === undefined) delete process.env.N8N_CALLBACK_SECRET;
    else process.env.N8N_CALLBACK_SECRET = prev;
  });

  const body = { submissionId: 'fake', standardCode: '1', specCode: 'a', result: { status: 'pass' } };

  it('POST /api/webhooks/n8n/callback no longer accepts unauthenticated writes (route deleted)', async () => {
    const res = await request(app).post('/api/webhooks/n8n/callback').send(body);
    // The validation-callback route was removed. The path now falls through to
    // the `router.use(authenticate)` guard, which rejects the missing Bearer
    // token with 401 before Express can 404. Either way the headline C2 exploit
    // is closed: an unauthenticated caller can no longer post a ValidationResult.
    expect([401, 404]).toContain(res.status);
    expect(res.status).not.toBe(200);
  });

  it('spec-loader callback rejects a POST with no shared secret (401)', async () => {
    const res = await request(app).post('/api/webhooks/spec-loader/callback').send(body);
    expect(res.status).toBe(401);
  });

  it('spec-loader callback rejects a POST with the wrong shared secret (401)', async () => {
    const res = await request(app)
      .post('/api/webhooks/spec-loader/callback')
      .set('X-Callback-Secret', 'wrong-secret')
      .send(body);
    expect(res.status).toBe(401);
  });

  it('document-matcher callback rejects a POST with no shared secret (401)', async () => {
    const res = await request(app).post('/api/webhooks/document-matcher/callback').send(body);
    expect(res.status).toBe(401);
  });

  it('spec-loader callback passes the secret guard when the correct secret is presented (not 401)', async () => {
    const res = await request(app)
      .post('/api/webhooks/spec-loader/callback')
      .set('X-Callback-Secret', SECRET)
      .send(body);
    // Past the auth guard — the controller takes over. The point is only that
    // a correctly-authenticated caller is NOT rejected by the secret guard.
    expect(res.status).not.toBe(401);
  });

  it('spec-loader callback also accepts the legacy X-API-Key header carrying the secret (not 401)', async () => {
    const res = await request(app)
      .post('/api/webhooks/spec-loader/callback')
      .set('X-API-Key', SECRET)
      .send(body);
    expect(res.status).not.toBe(401);
  });

  it('help/upload callback never silently accepts a bogus payload (no valid callbackToken)', async () => {
    const res = await request(app)
      .post('/api/webhooks/help/upload/callback')
      .send({ docId: '507f1f77bcf86cd799439011', status: 'loaded' }); // nonexistent doc, no token
    // 404 (doc not found) or 403 (bad token) or 400 (missing field) — never a 2xx accept.
    expect([400, 403, 404]).toContain(res.status);
    expect(res.status).not.toBe(200);
  });
});
