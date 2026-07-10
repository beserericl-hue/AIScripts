import { test, expect, request } from '@playwright/test';

/**
 * Regression: opening a submission's Review in the browser must NOT wipe the
 * server-merged review state (the isolation-fix follow-on bug where the store
 * autosaved empty buckets over the merge). Opens a submission that already has
 * server data, lets the client hydrate + settle, then asserts the SERVER still
 * has the same bucket/narrative counts.
 *
 *   E2E_BASE_URL=https://cshse-develop.up.railway.app \
 *   MCC_EMAIL=... MCC_PASSWORD=... MCC_SUB=<submission with server review data> \
 *   npx playwright test review_no_data_loss
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const EMAIL = process.env.MCC_EMAIL ?? '';
const PASSWORD = process.env.MCC_PASSWORD ?? '';
const SUB = process.env.MCC_SUB ?? '';

async function counts(api: any, token: string) {
  const r = await api.get(`/api/submissions/${SUB}`, { headers: { Authorization: `Bearer ${token}` } });
  const j = await r.json();
  const s = j.submission ?? j;
  const b = s.aiReviewState?.buckets ?? {};
  const nar = Object.values(b).reduce((n: number, v: any) => n + (v?.narratives?.length ?? 0), 0);
  return { buckets: Object.keys(b).length, narratives: nar, evidence: (s.aiReviewState?.evidenceDocs ?? []).length };
}

test('opening Review in the browser preserves server review data', async ({ page }) => {
  test.skip(!EMAIL || !PASSWORD || !SUB, 'set MCC_EMAIL / MCC_PASSWORD / MCC_SUB');

  const api = await request.newContext({ baseURL: BASE });
  const token = (await (await api.post('/api/auth/login', { data: { email: EMAIL, password: PASSWORD } })).json()).token as string;

  const before = await counts(api, token);
  expect(before.buckets, 'fixture submission must already have server review data').toBeGreaterThan(0);

  // Open the submission Review in the browser (SSO hash sign-in) and let the
  // client hydrate + any autosave debounce (1.2s) fire.
  await page.goto(`${BASE}/self-study/${SUB}?view=review#token=${encodeURIComponent(token)}`);
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(4000);

  const after = await counts(api, token);
  expect(after.buckets, 'buckets must not be wiped by opening Review').toBe(before.buckets);
  expect(after.narratives).toBe(before.narratives);
  expect(after.evidence).toBe(before.evidence);
});
