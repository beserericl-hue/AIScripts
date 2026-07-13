import { test, expect, request, APIRequestContext } from '@playwright/test';
import { seedFixture, cleanupSeed, type SeedResult } from '../helpers/seed';

/**
 * WIZARD PARSE SCREEN — the exact path a coordinator uses: Upload Files in the
 * UI → watch the Parse stages → click Open Review. Reproduces the prod bug
 * where a successful MCC parse (buckets land on the submission) still showed
 * "AI returned zero items" with Open Review disabled, because the /ai-status
 * snapshot (import record) is empty for MCC and clobbered the store.
 *
 * Drives the file input in the browser (NOT the API), so it covers the store's
 * snapshot-merge + Parse-screen hydration that API-based tests skipped.
 * Requires E2E_SSO_KEY, E2E_SEED_TOKEN, MCC_PDF.
 */
const BASE = process.env.E2E_BASE_URL ?? 'https://cshse-develop.up.railway.app';
const SSO_KEY = process.env.E2E_SSO_KEY ?? '';
const PDF = process.env.MCC_PDF ?? '';
const RUN = Date.now().toString(36);

async function tok(api: APIRequestContext, email: string) {
  return (await (await api.post('/api/v1/auth/sso-login', { headers: { 'x-cshse-api-key': SSO_KEY }, data: { email } })).json()).token as string;
}

test('wizard: a successful MCC parse enables Open Review (no false "zero items")', async ({ page }) => {
  test.skip(!SSO_KEY || !PDF, 'set E2E_SSO_KEY + MCC_PDF');
  test.setTimeout(600_000);
  const api = await request.newContext({ baseURL: BASE });
  let seed: SeedResult | undefined;
  try {
    seed = await seedFixture('wizard_review_minimal', { user: { institutionName: `Wiz Inst ${RUN}`, email: 'wiz-pc@test.local' }, submission: { institutionName: `Wiz Inst ${RUN}` } });
    const token = await tok(api, seed!.userEmail);
    const auth = { Authorization: `Bearer ${token}` };
    const institutionId = ((await (await api.get('/api/auth/me', { headers: auth })).json()).user ?? {}).institutionId;
    const sub = ((await (await api.post('/api/submissions', { headers: auth, data: { institutionId, institutionName: 'Wiz', programName: 'HS', programLevel: 'associate', type: 'initial' } })).json()).submission)._id;

    // Enter the wizard via the import view and upload through the REAL file input.
    await page.goto(`${BASE}/self-study/${sub}?view=import#token=${encodeURIComponent(token)}`);
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20000 });
    await page.waitForLoadState('networkidle');
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.waitFor({ state: 'attached', timeout: 30000 });
    await fileInput.setInputFiles(PDF);
    await page.getByRole('button', { name: /^\s*Next|Upload the/i }).first().click();

    // Wait for the parse to reach a terminal state — Open Review enabled OR the
    // empty banner. This is the crux: after an MCC parse it must be READY.
    const openReview = page.getByRole('button', { name: /Open Review/i });
    const emptyBanner = page.locator('[data-testid="cr-037-empty-buckets-banner"]');
    await expect
      .poll(async () => {
        if ((await emptyBanner.count()) > 0) return 'empty';
        if ((await openReview.count()) > 0 && (await openReview.isEnabled())) return 'ready';
        return 'waiting';
      }, { timeout: 540_000, intervals: [5000] })
      .not.toBe('waiting');

    // The regression: the empty banner must be ABSENT and Open Review ENABLED.
    await expect(emptyBanner, 'must NOT show "AI returned zero items" for a successful parse').toHaveCount(0);
    await expect(openReview, 'Open Review must be enabled').toBeEnabled({ timeout: 15000 });
    await page.screenshot({ path: 'test-results/wizard-open-review.png' });

    // And the server actually has the parsed content (belt + suspenders).
    const body = await (await api.get(`/api/submissions/${sub}`, { headers: auth })).json();
    const rs = ((body.submission ?? body) as any).aiReviewState ?? {};
    expect(Object.keys(rs.buckets ?? {}).length, 'server has parsed buckets').toBeGreaterThan(0);
  } finally {
    await cleanupSeed(seed);
  }
});
