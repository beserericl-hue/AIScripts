import { Page, expect } from '@playwright/test';

/**
 * Log in via the UI. For most flow tests prefer programmatic login (API call +
 * inject token into localStorage) once an /api/test/seed endpoint exists; this
 * helper is the slow but realistic path.
 */
export async function loginViaUI(
  page: Page,
  email: string,
  password: string,
  opts: { expectFailure?: boolean } = {}
): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /(log ?in|sign ?in)/i }).click();

  if (opts.expectFailure) {
    await expect(page.getByText(/invalid|incorrect|disabled/i)).toBeVisible();
  } else {
    await expect(page).not.toHaveURL(/\/login/);
  }
}

export const TEST_USERS = {
  // Populate with seeded test accounts when the seed endpoint exists.
  coordinator: { email: 'coord@example.test', password: 'Coordinator-Password-1' },
  reader:      { email: 'reader@example.test', password: 'Reader-Password-1' },
  admin:       { email: 'admin@example.test',  password: 'Admin-Password-1' },
};
