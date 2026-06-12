/**
 * The Reader Report must NOT destroy table formatting. Each spec shows the
 * narrative/evidence formatted (real <table>) by default, with a "tag" above it
 * that toggles to the comment view (inline-highlighted text) and back.
 */
import { test, expect } from '@playwright/test';
import { seedFixture, cleanupSeed, loginAsSeededViaSso, type SeedResult } from '../helpers/seed';

const SEC = 'sec-rr70';
const TABLE_HTML =
  '<p>Program narrative before the table.</p>' +
  '<table><thead><tr><th>Course</th><th>Standard</th></tr></thead>' +
  '<tbody><tr><td>HS 101</td><td>1.a</td></tr><tr><td>HS 202</td><td>1.b</td></tr></tbody></table>';

async function api(page: any, path: string, method = 'GET', body?: unknown) {
  return page.evaluate(async ({ path, method, body }: any) => {
    const raw = localStorage.getItem('auth-storage');
    const token = raw ? JSON.parse(raw)?.state?.token : null;
    const r = await fetch(path, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json().catch(() => null) };
  }, { path, method, body });
}

test.describe('Reader Report — formatted tables preserved + comment tag', () => {
  let seed: SeedResult | undefined;
  test.afterEach(async () => { await cleanupSeed(seed); seed = undefined; });

  test('table renders formatted by default; the tag toggles to the comment view', async ({ page }) => {
    test.setTimeout(150_000);
    seed = await seedFixture('wizard_review_minimal', {
      user: { email: 'rr70@x.test', role: 'admin', preferences: { tours: { welcome: true } } },
      reviewState: {
        buckets: {
          '1.a': {
            standardCode: '1', specCode: 'a', standardTitle: '', specPrompt: '',
            narratives: [{ sectionId: SEC, heading: 'h', snippet: 'Narrative with a table.', htmlSnippet: TABLE_HTML, wordCount: 5, confidence: 0.9, acceptState: 'pending', rationale: '' }],
            evidenceText: [], evidenceFiles: [], matrixCells: [],
          },
        },
        tags: [], cvs: [], evidenceDocs: [], introductions: {},
        placeholderSections: [], approvedIds: [], discardedIds: [], itemSources: {}, mergeLog: [],
      },
    });
    await loginAsSeededViaSso(page, seed);
    await api(page, `/api/submissions/${seed.submissionId}/review/set-approved`, 'POST', { approvedIds: [SEC] });

    await page.goto(`/reader-report/${seed.submissionId}`);
    await expect(page.getByTestId('reader-report-editor')).toBeVisible({ timeout: 20_000 });

    const spec = page.locator('#rr-spec-1-a');
    await expect(spec).toBeVisible();

    // 1) Default = formatted view → a REAL <table> with the header cells.
    await expect(spec.locator('table')).toBeVisible();
    await expect(spec.getByText('Course', { exact: true })).toBeVisible();
    await expect(spec.getByText('HS 101', { exact: true })).toBeVisible();

    // 2) The tag above the content links to the comment data.
    const tag = page.getByTestId('rr-comment-tag-1-a');
    await expect(tag).toBeVisible();

    // 3) Toggle → comment view (commentable text); the raw <table> is replaced.
    await tag.click();
    await expect(page.getByTestId('rr-comments-1-a')).toBeVisible();
    await expect(spec.locator('table')).toHaveCount(0);

    // 4) Toggle back → the formatted table is intact again.
    await tag.click();
    await expect(spec.locator('table')).toBeVisible();
  });
});
