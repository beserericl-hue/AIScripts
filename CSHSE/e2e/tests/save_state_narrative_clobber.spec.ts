import { test, expect, request, APIRequestContext } from '@playwright/test';
import { seedFixture, cleanupSeed, type SeedResult } from '../helpers/seed';

/**
 * Regression (prod): "Approved Standard 2 → it did not copy over" while Standard
 * 1 survived. Cause: /review/save-state did a full submission.save() that, when
 * it landed after a concurrent set-approved materialize, overwrote the just-
 * written narratives with its stale snapshot. This fires save-state and
 * set-approved CONCURRENTLY across many rounds and asserts BOTH standards'
 * narratives always survive. Seeds review buckets directly (no MCC import).
 */
const BASE = process.env.E2E_BASE_URL ?? 'https://cshse-develop.up.railway.app';
const SSO_KEY = process.env.E2E_SSO_KEY ?? '';
const RUN = Date.now().toString(36);

async function tok(api: APIRequestContext, email: string) {
  return (await (await api.post('/api/v1/auth/sso-login', { headers: { 'x-cshse-api-key': SSO_KEY }, data: { email } })).json()).token as string;
}
function bucket(std: string, spec: string) {
  return {
    standardCode: std, specCode: spec, standardTitle: `Standard ${std}`, specPrompt: `Spec ${std}.${spec}`,
    narratives: [{ sectionId: `n-${std}-${spec}-${RUN}`, heading: `${spec}.`, snippet: `Narrative ${std}.${spec}.`, htmlSnippet: `<p>Narrative ${std}.${spec}.</p>`, wordCount: 3, confidence: 0.95, acceptState: 'review_unknown' }],
    evidenceText: [], evidenceFiles: [], matrixCells: [], coverageScore: null, coverageCovered: null, coverageGaps: [], coverageStrengths: [],
  };
}

test('concurrent save-state does NOT clobber narratives materialized by set-approved', async ({ }) => {
  test.skip(!SSO_KEY, 'set E2E_SSO_KEY');
  test.setTimeout(120_000);
  const api = await request.newContext({ baseURL: BASE });
  let seed: SeedResult | undefined;
  try {
    const std1 = ['a', 'b', 'c', 'd', 'e', 'f'];
    const std2 = ['a', 'b', 'c', 'd'];
    const buckets: Record<string, unknown> = {};
    for (const s of std1) buckets[`1.${s}`] = bucket('1', s);
    for (const s of std2) buckets[`2.${s}`] = bucket('2', s);
    seed = await seedFixture('wizard_review_minimal', {
      user: { institutionName: `SaveRace ${RUN}`, email: 'saverace-pc@test.local' },
      submission: { institutionName: `SaveRace ${RUN}` },
      reviewState: { buckets, cvs: [], tags: [], introductions: {}, placeholderSections: [], matrices: [] },
    });
    const token = await tok(api, seed!.userEmail);
    const auth = { Authorization: `Bearer ${token}` };
    const sub = seed!.submissionId;
    const allIds = [...std1.map((s) => `n-1-${s}-${RUN}`), ...std2.map((s) => `n-2-${s}-${RUN}`)];
    const saveBody = { buckets, cvs: [], tags: [], introductions: {}, placeholderSections: [] };

    let worstMissing: string[] = [];
    for (let i = 0; i < 15; i++) {
      // Fire save-state and set-approved (materialize all) CONCURRENTLY — the
      // exact interleave that clobbered narratives before the fix.
      await Promise.all([
        api.post(`/api/submissions/${sub}/review/save-state`, { headers: auth, data: saveBody }),
        api.post(`/api/submissions/${sub}/review/set-approved`, { headers: auth, data: { approvedIds: allIds } }),
      ]);
      const body = await (await api.get(`/api/submissions/${sub}`, { headers: auth })).json();
      const s = (body.submission ?? body) as any;
      const present = new Set(
        (s.narrativeContent ?? [])
          .filter((n: any) => (n.content || '').trim())
          .map((n: any) => `${n.standardCode}.${n.specCode}`)
      );
      const expected = [...std1.map((s) => `1.${s}`), ...std2.map((s) => `2.${s}`)];
      const missing = expected.filter((k) => !present.has(k));
      if (missing.length > worstMissing.length) worstMissing = missing;
    }
    console.log('worst-missing across concurrent save-state/set-approved rounds:', JSON.stringify(worstMissing));
    expect(worstMissing, 'no narrative was ever clobbered by concurrent save-state').toEqual([]);
  } finally {
    await cleanupSeed(seed);
  }
});
