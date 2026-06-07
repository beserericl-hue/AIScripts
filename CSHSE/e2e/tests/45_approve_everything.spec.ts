/**
 * "Approve all" approves + moves EVERYTHING — E2E.
 *
 * Per request: one click approves every item across the whole review (all
 * standards, plus CVs / files) and moves them to the editor + File Library.
 * Proves on the real app:
 *   - narratives from MULTIPLE specs (1.a AND 2.a) land in the editor.
 *   - an approved evidence file materializes into the File Library.
 */
import { test, expect } from '@playwright/test';
import {
  seedFixture,
  cleanupSeed,
  loginAsSeededViaSso,
  gotoReviewStep,
  type SeedResult,
} from '../helpers/seed';

function narr(sectionId: string, marker: string) {
  return {
    sectionId, heading: sectionId, snippet: `${marker} body.`,
    htmlSnippet: `<p>${marker} body.</p>`, wordCount: 2,
    confidence: 0.95, acceptState: 'pending', rationale: '',
  };
}

async function apiGet(page: any, submissionId: string, path: string) {
  return page.evaluate(
    async ({ submissionId, path }: { submissionId: string; path: string }) => {
      const raw = localStorage.getItem('auth-storage');
      const token = raw ? JSON.parse(raw)?.state?.token : null;
      const r = await fetch(`/api/submissions/${submissionId}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return { status: r.status, body: await r.json() };
    },
    { submissionId, path }
  );
}

test.describe('Approve all approves and moves everything', () => {
  let seed: SeedResult | undefined;

  test.afterEach(async () => {
    await cleanupSeed(seed);
    seed = undefined;
  });

  test('one click → narratives from all specs + evidence file materialize', async ({ page }) => {
    test.setTimeout(120_000);

    seed = await seedFixture('wizard_review_minimal', {
      user: {
        email: 'approve-everything@x.test',
        preferences: { tours: { welcome: true, 'self-study': true } },
      },
      reviewState: {
        buckets: {
          '1.a': {
            standardCode: '1', specCode: 'a', standardTitle: '', specPrompt: '',
            narratives: [narr('n-1a', 'EVERYTHING_ONE_A')],
            evidenceText: [],
            evidenceFiles: [
              { sectionId: 'file-ev-1', heading: 'Everything Evidence File', snippet: 'file body', wordCount: 2, confidence: 0.9, acceptState: 'pending', rationale: '' },
            ],
            matrixCells: [],
          },
          '2.a': {
            standardCode: '2', specCode: 'a', standardTitle: '', specPrompt: '',
            narratives: [narr('n-2a', 'EVERYTHING_TWO_A')],
            evidenceText: [], evidenceFiles: [], matrixCells: [],
          },
        },
        tags: [], cvs: [], evidenceDocs: [], introductions: {},
        placeholderSections: [], approvedIds: [], discardedIds: [],
        itemSources: {}, mergeLog: [],
      },
    });

    await loginAsSeededViaSso(page, seed);
    await gotoReviewStep(page, seed); // lands on 1.a

    // ONE click: Approve all → everything.
    await page.getByTestId('approve-all').click();

    // Both specs' narratives materialize into the editor (narrativeContent).
    await expect
      .poll(async () => JSON.stringify((await apiGet(page, seed!.submissionId, '')).body?.narrativeContent ?? []),
        { timeout: 30_000, intervals: [1000] })
      .toContain('EVERYTHING_ONE_A');
    const sub = await apiGet(page, seed.submissionId, '');
    const nc = JSON.stringify(sub.body.narrativeContent ?? []);
    expect(nc).toContain('EVERYTHING_ONE_A');
    expect(nc, 'second spec also materialized').toContain('EVERYTHING_TWO_A');

    // The approved evidence file materialized into the File Library.
    await expect
      .poll(async () => JSON.stringify((await apiGet(page, seed!.submissionId, '/evidence')).body),
        { timeout: 30_000, intervals: [1000] })
      .toMatch(/Everything Evidence File/);
  });
});
