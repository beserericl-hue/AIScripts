import { test, expect, request } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Parser Train — SCREENSHOT WALKTHROUGH. Drives the real SU Parser Train UI in a
 * browser and captures a screenshot at every stage (page, create, parsed, diagnose,
 * learning-loop trajectory, approve). The images are assembled into the PDF report.
 *
 *   E2E_BASE_URL=… SU_EMAIL=… SU_PASSWORD=… npx playwright test 76_parser_train_screenshots
 */
const BASE = process.env.E2E_BASE_URL ?? 'https://cshse-develop.up.railway.app';
const SU_EMAIL = process.env.SU_EMAIL ?? process.env.SSO_TEST_EMAIL ?? '';
const SU_PASSWORD = process.env.SU_PASSWORD ?? process.env.SSO_TEST_PASSWORD ?? '';
const FILES = path.resolve(__dirname, '../fixtures/files');
const SHOTS = path.resolve(__dirname, '../report/shots');

test.describe('Parser Train — screenshot walkthrough', () => {
  test.skip(!SU_EMAIL || !SU_PASSWORD, 'set SU_EMAIL / SU_PASSWORD');

  test('capture the full SU Parser Train flow', async ({ page }) => {
    test.setTimeout(1_500_000);
    fs.mkdirSync(SHOTS, { recursive: true });
    const shot = async (name: string) => { await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true }); };

    // SU login via token hash handoff (lands on dashboard, not impersonation selector)
    const api = await request.newContext({ baseURL: BASE });
    const token = (await (await api.post('/api/auth/login', { data: { email: SU_EMAIL, password: SU_PASSWORD } })).json()).token;
    await page.goto(`${BASE}/dashboard#token=${encodeURIComponent(token)}`);
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });

    // 1. Parser Train page (empty)
    await page.goto(`${BASE}/parser-train`);
    await expect(page.getByRole('heading', { name: 'Parser Train' })).toBeVisible({ timeout: 15000 });
    await shot('01-parser-train-page');

    // 2. create a sandbox run
    await page.getByRole('button', { name: /Create sandbox run/i }).click();
    await expect(page.getByText(/Run ready/i)).toBeVisible({ timeout: 20000 });
    await shot('02-run-created');

    // 3. import the document → wait for parse
    await page.setInputFiles('input[type=file]', path.join(FILES, 'aacc.docx'));
    await expect(page.getByText(/^(parsed|completed)/).first()).toBeVisible({ timeout: 500000 });
    await shot('03-parsed');

    // 4. diagnose (contract)
    await page.getByRole('button', { name: /Run contract diagnose/i }).click();
    await expect(page.getByText(/Compare anchors:/i)).toBeVisible({ timeout: 60000 });
    await shot('04-diagnose-contract');

    // 5. auto-refine — the learning loop
    await page.getByRole('button', { name: /Auto-refine/i }).click();
    await expect(page.getByText(/Learning loop:/i)).toBeVisible({ timeout: 30000 });
    await shot('05-learning-started');
    // wait for it to finish (re-parses several times)
    await expect(page.getByText(/Learning loop: done/i)).toBeVisible({ timeout: 1_200_000 });
    await shot('06-learning-done');

    // 6. approve → activate
    const approveBtn = page.getByRole('button', { name: /Approve & activate/i });
    if (await approveBtn.isVisible().catch(() => false)) {
      await approveBtn.click();
      await expect(page.getByText(/Activated .* rule/i)).toBeVisible({ timeout: 30000 });
      await shot('07-approved');
    }

    // 7. recent runs list (isolation surface)
    await shot('08-final-state');
  });
});
