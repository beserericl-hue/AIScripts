/**
 * Tier 1 — Parse step regression.
 *
 * Seeds an in-progress parse state and asserts the friendly stage
 * label rendering, completed-stage iconography, and refresh-resume
 * behavior.
 */
import { test, expect } from '@playwright/test';
import {
  seedFixture,
  cleanupSeed,
  loginAsSeededViaSso,
  type SeedResult,
} from '../helpers/seed';

test.describe('Parse step', () => {
  let seed: SeedResult | undefined;

  test.afterEach(async () => {
    await cleanupSeed(seed);
    seed = undefined;
  });

  test('Stage labels use friendly names (no "mammoth")', async ({ page }) => {
    test.setTimeout(60_000);
    seed = await seedFixture('wizard_review_minimal', {
      user: { email: 'parse-labels@x.test' },
      import: {
        wizardStep: 'parse',
        // Use 'parsing' (not 'parsed') so the wizard's auto-route logic
        // (deriveStepFromStatus) keeps us on the Parse step instead of
        // jumping ahead to Review. ParseStep renders the friendly
        // stage labels regardless of running vs done state.
        aiStatus: 'parsing',
        aiStages: [
          { name: 'mammoth', state: 'done', detail: '1.2 MB HTML' },
          { name: 'deep_walker', state: 'done', detail: '142 sections' },
          { name: 'matcher', state: 'running', detail: '50 / 142' },
        ],
      },
    });
    await loginAsSeededViaSso(page, seed);
    await page.goto(`/self-study/${seed.submissionId}`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /importer wizard/i }).click();

    // Friendly labels MUST appear.
    await expect(page.getByText('Document Reader')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Reading structure')).toBeVisible();
    await expect(page.getByText('Matching to specifications')).toBeVisible();
    // The raw technical names must NOT leak into the UI.
    expect(await page.locator('body').textContent()).not.toContain('mammoth');
    expect(await page.locator('body').textContent()).not.toContain('deep_walker');
  });

  test('Each completed stage shows a green checkmark', async ({ page }) => {
    test.setTimeout(60_000);
    seed = await seedFixture('wizard_review_minimal', {
      user: { email: 'parse-checks@x.test' },
      import: {
        wizardStep: 'parse',
        aiStatus: 'parsing',
        aiStages: [
          { name: 'mammoth', state: 'done' },
          { name: 'deep_walker', state: 'done' },
          { name: 'matcher', state: 'done' },
        ],
      },
    });
    await loginAsSeededViaSso(page, seed);
    await page.goto(`/self-study/${seed.submissionId}`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /importer wizard/i }).click();

    // The Parse step renders one row per stage. Each completed stage
    // carries a CheckCircle2 icon (lucide-react renders as <svg> with
    // path data containing the icon mark). Count visible check-style
    // SVGs adjacent to stage labels.
    await expect(page.getByText('Document Reader')).toBeVisible({ timeout: 15_000 });
    // Lucide CheckCircle2 ships with a stable `lucide-circle-check-big`
    // (or similar) CSS class; assert there are >= 3 done-state markers.
    const checks = page.locator('svg.lucide-circle-check-big, svg[class*="check"]');
    const count = await checks.count();
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('Hard refresh during Parse resumes at the same stage', async ({ page }) => {
    test.setTimeout(60_000);
    seed = await seedFixture('wizard_review_minimal', {
      user: { email: 'parse-refresh@x.test' },
      import: {
        wizardStep: 'parse',
        aiStatus: 'parsing',
        aiStages: [
          { name: 'mammoth', state: 'done' },
          { name: 'deep_walker', state: 'done' },
          { name: 'matcher', state: 'running', detail: '42 / 100' },
        ],
      },
    });
    await loginAsSeededViaSso(page, seed);
    await page.goto(`/self-study/${seed.submissionId}`);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /importer wizard/i }).click();
    await expect(page.getByText('Matching to specifications')).toBeVisible({ timeout: 15_000 });

    // Hard refresh. The wizard's open/closed state (activeView) is
    // React-local and resets to 'standards' on reload, but the
    // Zustand step + stages are localStorage-persisted and rehydrate
    // synchronously. Re-open the wizard and verify the same running
    // stage is still rendered.
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /importer wizard/i }).click();
    await expect(page.getByText('Matching to specifications')).toBeVisible({ timeout: 20_000 });
  });
});
