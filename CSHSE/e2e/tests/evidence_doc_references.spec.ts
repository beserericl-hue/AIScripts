import { test, expect, request, APIRequestContext } from '@playwright/test';
import { seedFixture, cleanupSeed, type SeedResult } from '../helpers/seed';

/**
 * Multi-section appendix references: one appendix (evidence doc) can be linked
 * under several sections (e.g. Appendix A10 → Introduction AND Standard 1.e).
 * The reviewer sets the full list; materialize (set-approved) fans out over
 * referencedBySpecs, creating one SupportingEvidence per referenced section.
 * Seeds the evidence doc directly into aiReviewState (no 15-min MCC import).
 */
const BASE = process.env.E2E_BASE_URL ?? 'https://cshse-develop.up.railway.app';
const SSO_KEY = process.env.E2E_SSO_KEY ?? '';
const RUN = Date.now().toString(36);
const SECTION_ID = `mccap:test:A10:${RUN}`;

async function tok(api: APIRequestContext, email: string) {
  return (await (await api.post('/api/v1/auth/sso-login', { headers: { 'x-cshse-api-key': SSO_KEY }, data: { email } })).json()).token as string;
}

test('an appendix can reference multiple sections; materialize links it under each', async ({ }) => {
  test.skip(!SSO_KEY, 'set E2E_SSO_KEY');
  test.setTimeout(120_000);
  const api = await request.newContext({ baseURL: BASE });
  let seed: SeedResult | undefined;
  try {
    // Seed a submission whose aiReviewState already contains one appendix doc.
    seed = await seedFixture('wizard_review_minimal', {
      user: { institutionName: `Ref Inst ${RUN}`, email: 'ref-pc@test.local' },
      submission: { institutionName: `Ref Inst ${RUN}` },
      reviewState: {
        buckets: {},
        cvs: [],
        tags: [],
        introductions: {},
        placeholderSections: [],
        matrices: [],
        evidenceDocs: [
          {
            sectionId: SECTION_ID,
            docSubKind: 'paper',
            title: 'Appendix A10: Enrollment Trends / Retention / Graduation Data',
            summary: 'Appendix section A — other.',
            pageCountEstimate: 2,
            imageCount: 0,
            htmlSnippet: '<p>Enrollment and graduation data for MCC.</p>',
            snippet: 'Enrollment and graduation data for MCC.',
            resolvedStd: 'introduction',
          },
        ],
      },
    });
    const token = await tok(api, seed!.userEmail);
    const auth = { Authorization: `Bearer ${token}` };
    const sub = seed!.submissionId;

    // The seeded appendix is present in the review state.
    const review0 = await (await api.get(`/api/submissions/${sub}/review`, { headers: auth })).json();
    const docs0 = (review0.aiReviewState ?? review0).evidenceDocs ?? review0.evidenceDocs ?? [];
    expect(docs0.some((d: any) => d.sectionId === SECTION_ID), 'seeded appendix present').toBeTruthy();

    // Set TWO references: Introduction AND Standard 1.e (the A10 scenario).
    const setRes = await api.post(`/api/submissions/${sub}/review/evidence-doc-references`, {
      headers: auth,
      data: { sectionId: SECTION_ID, references: [{ std: 'introduction' }, { std: '1', spec: 'e' }] },
    });
    expect(setRes.ok(), 'set-references ok').toBeTruthy();

    // Persisted on the review item.
    const review1 = await (await api.get(`/api/submissions/${sub}/review`, { headers: auth })).json();
    const doc1 = ((review1.aiReviewState ?? review1).evidenceDocs ?? review1.evidenceDocs ?? []).find((d: any) => d.sectionId === SECTION_ID);
    const refs = (doc1?.referencedBySpecs ?? []).map((r: any) => `${r.std}${r.spec ? '.' + r.spec : ''}`).sort();
    console.log('persisted referencedBySpecs:', JSON.stringify(doc1?.referencedBySpecs));
    expect(refs).toEqual(['1.e', 'introduction']);

    // Approve the appendix → materialize fans out over both references.
    const appr = await api.post(`/api/submissions/${sub}/review/set-approved`, { headers: auth, data: { approvedIds: [SECTION_ID] } });
    expect(appr.ok(), 'set-approved ok').toBeTruthy();

    // Two SupportingEvidence records: one under Introduction, one under 1.e.
    // And NONE with a bogus specCode of the literal string "undefined".
    const ev = await (await api.get(`/api/submissions/${sub}/evidence`, { headers: auth })).json();
    const list: any[] = ev.evidence ?? ev.files ?? ev ?? [];
    const mine = list.filter((e) => Array.isArray(e.tags) && e.tags.some((t: string) => t.includes(SECTION_ID)));
    const routes = mine.map((e) => `${e.standardCode ?? ''}${e.specCode ? '.' + e.specCode : ''}`).sort();
    console.log('materialized SupportingEvidence routes:', JSON.stringify(routes), '| count:', mine.length);
    expect(mine.length, 'one record per referenced section').toBe(2);
    expect(routes).toEqual(['1.e', 'introduction']);
    expect(mine.every((e) => e.specCode !== 'undefined'), 'no literal "undefined" specCode').toBeTruthy();
  } finally {
    await cleanupSeed(seed);
  }
});
