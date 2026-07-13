import { test, expect, request, APIRequestContext } from '@playwright/test';
import { seedFixture, cleanupSeed, type SeedResult } from '../helpers/seed';

/**
 * A hyperlink inside the Standards (self-study) narrative editor must be
 * clickable — clicking it opens the target in a NEW TAB (so the coordinator
 * never navigates away from the edit surface and loses unsaved work). The Link
 * extension keeps openOnClick:false; a handleClick handler does the new-tab open.
 */
const BASE = process.env.E2E_BASE_URL ?? 'https://cshse-develop.up.railway.app';
const SSO_KEY = process.env.E2E_SSO_KEY ?? '';
const RUN = Date.now().toString(36);
const HREF = 'https://example.com/seeded-afa-link';

async function tok(api: APIRequestContext, email: string) {
  return (await (await api.post('/api/v1/auth/sso-login', { headers: { 'x-cshse-api-key': SSO_KEY }, data: { email } })).json()).token as string;
}

test('a link in the Standards narrative opens in a new tab on click', async ({ page }) => {
  test.skip(!SSO_KEY, 'set E2E_SSO_KEY');
  test.setTimeout(120_000);
  const api = await request.newContext({ baseURL: BASE });
  let seed: SeedResult | undefined;
  try {
    seed = await seedFixture('wizard_review_minimal', { user: { institutionName: `Link Inst ${RUN}`, email: 'link-pc@test.local' }, submission: { institutionName: `Link Inst ${RUN}` } });
    const token = await tok(api, seed!.userEmail);
    const auth = { Authorization: `Bearer ${token}` };
    const institutionId = ((await (await api.get('/api/auth/me', { headers: auth })).json()).user ?? {}).institutionId;
    const sub = ((await (await api.post('/api/submissions', { headers: auth, data: { institutionId, institutionName: 'Link', programName: 'HS', programLevel: 'associate', type: 'initial' } })).json()).submission)._id;

    // Seed a narrative for Standard 1.a containing a hyperlink.
    const content = `<p>Program info. See <a href="${HREF}">SEEDED AFA LINK</a> for accreditation details.</p>`;
    const patch = await api.patch(`/api/submissions/${sub}/narrative`, { headers: auth, data: { standardCode: '1', specCode: 'a', content } });
    expect(patch.ok(), 'narrative saved').toBeTruthy();

    // Open the Standards editor and select spec 1.a.
    await page.goto(`${BASE}/self-study/${sub}?view=standards#token=${encodeURIComponent(token)}`);
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20000 });
    await page.waitForLoadState('networkidle');
    // Expand Standard 1 if collapsed, then open spec 1.a.
    const std1 = page.getByRole('button', { name: /Standard 1\b/ }).first();
    if (await std1.count()) await std1.click().catch(() => {});
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /1\.a\b/ }).first().click();

    // The seeded link must render in the editor.
    const link = page.getByRole('link', { name: 'SEEDED AFA LINK' }).first();
    await expect(link).toBeVisible({ timeout: 15000 });

    // Clicking it opens a NEW TAB to the href (not same-page navigation).
    const [popup] = await Promise.all([
      page.waitForEvent('popup', { timeout: 10000 }),
      link.click(),
    ]);
    expect(popup.url()).toContain('seeded-afa-link');
    // And the editor page did NOT navigate away.
    expect(page.url()).toContain(`/self-study/${sub}`);
    await popup.close();
  } finally {
    await cleanupSeed(seed);
  }
});
