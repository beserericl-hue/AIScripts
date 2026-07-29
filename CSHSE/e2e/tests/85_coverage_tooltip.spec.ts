import { test, expect, request, Page } from '@playwright/test';

/**
 * Coverage-dot tooltips (Monica / Kennesaw request): hovering a spec's
 * green/yellow/red dot in the Review rail must explain WHY that color — the
 * coverage status + the AI's specific gaps/strengths — so a coordinator isn't
 * guessing. Runs on dev (SU) or prod (impersonate the doc's PC).
 * Env: BASE, SU_EMAIL/SU_PASSWORD, SUBMISSION_ID, optional PC_* for prod.
 */
const BASE = process.env.BASE ?? 'https://cshse-develop.up.railway.app';
const SU_EMAIL = process.env.SU_EMAIL ?? 'eric@agileadtesting.com';
const SU_PASSWORD = process.env.SU_PASSWORD ?? 'Fr332bafami!y';
const SUBMISSION_ID = process.env.SUBMISSION_ID ?? '6a628cfc18c16eda99b34a95';
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

test('coverage dots explain their color on hover', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1600, height: 950 });
  const api = await request.newContext();
  const token = (await j(api.post(`${BASE}/api/auth/login`, { data: { email: SU_EMAIL, password: SU_PASSWORD } }))).token;
  await signIn(page, token);

  await page.goto(`${BASE}/self-study/${SUBMISSION_ID}?view=review`);
  const rail = page.getByRole('complementary', { name: 'Specifications' });
  await expect(rail).toBeVisible({ timeout: 60000 });

  // Legend advertises the hover.
  await expect(rail.getByText(/hover a dot for why/i)).toBeVisible();

  // Find several dots and read their tooltip (title) text.
  const dots = rail.locator('[data-testid^="coverage-dot-"]');
  const n = await dots.count();
  expect(n).toBeGreaterThan(5);

  let checkedGap = false, checkedCovered = false;
  const seen: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = dots.nth(i);
    const key = (await d.getAttribute('data-testid'))!.replace('coverage-dot-', '');
    const title = (await d.getAttribute('title')) || '';
    expect(title.length, `dot ${key} should have a reason tooltip`).toBeGreaterThan(30);
    // Every tooltip states a color/status word.
    expect(title).toMatch(/Covered|Partial|Gap|No content placed/);

    if (/🟢 Covered/.test(title) && !checkedCovered) {
      checkedCovered = true;
      seen.push(`${key}: covered tip = "${title.split('\n')[0]}"`);
    }
    if (/🔴 Gap|🟡 Partial/.test(title) && /needs work/i.test(title) && title.includes('•') && !checkedGap) {
      checkedGap = true;
      // A gap/partial dot must list at least one concrete "what needs work" bullet.
      expect(title).toMatch(/needs work[\s\S]*•/);
      seen.push(`${key}: ${title.split('\n')[0]}  |  first gap: ${title.split('•')[1]?.trim().slice(0, 70)}`);
    }
  }

  expect(checkedCovered, 'expected at least one 🟢 covered dot with an explanation').toBeTruthy();
  expect(checkedGap, 'expected at least one 🟡/🔴 dot listing what needs work').toBeTruthy();

  // Screenshot a dot's tooltip region (hover to surface the native title where supported).
  const firstGap = rail.locator('[data-testid^="coverage-dot-"]').first();
  await firstGap.hover();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'report/coverage-tooltip.png' });

  console.log('Coverage-dot tooltips:\n  ' + seen.join('\n  '));
  console.log('✓ every dot has a reason; covered + gap tooltips verified');
});
