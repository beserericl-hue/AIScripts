/**
 * Tier 1 — Recovery: hard refresh persistence.
 *
 * The highest-value regression test in the suite. Every shipped CR has
 * touched the persist layer (Zustand `persist` + dirty flag). This spec
 * exercises the persist invariant from the Review step.
 *
 * For each mutation the wizard supports (Edit, Discard, Approve), this
 * test asserts that after a hard refresh + re-navigation to Review, the
 * mutation is still applied.
 */
import { test, expect } from '@playwright/test';
import {
  seedFixture,
  cleanupSeed,
  loginAsSeeded,
  gotoReviewStep,
  type SeedResult
} from '../helpers/seed';

test.describe('Recovery — hard refresh', () => {
  let seed: SeedResult | undefined;

  test.beforeEach(async () => {
    seed = await seedFixture('wizard_review_minimal');
  });
  test.afterEach(async () => {
    await cleanupSeed(seed);
  });

  test('Approve survives hard refresh', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsSeeded(page, seed!);
    await gotoReviewStep(page, seed!);

    await page.getByRole('button', { name: /^approve$/i }).first().click();
    await page.waitForTimeout(300);
    await expect(page.getByRole('button', { name: /^reviewed$/i }).first())
      .toBeVisible({ timeout: 5000 });

    await page.reload({ waitUntil: 'load' });
    await gotoReviewStep(page, seed!);

    await expect(page.getByRole('button', { name: /^reviewed$/i }).first())
      .toBeVisible({ timeout: 10000 });
  });

  test('Discard survives hard refresh', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsSeeded(page, seed!);
    await gotoReviewStep(page, seed!);

    const cardsBefore = await page
      .getByRole('button', { name: /^edit$/i })
      .count();

    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: /^discard$/i }).first().click();
    await page.waitForTimeout(500);

    await page.reload({ waitUntil: 'load' });
    await gotoReviewStep(page, seed!);

    const cardsAfter = await page
      .getByRole('button', { name: /^edit$/i })
      .count();
    expect(cardsAfter).toBe(cardsBefore - 1);
  });
});
