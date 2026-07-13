import { test, expect, request, APIRequestContext } from '@playwright/test';
import { seedFixture, cleanupSeed, type SeedResult } from '../helpers/seed';

/**
 * Regression (prod): "Approve all → Self-Study editor is empty/partial". The AI
 * eval-queue worker's validateSection ended with a full submission.save() that
 * rewrote the whole doc from a stale snapshot, clobbering narratives another
 * request had just materialized (lost update). This test runs validation
 * CONCURRENTLY with materialize and asserts the materialized narratives survive.
 * Seeds review buckets directly (no MCC import).
 */
const BASE = process.env.E2E_BASE_URL ?? 'https://cshse-develop.up.railway.app';
const SSO_KEY = process.env.E2E_SSO_KEY ?? '';
const RUN = Date.now().toString(36);
const LETTERS = ['a', 'b', 'c', 'd', 'e', 'f'];

async function tok(api: APIRequestContext, email: string) {
  return (await (await api.post('/api/v1/auth/sso-login', { headers: { 'x-cshse-api-key': SSO_KEY }, data: { email } })).json()).token as string;
}

function bucket(spec: string) {
  return {
    standardCode: '1', specCode: spec, standardTitle: 'Program Identity', specPrompt: `Spec 1.${spec}`,
    narratives: [{
      sectionId: `n-1-${spec}-${RUN}`, heading: `${spec}.`,
      snippet: `Seeded narrative content for specification 1.${spec} with enough words to evaluate.`,
      htmlSnippet: `<p>Seeded narrative content for specification 1.${spec} with enough words to evaluate.</p>`,
      wordCount: 10, confidence: 0.95, acceptState: 'review_unknown',
    }],
    evidenceText: [], evidenceFiles: [], matrixCells: [],
    coverageScore: null, coverageCovered: null, coverageGaps: [], coverageStrengths: [],
  };
}

test('AI validation running concurrently does NOT clobber materialized narratives', async ({ }) => {
  test.skip(!SSO_KEY, 'set E2E_SSO_KEY');
  test.setTimeout(180_000);
  const api = await request.newContext({ baseURL: BASE });
  let seed: SeedResult | undefined;
  try {
    const buckets: Record<string, unknown> = {};
    for (const s of LETTERS) buckets[`1.${s}`] = bucket(s);
    seed = await seedFixture('wizard_review_minimal', {
      user: { institutionName: `Clobber ${RUN}`, email: 'clobber-pc@test.local' },
      submission: { institutionName: `Clobber ${RUN}` },
      reviewState: { buckets, cvs: [], tags: [], introductions: {}, placeholderSections: [], matrices: [] },
    });
    const token = await tok(api, seed!.userEmail);
    const auth = { Authorization: `Bearer ${token}` };
    const sub = seed!.submissionId;
    const approvedIds = LETTERS.map((s) => `n-1-${s}-${RUN}`);

    // 1) Approve → materialize narratives for 1.a–1.f (also enqueues them for eval).
    await api.post(`/api/submissions/${sub}/review/set-approved`, { headers: auth, data: { approvedIds } });
    // Kick a full validate-all so the worker churns validateSection repeatedly.
    await api.post(`/api/submissions/${sub}/review/evaluate-all`, { headers: auth });

    // 2) While validation runs, re-materialize a few more times (the concurrent
    //    window where the old full-save clobbered narratives). Then keep polling
    //    the editor content and assert ALL six specs stay present the whole time.
    let worstMissing: string[] = [];
    for (let i = 0; i < 12; i++) {
      // Re-approve to force another materialize concurrent with validation.
      await api.post(`/api/submissions/${sub}/review/set-approved`, { headers: auth, data: { approvedIds } });
      const body = await (await api.get(`/api/submissions/${sub}`, { headers: auth })).json();
      const s = (body.submission ?? body) as any;
      const present = new Set(
        (s.narrativeContent ?? [])
          .filter((n: any) => String(n.standardCode) === '1' && (n.content || '').trim())
          .map((n: any) => n.specCode)
      );
      const missing = LETTERS.filter((l) => !present.has(l));
      if (missing.length > worstMissing.length) worstMissing = missing;
      // brief pause to overlap with the 4s worker tick
      await new Promise((r) => setTimeout(r, 2500));
    }
    console.log('worst missing during concurrent validation:', JSON.stringify(worstMissing));
    expect(worstMissing, 'no narrative was ever clobbered by concurrent validation').toEqual([]);
  } finally {
    await cleanupSeed(seed);
  }
});
