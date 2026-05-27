/**
 * CR-040 follow-on (2026-05-27) — Re-run detectors button E2E.
 *
 * The Review surface has a "🔍 Re-run detectors" button (see
 * client/src/features/selfStudy/Editor/Review/ReviewSurface.tsx) that
 * POSTs /api/imports/:importId/redetect, which in turn calls the
 * ai-service's /ai/import/redetect endpoint (now with TOC-anchored
 * second-pass detection — see ai-service/app/splitter/toc_detector.py).
 *
 * This spec exercises the UI side of the redetect path:
 *
 *   1. The button is rendered + enabled on the Review surface for a
 *      seeded import.
 *   2. Clicking the button fires the redetect request.
 *   3. The success banner (data-testid="cr-040-redetect-result") shows
 *      the human-readable counts the controller assembled.
 *   4. When the response includes tocAdded > 0, the banner mentions
 *      "TOC pass recovered N CV(s)" — the diagnostic the user asked
 *      for so coordinators see when the TOC saved a detection that
 *      pattern matching would have lost.
 *   5. The error banner renders on a 502 from the controller.
 *
 * The /api/imports/.../redetect call is INTERCEPTED via page.route()
 * so this spec is hermetic — the ai-service is exercised independently
 * by ai-service/tests/test_redetect_endpoint.py, and the controller
 * is exercised independently by server/tests/integration/redetectImport.test.ts.
 * This spec proves the UI rendering ties together.
 */
import { test, expect } from '@playwright/test';
import {
  seedFixture,
  cleanupSeed,
  loginAsSeededViaSso,
  gotoReviewStep,
  type SeedResult
} from '../helpers/seed';

