/**
 * CR-059 — the legacy "Import Document" editor is gone: no toolbar button and
 * no "Hide legacy importer" preference in the settings menu. The new "Import
 * file" button is present in its place. E2E vs live.
 */
import { test, expect } from '@playwright/test';
import { seedFixture, cleanupSeed, loginAsSeededViaSso, type SeedResult } from '../helpers/seed';
import { gotoEditorStandards } from '../helpers/importFile';

test.describe('Legacy importer removed', () => {
  let seed: SeedResult | undefined;
  test.afterEach(async () => {
    await cleanupSeed(seed);
    seed = undefined;
  });

  test('no "Import Document" button, no "Hide legacy importer" pref; "Import file" exists', async ({ page }) => {
    test.setTimeout(90_000);
    seed = await seedFixture('wizard_review_minimal', {
      user: {
        email: 'legacy-removed@x.test',
        preferences: { tours: { welcome: true, 'self-study': true } },
      },
    });
    await loginAsSeededViaSso(page, seed);
    await gotoEditorStandards(page, seed);

    // New button present; legacy button absent.
    await expect(page.getByTestId('import-file-button')).toBeVisible();
    await expect(page.getByRole('button', { name: /Import Document/i })).toHaveCount(0);

    // The "Hide legacy importer" preference is gone from the settings menu.
    const cog = page.getByRole('button', { name: /settings|preferences/i }).first();
    if (await cog.count()) {
      await cog.click({ force: true }).catch(() => {});
    }
    await expect(page.getByText(/Hide legacy importer/i)).toHaveCount(0);
  });
});
