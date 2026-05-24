/**
 * Tier 1 — CR-033 Discard button.
 *
 * Real functional verification (not the bundle-string scan from the
 * previous version). Lands on the Review step via the seed endpoint,
 * clicks Discard on a known card, confirms the dialog, asserts the card
 * disappears, asserts the change survives a hard refresh.
 *
 * Replaces the bundle-scan-only `discard_button.spec.ts`.
 */
import { test, expect } from '@playwright/test';
import {
  seedFixture,
  cleanupSeed,
  loginAsSeededViaSso,
  gotoReviewStep,
  type SeedResult
} from '../helpers/seed';

test.describe('CR-033 — Discard button on Review cards', () => {
  let seed: SeedResult | undefined;

  test.beforeEach(async () => {
    seed = await seedFixture('wizard_review_minimal');
  });

  test.afterEach(async () => {
    await cleanupSeed(seed);
    seed = undefined;
  });

  test('Discard button is visible on every text-bearing card', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsSeededViaSso(page, seed!);
    await gotoReviewStep(page, seed!);

    // gotoReviewStep selected the first spec — assert every rendered
    // card has its own Discard button. The Review pane is master/detail,
    // so this is the structurally invariant claim of the feature: "for
    // any spec the coordinator opens, every text-bearing card carries a
    // Discard button." The seed's first spec (1.a) has 2 narrative cards.
    const editButtons = page.getByRole('button', { name: /^edit$/i });
    const discardButtons = page.getByRole('button', { name: /^discard$/i });
    const editCount = await editButtons.count();
    const discardCount = await discardButtons.count();
    expect(editCount).toBeGreaterThanOrEqual(1);
    expect(discardCount).toBe(editCount);

    // Confirm red styling on the first Discard
    const first = discardButtons.first();
    const className = await first.getAttribute('class');
    expect(className).toMatch(/text-red-700|text-red/);
    expect(className).toMatch(/border-red/);
  });

  test('clicking Discard + confirming removes the card from the spec', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsSeededViaSso(page, seed!);
    await gotoReviewStep(page, seed!);

    // Count cards before discard
    const cardsBefore = await page
      .getByRole('button', { name: /^edit$/i })
      .count();
    expect(cardsBefore).toBeGreaterThanOrEqual(1);

    // Accept the confirm dialog when it appears
    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: /^discard$/i }).first().click();

    // Wait for the DOM to settle
    await page.waitForTimeout(500);

    const cardsAfter = await page
      .getByRole('button', { name: /^edit$/i })
      .count();
    expect(cardsAfter).toBe(cardsBefore - 1);
  });

  test('cancelling the confirm dialog keeps the card', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsSeededViaSso(page, seed!);
    await gotoReviewStep(page, seed!);

    const cardsBefore = await page
      .getByRole('button', { name: /^edit$/i })
      .count();

    page.once('dialog', (d) => d.dismiss());
    await page.getByRole('button', { name: /^discard$/i }).first().click();
    await page.waitForTimeout(300);

    const cardsAfter = await page
      .getByRole('button', { name: /^edit$/i })
      .count();
    expect(cardsAfter).toBe(cardsBefore);
  });

  test('discarded card stays discarded after a hard refresh', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsSeededViaSso(page, seed!);
    await gotoReviewStep(page, seed!);

    const cardsBefore = await page
      .getByRole('button', { name: /^edit$/i })
      .count();

    page.once('dialog', (d) => d.accept());
    await page.getByRole('button', { name: /^discard$/i }).first().click();
    await page.waitForTimeout(500);

    // Hard refresh
    await page.reload({ waitUntil: 'load' });
    await page.waitForLoadState('networkidle');
    // After reload, re-navigate into the wizard's Review step
    await gotoReviewStep(page, seed!);

    const cardsAfter = await page
      .getByRole('button', { name: /^edit$/i })
      .count();
    expect(cardsAfter).toBe(cardsBefore - 1);
  });
});
