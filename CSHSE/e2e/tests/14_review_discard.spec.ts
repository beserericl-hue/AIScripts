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

    // The Review pane is master/detail: each spec tab renders its own
    // cards. Iterate every spec tab in the left rail and accumulate the
    // total Discard count across all of them. The seed fixture has 4
    // narratives + 1 evidence text spread across 3 specs (1.a/2.a/7.b).
    const specsRail = page.getByRole('complementary', { name: /specifications/i });
    const specTabs = specsRail.getByRole('tab');
    const specCount = await specTabs.count();
    let totalDiscard = 0;
    for (let i = 0; i < specCount; i++) {
      const tab = specTabs.nth(i);
      const tabName = await tab.getAttribute('aria-label') || '';
      // Skip the 'Unplaced' bucket — its body uses a different surface
      // and has no Discard buttons in this fixture.
      if (/unplaced/i.test(tabName)) continue;
      await tab.click();
      // Allow the right pane to re-render
      await page.waitForTimeout(150);
      const specDiscard = await page.getByRole('button', { name: /^discard$/i }).count();
      totalDiscard += specDiscard;
    }
    expect(totalDiscard).toBeGreaterThanOrEqual(3);

    // Confirm red styling on the first Discard we can see on whichever
    // spec is currently selected.
    const first = page.getByRole('button', { name: /^discard$/i }).first();
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
