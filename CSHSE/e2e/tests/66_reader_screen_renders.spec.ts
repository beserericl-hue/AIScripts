/**
 * The reader reviews in the SAME Self-Study Editor the PC uses (matching
 * production). The old flat /reader/:id screen is deprecated — that route now
 * redirects to /self-study/:id. This asserts the redirect.
 */
import { test, expect } from '@playwright/test';
import { seedFixture, cleanupSeed, loginAsSeededViaSso, type SeedResult } from '../helpers/seed';

test.describe('Reader review opens the Self-Study Editor (not the flat screen)', () => {
  let seed: SeedResult | undefined;
  test.afterEach(async () => { await cleanupSeed(seed); seed = undefined; });

  test('/reader/:id redirects to /self-study/:id', async ({ page }) => {
    test.setTimeout(90_000);
    seed = await seedFixture('wizard_review_minimal', {
      user: { email: 'reader-redirect@x.test', preferences: { tours: { welcome: true } } },
    });
    await loginAsSeededViaSso(page, seed);

    await page.goto(`/reader/${seed.submissionId}`);
    await page.waitForLoadState('networkidle');
    // The deprecated flat screen must NOT render; the URL is the editor.
    await expect(page).toHaveURL(new RegExp(`/self-study/${seed.submissionId}`), { timeout: 20_000 });
    await expect(page.getByTestId('reader-review-screen')).toHaveCount(0);
  });
});
