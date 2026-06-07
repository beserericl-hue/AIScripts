/**
 * Approving an item must show up in the Standards/Specification editor
 * WITHOUT a hard reload — the gap the old spec 44 missed.
 *
 * Spec 44 only checked the server field `narrativeContent` via fetch (which
 * always worked — server materialization was never the bug). The real
 * user-reported failure was that approval flows through the Zustand store,
 * which never invalidated the react-query ['submission'] cache the editor
 * reads from, so approved text only appeared after a manual reload.
 *
 * This drives the actual UI: open spec 1.a editor (marker absent) → switch to
 * the Review surface and approve → switch back to the editor (NO page reload)
 * → the approved narrative is now visible in the on-screen ProseMirror editor.
 */
import { test, expect } from '@playwright/test';
import { seedFixture, cleanupSeed, loginAsSeededViaSso, type SeedResult } from '../helpers/seed';
import { gotoEditorStandards } from '../helpers/importFile';

const SEC = 'sec-editorsync-58';
const MARKER = 'EDITORSYNCMARKER58';

test.describe('Approved item reflects in the spec editor without reload', () => {
  let seed: SeedResult | undefined;
  test.afterEach(async () => {
    await cleanupSeed(seed);
    seed = undefined;
  });

  test('approve on Review surface → editor shows it (no reload)', async ({ page }) => {
    test.setTimeout(150_000);
    seed = await seedFixture('wizard_review_minimal', {
      user: {
        email: 'editor-sync@x.test',
        preferences: { tours: { welcome: true, 'self-study': true } },
      },
      reviewState: {
        buckets: {
          '1.a': {
            standardCode: '1', specCode: 'a', standardTitle: '', specPrompt: '',
            narratives: [
              {
                sectionId: SEC,
                heading: 'Editor-sync card',
                snippet: `${MARKER} narrative body.`,
                htmlSnippet: `<p>${MARKER} narrative body.</p>`,
                wordCount: 3, confidence: 0.95, acceptState: 'pending', rationale: '',
              },
            ],
            evidenceText: [], evidenceFiles: [], matrixCells: [],
          },
        },
        tags: [], cvs: [], evidenceDocs: [], introductions: {},
        placeholderSections: [], approvedIds: [], discardedIds: [],
        itemSources: {}, mergeLog: [],
      },
    });

    await loginAsSeededViaSso(page, seed);

    // --- 1) Standards editor for spec 1.a — the approved marker is NOT there yet. ---
    await gotoEditorStandards(page, seed); // default selection is spec 1.a
    await expect(page.locator('.ProseMirror').first()).toBeVisible({ timeout: 25_000 });
    await expect(page.locator('.ProseMirror').first()).not.toContainText(MARKER);

    // --- 2) Switch to the Review surface (in-session, no page.goto). ---
    await page.getByRole('button', { name: /^Review\b/i }).first().click();
    await expect(page.getByRole('heading', { name: /^Review$/i })).toBeVisible({ timeout: 15_000 });
    // Select spec 1.a in the rail so its card renders.
    const tab1a = page
      .getByRole('complementary', { name: /specifications/i })
      .getByRole('tab', { name: /^1\.a/i })
      .first();
    await expect(tab1a).toBeVisible({ timeout: 15_000 });
    await tab1a.click({ force: true });

    // Approve the narrative card. (Materializes server-side AND must refresh
    // the editor cache via the reviewMaterializedAt bridge.)
    const approve = page.getByTestId(`approve-toggle-${SEC}`);
    await expect(approve).toBeVisible({ timeout: 30_000 });
    await approve.click();
    await expect(approve).toHaveAttribute('data-approved', 'true', { timeout: 10_000 });

    // --- 3) Switch BACK to the Standards editor — NO reload. The approved
    //        narrative must now be visible in the on-screen editor. ---
    await page.getByRole('button', { name: /^Standards$/i }).first().click();
    await expect(page.locator('.ProseMirror').first()).toBeVisible({ timeout: 25_000 });
    await expect(page.locator('.ProseMirror').first()).toContainText(MARKER, { timeout: 25_000 });
  });
});
