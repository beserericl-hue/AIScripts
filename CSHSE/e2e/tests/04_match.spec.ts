/**
 * Tier 1 — Match step regression.
 *
 * Status: SCAFFOLDED.
 */
import { test, expect } from '@playwright/test';
import { seedFixture, cleanupSeed, type SeedResult } from '../helpers/seed';

test.describe.skip('Match step', () => {
  let seed: SeedResult | undefined;

  test.beforeEach(async () => {
    seed = await seedFixture('wizard_match_done');
  });
  test.afterEach(async () => {
    await cleanupSeed(seed);
  });

  test('Every paragraph lands in exactly one bucket', async ({ page }) => {
    // TODO: sum bucket card counts, compare to total parsed paragraphs from
    // the fixture metadata, assert equal.
    expect(true).toBe(true);
  });

  test('Confidence colors render correctly', async ({ page }) => {
    // TODO: assert high-confidence cards have green stripe, medium amber, low red.
    expect(true).toBe(true);
  });

  test('byte_offset_start is monotonic within an import (CR-031)', async ({ page }) => {
    // TODO: scrape the rendered card order, assert byteOffsetStart values strictly increase.
    expect(true).toBe(true);
  });
});
