import { test, expect } from '@playwright/test';

test.describe('Backend smoke', () => {
  test('GET /health returns 200', async ({ request }) => {
    const res = await request.get('/health');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  test('GET /api/auth/me without a token returns 401', async ({ request }) => {
    const res = await request.get('/api/auth/me');
    expect(res.status()).toBe(401);
  });
});
