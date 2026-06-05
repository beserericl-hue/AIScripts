/**
 * Approve auto-applies to the editor — E2E.
 *
 * Per the simplification: "Apply to editor" is gone; Approve / Approve all move
 * the text straight into the Standards editor. Proves on the real app:
 *   1. There is NO "Apply to editor" button.
 *   2. Clicking Approve writes the narrative into Submission.narrativeContent
 *      (the field the editor reads) — no separate Apply step.
 *   3. It survives a reload.
 */
import { test, expect } from '@playwright/test';
import {
  seedFixture,
  cleanupSeed,
  loginAsSeededViaSso,
  gotoReviewStep,
  type SeedResult,
} from '../helpers/seed';

const SEC = 'sec-autoapply-1';

async function narrativeContent(page: any, submissionId: string) {
  return page.evaluate(async (submissionId: string) => {
    const raw = localStorage.getItem('auth-storage');
    const token = raw ? JSON.parse(raw)?.state?.token : null;
    const r = await fetch(`/api/submissions/${submissionId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const sub = await r.json();
    return JSON.stringify(sub?.narrativeContent ?? []);
  }, submissionId);
}

test.describe('Approve auto-applies text to the editor', () => {
  let seed: SeedResult | undefined;

  test.afterEach(async () => {
    await cleanupSeed(seed);
    seed = undefined;
  });

  test('no Apply button; clicking Approve materializes the narrative', async ({ page }) => {
    test.setTimeout(120_000);

    seed = await seedFixture('wizard_review_minimal', {
      user: {
        email: 'approve-autoapply@x.test',
        preferences: { tours: { welcome: true, 'self-study': true } },
      },
      reviewState: {
        buckets: {
          '1.a': {
            standardCode: '1', specCode: 'a', standardTitle: '', specPrompt: '',
            narratives: [
              {
                sectionId: SEC,
                heading: 'Auto-apply card',
                snippet: 'AUTOAPPLY_MARKER narrative body.',
                htmlSnippet: '<p>AUTOAPPLY_MARKER narrative body.</p>',
                wordCount: 3, confidence: 0.95, acceptState: 'pending', rationale: '',
              },
            ],
            evidenceText: [],
            evidenceFiles: [
              {
                sectionId: 'file-autoapply-1',
                heading: 'AutoApply Evidence File',
                snippet: 'Evidence file body for the File Library.',
                wordCount: 6, confidence: 0.9, acceptState: 'pending', rationale: '',
              },
            ],
            matrixCells: [],
          },
        },
        tags: [], cvs: [], evidenceDocs: [], introductions: {},
        placeholderSections: [], approvedIds: [], discardedIds: [],
        itemSources: {}, mergeLog: [],
      },
    });

    await loginAsSeededViaSso(page, seed);
    await gotoReviewStep(page, seed);

    // The redundant "Apply to editor" button is gone; a hint stands in its place.
    await expect(page.getByRole('button', { name: /Apply to editor/i })).toHaveCount(0);
    await expect(page.getByTestId('approve-auto-apply-hint')).toBeVisible();

    // Approve everything on the spec — text AND the evidence file.
    await page.getByTestId('approve-all').click();
    await expect(page.getByTestId(`approve-toggle-${SEC}`)).toHaveAttribute('data-approved', 'true');

    // (a) narrativeContent (the editor's field) now contains the approved text.
    await expect
      .poll(() => narrativeContent(page, seed!.submissionId), { timeout: 30_000, intervals: [1000] })
      .toContain('AUTOAPPLY_MARKER');

    // (b) the File Library is reachable by the owner (was 403) and the approved
    //     evidence file materialized into it.
    await expect
      .poll(
        async () => {
          const res = await page.evaluate(async (submissionId: string) => {
            const raw = localStorage.getItem('auth-storage');
            const token = raw ? JSON.parse(raw)?.state?.token : null;
            const r = await fetch(`/api/submissions/${submissionId}/evidence`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            return { status: r.status, body: await r.json() };
          }, seed!.submissionId);
          return JSON.stringify(res);
        },
        { timeout: 30_000, intervals: [1000] }
      )
      .toMatch(/AutoApply Evidence File/);

    // Survives reload.
    await page.reload();
    await page.waitForLoadState('networkidle');
    expect(await narrativeContent(page, seed.submissionId)).toContain('AUTOAPPLY_MARKER');
  });
});
