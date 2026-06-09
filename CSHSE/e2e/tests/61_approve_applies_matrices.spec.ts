/**
 * Unified approve → matrices. Historically matrices had a SEPARATE apply path,
 * so approving review items did not push curriculum matrices into the editor.
 * Now set-approved also materializes detected matrices (aiMatrixState.matrices)
 * into CurriculumMatrix.rawContent — the source the Matrix editor renders.
 *
 * Seeds a matrix + a narrative, approves, and asserts the matrix HTML lands in
 * the CurriculumMatrix. Also asserts idempotency (re-approve doesn't duplicate).
 */
import { test, expect } from '@playwright/test';
import { seedFixture, cleanupSeed, loginAsSeededViaSso, type SeedResult } from '../helpers/seed';

const MATRIX_MARKER = 'MATRIXMARKER61';
const NARR = 'sec61-narr';

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

async function matrixHasMarker(page: any, submissionId: string) {
  const res = await api(page, `/api/submissions/${submissionId}/matrix`);
  const rc = res.body?.rawContent || [];
  return rc.filter((r: any) => String(r.content || '').includes(MATRIX_MARKER)).length;
}

test.describe('Approve also applies curriculum matrices', () => {
  let seed: SeedResult | undefined;
  test.afterEach(async () => { await cleanupSeed(seed); seed = undefined; });

  test('approving materializes detected matrices into the editor (idempotent)', async ({ page }) => {
    test.setTimeout(120_000);
    seed = await seedFixture('wizard_review_minimal', {
      user: { email: 'approve-matrix@x.test', preferences: { tours: { welcome: true, 'self-study': true } } },
      reviewState: {
        buckets: {
          '1.a': {
            standardCode: '1', specCode: 'a', standardTitle: '', specPrompt: '',
            narratives: [{ sectionId: NARR, heading: 'n', snippet: 's', htmlSnippet: '<p>s</p>', wordCount: 1, confidence: 0.9, acceptState: 'pending', rationale: '' }],
            evidenceText: [], evidenceFiles: [], matrixCells: [],
          },
        },
        tags: [], cvs: [], evidenceDocs: [], introductions: {}, placeholderSections: [],
        approvedIds: [], discardedIds: [], itemSources: {}, mergeLog: [],
      },
      matrixState: {
        matrices: [
          { matrixId: 'mx-test', name: 'Test Curriculum Matrix', htmlSnippet: `<table><tr><td>${MATRIX_MARKER} course coverage grid</td></tr></table>`, cells: [], columnHeaders: [] },
        ],
        matrixRowEdits: {},
      },
    });
    await loginAsSeededViaSso(page, seed);

    // Before approving, the matrix is NOT yet in the CurriculumMatrix.
    expect(await matrixHasMarker(page, seed.submissionId)).toBe(0);

    // Approve → server also applies matrices.
    const res = await api(page, `/api/submissions/${seed.submissionId}/review/set-approved`, 'POST', { approvedIds: [NARR] });
    expect(res.status).toBe(200);
    expect(res.body.matricesApplied).toBe(1);

    // The matrix HTML is now in CurriculumMatrix.rawContent — exactly once.
    await expect.poll(async () => matrixHasMarker(page, seed!.submissionId), { timeout: 15_000, intervals: [1000] }).toBe(1);

    // Idempotent: re-approving does not duplicate the matrix.
    const res2 = await api(page, `/api/submissions/${seed.submissionId}/review/set-approved`, 'POST', { approvedIds: [NARR] });
    expect(res2.status).toBe(200);
    expect(res2.body.matricesApplied).toBe(0); // already applied → no new insert
    expect(await matrixHasMarker(page, seed.submissionId)).toBe(1);
  });
});
