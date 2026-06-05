/**
 * "Apply to editor" pipeline — E2E.
 *
 * Reported bugs: (1) approving text didn't move it to the Self-Study editor;
 * (2) imported CVs/files didn't appear in the File Library.
 *
 * Findings (proven here against the real app + DB):
 *   - Approve only marks "Reviewed"; the green "Apply to editor" button is what
 *     MATERIALIZES content. After Apply, the narrative lands in
 *     Submission.narrativeContent — exactly the field the Standards editor reads
 *     (getCurrentContent). So bug (1) was the Approve≠Apply UX, now relabeled.
 *   - The File Library (GET /evidence) used to 403 the OWNER PC; after the
 *     verifyEvidenceAccess fix it returns the submission's evidence.
 */
import { test, expect } from '@playwright/test';
import {
  seedFixture,
  cleanupSeed,
  loginAsSeededViaSso,
  gotoReviewStep,
  type SeedResult,
} from '../helpers/seed';

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

test.describe('Apply to editor materializes content into the DB', () => {
  let seed: SeedResult | undefined;

  test.afterEach(async () => {
    await cleanupSeed(seed);
    seed = undefined;
  });

  test('approved narrative → editor (narrativeContent); evidence list reachable by owner', async ({ page }) => {
    test.setTimeout(120_000);

    seed = await seedFixture('wizard_review_minimal', {
      user: {
        email: 'apply-pipeline@x.test',
        preferences: { tours: { welcome: true, 'self-study': true } },
      },
      reviewState: {
        buckets: {
          '1.a': {
            standardCode: '1', specCode: 'a', standardTitle: '', specPrompt: '',
            narratives: [
              {
                sectionId: 'n1',
                heading: 'Reg Accred',
                snippet: 'APPLIED_NARRATIVE_MARKER text body.',
                htmlSnippet: '<p>APPLIED_NARRATIVE_MARKER text body.</p>',
                wordCount: 4, confidence: 0.95, acceptState: 'pending', rationale: '',
              },
            ],
            evidenceText: [], evidenceFiles: [], matrixCells: [],
          },
        },
        tags: [], cvs: [], evidenceDocs: [], introductions: {},
        placeholderSections: [], approvedIds: ['n1'], discardedIds: [],
        itemSources: {}, mergeLog: [],
      },
    });

    await loginAsSeededViaSso(page, seed);
    await gotoReviewStep(page, seed);

    await page.getByRole('button', { name: /Apply to editor/i }).click();
    await page.getByRole('button', { name: /Confirm — send to editor/i }).click();

    // 1) The narrative lands in narrativeContent — the field the editor reads.
    await expect
      .poll(
        async () => {
          const sub = await apiGet(page, seed!.submissionId, '');
          return JSON.stringify(sub.body?.narrativeContent ?? []);
        },
        { timeout: 30_000, intervals: [1000] }
      )
      .toContain('APPLIED_NARRATIVE_MARKER');

    // The applied content is filed under the right standard/spec.
    const sub = await apiGet(page, seed.submissionId, '');
    const nc = (sub.body.narrativeContent || []).find(
      (n: any) => n.standardCode === '1' && n.specCode === 'a'
    );
    expect(nc, 'narrativeContent has a 1.a entry').toBeTruthy();
    expect(nc.content).toContain('APPLIED_NARRATIVE_MARKER');

    // 2) The owner PC can now reach the File Library (was 403 before the fix).
    const ev = await apiGet(page, seed.submissionId, '/evidence');
    expect(ev.status, `evidence list status (was 403): ${JSON.stringify(ev.body).slice(0, 200)}`).toBe(200);
    expect(Array.isArray(ev.body.evidence)).toBe(true);
  });
});
