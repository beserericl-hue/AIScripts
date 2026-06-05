/**
 * Review-rail autosave — E2E.
 *
 * The audit found a class of Review mutations (change-kind, reassign, edit,
 * move-to-introduction, etc.) that only lived in the browser store until
 * "Apply to editor". The autosave (POST /review/save-state, debounced on the
 * ReviewSurface) now writes them to the DB on every change. This proves it on
 * the real app: change a card's kind → it autosaves → reload → still changed.
 */
import { test, expect } from '@playwright/test';
import {
  seedFixture,
  cleanupSeed,
  loginAsSeededViaSso,
  gotoReviewStep,
  type SeedResult,
} from '../helpers/seed';

const SEC = 'sec-autosave-1';

test.describe('Review rail autosave persists mutations', () => {
  let seed: SeedResult | undefined;

  test.afterEach(async () => {
    await cleanupSeed(seed);
    seed = undefined;
  });

  test('change-kind (narrative → evidence) autosaves and survives reload', async ({ page }) => {
    test.setTimeout(120_000);

    seed = await seedFixture('wizard_review_minimal', {
      user: {
        email: 'review-autosave@x.test',
        preferences: { tours: { welcome: true, 'self-study': true } },
      },
      reviewState: {
        buckets: {
          '1.a': {
            standardCode: '1', specCode: 'a', standardTitle: '', specPrompt: '',
            narratives: [
              {
                sectionId: SEC,
                heading: 'Kind switch card',
                snippet: 'Autosave kind-switch body.',
                htmlSnippet: '<p>Autosave kind-switch body.</p>',
                wordCount: 3, confidence: 0.9, acceptState: 'pending', rationale: '',
              },
            ],
            evidenceText: [], evidenceFiles: [], matrixCells: [],
          },
        },
        tags: [], cvs: [], evidenceDocs: [], introductions: {},
        placeholderSections: [], approvedIds: [], discardedIds: [],
        itemSources: {}, mergeLog: [],
      },
    });

    await loginAsSeededViaSso(page, seed);
    await gotoReviewStep(page, seed);

    // Starts as Narrative.
    await expect(page.getByTestId(`kind-text-${SEC}`)).toHaveAttribute('data-active', 'true');

    // Flip it to Evidence.
    await page.getByTestId(`kind-evidenceText-${SEC}`).click();
    await expect(page.getByTestId(`kind-evidenceText-${SEC}`)).toHaveAttribute('data-active', 'true');

    // The autosave chip confirms the DB write.
    await expect(page.getByTestId('review-save-state')).toHaveAttribute('data-state', 'saved', {
      timeout: 10_000,
    });

    // ---- RELOAD ----
    await page.reload();
    await page.waitForLoadState('networkidle');
    await gotoReviewStep(page, seed);

    // Still Evidence after the reload — the change persisted to the database.
    await expect(page.getByTestId(`kind-evidenceText-${SEC}`)).toHaveAttribute('data-active', 'true', {
      timeout: 15_000,
    });
    await expect(page.getByTestId(`kind-text-${SEC}`)).toHaveAttribute('data-active', 'false');

    // DB is source of truth: the item now lives in evidenceText, not narratives.
    const state = await page.evaluate(async (submissionId) => {
      const raw = localStorage.getItem('auth-storage');
      const token = raw ? JSON.parse(raw)?.state?.token : null;
      const r = await fetch(`/api/submissions/${submissionId}/review`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await r.json();
      const b = body?.aiReviewState?.buckets?.['1.a'] ?? {};
      return {
        narr: (b.narratives ?? []).map((i: any) => i.sectionId),
        ev: (b.evidenceText ?? []).map((i: any) => i.sectionId),
      };
    }, seed.submissionId);
    expect(state.ev).toContain(SEC);
    expect(state.narr).not.toContain(SEC);
  });
});
