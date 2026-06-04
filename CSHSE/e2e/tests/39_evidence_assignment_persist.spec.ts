/**
 * CV/Syllabi/Paper Standard assignment persistence — E2E.
 *
 * Regression guard for the reported bug: assigning a Standard/Substandard to a
 * CV had no Save and was lost on any rail refetch (Re-run detectors / reload),
 * reverting to "Unassigned". The fix persists the assignment server-side via
 * POST /review/route-evidence. This spec proves it on the REAL app:
 *   1. Assign a Standard to a CV on the Review surface → a "Saved" chip appears.
 *   2. Reload the page → the assignment is still there (not Unassigned).
 *
 * Seeds aiReviewState.cvs directly (top-level reviewState override). The
 * Review surface reads aiReviewState, so the CV rail renders without needing
 * the bucket/editor path.
 */
import { test, expect } from '@playwright/test';
import {
  seedFixture,
  cleanupSeed,
  loginAsSeededViaSso,
  type SeedResult,
} from '../helpers/seed';

const CV_SECTION = 'cv-e2e-1';

test.describe('Evidence assignment persists across reload', () => {
  let seed: SeedResult | undefined;

  test.afterEach(async () => {
    await cleanupSeed(seed);
    seed = undefined;
  });

  test('assign a Standard to a CV → Saved → survives reload', async ({ page }) => {
    test.setTimeout(120_000);

    seed = await seedFixture('wizard_review_minimal', {
      user: {
        email: 'evidence-assign-persist@x.test',
        preferences: { tours: { welcome: true, 'self-study': true } },
      },
      // Stamp aiReviewState directly so the Review surface shows a CV to assign.
      reviewState: {
        buckets: {},
        tags: [],
        cvs: [
          {
            sectionId: CV_SECTION,
            facultyName: 'Dr. E2E Persist',
            snippet: 'PhD in Human Services, persisted via reviewState seed.',
            routing: { source: 'matcher' },
          },
        ],
        evidenceDocs: [],
        introductions: {},
        placeholderSections: [],
        approvedIds: [],
        discardedIds: [],
        itemSources: {},
        mergeLog: [],
      },
    });

    await loginAsSeededViaSso(page, seed);
    await page.goto(`/self-study/${seed.submissionId}`);
    await page.waitForLoadState('networkidle');

    // The submission opens on the Review surface (un-triaged drafts present). If
    // not, click the Drafts → Review toolbar button.
    const cvsTile = page.locator('[data-tour="review-cvs"]');
    if (!(await cvsTile.isVisible().catch(() => false))) {
      await page.getByRole('button', { name: /^Review\b/i }).first().click();
    }
    await expect(cvsTile).toBeVisible({ timeout: 25_000 });
    await cvsTile.click();

    // Assign a Standard. Selecting a standard auto-picks its first substandard,
    // so the pair is complete and the save fires.
    const stdSelect = page.locator(`[data-testid="cv-assign-${CV_SECTION}-std"]`);
    await expect(stdSelect).toBeVisible({ timeout: 15_000 });
    // Standard "6" (Faculty) exists in the live CSHSE catalog.
    await stdSelect.selectOption('6');

    // The save chip confirms the server round-trip.
    await expect(
      page.locator(`[data-testid="cv-assign-${CV_SECTION}-savestate"]`)
    ).toHaveText(/saved/i, { timeout: 15_000 });

    // RELOAD — the real test. Before the fix this reverted to "Unassigned".
    await page.reload();
    await page.waitForLoadState('networkidle');

    const cvsTile2 = page.locator('[data-tour="review-cvs"]');
    if (!(await cvsTile2.isVisible().catch(() => false))) {
      await page.getByRole('button', { name: /^Review\b/i }).first().click();
    }
    await expect(cvsTile2).toBeVisible({ timeout: 25_000 });
    await cvsTile2.click();

    const stdSelectAfter = page.locator(`[data-testid="cv-assign-${CV_SECTION}-std"]`);
    await expect(stdSelectAfter).toBeVisible({ timeout: 15_000 });
    // Persisted: the Standard is still 6, not blank ("— standard —").
    await expect(stdSelectAfter).toHaveValue('6');
  });
});
