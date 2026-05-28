/**
 * Workflow sequencing fixes (follow-on to CR-045 / CR-047).
 *
 * Two reported sequencing problems on the Self-Study editor:
 *
 *   1. Sitting on the Review surface, clicking "Upload Files" jumped the
 *      UI to the *previous* run's "Parsing complete" screen instead of a
 *      fresh Upload step. Upload Files now always starts a NEW import:
 *      when the prior run has settled (parsed/applied/finished/…) the
 *      wizard is reset to the Upload step.
 *
 *   2. Opening the editor dropped the PC on the Standards view (workflow
 *      phase 3) even when un-applied drafts were still waiting in Review
 *      (phase 2). The editor now opens on the Review surface when there
 *      are pending drafts, so the PC follows the IMPORT → DRAFTS →
 *      SELF-STUDY → SUBMIT order.
 *
 * The `wizard_review_minimal` fixture seeds aiStatus='parsed' with
 * populated buckets — i.e. parsed drafts that have NOT been applied — so
 * both behaviors are exercised directly.
 */
import { test, expect } from '@playwright/test';
import {
  seedFixture,
  cleanupSeed,
  loginAsSeededViaSso,
  type SeedResult,
} from '../helpers/seed';

test.describe('Self-Study editor — workflow sequencing', () => {
  let seed: SeedResult | undefined;

  test.beforeEach(async () => {
    seed = await seedFixture('wizard_review_minimal');
  });

  test.afterEach(async () => {
    await cleanupSeed(seed);
    seed = undefined;
  });

  test('opens on the Review surface when drafts are waiting (phase 2, not phase 3)', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsSeededViaSso(page, seed!);
    await page.goto(`/self-study/${seed!.submissionId}`);

    // No tab click — the editor should land on Review on its own because
    // the seeded import is parsed with un-applied drafts.
    await expect(
      page.getByRole('heading', { name: /^Review$/i })
    ).toBeVisible({ timeout: 20_000 });
  });

  test('clicking Upload Files from Review starts a fresh import (no stale Parse screen)', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsSeededViaSso(page, seed!);
    await page.goto(`/self-study/${seed!.submissionId}`);

    // Editor opens on Review (per the test above).
    await expect(
      page.getByRole('heading', { name: /^Review$/i })
    ).toBeVisible({ timeout: 20_000 });

    // Click Upload Files to import ANOTHER document.
    await page.getByRole('button', { name: /Upload Files/i }).click();

    // The wizard opens on the Upload step — a fresh start…
    await expect(
      page.getByRole('heading', { name: /Upload your self-study document/i })
    ).toBeVisible({ timeout: 15_000 });
    // …and the previous run's "Parsing complete" screen is NOT shown.
    await expect(page.getByText('Parsing complete')).toHaveCount(0);
    // The Upload step is the active wizard step.
    await expect(
      page.getByRole('tab', { name: /^Upload$/i, selected: true })
    ).toBeVisible();
  });
});
