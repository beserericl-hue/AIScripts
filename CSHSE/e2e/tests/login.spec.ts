import { test, expect } from '@playwright/test';
import { loginViaUI } from '../helpers/auth';
import { seedFixture, cleanupSeed, type SeedResult } from '../helpers/seed';

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

  test('logs a coordinator in and lands them on the dashboard', async ({ page }) => {
    // Seed a coordinator with a password so the password-login flow has a
    // real user to authenticate. The seed endpoint forwards `password`
    // straight to the User model, which hashes it via the pre-save hook.
    let seed: SeedResult | undefined;
    try {
      seed = await seedFixture('wizard_review_minimal', {
        user: { password: 'TestPass1234!' },
      });
      await loginViaUI(page, seed.userEmail, 'TestPass1234!');
      // Successful login redirects to either /dashboard or the self-study
      // landing page depending on the user's role.
      await expect(page).toHaveURL(/\/(dashboard|self-study)/, { timeout: 20_000 });
    } finally {
      await cleanupSeed(seed);
    }
  });
});
