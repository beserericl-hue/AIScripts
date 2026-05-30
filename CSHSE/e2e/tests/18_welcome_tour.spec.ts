/**
 * CR-052 / Sprint 7 — Welcome tour + Help dropdown E2E.
 *
 * Two scenarios:
 *   - "Finish path": fresh user lands on /dashboard, auto-tour fires,
 *     user walks every step to Finish, persistence pinned via GET /me,
 *     post-completion hint appears anchored to the Help button.
 *   - "Skip path": skip after step 1; same persistence pin.
 *
 * Seed-driven on `https://cshse-develop.up.railway.app` via the existing
 * CR-034 endpoint. The fixture name `wizard_review_minimal` is reused;
 * we only override the user email + preferences to clear any prior
 * tour-completion flag.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
import {
  seedFixture,
  cleanupSeed,
  loginAsSeededViaSso,
  type SeedResult,
} from '../helpers/seed';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

/**
 * Query /api/auth/me from inside the page so we ride the same auth header
 * the app uses. Returns the persisted tours map.
 */
async function fetchPreferencesTours(page: Page): Promise<Record<string, boolean>> {
  const result = await page.evaluate(async () => {
    const raw = localStorage.getItem('auth-storage');
    const token = raw ? JSON.parse(raw)?.state?.token : null;
    if (!token) return { error: 'no-token' };
    const r = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return { error: `status-${r.status}` };
    const body = await r.json();
    return body?.user?.preferences?.tours ?? {};
  });
  if ((result as any)?.error) throw new Error(`fetchPreferencesTours: ${(result as any).error}`);
  return result as Record<string, boolean>;
}

test.describe('CR-052 — Welcome tour', () => {
  let seed: SeedResult | undefined;

  test.afterEach(async () => {
    await cleanupSeed(seed);
    seed = undefined;
  });

  test('auto-fires on /dashboard for a fresh user; Finish persists', async ({ page }) => {
    test.setTimeout(90_000);
    seed = await seedFixture('wizard_review_minimal', {
      user: { email: 'cr052-finish@x.test' },
    });
    await loginAsSeededViaSso(page, seed);
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');

    // The Joyride tooltip appears within ~2s once /dashboard renders.
    const tooltip = page.getByTestId('tour-tooltip');
    await expect(tooltip).toBeVisible({ timeout: 4000 });

    // Walk every step. The primary button's label flips to "Finish" on
    // the last step; we use that label to know when to stop.
    while (true) {
      const primary = page.getByTestId('tour-tooltip-primary');
      const label = await primary.textContent();
      await primary.click();
      if (label && label.includes('Finish')) break;
      // Safety brake — we should never need more than 20 clicks.
      // eslint-disable-next-line no-await-in-loop
      await page.waitForTimeout(80);
    }

    // Hint appears anchored to the Help button.
    const hint = page.getByTestId('hint-balloon-welcome-tour-completed');
    await expect(hint).toBeVisible({ timeout: 2000 });

    // Persistence — GET /me echoes tours.welcome === true.
    const tours = await fetchPreferencesTours(page);
    expect(tours.welcome).toBe(true);
  });

  test('Skip from step 1 also persists', async ({ page }) => {
    test.setTimeout(60_000);
    seed = await seedFixture('wizard_review_minimal', {
      user: { email: 'cr052-skip@x.test' },
    });
    await loginAsSeededViaSso(page, seed);
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId('tour-tooltip')).toBeVisible({ timeout: 4000 });
    // The first step has no Back button, so Skip is on the same row.
    await page.getByTestId('tour-tooltip-skip').click();

    await expect(page.getByTestId('tour-tooltip')).toBeHidden({ timeout: 2000 });

    // Same persistence pin.
    const tours = await fetchPreferencesTours(page);
    expect(tours.welcome).toBe(true);
  });

  test('Restart appears in the Help menu after completion', async ({ page }) => {
    test.setTimeout(60_000);
    seed = await seedFixture('wizard_review_minimal', {
      user: { email: 'cr052-restart@x.test' },
    });
    await loginAsSeededViaSso(page, seed);
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForLoadState('networkidle');

    // Skip the auto tour to flip tours.welcome=true via the same path.
    await expect(page.getByTestId('tour-tooltip')).toBeVisible({ timeout: 4000 });
    await page.getByTestId('tour-tooltip-skip').click();
    await expect(page.getByTestId('tour-tooltip')).toBeHidden({ timeout: 2000 });

    // Open the Help dropdown; the Tour item label should now read
    // "Watch the welcome tour again".
    await page.getByTestId('help-menu-trigger').click();
    const tourItem = page.getByTestId('help-menu-tour');
    await expect(tourItem).toHaveText(/watch the welcome tour again/i);
  });
});
