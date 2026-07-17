/**
 * Level-aware evaluation rubric. The official CSHSE National Standards differ by
 * degree level, so the AI evaluation criteria MUST come from the institution's
 * declared programLevel (associate / baccalaureate / masters) — sourced from the
 * Standard + its reader-report specification detail.
 *
 * Regression under test: an ASSOCIATE program's Standard 4 is "Program
 * Evaluation" (student learning outcomes, formal evaluation), NOT the legacy
 * flat catalog's "Budgetary Support". Before the fix, correct Program-Evaluation
 * narratives were judged against a budget rubric and failed with "does not
 * describe the budget". This test proves the correct rubric is now used.
 */
import { test, expect } from '@playwright/test';
import { seedFixture, cleanupSeed, loginAsSeededViaSso, type SeedResult } from '../helpers/seed';

async function api(page: any, path: string, method = 'GET', body?: unknown) {
  return page.evaluate(async ({ path, method, body }: any) => {
    const raw = localStorage.getItem('auth-storage');
    const token = raw ? JSON.parse(raw)?.state?.token : null;
    const r = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  }, { path, method, body });
}

// Associate Standard 4.a narrative — measurable student learning outcomes +
// assessment plan (Program Evaluation). Deliberately says NOTHING about budget.
const S4A = {
  sectionId: 'sec70-4a',
  heading: 'Program Evaluation',
  snippet:
    'The Human Services Program has clearly stated, measurable student learning outcomes tied to the CSHSE standards, and an implemented assessment plan with rubrics, portfolios, and capstone evaluations. Assessment data has been used to revise curriculum.',
  htmlSnippet:
    '<p>The Human Services Program has clearly stated, measurable student learning outcomes tied to the CSHSE standards, and an implemented assessment plan (rubrics, portfolios, capstone evaluations). Assessment results were used to revise the curriculum.</p>',
  wordCount: 40,
  confidence: 0.92,
  acceptState: 'pending',
  rationale: '',
};

test.describe('Level-aware evaluation rubric (associate)', () => {
  let seed: SeedResult | undefined;
  test.afterEach(async () => { await cleanupSeed(seed); seed = undefined; });

  test('associate Standard 4 is judged against Program Evaluation, not Budgetary Support', async ({ page }) => {
    test.setTimeout(180_000);

    seed = await seedFixture('wizard_review_minimal', {
      user: { email: 'level-rubric@x.test', preferences: { tours: { welcome: true, 'self-study': true } } },
      submission: { programLevel: 'associate' },
      reviewState: {
        buckets: {
          '4.a': {
            standardCode: '4', specCode: 'a', standardTitle: '', specPrompt: '',
            narratives: [S4A], evidenceText: [], evidenceFiles: [], matrixCells: [],
          },
        },
        tags: [], cvs: [], evidenceDocs: [], introductions: {}, placeholderSections: [],
        approvedIds: [], discardedIds: [], itemSources: {}, mergeLog: [],
      },
    });
    await loginAsSeededViaSso(page, seed);

    // --- The level-aware catalog is served correctly per degree level ---
    const assoc = (await api(page, `/api/standards?level=associate`)).body;
    const std4 = assoc.find((s: any) => s.code === '4');
    expect(std4?.title, 'associate Standard 4 title').toBe('Program Evaluation');
    const bach = (await api(page, `/api/standards?level=baccalaureate`)).body;
    expect(bach.find((s: any) => s.code === '9')?.title, 'bachelors Standard 9').toBe('Program Support');
    const mast = (await api(page, `/api/standards?level=masters`)).body;
    expect(mast.find((s: any) => s.code === '13'), 'masters Standard 13 present').toBeTruthy();
    expect(mast.find((s: any) => s.code === '20'), 'masters has no Standard 20').toBeFalsy();

    // The route resolves the level from the submission too.
    const bySub = (await api(page, `/api/standards?submissionId=${seed.submissionId}`)).body;
    expect(bySub.find((s: any) => s.code === '4')?.title).toBe('Program Evaluation');

    // --- Approve 4.a → materialize narrative + enqueue AI eval ---
    const setRes = await api(page, `/api/submissions/${seed.submissionId}/review/set-approved`, 'POST', {
      approvedIds: [S4A.sectionId],
    });
    expect(setRes.status).toBe(200);

    // --- Drain the eval queue ---
    await expect.poll(async () => {
      const p = (await api(page, `/api/submissions/${seed!.submissionId}/review/eval-progress`)).body;
      return p?.running === false && (p?.done ?? 0) >= 1 ? 'done' : `running ${p?.done}/${p?.total}`;
    }, { timeout: 150_000, intervals: [3000] }).toBe('done');

    // --- The verdict was produced against the Program-Evaluation rubric ---
    const ev = (await api(page, `/api/submissions/${seed.submissionId}/standards/4/specs/a/evaluation`)).body?.evaluation;
    expect(ev, 'spec 4.a has a verdict').toBeTruthy();
    const rationale = String(ev.rationale || ev.feedback || '').toLowerCase();
    // The Program-Evaluation rubric never mentions a budget. If the OLD Budgetary
    // Support rubric had been used, the AI would fault the narrative for not
    // describing the budget. Its absence proves the correct level rubric was used.
    expect(rationale, `rubric must not be Budgetary Support (rationale: ${rationale.slice(0, 160)})`).not.toContain('budget');
    // And a program-evaluation narrative that matches its rubric should not be a hard fail.
    expect(['pass', 'needs_improvement']).toContain(ev.verdict);
    console.log(`associate 4.a verdict=${ev.verdict} — rubric=Program Evaluation ✓`);
  });
});
