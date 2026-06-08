/**
 * Approved evidence must be findable AND carry readable text for the AI.
 *
 * Two bugs this guards against (user-reported 2026-06-07):
 *  1) UN-ASSIGNED approved CVs / syllabi / papers were silently dropped by the
 *     materialize guard `&& (resolvedStd || routing?.std)` — so ~55 of 65
 *     approved evidence items on the live submission never became
 *     SupportingEvidence at all (invisible to the AI + not in the File Library).
 *  2) Even materialized evidence stored only a title-ish `description`
 *     ("(data table)"), never the file body — so the AI evaluator (which reads
 *     the evidence text) "couldn't see the file".
 *
 * This drives the real server flow: seed an UN-ASSIGNED CV + an UN-ASSIGNED
 * syllabus (each with table HTML as the real body) → POST set-approved →
 * GET /evidence and assert BOTH materialized AND carry the body text in
 * metadata.description (the field the evaluator reads).
 */
import { test, expect } from '@playwright/test';
import { seedFixture, cleanupSeed, loginAsSeededViaSso, type SeedResult } from '../helpers/seed';

const CV = 'sec-ev-cv-1';
const SYL = 'sec-ev-syl-1';
const CV_MARKER = 'CVBODYMARKER59';
const SYL_MARKER = 'SYLBODYMARKER59';

async function evidence(page: any, submissionId: string) {
  return page.evaluate(async (id: string) => {
    const raw = localStorage.getItem('auth-storage');
    const token = raw ? JSON.parse(raw)?.state?.token : null;
    const r = await fetch(`/api/submissions/${id}/evidence`, { headers: { Authorization: `Bearer ${token}` } });
    const d = await r.json();
    const items = Array.isArray(d) ? d : (d.evidence || d.items || d.data || []);
    return items.map((e: any) => ({
      tags: e.tags || [],
      standardCode: e.standardCode ?? null,
      specCode: e.specCode ?? null,
      desc: e.description || '',
      metaDesc: e?.metadata?.description || '',
    }));
  }, submissionId);
}

async function setApproved(page: any, submissionId: string, ids: string[]) {
  return page.evaluate(async ({ id, ids }: { id: string; ids: string[] }) => {
    const raw = localStorage.getItem('auth-storage');
    const token = raw ? JSON.parse(raw)?.state?.token : null;
    const r = await fetch(`/api/submissions/${id}/review/set-approved`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ approvedIds: ids }),
    });
    return r.status;
  }, { id: submissionId, ids });
}

test.describe('Approved evidence materializes with readable text (even unassigned)', () => {
  let seed: SeedResult | undefined;
  test.afterEach(async () => {
    await cleanupSeed(seed);
    seed = undefined;
  });

  test('unassigned CV + syllabus become SupportingEvidence with body text', async ({ page }) => {
    test.setTimeout(120_000);
    seed = await seedFixture('wizard_review_minimal', {
      user: { email: 'evidence-text@x.test', preferences: { tours: { welcome: true, 'self-study': true } } },
      reviewState: {
        buckets: {},
        tags: [],
        // Both UN-ASSIGNED (no resolvedStd/resolvedSpec) — the case that used to drop.
        cvs: [
          {
            sectionId: CV, facultyName: 'Dr. Jane Faculty',
            snippet: '(data table)',
            htmlSnippet: `<table><tr><td>${CV_MARKER} PhD Counseling, 12 yrs faculty experience.</td></tr></table>`,
            wordCount: 6, confidence: 0.9, acceptState: 'pending', rationale: '',
          },
        ],
        evidenceDocs: [
          {
            sectionId: SYL, title: 'Intro to Human Services — Syllabus', docSubKind: 'syllabus',
            snippet: '(data table)', summary: '',
            htmlSnippet: `<table><tr><td>${SYL_MARKER} Course objectives and weekly schedule.</td></tr></table>`,
            wordCount: 6, confidence: 0.9, acceptState: 'pending', rationale: '',
          },
        ],
        introductions: {}, placeholderSections: [],
        approvedIds: [], discardedIds: [], itemSources: {}, mergeLog: [],
      },
    });
    await loginAsSeededViaSso(page, seed);

    // DIAGNOSTIC — confirm the seed actually persisted cvs/evidenceDocs into aiReviewState.
    const reviewState = await page.evaluate(async (id: string) => {
      const raw = localStorage.getItem('auth-storage');
      const token = raw ? JSON.parse(raw)?.state?.token : null;
      const r = await fetch(`/api/submissions/${id}/review`, { headers: { Authorization: `Bearer ${token}` } });
      const st = (await r.json())?.aiReviewState || {};
      return { cvs: (st.cvs || []).length, docs: (st.evidenceDocs || []).length, approved: st.approvedIds || [] };
    }, seed.submissionId);
    // eslint-disable-next-line no-console
    console.log('[59-diag] seeded aiReviewState:', JSON.stringify(reviewState));

    // Approve both un-assigned evidence items via the API (materialize runs here).
    const status = await setApproved(page, seed.submissionId, [CV, SYL]);
    expect(status).toBe(200);
    const rawEv = await evidence(page, seed.submissionId);
    // eslint-disable-next-line no-console
    console.log('[59-diag] evidence after approve:', JSON.stringify(rawEv));

    // Both must now exist as SupportingEvidence — NOT dropped — and carry the
    // real body text in metadata.description (what the AI evaluator reads).
    await expect
      .poll(async () => JSON.stringify(await evidence(page, seed!.submissionId)), { timeout: 20_000, intervals: [1000] })
      .toContain(CV_MARKER);

    const ev = await evidence(page, seed.submissionId);
    const cvRec = ev.find((e: any) => e.tags.includes(`rev:${CV}`));
    const sylRec = ev.find((e: any) => e.tags.includes(`rev:${SYL}`));

    expect(cvRec, 'unassigned CV materialized').toBeTruthy();
    expect(sylRec, 'unassigned syllabus materialized').toBeTruthy();
    // The AI-readable text field carries the real (table) body, not "(data table)".
    expect(cvRec.metaDesc).toContain(CV_MARKER);
    expect(sylRec.metaDesc).toContain(SYL_MARKER);
    expect(cvRec.metaDesc).not.toBe('(data table)');
  });
});
