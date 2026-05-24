/**
 * Tier 1 — CR-037 Empty-buckets guard.
 *
 * Status: SCAFFOLDED. Requires the CR-037 code to land before assertions
 * make sense; the empty-buckets fixture exists to drive the test.
 */
import { test, expect } from '@playwright/test';
import { seedFixture, cleanupSeed, loginAsSeededViaSso, type SeedResult } from '../helpers/seed';

test.describe.skip('CR-037 — Empty buckets guard', () => {
  test('Empty-bucket import shows actionable error, NOT empty Review', async ({ page }) => {
    // TODO: seed a fixture with aiStatus='finished' but aiBuckets={}.
    // Navigate to wizard, assert the "Import completed with zero items" panel,
    // assert Review tab is unreachable.
    expect(true).toBe(true);
  });

  test('Coordinator can click Start over from the empty-bucket panel', async ({ page }) => {
    // TODO: click Start over, assert returns to Upload step.
    expect(true).toBe(true);
  });
});
