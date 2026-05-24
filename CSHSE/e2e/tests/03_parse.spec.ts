/**
 * Tier 1 — Parse step regression.
 *
 * Status: SCAFFOLDED.
 */
import { test, expect } from '@playwright/test';
import { seedFixture, cleanupSeed, loginAsSeededViaSso, type SeedResult } from '../helpers/seed';

test.describe.skip('Parse step', () => {
  let seed: SeedResult | undefined;

  test.beforeEach(async () => {
    seed = await seedFixture('wizard_parse_running');
  });
  test.afterEach(async () => {
    await cleanupSeed(seed);
  });

  test('Stage labels use friendly names (no "mammoth")', async ({ page }) => {
    // TODO: navigate to Parse step, assert all stage labels are user-facing
    // (Document Reader / Reading structure / Building chunks / Embedding / Indexing).
    // Assert no occurrence of the literal string "mammoth" or "deep_walker".
    expect(true).toBe(true);
  });

  test('Each completed stage shows a green checkmark', async ({ page }) => {
    // TODO: assert per-stage check icon presence.
    expect(true).toBe(true);
  });

  test('Hard refresh during Parse resumes at the same stage', async ({ page }) => {
    // TODO: refresh mid-parse, assert stage state preserved.
    expect(true).toBe(true);
  });
});
