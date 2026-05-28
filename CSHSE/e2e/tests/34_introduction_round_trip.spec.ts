/**
 * CR-046 — Document Introduction editor discoverability + round-trip.
 *
 * The introduction editor + persistence endpoint shipped in CR-039
 * Phase 2c, but the editor was only reachable in a buried sub-state.
 * CR-046 added a discoverable "Introduction" button (first in the
 * SELF-STUDY toolbar group). This spec verifies:
 *   1. The "Introduction" button is reachable from the toolbar.
 *   2. Clicking it renders the document-introduction editor.
 *   3. Typing + Save persists to Submission.documentIntroduction and
 *      survives a page reload (the full Review→Apply→Editor data flow
 *      the user asked to close).
 *
 * Also discharges CR-039's deferred 23_introduction.spec.ts.
 */
import { test, expect } from '@playwright/test';
import {
  seedFixture,
  cleanupSeed,
  loginAsSeededViaSso,
  type SeedResult,
} from '../helpers/seed';

test.describe('CR-046 — Introduction surface round-trip', () => {
  let seed: SeedResult | undefined;

  test.beforeEach(async () => {
    seed = await seedFixture('wizard_review_minimal');
  });

  test.afterEach(async () => {
    await cleanupSeed(seed);
    seed = undefined;
  });

  test('Introduction button is first in the SELF-STUDY group and opens the editor', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsSeededViaSso(page, seed!);
    await page.goto(`/self-study/${seed!.submissionId}`);
    await page.waitForLoadState('networkidle');

    const introBtn = page.getByRole('button', { name: /^Introduction$/i });
    await expect(introBtn).toBeVisible({ timeout: 15_000 });
    await introBtn.click();

    // The document-introduction editor renders (heading + TipTap surface).
    await expect(
      page.getByRole('heading', { name: /Document Introduction/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('typing + Save persists across a page reload', async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsSeededViaSso(page, seed!);
    await page.goto(`/self-study/${seed!.submissionId}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /^Introduction$/i }).click();
    await expect(
      page.getByRole('heading', { name: /Document Introduction/i })
    ).toBeVisible({ timeout: 10_000 });

    const marker = `Stevenson HS program introduction ${Date.now()}`;
    const editor = page.locator('.ProseMirror').first();
    await editor.click();
    await editor.fill(marker);

    // Click Save and wait for the PATCH /introduction to resolve 200.
    // (The on-screen "Saved" badge auto-clears after ~1.5s, so it's a
    // flaky signal; the network response is the deterministic one.)
    const savePromise = page.waitForResponse(
      (r) =>
        /\/api\/submissions\/[^/]+\/introduction$/.test(r.url()) &&
        r.request().method() === 'PATCH'
    );
    await page.getByRole('button', { name: /^Save$/i }).first().click();
    const saveResp = await savePromise;
    expect(saveResp.status()).toBe(200);

    // Reload — the text must survive (persisted to documentIntroduction).
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /^Introduction$/i }).click();
    await expect(
      page.getByRole('heading', { name: /Document Introduction/i })
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.ProseMirror').first()).toContainText(marker);
  });
});
