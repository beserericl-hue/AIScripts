/**
 * CR-042 Slice 3 — minimal SSO verification.
 *
 * Proves the password-less login path end-to-end without depending on the
 * wizard UI (which has separate Zustand-state-population gaps unrelated
 * to the SSO endpoint).
 *
 * Flow:
 *   1. Seed a user via /api/test/seed (no password set — the fixture
 *      dropped it as part of CR-042 Slice 3).
 *   2. loginAsSeededViaSso plants the JWT in localStorage.
 *   3. Navigate to /self-study (a route guarded by authenticate).
 *   4. Assert the seeded user's name renders in the page banner — proof
 *      that /api/auth/me decoded the planted JWT and hydrated the store.
 *   5. Cleanup.
 */
import { test, expect } from '@playwright/test';
import {
  seedFixture,
  cleanupSeed,
  loginAsSeededViaSso,
  type SeedResult
} from '../helpers/seed';

test.describe('CR-042 — SSO login smoke', () => {
  let seed: SeedResult | undefined;

  test.afterEach(async () => {
    await cleanupSeed(seed);
    seed = undefined;
  });

  test('loginAsSeededViaSso lands the seeded user in an authenticated route', async ({
    page
  }) => {
    test.setTimeout(60_000);
    seed = await seedFixture('wizard_review_minimal');
    await loginAsSeededViaSso(page, seed);

    await page.goto('/self-study');
    await page.waitForLoadState('networkidle');

    // Must NOT have been bounced to /login by the API 401-redirect interceptor.
    expect(page.url()).not.toMatch(/\/login/);

    // The seeded user's display name + role appears in the top-right
    // banner once /api/auth/me hydrates — proves the JWT is valid and
    // the user-store accepted it.
    const banner = page.getByText('E2E Test Coordinator', { exact: false });
    await expect(banner).toBeVisible({ timeout: 20_000 });

    const role = page.getByText('program coordinator', { exact: false });
    await expect(role).toBeVisible({ timeout: 20_000 });
  });
});
