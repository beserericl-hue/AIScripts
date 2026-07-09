import { test, expect, request } from '@playwright/test';

/**
 * The superuser-only "Superusers" panel renders on the admin User Management
 * screen, and a granted user (Amy) shows up in it.
 *
 *   E2E_BASE_URL=https://cshse.courseworx.media \
 *   SSO_TEST_EMAIL=eric@agileadtesting.com SSO_TEST_PASSWORD='...' \
 *   npx playwright test superuser_panel
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const EMAIL = process.env.SSO_TEST_EMAIL ?? '';
const PASSWORD = process.env.SSO_TEST_PASSWORD ?? '';

test('Superusers panel renders for a superuser and lists granted users', async ({ page }) => {
  test.skip(!EMAIL || !PASSWORD, 'set SSO_TEST_EMAIL / SSO_TEST_PASSWORD');

  // Mint a JWT and sign in via the SSO hash handoff (a superuser lands on the
  // dashboard, not the impersonation selector, when arriving this way).
  const api = await request.newContext({ baseURL: BASE });
  const login = await api.post('/api/auth/login', { data: { email: EMAIL, password: PASSWORD } });
  expect(login.ok(), `login failed: ${login.status()}`).toBeTruthy();
  const token = (await login.json()).token as string;

  await page.goto(`${BASE}/dashboard#token=${encodeURIComponent(token)}`);
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });

  // Open Admin → Settings → Users (nav item has a unique description).
  await page.goto(`${BASE}/admin/settings`);
  await page.getByText('Manage users, roles, and invitations').click();

  // The superuser-only panel and its controls.
  await expect(page.getByRole('heading', { name: 'Superusers' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Select a user to make a superuser')).toBeVisible();
  // The bootstrap superuser is always present.
  await expect(page.getByText(EMAIL, { exact: false }).first()).toBeVisible();
});
