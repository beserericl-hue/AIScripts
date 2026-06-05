/**
 * CR-059 — paste a selected section as the imported file's supporting-evidence
 * summary (description); it persists on the evidence record. E2E vs live.
 */
import { test, expect } from '@playwright/test';
import { seedFixture, cleanupSeed, loginAsSeededViaSso, type SeedResult } from '../helpers/seed';
import {
  gotoEditorStandards,
  openAndImport,
  selectPreviewAndGetNeedle,
  apiGet,
} from '../helpers/importFile';

test.describe('Import-file drawer — paste as supporting-evidence summary', () => {
  let seed: SeedResult | undefined;
  test.afterEach(async () => {
    await cleanupSeed(seed);
    seed = undefined;
  });

  test('selected text saves as the imported file’s evidence summary', async ({ page }) => {
    test.setTimeout(120_000);
    seed = await seedFixture('wizard_review_minimal', {
      user: {
        email: 'import-paste-summary@x.test',
        preferences: { tours: { welcome: true, 'self-study': true } },
      },
    });
    await loginAsSeededViaSso(page, seed);
    await gotoEditorStandards(page, seed);

    await openAndImport(page);
    const needle = await selectPreviewAndGetNeedle(page);
    expect(needle.length).toBeGreaterThanOrEqual(5);

    await page.getByTestId('import-file-paste-summary').click();
    await expect(page.getByTestId('import-file-paste-summary')).toContainText(/Added to summary/i);
    // The panel echoes the current summary.
    await expect(page.getByTestId('import-file-summary')).toContainText(needle);

    // Persisted on the evidence record (description), readable via the API.
    await expect
      .poll(
        async () => {
          const body = (await apiGet(page, seed!.submissionId, '/evidence')).body;
          const list = body?.evidence ?? body ?? [];
          return JSON.stringify(list);
        },
        { timeout: 30_000, intervals: [1500] }
      )
      .toContain(needle);
  });
});
