/**
 * Tier 1 — Apply step regression.
 *
 * Status: SCAFFOLDED.
 */
import { test, expect } from '@playwright/test';
import { seedFixture, cleanupSeed, type SeedResult } from '../helpers/seed';

test.describe.skip('Apply step', () => {
  let seed: SeedResult | undefined;

  test.beforeEach(async () => {
    seed = await seedFixture('wizard_apply_dryrun');
  });
  test.afterEach(async () => {
    await cleanupSeed(seed);
  });

  test('Apply button disabled until all items approved/discarded', async ({ page }) => {
    // TODO: assert Apply disabled when an item is unreviewed; enabled after approve all.
    expect(true).toBe(true);
  });

  test('Apply commits to Self-Study Editor with correct content', async ({ page }) => {
    // TODO: click Apply, navigate to Self-Study Editor, assert spec narratives populated.
    expect(true).toBe(true);
  });

  test('Edited cards land with edited text (not AI original)', async ({ page }) => {
    // TODO: pre-seed an edited card, Apply, assert editor shows edited text.
    expect(true).toBe(true);
  });

  test('Discarded cards are NOT present after Apply', async ({ page }) => {
    // TODO: pre-seed a discarded card, Apply, assert editor doesn't show it.
    expect(true).toBe(true);
  });
});
