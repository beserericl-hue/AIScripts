import { test, expect, request, APIRequestContext } from '@playwright/test';
import * as fs from 'fs';
import { seedFixture, cleanupSeed, type SeedResult } from '../helpers/seed';

/**
 * "Approve all of Standard N → editor" must approve EVERY subspecification of
 * the standard on screen (1.a–1.f), not just the selected one, and move them to
 * the editor. Drives the real Review UI + verifies materialization.
 */
const BASE = process.env.E2E_BASE_URL ?? 'https://cshse-develop.up.railway.app';
const SSO_KEY = process.env.E2E_SSO_KEY ?? '';
const PDF = process.env.MCC_PDF ?? '';
const RUN = Date.now().toString(36);

async function tok(api: APIRequestContext, email: string) {
  return (await (await api.post('/api/v1/auth/sso-login', { headers: { 'x-cshse-api-key': SSO_KEY }, data: { email } })).json()).token as string;
}

test('Approve all of Standard 1 moves every subspec (a–f) to the editor', async ({ page }) => {
  test.skip(!SSO_KEY || !PDF, 'set E2E_SSO_KEY + MCC_PDF');
  test.setTimeout(900_000);
  const api = await request.newContext({ baseURL: BASE });
  let seed: SeedResult | undefined;
  try {
    seed = await seedFixture('wizard_review_minimal', { user: { institutionName: `AppStd Inst ${RUN}`, email: 'appstd-pc@test.local' }, submission: { institutionName: `AppStd Inst ${RUN}` } });
    const token = await tok(api, seed!.userEmail);
    const auth = { Authorization: `Bearer ${token}` };
    const institutionId = ((await (await api.get('/api/auth/me', { headers: auth })).json()).user ?? {}).institutionId;
    const sub = ((await (await api.post('/api/submissions', { headers: auth, data: { institutionId, institutionName: 'AppStd', programName: 'HS', programLevel: 'associate', type: 'initial' } })).json()).submission)._id;
    const up = await api.post('/api/imports/upload', { headers: auth, multipart: { submissionId: sub, file: { name: 'mcc.pdf', mimeType: 'application/pdf', buffer: fs.readFileSync(PDF) } } });
    const importId = (await up.json()).importId;
    await api.post(`/api/imports/${importId}/start-ai`, { headers: auth, data: { programLevel: 'associate', forceFormat: null } });
    await expect.poll(async () => {
      const b = await (await api.get(`/api/submissions/${sub}`, { headers: auth })).json();
      return Object.keys((((b.submission ?? b) as any).aiReviewState ?? {}).buckets ?? {}).length;
    }, { timeout: 700_000, intervals: [5000] }).toBeGreaterThan(0);

    // Open Review, select spec 1.a.
    await page.goto(`${BASE}/self-study/${sub}#token=${encodeURIComponent(token)}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: /^\s*Review/ }).first().click();
    await page.waitForTimeout(1500);
    // The rail renders "1.a" and the standard title in separate spans, so a text
    // regex spanning both never matches. The spec tab's title attr starts "1.a — ".
    const spec1a = page.locator('button[role="tab"][title^="1.a —"]').first();
    await spec1a.waitFor({ state: 'visible', timeout: 30000 });
    await spec1a.click();
    await page.waitForTimeout(1000);

    // The top button must be labeled for the whole standard.
    const approveBtn = page.getByTestId('approve-all');
    await expect(approveBtn).toBeVisible({ timeout: 10000 });
    await expect(approveBtn).toContainText(/Approve all of Standard 1 → editor/);
    await page.screenshot({ path: 'test-results/approve-standard-button.png' });
    await approveBtn.click();

    // The materialize round-trip (save review state → set-approved → recompute
    // narratives for every approved spec) is async; poll the editor content
    // until all of Standard 1's subspecs land instead of racing a fixed wait.
    let specs = new Set<string>();
    await expect
      .poll(
        async () => {
          const body = await (await api.get(`/api/submissions/${sub}`, { headers: auth })).json();
          const s = (body.submission ?? body) as any;
          const narr = (s.narrativeContent ?? []) as any[];
          specs = new Set(
            narr
              .filter((n) => String(n.standardCode) === '1' && (n.content || '').trim().length > 0)
              .map((n) => n.specCode)
          );
          return ['a', 'b', 'c', 'd', 'e', 'f'].every((l) => specs.has(l));
        },
        { timeout: 60_000, intervals: [2000] }
      )
      .toBe(true);
    console.log('Standard 1 specs materialized:', [...specs].sort().join(', '));

    // And the background AI review was queued for those specs (Part 2).
    const prog = await (await api.get(`/api/submissions/${sub}/review/eval-progress`, { headers: auth })).json();
    console.log('eval-progress after approve-all:', JSON.stringify(prog));
    expect(prog.total, 'background AI review was queued').toBeGreaterThan(0);
  } finally {
    await cleanupSeed(seed);
  }
});
