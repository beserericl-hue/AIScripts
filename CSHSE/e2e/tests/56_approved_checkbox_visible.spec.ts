/**
 * The per-card checkbox now REPRESENTS approval: checking it approves the item
 * (persisted to the DB), and approved items show a checked box across a reload —
 * so the coordinator can see at a glance what's approved.
 */
import { test, expect } from '@playwright/test';
import { seedFixture, cleanupSeed, loginAsSeededViaSso, gotoReviewStep, type SeedResult } from '../helpers/seed';

const SEC = 'sec-approvecheck-1';

test.describe('Approved items show a checked checkbox (persisted)', () => {
  let seed: SeedResult | undefined;
  test.afterEach(async () => {
    await cleanupSeed(seed);
    seed = undefined;
  });

  test('checking the box approves + persists; reload keeps it checked', async ({ page }) => {
    test.setTimeout(120_000);
    seed = await seedFixture('wizard_review_minimal', {
      user: { email: 'approve-check@x.test', preferences: { tours: { welcome: true, 'self-study': true } } },
      reviewState: {
        buckets: {
          '1.a': {
            standardCode: '1', specCode: 'a', standardTitle: '', specPrompt: '',
            narratives: [{ sectionId: SEC, heading: 'Approve-check card', snippet: 's', htmlSnippet: '<p>s</p>', wordCount: 1, confidence: 0.9, acceptState: 'pending', rationale: '' }],
            evidenceText: [], evidenceFiles: [], matrixCells: [],
          },
        },
        tags: [], cvs: [], evidenceDocs: [], introductions: {}, placeholderSections: [], approvedIds: [], discardedIds: [], itemSources: {}, mergeLog: [],
      },
    });
    await loginAsSeededViaSso(page, seed);
    await gotoReviewStep(page, seed);

    const box = page.getByTestId(`approve-check-${SEC}`);
    await expect(box).not.toBeChecked();

    // Check it → approves the item.
    await box.check();
    await expect(box).toBeChecked();
    await expect(page.getByTestId(`approve-toggle-${SEC}`)).toHaveAttribute('data-approved', 'true');

    // Persisted to the DB.
    await expect
      .poll(async () => {
        const r = await page.evaluate(async (id) => {
          const raw = localStorage.getItem('auth-storage');
          const token = raw ? JSON.parse(raw)?.state?.token : null;
          const res = await fetch(`/api/submissions/${id}/review`, { headers: { Authorization: `Bearer ${token}` } });
          return (await res.json())?.aiReviewState?.approvedIds ?? [];
        }, seed!.submissionId);
        return JSON.stringify(r);
      }, { timeout: 20_000, intervals: [1000] })
      .toContain(SEC);

    // Reload — the checkbox is STILL checked (approval came from the server).
    await page.reload();
    await page.waitForLoadState('networkidle');
    await gotoReviewStep(page, seed);
    await expect(page.getByTestId(`approve-check-${SEC}`)).toBeChecked({ timeout: 15_000 });
  });
});
