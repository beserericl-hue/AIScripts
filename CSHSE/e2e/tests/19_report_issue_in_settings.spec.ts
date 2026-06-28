/**
 * "Report issue" moved from a floating widget into the header Settings (gear)
 * menu, at Monica's request. There must be NO floating trigger, and the menu
 * item must open the bug-reporter modal.
 */
import { test, expect } from '@playwright/test';
import {
  seedFixture,
  cleanupSeed,
  loginAsSeededViaSso,
  gotoReviewStep,
  type SeedResult
} from '../helpers/seed';

test.describe('Report issue lives in the Settings menu', () => {
  let seed: SeedResult | undefined;
  test.beforeEach(async () => { seed = await seedFixture('wizard_review_minimal'); });
  test.afterEach(async () => { await cleanupSeed(seed); });

  test('no floating widget; the gear menu opens the report modal', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsSeededViaSso(page, seed!);
    await gotoReviewStep(page, seed!);

    // The floating "Report issue" widget is gone.
    await expect(page.getByTestId('bug-reporter-trigger')).toHaveCount(0);

    // Open the header Settings (gear) menu and click "Report issue".
    await page.getByTitle('User settings').click();
    const item = page.getByTestId('report-issue-menu-item');
    await expect(item).toBeVisible();
    await item.click();

    // The bug-reporter modal opens.
    await expect(page.getByTestId('bug-reporter-modal')).toBeVisible();
    await expect(page.getByTestId('bug-reporter-description')).toBeVisible();
  });
});
