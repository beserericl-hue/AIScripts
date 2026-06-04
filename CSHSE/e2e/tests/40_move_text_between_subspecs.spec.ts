/**
 * Move text from one card into another subspec — E2E.
 *
 * The parser sometimes dumps a whole Standard into its first subspec. This
 * proves, on the real app, that a coordinator can select a paragraph in a card
 * and move it to another subspec — and that the move persists across reload.
 *
 *   1. Seed bucket 2.a with a 3-paragraph narrative.
 *   2. Open "Move text…", select the middle paragraph, send it to 2.b.
 *   3. The source card (2.a) no longer shows that paragraph.
 *   4. 2.b now contains it — and still does after a full reload.
 */
import { test, expect } from '@playwright/test';
import {
  seedFixture,
  cleanupSeed,
  loginAsSeededViaSso,
  gotoReviewStep,
  type SeedResult,
} from '../helpers/seed';

const SRC = 'sec-2a-move-e2e';

test.describe('Move text between subspecs', () => {
  let seed: SeedResult | undefined;

  test.afterEach(async () => {
    await cleanupSeed(seed);
    seed = undefined;
  });

  test('select a paragraph in 2.a and move it to 2.b → persists', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1680, height: 1050 });

    seed = await seedFixture('wizard_review_minimal', {
      user: {
        email: 'move-text-e2e@x.test',
        preferences: { tours: { welcome: true, 'self-study': true } },
      },
      reviewState: {
        buckets: {
          '2.a': {
            standardCode: '2',
            specCode: 'a',
            standardTitle: '',
            specPrompt: '',
            narratives: [
              {
                sectionId: SRC,
                heading: 'All of Standard 2 dumped here',
                snippet: 'KEEP ALPHA paragraph. MOVE BRAVO paragraph. KEEP CHARLIE paragraph.',
                htmlSnippet:
                  '<p>KEEP ALPHA paragraph.</p><p>MOVE BRAVO paragraph.</p><p>KEEP CHARLIE paragraph.</p>',
                wordCount: 9,
                confidence: 0.9,
                acceptState: 'pending',
                rationale: '',
              },
            ],
            evidenceText: [],
            evidenceFiles: [],
            matrixCells: [],
          },
        },
        tags: [],
        cvs: [],
        evidenceDocs: [],
        introductions: {},
        placeholderSections: [],
        approvedIds: [],
        discardedIds: [],
        itemSources: { [SRC]: { importId: 'imp-1', sourceFilename: 'ss.docx' } },
        mergeLog: [],
      },
    });

    await loginAsSeededViaSso(page, seed);
    await gotoReviewStep(page, seed); // lands on spec 2.a (only seeded spec)

    // The source card shows all three paragraphs.
    await expect(page.getByText('MOVE BRAVO paragraph.')).toBeVisible({ timeout: 15_000 });

    // Open the move modal for the seeded card.
    await page.getByTestId(`move-text-open-${SRC}`).click();
    const modalBody = page.getByTestId('move-text-body');
    await expect(modalBody).toBeVisible({ timeout: 10_000 });

    // Pick destination 2 → b.
    await page.getByTestId('move-text-std').selectOption('2');
    await page.getByTestId('move-text-spec').selectOption('b');

    // Select the middle paragraph and move it.
    await modalBody.locator('p', { hasText: 'MOVE BRAVO' }).selectText();
    await expect(page.getByTestId('move-text-selection')).toContainText('MOVE BRAVO', {
      timeout: 5000,
    });
    await page.getByTestId('move-text-confirm').click();

    // The source card (still on 2.a) no longer shows the moved paragraph, but
    // keeps the others.
    await expect(page.getByText('MOVE BRAVO paragraph.')).toBeHidden({ timeout: 10_000 });
    await expect(page.getByText('KEEP ALPHA paragraph.')).toBeVisible();

    // A 2.b tab now exists — open it; the moved paragraph is there.
    const spec2b = page.getByRole('tab', { name: /^2\.b/ });
    await expect(spec2b).toBeVisible({ timeout: 10_000 });
    await spec2b.click({ force: true });
    await expect(page.getByText('MOVE BRAVO paragraph.')).toBeVisible({ timeout: 10_000 });

    // RELOAD — the move must persist server-side.
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /^Review\b/i }).first().click();
    await page.getByRole('heading', { name: /^Review$/i }).waitFor({ timeout: 15_000 });
    await page.getByRole('tab', { name: /^2\.b/ }).click({ force: true });
    await expect(page.getByText('MOVE BRAVO paragraph.')).toBeVisible({ timeout: 15_000 });
  });
});
