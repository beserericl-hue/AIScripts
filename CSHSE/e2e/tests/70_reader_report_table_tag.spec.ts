/**
 * The Reader Report keeps table formatting AND lets the reader select text
 * INSIDE the table to comment — the marker/highlight is placed ON the selected
 * text inside the table (not on a tag outside it).
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

test.describe('Reader Report — formatted table is commentable in place', () => {
  let seed: SeedResult | undefined;
  test.afterEach(async () => { await cleanupSeed(seed); seed = undefined; });

  test('table renders formatted; selecting text in it adds a comment marked on that text', async ({ page }) => {
    test.setTimeout(150_000);
    seed = await seedFixture('wizard_review_minimal', {
      // Superuser admin: can open the report AND create comments (bypasses the
      // assignment gate that a plain seeded reader would lack).
      user: { email: 'rr70@x.test', role: 'admin', isSuperuser: true, preferences: { tours: { welcome: true, 'reader-report': true } } },
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
    // 1) The table renders FORMATTED (real <table>, header + cells intact).
    await expect(spec.locator('table')).toBeVisible();
    const cell = spec.locator('td', { hasText: 'HS 101' });
    await expect(cell).toBeVisible();

    // 2) Select the text INSIDE the table cell and raise the composer.
    await cell.selectText();
    await page.getByTestId('rr-formatted-1-a').dispatchEvent('mouseup');
    await expect(page.getByTestId('rr-fc-composer')).toBeVisible();
    await page.getByTestId('rr-fc-composer').fill('Comment on HS 101 inside the table');
    await page.getByTestId('rr-fc-add').click();

    // 3) The comment persists, anchored to the selected text.
    await expect.poll(async () => {
      const r = await api(page, `/api/submissions/${seed!.submissionId}/comments?standardCode=1&specCode=a`);
      return (r.body?.comments || []).some((c: any) => (c.selectedText || '').includes('HS 101'));
    }, { timeout: 15_000 }).toBe(true);

    // 4) A marker is placed ON the selected text, INSIDE the still-formatted table.
    await expect(spec.locator('table')).toBeVisible();
    await expect(spec.locator('table mark[data-rr-comment]')).toBeVisible();
    await expect(spec.locator('table mark[data-rr-comment]')).toHaveText(/HS 101/);
  });
});