test.describe('CR-040 follow-on — Re-run detectors button', () => {
  let seed: SeedResult | undefined;

  test.beforeEach(async () => {
    seed = await seedFixture('wizard_review_minimal');
  });

  test.afterEach(async () => {
    await cleanupSeed(seed);
    seed = undefined;
  });

  test('renders the Re-run detectors button on the Review surface', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsSeededViaSso(page, seed!);
    await gotoReviewStep(page, seed!);

    const btn = page.getByRole('button', { name: /Re-run detectors/i });
    await expect(btn).toBeVisible({ timeout: 10_000 });
    // The button is enabled because the seed plants importId into the
    // Zustand localStorage payload (ai-import-storage).
    await expect(btn).toBeEnabled();
  });

  test('clicking the button shows a success banner with counts (no TOC recovery)', async ({ page }) => {
    test.setTimeout(60_000);

    // Intercept the redetect HTTP call. Return a "pattern-only" response:
    // 4 CVs detected, no TOC contribution. The banner should show the
    // base "Re-detect complete." message without the TOC blurb.
    await page.route(`**/api/imports/${seed!.importId}/redetect`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          counts: { cvs: 4, papers: 11, syllabi: 22, introHints: 0 },
          tocDiagnostics: {
            tocEntriesFound: 0,
            tocAnchoredDetections: 0,
            tocAdded: { cvs: 0, papers: 0, syllabi: 0 }
          },
          message: 'Re-detect complete. Found 4 CV(s), 11 paper(s), 22 syllabi.'
        })
      });
    });

    await loginAsSeededViaSso(page, seed!);
    await gotoReviewStep(page, seed!);

    await page.getByRole('button', { name: /Re-run detectors/i }).click();

    const banner = page.getByTestId('cr-040-redetect-result');
    await expect(banner).toBeVisible({ timeout: 10_000 });
    await expect(banner).toContainText(/Re-detect complete/i);
    await expect(banner).toContainText(/4 CV/);
    await expect(banner).toContainText(/11 paper/);
    await expect(banner).toContainText(/22 syllabi/);
    // No TOC blurb when tocAdded is zero.
    await expect(banner).not.toContainText(/TOC pass recovered/i);
  });

  test('clicking the button surfaces the "TOC pass recovered" diagnostic when the TOC contributed', async ({ page }) => {
    test.setTimeout(60_000);

    // Intercept with a Stevenson-shaped response: 5 CVs total, 3 of which
    // were recovered by the TOC-anchored pass (Thomas Swisher, Lauri Weiner,
    // Mary Beth Olson — names the pattern detector misses).
    await page.route(`**/api/imports/${seed!.importId}/redetect`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          counts: { cvs: 5, papers: 0, syllabi: 2, introHints: 0 },
          tocDiagnostics: {
            tocEntriesFound: 8,
            tocAnchoredDetections: 7,
            tocAdded: { cvs: 3, papers: 0, syllabi: 0 }
          },
          message:
            'Re-detect complete. Found 5 CV(s), 0 paper(s), 2 syllabi.' +
            ' (TOC pass recovered 3 CV(s), 0 paper(s), 0 syllabi the pattern detector missed.)'
        })
      });
    });

    await loginAsSeededViaSso(page, seed!);
    await gotoReviewStep(page, seed!);

    await page.getByRole('button', { name: /Re-run detectors/i }).click();

    const banner = page.getByTestId('cr-040-redetect-result');
    await expect(banner).toBeVisible({ timeout: 10_000 });
    // Base message.
    await expect(banner).toContainText(/Re-detect complete/i);
    await expect(banner).toContainText(/5 CV/);
    // TOC blurb specifically — proves the user-facing diagnostic the
    // user asked for is wired through.
    await expect(banner).toContainText(/TOC pass recovered 3 CV/i);
  });

  test('shows an error banner on 502 from the controller', async ({ page }) => {
    test.setTimeout(60_000);

    await page.route(`**/api/imports/${seed!.importId}/redetect`, async (route) => {
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'ai-service-failed',
          detail: 'cshse-ai timed out after 30s'
        })
      });
    });

    await loginAsSeededViaSso(page, seed!);
    await gotoReviewStep(page, seed!);

    await page.getByRole('button', { name: /Re-run detectors/i }).click();

    // The error path renders inline below the heading text (no testid —
    // we match by leading "✗" + a fragment of the controller detail).
    const errorMsg = page.locator('text=/✗.*cshse-ai timed out/i');
    await expect(errorMsg).toBeVisible({ timeout: 10_000 });

    // The success banner must NOT render on the error path.
    await expect(page.getByTestId('cr-040-redetect-result')).toHaveCount(0);
  });

  test('the button disables and shows "Re-detecting…" while the request is in flight', async ({ page }) => {
    test.setTimeout(60_000);

    // Hold the response for ~600ms so we can observe the in-flight state.
    let resolveRoute: () => void = () => {};
    const hold = new Promise<void>((r) => { resolveRoute = r; });
    await page.route(`**/api/imports/${seed!.importId}/redetect`, async (route) => {
      await hold;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          counts: { cvs: 1, papers: 0, syllabi: 0, introHints: 0 },
          tocDiagnostics: {
            tocEntriesFound: 0,
            tocAnchoredDetections: 0,
            tocAdded: { cvs: 0, papers: 0, syllabi: 0 }
          },
          message: 'Re-detect complete. Found 1 CV(s), 0 paper(s), 0 syllabi.'
        })
      });
    });

    await loginAsSeededViaSso(page, seed!);
    await gotoReviewStep(page, seed!);

    const btn = page.getByRole('button', { name: /Re-run detectors/i });
    await btn.click();

    // While the request is in flight, the label switches.
    const inFlight = page.getByRole('button', { name: /Re-detecting/i });
    await expect(inFlight).toBeVisible({ timeout: 5_000 });
    await expect(inFlight).toBeDisabled();

    // Release the hold and confirm the button returns to its idle label.
    resolveRoute();
    await expect(page.getByRole('button', { name: /Re-run detectors/i })).toBeVisible({
      timeout: 10_000
    });
    await expect(page.getByTestId('cr-040-redetect-result')).toBeVisible();
  });
});
