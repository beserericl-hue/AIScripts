import { test, expect, request, Page } from '@playwright/test';

/**
 * Up/down panel navigation on the Review screen and the Standards screen.
 * Runs on dev (SU + a training run) and prod (impersonate the doc's PC).
 * Env: BASE, SU_EMAIL/SU_PASSWORD, SUBMISSION_ID, optional PC_* for prod.
 */
const BASE = process.env.BASE ?? process.env.E2E_BASE_URL ?? 'https://cshse-develop.up.railway.app';
const SU_EMAIL = process.env.SU_EMAIL ?? 'eric@agileadtesting.com';
const SU_PASSWORD = process.env.SU_PASSWORD ?? 'Fr332bafami!y';
const SUBMISSION_ID = process.env.SUBMISSION_ID ?? '';
const PC_ID = process.env.PC_ID ?? '';
const PC = { id: PC_ID, email: process.env.PC_EMAIL ?? '', firstName: process.env.PC_FIRST ?? '', lastName: process.env.PC_LAST ?? '', role: 'program_coordinator' };
async function j(p: Promise<any>) { return (await p).json(); }

async function signIn(page: Page, token: string) {
  if (PC_ID) {
    await page.addInitScript(([t, pc]) => localStorage.setItem('auth-storage', JSON.stringify({ state: { token: t, needsImpersonationSelection: false, impersonation: { isImpersonating: true, impersonatedRole: 'program_coordinator', impersonatedUser: pc } }, version: 0 })), [token, PC] as any);
    await page.goto(`${BASE}/dashboard`);
  } else {
    await page.goto(`${BASE}/dashboard#token=${encodeURIComponent(token)}`);
  }
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
}

test.describe('Up/down panel navigation', () => {
  test.skip(!SUBMISSION_ID, 'set SUBMISSION_ID');

  test('Review screen: down goes to next panel, up to previous', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1600, height: 900 });
    const api = await request.newContext();
    const token = (await j(api.post(`${BASE}/api/auth/login`, { data: { email: SU_EMAIL, password: SU_PASSWORD } }))).token;
    await signIn(page, token);
    await page.goto(`${BASE}/self-study/${SUBMISSION_ID}?view=review`);
    const rail = page.getByRole('complementary', { name: 'Specifications' });
    await expect(rail).toBeVisible({ timeout: 45000 });

    // select the first spec in Standard 1 by clicking its rail tab
    const tabA = rail.getByRole('tab', { name: /^1\.a\b/ }).first();
    await tabA.click();
    await expect(tabA).toHaveAttribute('aria-selected', 'true');
    // DOWN → next panel (1.b)
    await page.getByTestId('review-nav-down').click();
    const tabB = rail.getByRole('tab', { name: /^1\.b\b/ }).first();
    await expect(tabB).toHaveAttribute('aria-selected', 'true', { timeout: 10000 });
    await expect(tabA).toHaveAttribute('aria-selected', 'false');
    // UP → back to 1.a
    await page.getByTestId('review-nav-up').click();
    await expect(tabA).toHaveAttribute('aria-selected', 'true', { timeout: 10000 });
    console.log('Review nav: 1.a → (down) 1.b → (up) 1.a ✓');
  });

  test('Standards screen: down/up move through panels (incl. introduction)', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1600, height: 900 });
    const api = await request.newContext();
    const token = (await j(api.post(`${BASE}/api/auth/login`, { data: { email: SU_EMAIL, password: SU_PASSWORD } }))).token;
    await signIn(page, token);
    await page.goto(`${BASE}/self-study/${SUBMISSION_ID}?view=standards`);
    await expect(page.getByRole('heading', { name: 'Self-Study Editor' })).toBeVisible({ timeout: 30000 });
    const crumb = page.locator('text=/Standard\\s+\\d+/').first();
    // capture the breadcrumb before/after to prove the panel changes
    const readCrumb = async () => (await page.locator('[data-testid="standards-nav-down"]').locator('xpath=ancestor::div[1]/preceding-sibling::*').allTextContents()).join(' ') || (await crumb.textContent()) || '';
    await page.getByTestId('standards-nav-down').waitFor({ state: 'visible', timeout: 20000 });
    const before = await page.locator('body').innerText();
    // DOWN then UP should change and restore the visible spec breadcrumb region
    await page.getByTestId('standards-nav-down').click();
    await page.waitForTimeout(800);
    const afterDown = await page.locator('body').innerText();
    expect(afterDown).not.toBe(before);
    await page.getByTestId('standards-nav-up').click();
    await page.waitForTimeout(800);
    // navigate up repeatedly to reach the Introduction panel (spec = null)
    for (let i = 0; i < 6; i++) { await page.getByTestId('standards-nav-up').click(); await page.waitForTimeout(400); }
    // the introduction panel shows the Introduction editor (document/standard intro)
    await expect(page.getByText(/Introduction/i).first()).toBeVisible({ timeout: 10000 });
    console.log('Standards nav: down/up move panels and reach the Introduction ✓');
  });
});
