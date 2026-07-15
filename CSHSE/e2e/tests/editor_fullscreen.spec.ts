import { test, expect, request, APIRequestContext } from '@playwright/test';
import { seedFixture, cleanupSeed, type SeedResult } from '../helpers/seed';

/**
 * Self-Study editor must be usable on small screens: a "Full screen" toggle
 * pops the whole editor into a full-viewport overlay so the narrative can be
 * read/edited. Simulated on a small viewport. Verifies the toggle exists and
 * that toggling fills the viewport.
 */
const BASE = process.env.E2E_BASE_URL ?? 'https://cshse-develop.up.railway.app';
const SSO_KEY = process.env.E2E_SSO_KEY ?? '';
const RUN = Date.now().toString(36);

async function tok(api: APIRequestContext, email: string) {
  return (await (await api.post('/api/v1/auth/sso-login', { headers: { 'x-cshse-api-key': SSO_KEY }, data: { email } })).json()).token as string;
}

test('editor Full screen toggle fills the viewport on a small screen', async ({ browser }) => {
  test.skip(!SSO_KEY, 'set E2E_SSO_KEY');
  test.setTimeout(90_000);
  const api = await request.newContext({ baseURL: BASE });
  let seed: SeedResult | undefined;
  try {
    seed = await seedFixture('wizard_review_minimal', {
      user: { institutionName: `FS ${RUN}`, email: 'fs-pc@test.local' },
      submission: { institutionName: `FS ${RUN}` },
    });
    const token = await tok(api, seed!.userEmail);
    const auth = { Authorization: `Bearer ${token}` };
    const sub = seed!.submissionId;
    // Give spec 1.a some narrative content so the editor renders it.
    await api.patch(`/api/submissions/${sub}/narrative`, { headers: auth, data: { standardCode: '1', specCode: 'a', content: '<p>' + 'Line of narrative text. '.repeat(60) + '</p>' } });

    // Small screen (the reported failure condition).
    const ctx = await browser.newContext({ viewport: { width: 900, height: 600 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/self-study/${sub}?view=standards#token=${encodeURIComponent(token)}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    // Select Standard 1 (opens spec 1.a).
    await page.getByRole('button', { name: /Standard 1\b/ }).first().click();
    await page.waitForTimeout(1000);

    const toggle = page.getByTestId('editor-fullscreen-toggle').first();
    await expect(toggle, 'Full screen toggle present').toBeVisible({ timeout: 15000 });
    await expect(toggle).toContainText(/Full screen/);

    // Enter full screen → the editor root should fill (nearly) the whole viewport.
    await toggle.click();
    await page.waitForTimeout(400);
    const vp = page.viewportSize()!;
    const box = await page.locator('.narrative-editor').first().boundingBox();
    console.log('editor box after expand:', box, 'viewport:', vp);
    expect(box!.width).toBeGreaterThan(vp.width * 0.9);
    expect(box!.height).toBeGreaterThan(vp.height * 0.9);
    await expect(toggle).toContainText(/Exit full screen/);

    // Esc exits.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await expect(page.getByTestId('editor-fullscreen-toggle').first()).toContainText(/Full screen/);
    await ctx.close();
  } finally {
    await cleanupSeed(seed);
  }
});
