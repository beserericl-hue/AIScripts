/**
 * A hard reload must keep the user on the SAME surface (Review vs Standards),
 * not drop them on the Standards editor. The active view is mirrored to
 * `?view=` and restored on mount.
 */
import { test, expect } from '@playwright/test';
import {
  seedFixture,
  cleanupSeed,
  loginAsSeededViaSso,
  gotoReviewStep,
  type SeedResult
} from '../helpers/seed';

test.describe('View persists across a hard reload', () => {
  let seed: SeedResult | undefined;
  test.beforeEach(async () => { seed = await seedFixture('wizard_review_minimal'); });
  test.afterEach(async () => { await cleanupSeed(seed); });

  test('reloading on Review stays on Review; reloading on Standards stays on Standards', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsSeededViaSso(page, seed!);
    await gotoReviewStep(page, seed!);

    // On Review — the URL reflects it and a reload keeps us here.
    await expect(page.getByRole('heading', { name: /^Review$/i })).toBeVisible();
    await expect(page).toHaveURL(/[?&]view=review/);
    await page.reload();
    await expect(page.getByRole('heading', { name: /^Review$/i })).toBeVisible();
    await expect(page).toHaveURL(/[?&]view=review/);

    // Switch to the Standards editor via the top tab.
    await page.getByRole('button', { name: /^Standards$/i }).first().click();
    await expect(page).toHaveURL(/[?&]view=standards/);
    // Standards editor chrome (Validate All) is present; Review heading is gone.
    await expect(page.getByTestId('validate-all-cta')).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Review$/i })).toHaveCount(0);

    // Reload on Standards — stays on Standards, does NOT bounce to Review.
    await page.reload();
    await expect(page).toHaveURL(/[?&]view=standards/);
    await expect(page.getByTestId('validate-all-cta')).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Review$/i })).toHaveCount(0);
  });
});
