/**
 * CR-059 — paste a selected section of an imported file into the active
 * standard/sub-spec narrative; the text persists to narrativeContent. E2E vs live.
 */
import { test, expect } from '@playwright/test';
import { seedFixture, cleanupSeed, loginAsSeededViaSso, type SeedResult } from '../helpers/seed';
import {
  gotoEditorStandards,
  openAndImport,
  selectPreviewAndGetNeedle,
  apiGet,
  stripHtml,
} from '../helpers/importFile';

test.describe('Import-file drawer — paste into narrative', () => {
  let seed: SeedResult | undefined;
  test.afterEach(async () => {
    await cleanupSeed(seed);
    seed = undefined;
  });

  test('selected text pastes into the active spec narrative and persists', async ({ page }) => {
    test.setTimeout(120_000);
    seed = await seedFixture('wizard_review_minimal', {
      user: {
        email: 'import-paste-narr@x.test',
        preferences: { tours: { welcome: true, 'self-study': true } },
      },
    });
    await loginAsSeededViaSso(page, seed);
    await gotoEditorStandards(page, seed); // default selection is spec 1.a

    await openAndImport(page);
    const needle = await selectPreviewAndGetNeedle(page);
    expect(needle.length).toBeGreaterThanOrEqual(5);

    await page.getByTestId('import-file-paste-narrative').click();
    await expect(page.getByTestId('import-file-paste-narrative')).toContainText(/Pasted into narrative/i);

    // Localize: did the text actually land in the on-screen narrative editor?
    await expect(page.locator('.ProseMirror').first()).toContainText(needle, { timeout: 10_000 });

    // The autosave (PATCH /narrative) persists it — read it back from the API,
    // scoped to standard 1 / spec a, and confirm the needle landed there.
    await expect
      .poll(
        async () => {
          const nc = (await apiGet(page, seed!.submissionId, '')).body?.narrativeContent ?? [];
          const entry = (nc as any[]).find((n) => n.standardCode === '1' && n.specCode === 'a');
          return stripHtml(entry?.content || '');
        },
        { timeout: 30_000, intervals: [1500] }
      )
      .toContain(needle);
  });
});
