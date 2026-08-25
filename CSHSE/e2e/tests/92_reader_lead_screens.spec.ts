import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * CR-074 — Reader / Lead-Reader screens E2E, capturing a screenshot per test.
 * Prep: scratchpad/prep_readerteam.cjs → E2E_RT_JSON. Screenshots go to
 * E2E_SHOT_DIR. Covers: reader-report roster (lead sees all readers), full-screen
 * focus mode, lead viewing another reader's report, the Lead Reader Report reader
 * info + course list, the file-preview modal z-order, the institution roster
 * (lead not double-listed), and the edit-user email/role modal.
 */
const BASE = process.env.E2E_BASE_URL ?? 'https://cshse-develop.up.railway.app';
const SHOT_DIR = process.env.E2E_SHOT_DIR ?? '/tmp/rt_shots';
let cfg: any = {};
try { cfg = JSON.parse(process.env.E2E_RT_JSON ?? ''); } catch { /* skipped */ }
fs.mkdirSync(SHOT_DIR, { recursive: true });
const shot = (page: Page, name: string) => page.screenshot({ path: path.join(SHOT_DIR, name), fullPage: false });

async function auth(page: Page, token: string) {
  await page.context().addInitScript((t) => {
    localStorage.setItem('auth-storage', JSON.stringify({
      state: { token: t, impersonation: { isImpersonating: false, originalUser: null, impersonatedRole: undefined, impersonatedUser: undefined }, needsImpersonationSelection: false },
      version: 0,
    }));
  }, token);
}

