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

    // First wait for the "Curriculum matrices for 1.a" header — that
    // proves the matrix-references panel mounted for the selected spec
    // (same passing precondition as test 1 above).
    await expect(
      page.getByText(/Curriculum matrices for 1\.a/i)
    ).toBeVisible({ timeout: 15_000 });

    // The Jump button uses the `title` attribute as its accessible name:
    // "Jump to this spec's row in Curriculum Map (N course cells)".
    // Match on that instead of bare "Curriculum Map" — title overrides
    // the span text when both are present.
    const matrixBtn = page.getByRole('button', {
      name: /Jump to this spec's row in Curriculum Map/i,
    });
    await expect(matrixBtn).toBeVisible({ timeout: 10_000 });
    await matrixBtn.click();
    // Clicking dispatches selectMatrixRow which switches the rail to
    // the Matrices view. Confirm the rail switched (negative-space proof
    // the click handler fired).
    await expect(
      page.getByRole('tab', { name: /^Matrices/ })
    ).toHaveAttribute('aria-selected', 'true', { timeout: 5_000 });
  });

  test('inline coverage breakdown lists the column codes (I, T, etc.) for the spec', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsSeededViaSso(page, seed!);
    await gotoReviewStep(page, seed!);

    // Wait for the matrix-references panel itself to mount.
    await expect(
      page.getByText(/Curriculum matrices for 1\.a/i)
    ).toBeVisible({ timeout: 15_000 });

    // The per-spec matrix references panel includes a grid showing
    // "{column header}: {code}" per cell. For our seed (2 cells under
    // 1.a — CHS 101=I + CHS 201=T) both columns must render.
    await expect(page.getByText('CHS 101:')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('CHS 201:')).toBeVisible();
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
