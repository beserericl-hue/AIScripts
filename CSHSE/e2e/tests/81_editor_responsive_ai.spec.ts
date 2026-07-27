import { test, expect, request, Page } from '@playwright/test';

/**
 * Self-Study Editor UI fixes (3 prod defects), run on BOTH dev and prod:
 *  - full-screen focus mode (work area takes over the viewport, chrome hidden)
 *  - responsive hamburger (grouped toolbar collapses < 2xl into a Menu dropdown)
 *  - AI evaluation button on the Standards spec editor
 *
 * Env:
 *   BASE           the environment under test (dev or prod URL)
 *   SU_EMAIL/SU_PASSWORD   superuser login
 *   SUBMISSION_ID  a submission whose editor to open
 *   PC_ID          (optional) impersonate this Program Coordinator (prod). If
 *                  unset, open as the superuser (dev sandbox runs).
 *   PC_EMAIL/PC_FIRST/PC_LAST  impersonated PC identity (when PC_ID set)
 */
const BASE = process.env.BASE ?? process.env.E2E_BASE_URL ?? 'https://cshse-develop.up.railway.app';
const SU_EMAIL = process.env.SU_EMAIL ?? 'eric@agileadtesting.com';
const SU_PASSWORD = process.env.SU_PASSWORD ?? 'Fr332bafami!y';
const SUBMISSION_ID = process.env.SUBMISSION_ID ?? '';
const PC_ID = process.env.PC_ID ?? '';
const PC = { id: PC_ID, email: process.env.PC_EMAIL ?? '', firstName: process.env.PC_FIRST ?? '', lastName: process.env.PC_LAST ?? '', role: 'program_coordinator' };
async function j(p: Promise<any>) { return (await p).json(); }

async function openEditor(page: Page, token: string) {
  if (PC_ID) {
    await page.addInitScript(([tok, pcObj]) => {
      localStorage.setItem('auth-storage', JSON.stringify({ state: { token: tok, needsImpersonationSelection: false, impersonation: { isImpersonating: true, impersonatedRole: 'program_coordinator', impersonatedUser: pcObj } }, version: 0 }));
    }, [token, PC] as any);
    await page.goto(`${BASE}/dashboard`);
  } else {
    await page.goto(`${BASE}/dashboard#token=${encodeURIComponent(token)}`);
  }
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
  await page.goto(`${BASE}/self-study/${SUBMISSION_ID}?view=standards`);
  await expect(page.getByRole('heading', { name: 'Self-Study Editor' })).toBeVisible({ timeout: 30000 });
}

test.describe('Self-Study Editor — full-screen + hamburger + AI eval', () => {
  test.skip(!SUBMISSION_ID, 'set SUBMISSION_ID');

  test('full-screen focus mode hides the chrome and Esc/exit restores it', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1600, height: 900 });
    const api = await request.newContext();
    const token = (await j(api.post(`${BASE}/api/auth/login`, { data: { email: SU_EMAIL, password: SU_PASSWORD } }))).token;
    await openEditor(page, token);

    const title = page.getByRole('heading', { name: 'Self-Study Editor' });
    await expect(title).toBeVisible();
    await page.getByTestId('focus-enter').click();
    await expect(page.getByTestId('focus-exit')).toBeVisible();
    await expect(title).toBeHidden();                       // chrome gone → work area full
    await page.getByTestId('focus-exit').click();
    await expect(title).toBeVisible();                      // restored
    // Esc also exits
    await page.getByTestId('focus-enter').click();
    await expect(page.getByTestId('focus-exit')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(title).toBeVisible();
  });

  test('toolbar collapses into a hamburger below 2xl and expands above', async ({ page }) => {
    test.setTimeout(120_000);
    const api = await request.newContext();
    const token = (await j(api.post(`${BASE}/api/auth/login`, { data: { email: SU_EMAIL, password: SU_PASSWORD } }))).token;
    // WIDE (>= 1536): grouped nav shown, hamburger hidden
    await page.setViewportSize({ width: 1700, height: 900 });
    await openEditor(page, token);
    await expect(page.getByTestId('ss-tab-standards').or(page.locator('[data-tour="ss-tab-standards"]'))).toBeVisible();
    await expect(page.getByTestId('toolbar-menu')).toBeHidden();
    // NARROW (< 1536, e.g. maximized laptop): grouped nav hidden, hamburger shown
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.getByTestId('toolbar-menu')).toBeVisible();
    await expect(page.locator('[data-tour="ss-tab-standards"]')).toBeHidden();
    // the hamburger dropdown navigates
    await page.getByTestId('toolbar-menu').click();
    await page.getByRole('menuitem', { name: 'Introduction' }).click();
    await expect(page).toHaveURL(/view=introduction/, { timeout: 10000 });
  });

  test('AI evaluation is reachable from the Standards spec editor', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1600, height: 900 });
    const api = await request.newContext();
    const token = (await j(api.post(`${BASE}/api/auth/login`, { data: { email: SU_EMAIL, password: SU_PASSWORD } }))).token;
    await openEditor(page, token);
    await page.waitForTimeout(1500);
    // The AI-eval control lives in the editor's action row, which only renders for
    // an EDITABLE spec (a Program Coordinator). Read-only viewers (a superuser
    // browsing a sandbox run) get no action row — skip there; prod exercises it fully.
    const saveBtn = page.locator('[data-tour="ss-save"]');
    if (!(await saveBtn.isVisible().catch(() => false))) {
      test.skip(true, 'read-only viewer (no editable action row) — AI-eval button is a PC feature; tested on prod');
    }
    // Editable: the AI-eval control is present — the verdict button or the
    // "not evaluated" placeholder. On a validated spec, clicking opens the report.
    const evalBtn = page.getByTestId('ai-eval-button');
    const evalNone = page.getByTestId('ai-eval-none');
    await expect(evalBtn.or(evalNone)).toBeVisible({ timeout: 15000 });
    if (await evalBtn.isVisible().catch(() => false)) {
      await evalBtn.click();
      await expect(page.getByTestId('ai-report')).toBeVisible({ timeout: 10000 });
      console.log('AI evaluation button opens the AI report ✓');
    } else {
      console.log('AI evaluation placeholder shown (spec not yet validated) ✓');
    }
  });
});
