import { describe, expect, it } from 'vitest';
import request from 'supertest';
import app from '../../src/index';

/**
 * Regression guard for the 2026-05-10 security audit, finding C2:
 * `POST /api/webhooks/n8n/callback` and the three sibling callback endpoints
 * are mounted before the `authenticate` middleware. Any external caller can
 * post arbitrary results.
 *
 * These tests CURRENTLY DOCUMENT the broken state. When the fix lands
 * (HMAC signature verification + dedup on executionId), invert the assertions:
 *  - missing/invalid signature -> expect 401
 *  - duplicate executionId    -> expect 409
 */
describe('Webhook callback authentication (regression guard for audit C2)', () => {
  const callbackPaths = [
    '/api/webhooks/n8n/callback',
    '/api/webhooks/spec-loader/callback',
    '/api/webhooks/document-matcher/callback',
    '/api/webhooks/help/upload/callback',
  ];

  for (const path of callbackPaths) {
    it(`${path} accepts an unauthenticated POST today (should require HMAC)`, async () => {
      const res = await request(app)
        .post(path)
        .send({ submissionId: 'fake', standardCode: '1', specCode: 'a', result: { status: 'pass' } });

      // Today: anything other than 401/403 means no auth check ran.
      // This assertion will fail (correctly) once the fix lands.
      expect([401, 403]).not.toContain(res.status);
    });
  }
});
