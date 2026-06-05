/**
 * CR-059 — the Import-file drawer is reachable beyond a sub-spec: on the
 * Introduction surface, "Paste into narrative" targets the document
 * introduction and persists. E2E vs live.
 */
import { test, expect } from '@playwright/test';
import { seedFixture, cleanupSeed, loginAsSeededViaSso, type SeedResult } from '../helpers/seed';
import {
  gotoEditorIntroduction,
  openAndImport,
  selectPreviewAndGetNeedle,
  apiGet,
  stripHtml,
} from '../helpers/importFile';

test.describe('Import-file drawer — Introduction target (no sub-spec)', () => {
  let seed: SeedResult | undefined;
  test.afterEach(async () => {
    await cleanupSeed(seed);
    seed = undefined;
  });

  test('paste into narrative on the Introduction view persists to the document intro', async ({ page }) => {
    test.setTimeout(120_000);
    seed = await seedFixture('wizard_review_minimal', {
      user: {
        email: 'import-intro@x.test',
        preferences: { tours: { welcome: true, 'self-study': true } },
      },
    });
    await loginAsSeededViaSso(page, seed);
    await gotoEditorIntroduction(page, seed);

    await openAndImport(page);

    // The narrative button must be enabled here (target = Introduction).
    await expect(page.getByTestId('import-file-paste-narrative')).toBeEnabled();
    const needle = await selectPreviewAndGetNeedle(page);

    await page.getByTestId('import-file-paste-narrative').click();
    await expect(page.getByTestId('import-file-paste-narrative')).toContainText(/Pasted into narrative/i);

    await expect
      .poll(
        async () => stripHtml((await apiGet(page, seed!.submissionId, '')).body?.documentIntroduction || ''),
        { timeout: 30_000, intervals: [1500] }
      )
      .toContain(needle);
  });
});
