/**
 * Review "Approve" / "Approve all" persistence — E2E.
 *
 * Reported bug: a coordinator spent an hour marking documents Approved
 * ("Reviewed"); on reset, every mark vanished. Root cause: the Review surface's
 * approve handlers wrote only to the browser store, never the DB. This proves
 * the fix on the real app:
 *
 *   1. Approve all items in spec 1.a and 2.a.
 *   2. They show "Reviewed".
 *   3. Reload the page (the "reset").
 *   4. They are STILL "Reviewed" — persisted in the database.
 */
import { test, expect, type Page } from '@playwright/test';
import {
  seedFixture,
  cleanupSeed,
  loginAsSeededViaSso,
  gotoReviewStep,
  type SeedResult,
} from '../helpers/seed';

function narrative(sectionId: string, n: number) {
  return {
    sectionId,
    heading: `Doc ${n}`,
    snippet: `Body for ${sectionId}.`,
    htmlSnippet: `<p>Body for ${sectionId}.</p>`,
    wordCount: 3,
    confidence: 0.9,
    acceptState: 'pending',
    rationale: '',
  };
}
function bucket(std: string, spec: string, narratives: any[]) {
  return {
    standardCode: std,
    specCode: spec,
    standardTitle: '',
    specPrompt: '',
    narratives,
    evidenceText: [],
    evidenceFiles: [],
    matrixCells: [],
  };
}

async function openReviewSpec(page: Page, specLabel: RegExp) {
  if (!(await page.getByRole('heading', { name: /^Review$/i }).isVisible().catch(() => false))) {
    await page.getByRole('button', { name: /^Review\b/i }).first().click();
    await page.getByRole('heading', { name: /^Review$/i }).waitFor({ timeout: 15_000 });
  }
  await page.getByRole('tab', { name: specLabel }).first().click({ force: true });
}

test.describe('Review approvals persist in the database', () => {
  let seed: SeedResult | undefined;

  test.afterEach(async () => {
    await cleanupSeed(seed);
    seed = undefined;
  });

  test('Approve all in 1.a and 2.a → survives a reload', async ({ page }) => {
    test.setTimeout(120_000);

    seed = await seedFixture('wizard_review_minimal', {
      user: {
        email: 'approvals-persist@x.test',
        preferences: { tours: { welcome: true, 'self-study': true } },
      },
      reviewState: {
        buckets: {
          '1.a': bucket('1', 'a', [narrative('sec-1a-1', 1), narrative('sec-1a-2', 2)]),
          '2.a': bucket('2', 'a', [narrative('sec-2a-1', 3)]),
        },
        tags: [],
        cvs: [],
        evidenceDocs: [],
        introductions: {},
        placeholderSections: [],
        approvedIds: [],
        discardedIds: [],
        itemSources: {},
        mergeLog: [],
      },
    });

    await loginAsSeededViaSso(page, seed);
    await gotoReviewStep(page, seed); // lands on 1.a (first spec)

    // Approve all on 1.a → both cards become "Reviewed".
    await page.getByTestId('approve-all').click();
    await expect(
      page.locator('[data-testid^="approve-toggle-"][data-approved="true"]')
    ).toHaveCount(2, { timeout: 10_000 });

    // Approve all on 2.a.
    await openReviewSpec(page, /^2\.a/);
    await page.getByTestId('approve-all').click();
    await expect(
      page.locator('[data-testid^="approve-toggle-"][data-approved="true"]')
    ).toHaveCount(1, { timeout: 10_000 });

    // ---- THE RESET ----
    await page.reload();
    await page.waitForLoadState('networkidle');

    // 1.a still fully Reviewed after the reload.
    await openReviewSpec(page, /^1\.a/);
    await expect(page.getByTestId('approve-toggle-sec-1a-1')).toHaveAttribute('data-approved', 'true', { timeout: 15_000 });
    await expect(page.getByTestId('approve-toggle-sec-1a-2')).toHaveAttribute('data-approved', 'true');
    await expect(page.getByTestId('approve-toggle-sec-1a-1')).toHaveText(/Reviewed/);

    // 2.a still Reviewed too.
    await openReviewSpec(page, /^2\.a/);
    await expect(page.getByTestId('approve-toggle-sec-2a-1')).toHaveAttribute('data-approved', 'true', { timeout: 10_000 });

    // And the server is the source of truth — GET /review echoes all three ids.
    const approved = await page.evaluate(async (submissionId) => {
      const raw = localStorage.getItem('auth-storage');
      const token = raw ? JSON.parse(raw)?.state?.token : null;
      const r = await fetch(`/api/submissions/${submissionId}/review`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await r.json();
      return body?.aiReviewState?.approvedIds ?? [];
    }, seed.submissionId);
    expect([...approved].sort()).toEqual(['sec-1a-1', 'sec-1a-2', 'sec-2a-1']);
  });
});
