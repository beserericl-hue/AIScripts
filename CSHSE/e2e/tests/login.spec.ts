import { test, expect } from '@playwright/test';
import { loginViaUI, TEST_USERS } from '../helpers/auth';

test.describe('Login flow', () => {
  test('renders the login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: /(log ?in|sign ?in)/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
  });

  test('shows an error when credentials are wrong', async ({ page }) => {
    await loginViaUI(page, 'nobody@example.test', 'definitely-wrong-pw', {
      expectFailure: true,
    });
    await expect(page).toHaveURL(/\/login/);
  });

  test.skip('logs a coordinator in and lands them on the dashboard (needs seeded DB)', async ({ page }) => {
    // Skipped until an E2E seed endpoint exists. To enable: provision a test
    // MongoDB, seed `TEST_USERS.coordinator`, set E2E_SEEDED=1, remove .skip.
    await loginViaUI(page, TEST_USERS.coordinator.email, TEST_USERS.coordinator.password);
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
