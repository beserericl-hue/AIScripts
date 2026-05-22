/**
 * Tier 1 — Matrix step regression (CR-029 / CR-035).
 *
 * Status: SCAFFOLDED.
 */
import { test, expect } from '@playwright/test';
import { seedFixture, cleanupSeed, type SeedResult } from '../helpers/seed';

test.describe.skip('Matrix step', () => {
  let seed: SeedResult | undefined;

  test.beforeEach(async () => {
    seed = await seedFixture('wizard_matrix_pending');
  });
  test.afterEach(async () => {
    await cleanupSeed(seed);
  });

  test('Inferred subspec chip shown on each row', async ({ page }) => {
    // TODO: assert each row card has a "Spec X.y" chip with a real subspec.
    expect(true).toBe(true);
  });

  test('Keep this row → row appears under resolved subspec on Review', async ({ page }) => {
    // TODO: click Keep, navigate to Review, assert row visible under target spec.
    // CR-035 — also verify Curriculum Matrix tab populated with cell codes.
    expect(true).toBe(true);
  });

  test('Remove this row → row vanishes; Restore brings it back', async ({ page }) => {
    // TODO: click Remove, assert row in Removed section. Click Restore, assert returns.
    expect(true).toBe(true);
  });

  test('Hard refresh mid-matrix returns to same row position', async ({ page }) => {
    // TODO: navigate to row N, refresh, assert row N still active.
    expect(true).toBe(true);
  });
});
