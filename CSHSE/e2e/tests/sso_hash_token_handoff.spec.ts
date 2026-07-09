import { test, expect, request } from '@playwright/test';

/**
 * Regression: the SSO handoff (MemberClick OAuth callback + ticket flow) sends
 * the signed-in member to `${returnTo}#token=<JWT>`. The client must consume that
 * fragment on load, authenticate, and land on the dashboard — NOT silently drop
 * the token and bounce to /login (the bug Amy hit).
 *
 * Run against a live target:
 *   E2E_BASE_URL=https://cshse.courseworx.media \
 *   SSO_TEST_EMAIL=eric@agileadtesting.com SSO_TEST_PASSWORD='...' \
 *   npx playwright test sso_hash_token_handoff
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const EMAIL = process.env.SSO_TEST_EMAIL ?? '';
const PASSWORD = process.env.SSO_TEST_PASSWORD ?? '';

test('SSO #token= fragment authenticates and lands off /login', async ({ page }) => {
  test.skip(!EMAIL || !PASSWORD, 'set SSO_TEST_EMAIL / SSO_TEST_PASSWORD');

  // Mint a real JWT the same way the SSO callback does (login endpoint).
  const api = await request.newContext({ baseURL: BASE });
  const login = await api.post('/api/auth/login', { data: { email: EMAIL, password: PASSWORD } });
  expect(login.ok(), `login failed: ${login.status()}`).toBeTruthy();
  const token = (await login.json()).token as string;
  expect(token, 'no token from /api/auth/login').toBeTruthy();

  // Simulate exactly what the SSO callback 303-redirects to.
  await page.goto(`${BASE}/dashboard#token=${encodeURIComponent(token)}`);

  // The bug: we get thrown to /login. The fix: we stay authenticated.
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
  // Token must be stripped from the address bar (not bookmarkable/shareable).
  await expect(page).toHaveURL((u) => !u.hash.includes('token='), { timeout: 15000 });
  // And we should be on an authenticated screen (dashboard or impersonation).
  await expect(page).toHaveURL(/\/(dashboard|impersonate)/, { timeout: 15000 });
});
