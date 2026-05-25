/**
 * Smoke E2E — Discard button visibility on Review-step item cards.
 *
 * Original commit: a977c57 ("Review cards: visible one-click Discard
 * button next to Edit"). This spec proves the deploy actually shipped
 * the new code AND the Discard control renders on a real card in the
 * persisted Review surface.
 *
 * Migrated 2026-05-25 from the E2E_USER/E2E_PASS gated form to the
 * SSO seed flow so it runs in every default sweep.
 */
import { test, expect } from '@playwright/test';
import {
  seedFixture,
  cleanupSeed,
  loginAsSeededViaSso,
  type SeedResult,
} from '../helpers/seed';

test.describe('AI Import Review — Discard button visibility', () => {
  let seed: SeedResult | undefined;

  test.afterEach(async () => {
    await cleanupSeed(seed);
    seed = undefined;
  });

  test('Discard button is visible on the first item card', async ({ page }) => {
    test.setTimeout(60_000);
    seed = await seedFixture('wizard_review_minimal');
    await loginAsSeededViaSso(page, seed);
    await page.goto(`/self-study/${seed.submissionId}`);
    await page.waitForLoadState('networkidle');

    // Open the persisted Review surface from the toolbar — that's where
    // the post-CR-043 Discard button lives.
    const reviewBtn = page.getByRole('button', { name: /^Review/ });
    await expect(reviewBtn).toBeEnabled({ timeout: 15_000 });
    await reviewBtn.click();
    await expect(page.getByRole('heading', { name: /Review/i })).toBeVisible({ timeout: 10_000 });

    // Click into the first spec tab so cards render.
    const firstSpecTab = page
      .getByRole('complementary', { name: /specifications/i })
      .getByRole('tab', { name: /^\d+\.[a-z]/i })
      .first();
    await expect(firstSpecTab).toBeVisible({ timeout: 15_000 });
    await firstSpecTab.click({ force: true });

    // The Discard button is one of the per-card actions (Edit, Discard,
    // Show in Source). It renders on every text-bearing card.
    const discardBtn = page.getByRole('button', { name: /^discard$/i }).first();
    await expect(discardBtn).toBeVisible({ timeout: 15_000 });

    // The button must not be disabled in the default state.
    await expect(discardBtn).toBeEnabled();
  });
});
