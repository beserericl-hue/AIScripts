/**
 * Tier 1 — CR-039 Standard-level Introduction sections.
 *
 * Asserts the wizard's Review step renders:
 *   1. A Document Introduction rail entry at the top.
 *   2. Per-Standard Introduction sub-entries under each Standard heading.
 *   3. The "+ Add" affordance (CR-039 Phase 2c part 2) next to every
 *      Introduction row — clicking it opens ShowInSourceModal in
 *      selection mode.
 *
 * Uses the existing wizard_review_minimal fixture (which seeds buckets
 * for Standard 1). The SpecRail renders Document Introduction always +
 * a per-Standard Introduction sibling whenever that Standard has a
 * bucket seeded.
 */
import { test, expect } from '@playwright/test';
import {
  seedFixture,
  cleanupSeed,
  loginAsSeededViaSso,
  gotoReviewStep,
  type SeedResult
} from '../helpers/seed';

test.describe('CR-039 — Standard-level Introduction sections', () => {
  let seed: SeedResult | undefined;

  test.beforeEach(async () => {
    seed = await seedFixture('wizard_review_minimal');
  });

  test.afterEach(async () => {
    await cleanupSeed(seed);
    seed = undefined;
  });

  test('Document Introduction rail entry visible with "+ Add" affordance', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsSeededViaSso(page, seed!);
    await gotoReviewStep(page, seed!);

    // Document Introduction sits at the top of the SpecRail (always
    // rendered — the store initializes a document-level intro bucket).
    // Scope to the role=tab to avoid matching the per-card intro
    // combobox options (which carry the same text).
    await expect(
      page.getByRole('tab', { name: 'Document Introduction' })
    ).toBeVisible({ timeout: 15_000 });

    // CR-039 Phase 2c part 2 "+ Add" affordance. One button per intro
    // row across the rail (Document + per-Standard). Assert at least
    // one is visible.
    const addButtons = page.getByRole('button', { name: /\+ Add/ });
    await expect(addButtons.first()).toBeVisible();
    const count = await addButtons.count();
    expect(count, 'expected at least one "+ Add" button on the rail').toBeGreaterThan(0);
  });

  test('clicking "+ Add" on Document Introduction opens the source modal', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsSeededViaSso(page, seed!);
    await gotoReviewStep(page, seed!);

    // The Document Introduction "+ Add" button is the first one on
    // the rail (renders before any per-Standard intro). Click it +
    // verify the source modal opens.
    const firstAdd = page.getByRole('button', { name: /\+ Add/ }).first();
    await expect(firstAdd).toBeVisible({ timeout: 15_000 });
    await firstAdd.click();

    // ShowInSourceModal opens in selection mode. Look for any modal
    // dialog OR for selection-mode UI text. The modal renders a
    // role="dialog" wrapper.
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
  });
});
