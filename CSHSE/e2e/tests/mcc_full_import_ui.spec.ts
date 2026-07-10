import { test, expect, request } from '@playwright/test';

/**
 * FULL browser import: drive the real wizard — upload the MCC PDF, wait for the
 * parse, and assert the wizard does NOT show "AI returned zero items", that
 * "Open Review" is enabled, and that the server's aiReviewState actually
 * received the parsed content. This reproduces the exact flow that was failing.
 *
 *   E2E_BASE_URL=https://cshse-develop.up.railway.app \
 *   MCC_EMAIL=eric@agileadtesting.com MCC_PASSWORD='...' \
 *   MCC_INST=<institutionId> MCC_PDF="/path/to/Final Self Study....pdf" \
 *   npx playwright test mcc_full_import_ui
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const EMAIL = process.env.MCC_EMAIL ?? '';
const PASSWORD = process.env.MCC_PASSWORD ?? '';
const INST = process.env.MCC_INST ?? '';
const PDF = process.env.MCC_PDF ?? '';

test('full MCC import in the browser: no zero-items, review data lands', async ({ page }) => {
  test.skip(!EMAIL || !PASSWORD || !INST || !PDF, 'set MCC_EMAIL/PASSWORD/INST/PDF');
  test.setTimeout(600_000); // 935-page parse + 73 appendix S3 uploads take minutes

  const api = await request.newContext({ baseURL: BASE });
  const token = (await (await api.post('/api/auth/login', { data: { email: EMAIL, password: PASSWORD } })).json()).token as string;

  // Fresh submission so the test is deterministic.
  const created = await api.post('/api/submissions', {
    headers: { Authorization: `Bearer ${token}` },
    data: { institutionId: INST, institutionName: 'MCC UI E2E', programName: 'Human Services', programLevel: 'associate', type: 'initial' },
  });
  const sub = ((await created.json()).submission ?? (await created.json()))._id as string;

  // Open the import wizard (PC-only view) via SSO hash sign-in.
  await page.goto(`${BASE}/self-study/${sub}?view=import#token=${encodeURIComponent(token)}`);
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20000 });
  await page.waitForLoadState('networkidle');
  const fileInput = page.locator('input[type="file"]');
  await fileInput.first().waitFor({ state: 'attached', timeout: 30000 });

  // Upload the PDF and kick off the import.
  await fileInput.first().setInputFiles(PDF);
  await page.getByRole('button', { name: /^\s*Next|Upload the/i }).first().click();

  // Wait for the parse to actually COMPLETE. The "Open Review" button is present
  // but DISABLED during parsing, so we must wait for it to become ENABLED (or
  // for the empty-parse banner). This includes the slow 73-appendix S3 upload.
  const openReview = page.getByRole('button', { name: /Open Review/i });
  const emptyBanner = page.locator('[data-testid="cr-037-empty-buckets-banner"]');
  await expect
    .poll(
      async () => {
        if ((await emptyBanner.count()) > 0) return 'empty';
        if ((await openReview.count()) > 0 && (await openReview.isEnabled())) return 'ready';
        return 'waiting';
      },
      { timeout: 480_000, intervals: [5000] }
    )
    .not.toBe('waiting');

  // The failure mode: the "AI returned zero items" banner. It must be absent.
  await expect(emptyBanner).toHaveCount(0);
  await expect(page.getByText(/AI returned zero items/i)).toHaveCount(0);
  // And Open Review must be enabled.
  await expect(openReview).toBeEnabled({ timeout: 15000 });

  // The server must actually have the parsed review content.
  const r = await api.get(`/api/submissions/${sub}`, { headers: { Authorization: `Bearer ${token}` } });
  const rs = (((await r.json()).submission ?? (await r.json())) as any).aiReviewState ?? {};
  const buckets = Object.keys(rs.buckets ?? {}).length;
  expect(buckets, 'server aiReviewState must have parsed buckets').toBeGreaterThan(0);
});
