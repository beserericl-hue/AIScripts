/**
 * CR-059 — Import-file drawer: import one file → it auto-appears in the File
 * Library (no explicit "keep") and its parsed preview renders. E2E vs live.
 */
import { test, expect } from '@playwright/test';
import { seedFixture, cleanupSeed, loginAsSeededViaSso, type SeedResult } from '../helpers/seed';
import { gotoEditorStandards, openAndImport, apiGet } from '../helpers/importFile';

test.describe('Import-file drawer — import + auto-add to File Library', () => {
  let seed: SeedResult | undefined;
  test.afterEach(async () => {
    await cleanupSeed(seed);
    seed = undefined;
  });

  test('uploading a file imports it (File Library) and shows a preview', async ({ page }) => {
    test.setTimeout(120_000);
    seed = await seedFixture('wizard_review_minimal', {
      user: {
        email: 'import-dragdrop@x.test',
        preferences: { tours: { welcome: true, 'self-study': true } },
      },
    });
    await loginAsSeededViaSso(page, seed);
    await gotoEditorStandards(page, seed);

    await openAndImport(page); // asserts imported + preview testids visible

    // Auto-import: the file is now a SupportingEvidence record for the submission.
    await expect
      .poll(async () => JSON.stringify((await apiGet(page, seed!.submissionId, '/evidence')).body),
        { timeout: 30_000, intervals: [1000] })
      .toMatch(/sample-import\.docx/i);
  });
});
