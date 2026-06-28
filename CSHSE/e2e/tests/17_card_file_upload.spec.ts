/**
 * CR-070 — performing the per-card "Import file" upload must NOT blank the page.
 * (The earlier test only checked the button existed; it never clicked it. The
 * upload runs through `api` with skipAuthRedirect so a 401 can't trigger the
 * logout-redirect, and the surface is wrapped in an ErrorBoundary so a render
 * crash shows a fallback instead of a blank tree.)
 */
import { test, expect } from '@playwright/test';
import {
  seedFixture,
  cleanupSeed,
  loginAsSeededViaSso,
  gotoReviewStep,
  type SeedResult
} from '../helpers/seed';

test.describe('CR-070 — per-card file upload is crash-safe', () => {
  let seed: SeedResult | undefined;
  test.beforeEach(async () => { seed = await seedFixture('wizard_review_minimal'); });
  test.afterEach(async () => { await cleanupSeed(seed); });

  test('uploading a file shows the modal and never blanks the page', async ({ page }) => {
    test.setTimeout(60_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await loginAsSeededViaSso(page, seed!);
    await gotoReviewStep(page, seed!);

    // Perform the upload via the per-card input (set a file → fires onChange).
    const input = page.getByTestId('card-upload-input').first();
    await expect(input).toBeAttached();
    await input.setInputFiles({
      name: 'appendix.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 e2e upload'),
    });

    // The progress modal appears.
    const dialog = page.getByRole('dialog', { name: /Upload file/i });
    await expect(dialog).toBeVisible();

    // It resolves to a terminal state (done or error) — never hangs, never blanks.
    await expect(dialog).toContainText(/File uploaded|Upload failed/i, { timeout: 20_000 });

    // CRITICAL: the page is still alive — the Review surface did NOT blank or
    // navigate to /login (the reported regression).
    await expect(page.getByRole('heading', { name: /^Review$/i })).toBeVisible();
    await expect(page).toHaveURL(/\/self-study\//);
    await expect(page.getByTestId('surface-error')).toHaveCount(0);

    // Close the modal — surface still intact.
    await dialog.getByRole('button', { name: /Close/i }).click();
    await expect(page.getByRole('heading', { name: /^Review$/i })).toBeVisible();

    expect(pageErrors, `no uncaught page errors: ${pageErrors.join(' | ')}`).toEqual([]);
  });

  test('an OBJECT error from the server renders as a string, not a render crash', async ({ page }) => {
    test.setTimeout(60_000);
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await loginAsSeededViaSso(page, seed!);
    await gotoReviewStep(page, seed!);

    // Force the server to return its error as an OBJECT — this is what crashed
    // the Review surface with React error #31 (objects are not valid children).
    await page.route('**/evidence/upload', (route) =>
      route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Unsupported file type', code: 'BAD_TYPE', errorId: 'abc123' } }),
      })
    );

    await page.getByTestId('card-upload-input').first().setInputFiles({
      name: 'bad.exe',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from('MZ'),
    });

    const dialog = page.getByRole('dialog', { name: /Upload file/i });
    await expect(dialog).toBeVisible();
    // The string message is shown — NOT a crash.
    await expect(dialog).toContainText(/Upload failed/i);
    await expect(dialog).toContainText(/Unsupported file type/i);
    // The surface did not crash to the ErrorBoundary fallback.
    await expect(page.getByTestId('surface-error')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /^Review$/i })).toBeVisible();
    expect(pageErrors, `no uncaught page errors: ${pageErrors.join(' | ')}`).toEqual([]);
  });
});
