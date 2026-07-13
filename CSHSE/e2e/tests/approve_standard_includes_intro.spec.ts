import { test, expect, request, APIRequestContext } from '@playwright/test';
import { seedFixture, cleanupSeed, type SeedResult } from '../helpers/seed';

/**
 * "Approve all of Standard N → editor" must include the STANDARD's Introduction
 * (it is part of the standard), not just the a–f subspecs. Seeds Standard-1
 * buckets + a Standard-1 introduction, selects spec 1.a, approves, and asserts
 * BOTH the subspecs AND the standard introduction materialize.
 */
const BASE = process.env.E2E_BASE_URL ?? 'https://cshse-develop.up.railway.app';
const SSO_KEY = process.env.E2E_SSO_KEY ?? '';
const RUN = Date.now().toString(36);
const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f'];
const INTRO_ID = `intro-std1-${RUN}`;

async function tok(api: APIRequestContext, email: string) {
  return (await (await api.post('/api/v1/auth/sso-login', { headers: { 'x-cshse-api-key': SSO_KEY }, data: { email } })).json()).token as string;
}
function bucket(spec: string) {
  return {
    standardCode: '1', specCode: spec, standardTitle: 'Program Identity', specPrompt: `Spec 1.${spec}`,
    narratives: [{ sectionId: `n-1-${spec}-${RUN}`, heading: `${spec}.`, snippet: `Narrative 1.${spec}.`, htmlSnippet: `<p>Narrative 1.${spec}.</p>`, wordCount: 3, confidence: 0.95, acceptState: 'review_unknown' }],
    evidenceText: [], evidenceFiles: [], matrixCells: [], coverageScore: null, coverageCovered: null, coverageGaps: [], coverageStrengths: [],
  };
}

test('Approve all of Standard 1 also moves the Standard 1 Introduction', async ({ page }) => {
  test.skip(!SSO_KEY, 'set E2E_SSO_KEY');
  test.setTimeout(120_000);
  const api = await request.newContext({ baseURL: BASE });
  let seed: SeedResult | undefined;
  try {
    const buckets: Record<string, unknown> = {};
    for (const s of LETTERS) buckets[`1.${s}`] = bucket(s);
    seed = await seedFixture('wizard_review_minimal', {
      user: { institutionName: `Intro ${RUN}`, email: 'introstd-pc@test.local' },
      submission: { institutionName: `Intro ${RUN}` },
      reviewState: {
        buckets, cvs: [], tags: [], placeholderSections: [], matrices: [],
        introductions: {
          'standard-1': {
            scope: 'standard', standardCode: '1',
            items: [{ sectionId: INTRO_ID, heading: 'Overview', snippet: 'Standard 1 intro text.', htmlSnippet: '<p>Standard 1 intro text.</p>', wordCount: 4, confidence: 1.0, acceptState: 'review_unknown' }],
          },
        },
      },
    });
    const token = await tok(api, seed!.userEmail);
    const auth = { Authorization: `Bearer ${token}` };
    const sub = seed!.submissionId;

    await page.goto(`${BASE}/self-study/${sub}?view=review#token=${encodeURIComponent(token)}`);
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20000 });
    await page.waitForLoadState('networkidle');
    const spec1a = page.locator('button[role="tab"][title^="1.a —"]').first();
    await spec1a.waitFor({ state: 'visible', timeout: 30000 });
    await spec1a.click();

    const approveBtn = page.getByTestId('approve-all');
    await expect(approveBtn).toContainText(/Approve all of Standard 1 → editor/);
    await approveBtn.click();
    await expect(approveBtn).toBeEnabled({ timeout: 45000 });

    // Poll: all six subspecs AND the standard-1 introduction must materialize.
    await expect.poll(async () => {
      const body = await (await api.get(`/api/submissions/${sub}`, { headers: auth })).json();
      const s = (body.submission ?? body) as any;
      const specs = new Set((s.narrativeContent ?? []).filter((n: any) => String(n.standardCode) === '1' && (n.content || '').trim()).map((n: any) => n.specCode));
      const introHtml = (s.standardIntroductions ?? {})['1'] || '';
      const allSpecs = LETTERS.every((l) => specs.has(l));
      return allSpecs && introHtml.includes('Standard 1 intro text');
    }, { timeout: 60000, intervals: [2500] }).toBe(true);
    console.log('Standard 1 specs + introduction all materialized ✓');
  } finally {
    await cleanupSeed(seed);
  }
});
