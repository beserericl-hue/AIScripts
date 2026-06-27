/**
 * CR-064 — mode-aware Review chrome. The Review surface must NOT show the
 * self-study-phase controls (Validate All, Validated counter, Submit
 * Self-Study, overall progress) or the confusing wizard/redundant nav
 * ("Back to editor", "◂ Back", "Next: Apply"). Navigation is the top tabs;
 * Approve writes to the editor automatically.
 */
import { test, expect } from '@playwright/test';
import {
  seedFixture,
  cleanupSeed,
  loginAsSeededViaSso,
  gotoReviewStep,
  type SeedResult
} from '../helpers/seed';

test.describe('CR-064 — Review is de-noised', () => {
  let seed: SeedResult | undefined;
  test.beforeEach(async () => { seed = await seedFixture('wizard_review_minimal'); });
  test.afterEach(async () => { await cleanupSeed(seed); });

  test('self-study chrome + wizard/redundant nav are absent on Review', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsSeededViaSso(page, seed!);
    await gotoReviewStep(page, seed!);

    // The Review surface is up.
    await expect(page.getByRole('heading', { name: /^Review$/i })).toBeVisible();

    // Self-study-phase chrome is hidden on Review (CR-064).
    await expect(page.getByTestId('validate-all-cta')).toHaveCount(0);
    await expect(page.getByTestId('submit-self-study-cta')).toHaveCount(0);
    await expect(page.getByText(/\d+\/\d+ Validated/)).toHaveCount(0);

    // Redundant / confusing navigation removed.
    await expect(page.getByRole('button', { name: /Back to editor/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^◂?\s*Back$/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Next:\s*(Apply|Matrix)/i })).toHaveCount(0);

    // The single-source filter is hidden (only shows for >1 source).
    await expect(page.getByText(/Filter by source/i)).toHaveCount(0);

    // Review still works: a Compare action is present (the cards render).
    await expect(page.getByRole('button', { name: /^compare$/i }).first()).toBeVisible();

    // CR-070 — each card has a per-card "Import file" control (scoped to that
    // card's own spec; opens a modal on use).
    await expect(page.getByText('Import file').first()).toBeVisible();
    await expect(page.getByTestId('card-upload-input').first()).toBeAttached();

    // CR-066 — the spec-level approve button is renamed + reveals the outcome.
    await expect(page.getByTestId('approve-all')).toContainText(/Approve specification.*editor/i);
    await expect(page.getByText(/Approve This Subspecification/i)).toHaveCount(0);

    // CR-065 — no permanent AI-evaluation sidebar; an "ⓘ" opens it as a modal.
    await expect(page.getByLabel('AI evaluation panel')).toHaveCount(0); // not inline
    await page.getByRole('button', { name: 'AI evaluation' }).first().click();
    await expect(page.getByRole('dialog', { name: 'AI evaluation' })).toBeVisible();
    // It's read-only — no Show-in-source / Place-as / Reassign inside the modal.
    const modal = page.getByRole('dialog', { name: 'AI evaluation' });
    await expect(modal.getByText(/Show in source/i)).toHaveCount(0);
    await expect(modal.getByText(/Place this item as|Reassign to a different/i)).toHaveCount(0);
    await modal.getByRole('button', { name: 'Close' }).click();

    // CR-069 — the coverage legend is visible (dot ≠ match confidence).
    await expect(page.getByText(/Coverage:/i)).toBeVisible();

    // CR-068 — clicking a count shows a flat cross-spec list with a back affordance.
    await page.getByTestId('count-filter-evidence').click();
    await expect(page.getByTestId('back-to-specs')).toBeVisible();
    await expect(page.getByText(/Showing all evidence across every spec/i)).toBeVisible();
    await page.getByTestId('back-to-specs').click();
    await expect(page.getByTestId('back-to-specs')).toHaveCount(0);

    // CR-068 — selecting a spec/subspec in the rail ALSO exits the flat list
    // (returns the UI to normal), so the rail is never a dead end.
    await page.getByTestId('count-filter-evidence').click();
    await expect(page.getByText(/Showing all evidence across every spec/i)).toBeVisible();
    await page.getByRole('tab').filter({ hasText: /Document Introduction/i }).first().click();
    await expect(page.getByText(/Showing all evidence across every spec/i)).toHaveCount(0);
  });
});
