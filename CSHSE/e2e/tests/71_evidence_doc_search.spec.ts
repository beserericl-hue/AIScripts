/**
 * Document search in the Review "Papers / Projects / Appendices" list. The
 * coordinator can filter the evidence-doc list to only those documents indexed
 * for a given Standard / Subspecification (the routing the reader uses to find
 * evidence per spec), and/or by a free-text match on title. Confirms which
 * documents actually landed under (say) Standard 4.a.
 */
import { test, expect } from '@playwright/test';
import { seedFixture, cleanupSeed, loginAsSeededViaSso, gotoReviewStep, type SeedResult } from '../helpers/seed';

function paper(id: string, title: string, std: string, spec: string) {
  return {
    sectionId: id, heading: id, snippet: title, htmlSnippet: `<p>${title}</p>`,
    wordCount: 5, confidence: 0.9, acceptState: 'pending', rationale: '',
    title, docSubKind: 'paper',
    resolvedStd: std, resolvedSpec: spec,
    routing: { std, spec },
  };
}

const P4A = 'sec-doc-4a';
const P4B = 'sec-doc-4b';
const P5A = 'sec-doc-5a';

test.describe('Evidence-doc search (filter by Standard / Subspec / text)', () => {
  let seed: SeedResult | undefined;
  test.afterEach(async () => { await cleanupSeed(seed); seed = undefined; });

  test('filter the Papers list to the docs indexed for a Standard / Subspec', async ({ page }) => {
    test.setTimeout(120_000);
    seed = await seedFixture('wizard_review_minimal', {
      user: { email: 'doc-search@x.test', preferences: { tours: { welcome: true, 'self-study': true } } },
      submission: { programLevel: 'associate' },
      reviewState: {
        buckets: {}, tags: [], cvs: [],
        evidenceDocs: [
          paper(P4A, 'Assessment Rubric A11', '4', 'a'),
          paper(P4B, 'Program Survey Results A13', '4', 'b'),
          paper(P5A, 'Admissions Policy Manual', '5', 'a'),
        ],
        introductions: {}, placeholderSections: [],
        approvedIds: [], discardedIds: [], itemSources: {}, mergeLog: [],
      },
    });
    await loginAsSeededViaSso(page, seed);
    await gotoReviewStep(page, seed);

    // Open the Papers / Projects / Appendices view.
    await page.getByTestId('rail-papers').click();
    // All three papers visible initially.
    await expect(page.locator(`[data-section-id="${P4A}"]`)).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(`[data-section-id="${P4B}"]`)).toBeVisible();
    await expect(page.locator(`[data-section-id="${P5A}"]`)).toBeVisible();

    // --- Filter to Standard 4 → the two Std-4 docs remain; the Std-5 doc hides. ---
    await page.getByTestId('evdocs-std-filter').selectOption('4');
    await expect(page.getByTestId('evdocs-filter-count')).toContainText('showing 2 of 3');
    await expect(page.locator(`[data-section-id="${P4A}"]`)).toBeVisible();
    await expect(page.locator(`[data-section-id="${P4B}"]`)).toBeVisible();
    await expect(page.locator(`[data-section-id="${P5A}"]`)).toHaveCount(0);

    // --- Narrow to Subspec 4.a → only the 4.a doc. ---
    await page.getByTestId('evdocs-spec-filter').selectOption('a');
    await expect(page.getByTestId('evdocs-filter-count')).toContainText('showing 1 of 3');
    await expect(page.locator(`[data-section-id="${P4A}"]`)).toBeVisible();
    await expect(page.locator(`[data-section-id="${P4B}"]`)).toHaveCount(0);

    // --- Clear, then free-text search matches on title. ---
    await page.getByTestId('evdocs-clear-filters').click();
    await page.getByTestId('evdocs-search').fill('Admissions');
    await expect(page.getByTestId('evdocs-filter-count')).toContainText('showing 1 of 3');
    await expect(page.locator(`[data-section-id="${P5A}"]`)).toBeVisible();
    await expect(page.locator(`[data-section-id="${P4A}"]`)).toHaveCount(0);

    // --- A no-match filter shows the empty state. ---
    await page.getByTestId('evdocs-search').fill('nonexistent-zzz');
    await expect(page.getByTestId('evdocs-no-matches')).toBeVisible();
    console.log('Evidence-doc search: Standard/Subspec + text filters work ✓');
  });
});
