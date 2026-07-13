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
    // Selecting Standard 1 opens its first spec (1.a) — where we seeded the link.
    const std1 = page.getByRole('button', { name: /Standard 1\b/ }).first();
    await std1.click();
    await page.waitForTimeout(800);

    // The seeded link renders in the editor.
    const link = page.getByRole('link', { name: 'SEEDED AFA LINK' }).first();
    await expect(link).toBeVisible({ timeout: 15000 });

    // Clicking the link inside the (editable) editor must open the href in a
    // NEW TAB via window.open — never navigate the edit surface away. We spy on
    // window.open and dispatch a real click on the anchor (a coordinate click is
    // unreliable here: the editor's floating action row overlaps short content).
    const result = await page.evaluate((href) => {
      const out: { openArgs: any[] } = { openArgs: [] };
      const orig = window.open;
      (window as any).open = (...a: any[]) => { out.openArgs.push(a); return null; };
      const a = Array.from(document.querySelectorAll('a[href]')).find(
        (x) => x.getAttribute('href') === href
      ) as HTMLElement | undefined;
      if (!a) return { ...out, err: 'anchor not found' };
      a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      window.open = orig;
      return out;
    }, HREF);
    console.log('window.open after link click:', JSON.stringify(result));
    expect((result as any).openArgs?.length, 'window.open was called for the link').toBeGreaterThan(0);
    expect((result as any).openArgs[0][0]).toContain('seeded-afa-link');
    expect((result as any).openArgs[0][1], 'opens in a new tab').toBe('_blank');
    // The editor page itself did NOT navigate away.
    expect(page.url()).toContain(`/self-study/${sub}`);
  } finally {
    await cleanupSeed(seed);
  }
});
