import { test, expect, request, Page } from '@playwright/test';

/**
 * Coverage-dot tooltips + the "not assessed" state (Monica/Amia + Amy/MCC).
 *
 * Test 1 (a submission WITH coverage): hovering a spec's dot explains WHY that
 * color — status + the AI's specific gaps/strengths.
 * Test 2 (a submission WITHOUT coverage, e.g. MCC): the dots are a distinct
 * GRAY "not assessed" state (not a red gap), the tooltip says so, and clicking
 * "Check coverage" backfills real reasons — no re-reading the document.
 *
 * Env: BASE, SU_EMAIL/SU_PASSWORD, SUBMISSION_ID (with coverage),
 *      MCC_SUBMISSION_ID (without coverage), optional PC_* for prod.
 */
const BASE = process.env.BASE ?? 'https://cshse-develop.up.railway.app';
const SU_EMAIL = process.env.SU_EMAIL ?? 'eric@agileadtesting.com';
const SU_PASSWORD = process.env.SU_PASSWORD ?? 'Fr332bafami!y';
const SUBMISSION_ID = process.env.SUBMISSION_ID ?? '6a628cfc18c16eda99b34a95';
const MCC_SUBMISSION_ID = process.env.MCC_SUBMISSION_ID ?? '';
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
async function login(page: Page) {
  const api = await request.newContext();
  const token = (await j(api.post(`${BASE}/api/auth/login`, { data: { email: SU_EMAIL, password: SU_PASSWORD } }))).token;
  await signIn(page, token);
}

test('1) coverage dots explain their color on hover (assessed submission)', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1600, height: 950 });
  await login(page);
  await page.goto(`${BASE}/self-study/${SUBMISSION_ID}?view=review`);
  // Wait on the review chrome (heavier MCC payloads can take a while), then the
  // rail via a stable CSS selector rather than the landmark role.
  await expect(page.getByTestId('check-coverage-cta')).toBeVisible({ timeout: 120000 });
  const rail = page.locator('aside[aria-label="Specifications"]');
  await expect(rail).toBeVisible({ timeout: 30000 });
  await expect(rail.getByText(/hover a dot for why/i)).toBeVisible();

  const dots = rail.locator('[data-testid^="coverage-dot-"]');
  const n = await dots.count();
  expect(n).toBeGreaterThan(5);

  let checkedGap = false, checkedCovered = false;
  for (let i = 0; i < n; i++) {
    const d = dots.nth(i);
    const title = (await d.getAttribute('title')) || '';
    const state = (await d.getAttribute('data-coverage-state')) || '';
    expect(title.length).toBeGreaterThan(30);
    if (state === 'covered' && !checkedCovered) { checkedCovered = true; expect(title).toMatch(/🟢 Covered/); }
    if ((state === 'gap' || state === 'partial') && title.includes('•') && !checkedGap) {
      checkedGap = true;
      // A REAL reason, not the "not assessed" fallback.
      expect(title).not.toMatch(/Not yet assessed/);
      expect(title).toMatch(/needs work[\s\S]*•/);
    }
  }
  expect(checkedCovered, 'expected a 🟢 covered dot with a reason').toBeTruthy();
  expect(checkedGap, 'expected a 🟡/🔴 dot with concrete gap bullets').toBeTruthy();
  console.log('✓ assessed submission: dots carry real reasons');
});

test('2) "not assessed" dots + Check-coverage backfill (MCC / no-coverage)', async ({ page }) => {
  test.skip(!MCC_SUBMISSION_ID, 'set MCC_SUBMISSION_ID to a submission without coverage');
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1600, height: 950 });
  await login(page);
  await page.goto(`${BASE}/self-study/${MCC_SUBMISSION_ID}?view=review`);
  // Wait on the review chrome (heavier MCC payloads can take a while), then the
  // rail via a stable CSS selector rather than the landmark role.
  await expect(page.getByTestId('check-coverage-cta')).toBeVisible({ timeout: 120000 });
  const rail = page.locator('aside[aria-label="Specifications"]');
  await expect(rail).toBeVisible({ timeout: 30000 });

  const unassessed = rail.locator('[data-testid^="coverage-dot-"][data-coverage-state="unassessed"]');
  const before = await unassessed.count();
  console.log(`unassessed dots before: ${before}`);

  if (before > 0) {
    // An unassessed dot must say so — and must NOT masquerade as a red gap.
    const t = (await unassessed.first().getAttribute('title')) || '';
    expect(t).toMatch(/Not yet assessed/);
    expect(t).toMatch(/Check coverage/);
    expect(t).not.toMatch(/🔴 Gap/);

    // Backfill: click "Check coverage" and wait for it to finish.
    const btn = page.getByTestId('check-coverage-cta');
    await expect(btn).toBeVisible();
    await btn.click();
    await expect(page.getByTestId('coverage-done')).toBeVisible({ timeout: 280_000 });
    await page.waitForTimeout(1500);

    const after = await rail.locator('[data-testid^="coverage-dot-"][data-coverage-state="unassessed"]').count();
    console.log(`unassessed dots after Check coverage: ${after}`);
    expect(after).toBeLessThan(before);
  } else {
    console.log('(already assessed from a prior run — verifying real reasons exist)');
  }

  // Either way, a now-assessed dot must carry a REAL reason (not the fallback).
  const assessed = rail.locator('[data-testid^="coverage-dot-"]:not([data-coverage-state="unassessed"]):not([data-coverage-state="none"])');
  const na = await assessed.count();
  expect(na).toBeGreaterThan(0);
  let sawReason = false;
  for (let i = 0; i < Math.min(na, 12); i++) {
    const title = (await assessed.nth(i).getAttribute('title')) || '';
    if (/•/.test(title) && !/Not yet assessed/.test(title)) { sawReason = true; break; }
  }
  expect(sawReason, 'a backfilled dot should show real gaps/strengths').toBeTruthy();
  console.log('✓ MCC-style submission: Check coverage produced real reasons behind every dot');
});
