/**
 * The reader review screen (/reader/:id) must show the self-study — clicking a
 * submission in the reader queue previously opened a BLANK page because the
 * screen sourced standards from /api/specs (no standards array → []) and read
 * narratives from the non-serializing `narratives` Map. This drives it as an
 * authenticated reader and asserts the standards scaffold + the materialized
 * narrative actually render.
 */
import { test, expect } from '@playwright/test';
import { seedFixture, cleanupSeed, loginAsSeededViaSso, type SeedResult } from '../helpers/seed';

const SEC = 'sec-reader66';
const MARKER = 'READERSCREENMARKER66';

async function api(page: any, path: string, method = 'GET', body?: unknown) {
  return page.evaluate(async ({ path, method, body }: any) => {
    const raw = localStorage.getItem('auth-storage');
    const token = raw ? JSON.parse(raw)?.state?.token : null;
    const r = await fetch(path, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json().catch(() => null) };
  }, { path, method, body });
}

test.describe('Reader review screen renders the self-study (not blank)', () => {
  let seed: SeedResult | undefined;
  test.afterEach(async () => { await cleanupSeed(seed); seed = undefined; });

  test('standards scaffold + materialized narrative render for a reader', async ({ page }) => {
    test.setTimeout(120_000);
    // Owner (PC) so getSubmission + set-approved both work without the reader
    // assignment/submitted gate (that access rule is enforced separately and is
    // NOT what broke — the render was). The reader screen renders role-agnostically.
    seed = await seedFixture('wizard_review_minimal', {
      user: { email: 'reader-screen@x.test', preferences: { tours: { welcome: true } } },
      reviewState: {
        buckets: {
          '1.a': {
            standardCode: '1', specCode: 'a', standardTitle: '', specPrompt: '',
            narratives: [
              { sectionId: SEC, heading: 'h', snippet: `${MARKER} narrative body.`, htmlSnippet: `<p>${MARKER} narrative body.</p>`, wordCount: 3, confidence: 0.9, acceptState: 'pending', rationale: '' },
            ],
            evidenceText: [], evidenceFiles: [], matrixCells: [],
          },
        },
        tags: [], cvs: [], evidenceDocs: [], introductions: {},
        placeholderSections: [], approvedIds: [], discardedIds: [], itemSources: {}, mergeLog: [],
      },
    });
    await loginAsSeededViaSso(page, seed);

    // Materialize the narrative into submission.narratives/narrativeContent.
    const set = await api(page, `/api/submissions/${seed.submissionId}/review/set-approved`, 'POST', { approvedIds: [SEC] });
    expect(set.status, JSON.stringify(set.body)).toBe(200);

    // Open the reader review screen.
    await page.goto(`/reader/${seed.submissionId}`);
    await page.waitForLoadState('networkidle');

    // It renders (not blank, not the empty state).
    await expect(page.getByTestId('reader-review-screen')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('reader-review-empty')).toHaveCount(0);
    // The standards scaffold is present (was [] before the fix).
    await expect(page.getByText('Standard 1', { exact: false }).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Standard 21|Standard 20/).first()).toBeVisible();
    // The materialized narrative actually shows (read from narrativeContent).
    await expect(page.getByText(MARKER, { exact: false }).first()).toBeVisible({ timeout: 15_000 });
    // Messages affordance is present.
    await expect(page.getByTestId('reader-messages-link')).toBeVisible();
  });
});
