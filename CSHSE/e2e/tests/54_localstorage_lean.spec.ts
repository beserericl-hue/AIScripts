/**
 * Directive verification — localStorage must NOT carry review content
 * (buckets/narratives/tags/cvs/evidenceDocs/introductions/matrices/approvedIds).
 * Only resumable identity may be persisted. The review content lives on the
 * server (Submission.aiReviewState) and is loaded from there.
 */
import { test, expect } from '@playwright/test';
import { seedFixture, cleanupSeed, loginAsSeededViaSso, gotoReviewStep, type SeedResult } from '../helpers/seed';

test.describe('localStorage stays lean (server is source of truth)', () => {
  let seed: SeedResult | undefined;
  test.afterEach(async () => {
    await cleanupSeed(seed);
    seed = undefined;
  });

  test('ai-import-storage holds only resumable identity — no review content', async ({ page }) => {
    test.setTimeout(90_000);
    seed = await seedFixture('wizard_review_minimal', {
      user: { email: 'ls-lean@x.test', preferences: { tours: { welcome: true, 'self-study': true } } },
      reviewState: {
        buckets: {
          '1.a': {
            standardCode: '1', specCode: 'a', standardTitle: '', specPrompt: '',
            narratives: [{ sectionId: 'lsn-1', heading: 'LEANCHECK_NARRATIVE', snippet: 'x', htmlSnippet: '<p>x</p>', wordCount: 1, confidence: 0.9, acceptState: 'pending', rationale: '' }],
            evidenceText: [], evidenceFiles: [], matrixCells: [],
          },
        },
        tags: [], cvs: [], evidenceDocs: [], introductions: {}, placeholderSections: [], approvedIds: [], discardedIds: [], itemSources: {}, mergeLog: [],
      },
    });
    await loginAsSeededViaSso(page, seed);
    // Open the editor + Review so the app hydrates from the server and
    // re-writes localStorage with the trimmed partialize.
    await gotoReviewStep(page, seed);
    // Make an edit so the store definitely persists at least once post-hydration.
    await page.getByTestId('kind-evidenceText-lsn-1').click().catch(() => {});
    await page.waitForTimeout(2500);

    const ls = await page.evaluate(() => window.localStorage.getItem('ai-import-storage'));
    expect(ls, 'ai-import-storage should exist').toBeTruthy();
    const raw = ls || '';
    // The review CONTENT must NOT be in localStorage.
    expect(raw, 'narrative content leaked to localStorage').not.toContain('LEANCHECK_NARRATIVE');
    const parsed = JSON.parse(raw);
    const state = parsed?.state ?? {};
    // Heavy review fields must be absent from the persisted shape.
    for (const f of ['buckets', 'tags', 'cvs', 'evidenceDocs', 'introductions', 'matrices', 'matrixRowEdits', 'approvedIds', 'discardedIds', 'coverageReport']) {
      expect(state[f], `${f} should NOT be persisted to localStorage`).toBeUndefined();
    }
    // Resumable identity SHOULD still be there.
    expect(state.submissionId, 'submissionId (resumable identity) should persist').toBeTruthy();
  });
});
