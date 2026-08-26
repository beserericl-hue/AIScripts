import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * CR-074 — Forgot Password (site-login reset) E2E, screenshot per test.
 *
 * Public UI (tests 1/3/4) needs no seed. Tests 2 (memberclick-only screen) and
 * 5 (full reset → login) read E2E_PW_JSON from scratchpad/prep_pwreset.cjs
 * (run in-container): { base, mcEmail, resetEmail, resetToken, newPassword }.
 * Screenshots go to E2E_SHOT_DIR.
 */
const BASE = process.env.E2E_BASE_URL ?? 'https://cshse-develop.up.railway.app';
const SHOT_DIR = process.env.E2E_SHOT_DIR ?? '/tmp/pwreset_shots';
let cfg: any = {};
try { cfg = JSON.parse(process.env.E2E_PW_JSON ?? ''); } catch { /* skipped */ }
fs.mkdirSync(SHOT_DIR, { recursive: true });
const shot = (page: Page, name: string) => page.screenshot({ path: path.join(SHOT_DIR, name), fullPage: false });

test.describe('CR-074 Forgot Password', () => {
  test('1) Login page shows a Forgot password link that opens the reset screen', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto(`${BASE}/login`, { waitUntil: 'load' });
    const link = page.getByTestId('forgot-password-link');
    await expect(link).toBeVisible({ timeout: 15000 });
    await link.dispatchEvent('click');
    await expect(page).toHaveURL(/\/forgot-password/);
    await expect(page.getByRole('heading', { name: /Reset your password/i })).toBeVisible();
    await shot(page, '01-forgot-form.png');
  });

  test('3) Submitting an email shows the check-your-spam confirmation', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto(`${BASE}/forgot-password`, { waitUntil: 'load' });
    // No email-enumeration: any address returns the same success screen.
    await page.getByTestId('fp-email').fill('nobody-e2e@example.com');
    await page.getByTestId('fp-send').dispatchEvent('click');
    const sent = page.getByTestId('fp-sent');
    await expect(sent).toBeVisible({ timeout: 15000 });
    await expect(sent).toContainText(/spam or junk folder/i);
    await expect(sent).toContainText(/cshse\.courseworx\.media/i);
    await shot(page, '03-sent-confirmation.png');
  });

  test('4) Reset screen with no token tells the user to use the email link', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto(`${BASE}/reset-password`, { waitUntil: 'load' });
    await expect(page.getByTestId('rp-notoken')).toBeVisible({ timeout: 15000 });
    await shot(page, '04-reset-no-token.png');
  });

  test('2) A memberclick-only account is sent to the MemberClick administrator', async ({ page }) => {
    test.skip(!cfg.mcEmail, 'set E2E_PW_JSON (run scratchpad/prep_pwreset.cjs in-container)');
    test.setTimeout(60_000);
    await page.goto(`${BASE}/forgot-password`, { waitUntil: 'load' });
    await page.getByTestId('fp-email').fill(cfg.mcEmail);
    await page.getByTestId('fp-send').dispatchEvent('click');
    const mc = page.getByTestId('fp-memberclick');
    await expect(mc).toBeVisible({ timeout: 15000 });
    await expect(mc).toContainText(/MemberClick/i);
    await expect(page.getByText(/Amy Primm/i)).toBeVisible();
    await shot(page, '02-memberclick-only.png');
  });

  test('5) Full reset: set a new password from the emailed link, then sign in', async ({ page }) => {
    test.skip(!cfg.resetToken, 'set E2E_PW_JSON (run scratchpad/prep_pwreset.cjs in-container)');
    test.setTimeout(90_000);
    await page.goto(`${BASE}/reset-password?token=${cfg.resetToken}`, { waitUntil: 'load' });
    await page.getByTestId('rp-password').fill(cfg.newPassword);
    await page.getByTestId('rp-confirm').fill(cfg.newPassword);
    await page.getByTestId('rp-submit').dispatchEvent('click');
    // Back to the login screen with the success banner.
    await expect(page).toHaveURL(/\/login\?reset=1/, { timeout: 20000 });
    await expect(page.getByTestId('login-reset-done')).toBeVisible();
    await shot(page, '05a-reset-done-login.png');
    // The new password actually works.
    await page.getByLabel(/Email address/i).fill(cfg.resetEmail);
    await page.getByLabel(/^Password$/i).fill(cfg.newPassword);
    await page.getByRole('button', { name: /^Sign in$/i }).dispatchEvent('click');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30000 });
    await shot(page, '05b-signed-in.png');
  });
});
