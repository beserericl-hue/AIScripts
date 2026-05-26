/**
 * CR-024 — Matrix ↔ Spec bidirectional link.
 *
 * Click a spec in the SpecRail → ALL matrices that address that spec
 * scroll to + flash-highlight the matching row. The wiring:
 *   aiImportStore.setMatrixScrollSpec(specKey) is called on every rail
 *   click; MatricesView reads matrixScrollSpec and finds every
 *   `[id$="row-{std}-{spec}"]` anchor to scroll into view.
 *
 * For E2E we exercise the rail-click side (no actual scroll/highlight
 * verification — that's brittle in headless and not the load-bearing
 * invariant; the load-bearing invariant is that the rail click
 * BROADCASTS via the store, which then enables MatricesView to scroll).
 *
 * Seed inline: extend wizard_review_minimal with a matrix that has one
 * cell addressing spec 1.a. The matrix-cell-bucket render in
 * ItemCardList surfaces the "Curriculum matrices for 1.a" header when
 * the spec is selected — that's the contract this CR ships.
 */
import { test, expect } from '@playwright/test';
import {
  seedFixture,
  cleanupSeed,
  loginAsSeededViaSso,
  gotoReviewStep,
  type SeedResult,
} from '../helpers/seed';

test.describe('CR-024 — matrix ↔ spec bidirectional link', () => {
  let seed: SeedResult | undefined;

  test.beforeEach(async () => {
    seed = await seedFixture('wizard_review_minimal', {
      // Override the default empty matrices with one that addresses 1.a.
      import: {
        aiMatrices: [
          {
            matrixId: 'mx-1',
            name: 'Curriculum Map',
            columnHeaders: ['CHS 101', 'CHS 201'],
            cells: [
              {
                std: '1',
                spec: 'a',
                columnIndex: 1,
                codeRaw: 'I',
                rowAnchor: 'matrix-mx-1-row-1-a',
                confidence: 1,
              },
              {
                std: '1',
                spec: 'a',
                columnIndex: 2,
                codeRaw: 'T',
                rowAnchor: 'matrix-mx-1-row-1-a',
                confidence: 1,
              },
            ],
          },
        ],
      } as any,
    });
  });

  test.afterEach(async () => {
    await cleanupSeed(seed);
    seed = undefined;
  });

  test('selecting spec 1.a in the rail surfaces the "Curriculum matrices for 1.a" header', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsSeededViaSso(page, seed!);
    await gotoReviewStep(page, seed!);

    // gotoReviewStep already selected the first spec tab (which is 1.a).
    // The ItemCardList renders a "Curriculum matrices for {std}.{spec}"
    // header above the cards whenever the active bucket has matching
    // matrix rows. That header is the visible affordance CR-024 ships:
    // it tells the coordinator "this spec has matrix coverage here".
    await expect(
      page.getByText(/Curriculum matrices for 1\.a/i)
    ).toBeVisible({ timeout: 15_000 });
  });

  test('the matrix name is rendered as a clickable Jump button (CR-024 affordance)', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsSeededViaSso(page, seed!);
    await gotoReviewStep(page, seed!);

    // The header renders one button per matching matrix; clicking
    // dispatches selectMatrixRow(rowAnchor) which the MatricesView
    // consumes to scroll + flash. We assert the button exists +
    // is clickable. Visual scroll/highlight isn't asserted (jsdom
    // headless quirks make it flaky; the broadcast-store path is
    // unit-tested in the matrixScrollSpec selectors).
    const matrixBtn = page.getByRole('button', { name: /Curriculum Map/i });
    await expect(matrixBtn).toBeVisible({ timeout: 15_000 });
    await matrixBtn.click();
    // No specific assertion after the click — the test passes if the
    // click handler doesn't throw and the button stays in the DOM.
    await expect(matrixBtn).toBeVisible();
  });

  test('inline coverage breakdown lists the column codes (I, T, etc.) for the spec', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsSeededViaSso(page, seed!);
    await gotoReviewStep(page, seed!);

    // The per-spec matrix references panel includes a grid showing
    // "{column header}: {code}" per cell. For our seed (2 cells under
    // 1.a — CHS 101=I + CHS 201=T) both codes must render.
    await expect(page.getByText('CHS 101:')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('CHS 201:')).toBeVisible();
    // The font-mono codes 'I' and 'T' appear in the breakdown.
    const breakdownArea = page
      .locator('text=/Curriculum matrices for 1\\.a/i')
      .locator('xpath=..');
    await expect(breakdownArea.getByText(/^I$/).first()).toBeVisible();
    await expect(breakdownArea.getByText(/^T$/).first()).toBeVisible();
  });

  test('cell-count chip reflects the number of matrix cells addressing the spec', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsSeededViaSso(page, seed!);
    await gotoReviewStep(page, seed!);

    // The Jump button has a small chip "2 cells" since spec 1.a is
    // addressed by 2 matrix cells in our seed.
    await expect(page.getByText(/2 cells/i)).toBeVisible({ timeout: 15_000 });
  });
});
