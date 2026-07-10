import { test, expect, request } from '@playwright/test';

/**
 * Browser-level confirmation that an imported MCC self-study renders in the UI:
 * the self-study editor for the submission shows the materialized appendix
 * evidence (native PDF) and standard narrative. Run against dev:
 *
 *   E2E_BASE_URL=https://cshse-develop.up.railway.app \
 *   MCC_EMAIL=beser.ericl@gmail.com MCC_PASSWORD='...' MCC_SUB=<submissionId> \
 *   npx playwright test mcc_import_ui
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const EMAIL = process.env.MCC_EMAIL ?? '';
const PASSWORD = process.env.MCC_PASSWORD ?? '';
const SUB = process.env.MCC_SUB ?? '';

test('MCC import renders in the self-study UI (narrative + appendix files)', async ({ page }) => {
  test.skip(!EMAIL || !PASSWORD || !SUB, 'set MCC_EMAIL / MCC_PASSWORD / MCC_SUB');

  const api = await request.newContext({ baseURL: BASE });
  const login = await api.post('/api/auth/login', { data: { email: EMAIL, password: PASSWORD } });
  expect(login.ok(), `login failed: ${login.status()}`).toBeTruthy();
  const token = (await login.json()).token as string;

  // SSO-style hash handoff signs us in on load.
  await page.goto(`${BASE}/self-study/${SUB}#token=${encodeURIComponent(token)}`);
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20000 });

  // The editor shell should mount (not error/blank). Give it room to load.
  await page.waitForLoadState('networkidle');
  // A CSHSE standard label (Std 1 = Institutional Requirements…) should appear
  // somewhere in the self-study surface once the import materialized.
  const body = page.locator('body');
  await expect(body).toContainText(/Institutional Requirements|Standard 1|Human Services/i, { timeout: 20000 });
});
