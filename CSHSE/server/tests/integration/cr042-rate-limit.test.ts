/**
 * CR-042 Phase B — tier-based rate limit for /api/v1/* endpoints.
 *
 * The middleware buckets requests by API key (when authenticated) or IP
 * (anonymous), with default tiers:
 *   - sso-login API key: 60 / min
 *   - general-api key:   30 / min
 *   - anonymous:         10 / min
 *
 * Pins:
 *   1. Anonymous requests get the 10/min cap → 11th in the window is 429.
 *   2. The 429 response carries Retry-After + X-RateLimit-* headers.
 *   3. metadata.rateLimit on the APIKey overrides the default tier.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import app from '../../src/index';
import { APIKey } from '../../src/models/APIKey';
import { _testResetRateLimits } from '../../src/middleware/apiKeyRateLimit';

async function mintKey(opts: { scope: 'sso-login' | 'general-api'; rateLimit?: number }) {
  const raw = `key_${crypto.randomBytes(12).toString('hex')}`;
  const keyHash = crypto.createHash('sha256').update(raw).digest('hex');
  await APIKey.create({
    name: `rl-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    keyPrefix: raw.slice(0, 8),
    keySuffix: raw.slice(-4),
    keyHash,
    scope: opts.scope,
    purpose: opts.scope === 'sso-login' ? 'integration' : 'api_access',
    isActive: true,
    createdBy: new (require('mongoose').Types.ObjectId)(),
    createdByName: 'RL Test',
    metadata: opts.rateLimit !== undefined ? { rateLimit: opts.rateLimit } : undefined,
  } as any);
  return raw;
}

describe('CR-042 Phase B — apiKeyRateLimit', () => {
  beforeEach(() => {
    _testResetRateLimits();
  });

  it('emits X-RateLimit-* headers on every response', async () => {
    const res = await request(app)
      .post('/api/v1/auth/sso-mint-ticket')
      .send({ email: 'whatever@example.test' });
    expect(res.headers['x-ratelimit-limit']).toBe('10');
    expect(typeof res.headers['x-ratelimit-remaining']).toBe('string');
    expect(typeof res.headers['x-ratelimit-reset']).toBe('string');
  });

  it('anonymous: 11th request inside the window returns 429 with Retry-After', async () => {
    // Anonymous cap = 10/min. Hit it 11 times.
    let last;
    for (let i = 0; i < 11; i++) {
      last = await request(app)
        .post('/api/v1/auth/sso-mint-ticket')
        .send({ email: 'whatever@example.test' });
    }
    expect(last!.status).toBe(429);
    expect(last!.headers['retry-after']).toBeDefined();
    expect(Number(last!.headers['retry-after'])).toBeGreaterThan(0);
    expect(last!.body.status).toBe(429);
    expect(last!.body.title).toMatch(/rate limit/i);
  });

  it('metadata.rateLimit override raises the per-key ceiling', async () => {
    _testResetRateLimits();
    // override = 100, so 15 requests stay under cap and never 429.
    const raw = await mintKey({ scope: 'sso-login', rateLimit: 100 });
    let last;
    for (let i = 0; i < 15; i++) {
      last = await request(app)
        .post('/api/v1/auth/sso-mint-ticket')
        .set('x-cshse-api-key', raw)
        .send({ email: 'never-hits-cap@example.test' });
    }
    expect(last!.status).not.toBe(429);
    expect(last!.headers['x-ratelimit-limit']).toBe('100');
  });

  it('sso-login default cap is 60/min (vs anonymous 10/min)', async () => {
    _testResetRateLimits();
    const raw = await mintKey({ scope: 'sso-login' });
    const res = await request(app)
      .post('/api/v1/auth/sso-mint-ticket')
      .set('x-cshse-api-key', raw)
      .send({ email: 'a@example.test' });
    expect(res.headers['x-ratelimit-limit']).toBe('60');
  });

  it('e2e-bootstrap keys are exempt from rate limiting (E2E suite parallelism)', async () => {
    _testResetRateLimits();
    // Manually craft a bootstrap key (createdByName='e2e-bootstrap')
    // to mirror what /api/test/bootstrap-sso-key produces.
    const raw = `key_${crypto.randomBytes(12).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(raw).digest('hex');
    await APIKey.create({
      name: `bootstrap-rl-${Date.now()}`,
      keyPrefix: 'cshse_sso_v1_',
      keySuffix: raw.slice(-4),
      keyHash,
      scope: 'sso-login',
      purpose: 'integration',
      isActive: true,
      createdBy: new (require('mongoose').Types.ObjectId)('000000000000000000000000'),
      createdByName: 'e2e-bootstrap',
    } as any);

    // Hit the endpoint 70 times — past the default sso-login cap of
    // 60/min. With the bypass, none of them 429.
    let any429 = false;
    let bypassHeader: string | undefined;
    for (let i = 0; i < 70; i++) {
      const res = await request(app)
        .post('/api/v1/auth/sso-mint-ticket')
        .set('x-cshse-api-key', raw)
        .send({ email: `boot-${i}@example.test` });
      if (res.status === 429) {
        any429 = true;
        break;
      }
      if (i === 0) bypassHeader = res.headers['x-ratelimit-bypass'];
    }
    expect(any429).toBe(false);
    expect(bypassHeader).toBe('e2e-bootstrap');
  });
});