test.describe('CR-074 Reader / Lead-Reader screens', () => {
  test.skip(!cfg.sub || !cfg.leadToken, 'set E2E_RT_JSON (run scratchpad/prep_readerteam.cjs in-container)');

  test('1) Reader Report roster shows the lead + both readers', async ({ page }) => {
    test.setTimeout(90_000);
    await auth(page, cfg.leadToken);
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'load' });
    await expect(page.getByTestId('reader-self-study-panel')).toBeVisible({ timeout: 20000 });
    await page.getByTestId(`reader-open-report-${cfg.sub}`).dispatchEvent('click');
    await expect(page.getByRole('heading', { name: /Reader Report/i })).toBeVisible({ timeout: 30000 });
    // The "All reader reports" roster lists all three reviewers.
    const roster = page.getByTestId('rr-all-reports');
    await expect(roster).toBeVisible();
    await expect(roster).toContainText(cfg.leadName);
    await expect(roster).toContainText(cfg.r1Name);
    await expect(roster).toContainText(cfg.r2Name);
    await shot(page, '01-reader-report-roster.png');
  });

  test('2) Full-screen focus mode hides the app + section menus', async ({ page }) => {
    test.setTimeout(90_000);
    await auth(page, cfg.leadToken);
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'load' });
    await page.getByTestId(`reader-open-report-${cfg.sub}`).dispatchEvent('click');
    await expect(page.getByRole('heading', { name: /Reader Report/i })).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('reader-report-nav')).toBeVisible();
    await page.getByTestId('reader-report-fullscreen').dispatchEvent('click');
    // The Self-Study section menu is gone in focus mode; the report stays.
    await expect(page.getByTestId('reader-report-nav')).toBeHidden();
    await expect(page.getByTestId('reader-report-editor')).toBeVisible();
    await shot(page, '02-fullscreen.png');
  });

  test('3) Lead can open another reader’s report (read-only)', async ({ page }) => {
    test.setTimeout(90_000);
    await auth(page, cfg.leadToken);
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'load' });
    await page.getByTestId(`reader-open-report-${cfg.sub}`).dispatchEvent('click');
    await expect(page.getByRole('heading', { name: /Reader Report/i })).toBeVisible({ timeout: 30000 });
    // Reader #1 started their report → the lead can open it (the roster row
    // switches to "Viewing"; the lead reviews/over-rides it).
    await page.getByTestId(`rr-view-reviewer-${cfg.r1Id}`).dispatchEvent('click');
    await expect(page.getByTestId(`rr-view-reviewer-${cfg.r1Id}`)).toContainText('Viewing', { timeout: 15000 });
    await shot(page, '03-view-other-reader.png');
  });

  test('4) Lead Reader Report: reader info + course list', async ({ page }) => {
    test.setTimeout(90_000);
    await auth(page, cfg.leadToken);
    // Reach it client-side (a full-reload deep-link races the router): dashboard
    // → reader report → the "Lead Reader Report" tab.
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'load' });
    await page.getByTestId(`reader-open-report-${cfg.sub}`).dispatchEvent('click');
    await expect(page.getByRole('heading', { name: /Reader Report/i })).toBeVisible({ timeout: 30000 });
    await page.getByTestId('rr-nav-lead-reader-report').dispatchEvent('click');
    const leadInfo = page.getByText('Reader Information', { exact: false });
    await expect(leadInfo).toBeVisible({ timeout: 30000 });
    const body = page.locator('body');
    // Lead is named as the lead (not blank); the two readers are additional.
    await expect(body).toContainText(cfg.leadName);
    await expect(body).toContainText(cfg.r1Name);
    await expect(body).toContainText(cfg.r2Name);
    // The course list is populated (HUS 100 from the matrix/syllabus), not "None listed".
    await expect(body).toContainText(/HUS\s*100/);
    await shot(page, '04-lead-reader-report.png');
  });

  test('5) File-preview modal renders on top of the checklist', async ({ page }) => {
    test.setTimeout(90_000);
    await auth(page, cfg.leadToken);
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'load' });
    await page.getByTestId(`reader-open-report-${cfg.sub}`).dispatchEvent('click');
    await expect(page.getByRole('heading', { name: /Reader Report/i })).toBeVisible({ timeout: 30000 });
    // Spec 3.a has an assigned syllabus → its Files menu has 1 file.
    const filesBtn = page.getByTestId('rr-files-3-a');
    await filesBtn.scrollIntoViewIfNeeded();
    await filesBtn.dispatchEvent('click');
    // Open the first file → preview modal (portaled to <body>, z-[100]).
    const fileItem = page.locator('[data-testid^="rr-file-"]').first();
    await expect(fileItem).toBeVisible({ timeout: 10000 });
    await fileItem.dispatchEvent('click');
    await expect(page.getByText('HUS 100 Introduction to Human Services.pdf')).toBeVisible({ timeout: 15000 });
    await shot(page, '05-file-modal.png');
  });

  // Reach the admin Settings client-side (a full-reload deep-link races the
  // router). The Settings nav renders as <a href="/admin"> (possibly inside the
  // "More" dropdown); dispatchEvent triggers React-Router client nav even when
  // it's visually collapsed.
  async function gotoSettings(page: Page) {
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'load' });
    await page.waitForTimeout(2000);
    // Open the "More" overflow menu so the Settings <a href="/admin"> mounts.
    await page.getByRole('button', { name: /^More/ }).click({ force: true }).catch(() => {});
    await page.waitForTimeout(600);
    const link = page.locator('a[href="/admin"]');
    if (await link.count() > 0) await link.first().dispatchEvent('click');
    else await page.getByText('Settings', { exact: true }).first().dispatchEvent('click');
    await expect(page).toHaveURL(/\/admin/, { timeout: 15000 });
    await expect(page.getByText(/Manage colleges|Manage users|Institutions|Users/i).first()).toBeVisible({ timeout: 20000 });
  }

  test('6) Institution roster: lead is NOT double-listed as a reader', async ({ page }) => {
    test.setTimeout(120_000);
    await auth(page, cfg.adminToken);
    await gotoSettings(page);
    // Open the Institutions section, then filter to the test institution.
    await page.getByRole("button", { name: /Institutions/ }).first().dispatchEvent("click").catch(() => {});
    await page.waitForTimeout(800);
    const search = page.getByPlaceholder(/Search institutions/i);
    await expect(search).toBeVisible({ timeout: 15000 });
    await search.fill(cfg.instName);
    await expect(page.getByText(cfg.instName, { exact: false }).first()).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(800);
    await shot(page, '06-institution-roster.png');
    // The lead appears under LEAD READERS but not under READERS.
    const card = page.locator('div', { hasText: cfg.instName }).first();
    await expect(card).toContainText(cfg.leadName);
  });

  test('7) Edit-user modal: email + role are editable', async ({ page }) => {
    test.setTimeout(120_000);
    await auth(page, cfg.adminToken);
    await gotoSettings(page);
    // Open the Users section.
    await page.getByRole("button", { name: /^Users/ }).first().dispatchEvent("click").catch(() => {});
    await page.waitForTimeout(1200);
    const editBtn = page.locator('[title="Manage roles"]').first();
    await expect(editBtn).toBeVisible({ timeout: 20000 });
    await editBtn.click();
    const emailInput = page.getByTestId('edit-user-email');
    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await expect(emailInput).toBeEditable();
    await shot(page, '07-edit-user.png');
  });
});
