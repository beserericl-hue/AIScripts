import { test, expect, request } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL ?? 'https://cshse-develop.up.railway.app';
const SSO_KEY = process.env.E2E_SSO_KEY ?? '';
const SUB = process.env.LIB_SUB ?? '6a5282189427ce3f639be5f5';
const EMAIL = process.env.LIB_EMAIL ?? 'import-test-pc+825985a4@dev.test';

test('Supporting File Library shows an Introduction section', async ({ page }) => {
  test.skip(!SSO_KEY, 'set E2E_SSO_KEY');
  test.setTimeout(90_000);
  const api = await request.newContext({ baseURL: BASE });
  const token = (await (await api.post('/api/v1/auth/sso-login', { headers: { 'x-cshse-api-key': SSO_KEY }, data: { email: EMAIL } })).json()).token as string;

  await page.goto(`${BASE}/self-study/${SUB}#token=${encodeURIComponent(token)}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  // Open the Supporting File Library tab.
  await page.getByRole('button', { name: /Supporting File Library/i }).first().click();
  await page.waitForTimeout(1500);
  // Expand All so the Introduction accordion (top) is open.
  await page.getByText('Expand All', { exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'test-results/lib-introduction.png', fullPage: true });
  await expect(page.getByText(/Files referenced in the program introduction/i)).toBeVisible({ timeout: 10000 });
});
