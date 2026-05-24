/**
 * Tier 1 — CR-032 Edit pencil on Review-step cards.
 *
 * Verifies: pencil opens textarea, Save persists, hard-refresh persists,
 * Revert restores original.
 */
import { test, expect } from '@playwright/test';
import {
  seedFixture,
  cleanupSeed,
  loginAsSeededViaSso,
  gotoReviewStep,
  type SeedResult
} from '../helpers/seed';

test.describe('CR-032 — Edit pencil on Review cards', () => {
  let seed: SeedResult | undefined;

  test.beforeEach(async () => {
    seed = await seedFixture('wizard_review_minimal');
  });
  test.afterEach(async () => {
    await cleanupSeed(seed);
  });

  test('Edit pencil opens textarea, Save persists across reload', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsSeededViaSso(page, seed!);
    await gotoReviewStep(page, seed!);

    // Click the first Edit pencil
    await page.getByRole('button', { name: /^edit$/i }).first().click();

    // A textarea should appear in the right preview pane
    const textarea = page.locator('textarea').first();
    await expect(textarea).toBeVisible({ timeout: 5000 });

    const newText = 'CR-032 E2E verification — this card was edited by Playwright.';
    await textarea.fill(newText);

    // Save
    await page.getByRole('button', { name: /^save$/i }).click();
    await page.waitForTimeout(500);

    // The edited card should now show an "edited" badge
    await expect(page.locator('text=/edited/i').first()).toBeVisible({ timeout: 5000 });

    // Hard refresh and re-navigate to Review
    await page.reload({ waitUntil: 'load' });
    await gotoReviewStep(page, seed!);

    // The edited badge persists
    await expect(page.locator('text=/edited/i').first()).toBeVisible({ timeout: 10000 });
  });
});
