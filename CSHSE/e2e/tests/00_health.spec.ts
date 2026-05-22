/**
 * Tier 6 — Smoke / health.
 *
 * Verifies the deployed environment is reachable + the ai-service is
 * responding + the seed endpoint is mounted (when expected).
 */
import { test, expect, request } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const AI_BASE_URL =
  process.env.E2E_AI_BASE_URL ??
  BASE_URL.replace('cshse-develop', 'cshse-ai-develop');
const SEED_TOKEN = process.env.E2E_SEED_TOKEN ?? '';

test.describe('Smoke — environment health', () => {
  test('CSHSE app responds', async () => {
    const ctx = await request.newContext();
    const r = await ctx.get(`${BASE_URL}/`);
    expect(r.status()).toBeLessThan(500);
  });

  test('ai-service /health returns ok', async () => {
    const ctx = await request.newContext();
    const r = await ctx.get(`${AI_BASE_URL}/health`);
    expect(r.ok()).toBeTruthy();
    const body = await r.json();
    expect(body.status).toBe('ok');
    expect(body.git).toBeTruthy();
  });

  test.describe('seed endpoint (when expected)', () => {
    test.skip(!SEED_TOKEN, 'E2E_SEED_TOKEN not set — skipping seed-endpoint check.');

    test('GET /api/test/health returns ok', async () => {
      const ctx = await request.newContext();
      const r = await ctx.get(`${BASE_URL}/api/test/health`);
      expect(r.ok()).toBeTruthy();
      const body = await r.json();
      expect(body.ok).toBe(true);
      expect(Array.isArray(body.fixturesAvailable)).toBe(true);
      // wizard_review_minimal must exist
      expect(body.fixturesAvailable).toContain('wizard_review_minimal.json');
    });

    test('seed endpoint rejects requests without the token', async () => {
      const ctx = await request.newContext();
      const r = await ctx.post(`${BASE_URL}/api/test/seed`, {
        data: { fixture: 'wizard_review_minimal' }
      });
      expect(r.status()).toBe(403);
    });
  });
});
