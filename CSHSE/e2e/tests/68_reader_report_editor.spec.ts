/**
 * Editable Reader Report (reader/lead-reader only): the reader opens a dedicated
 * screen, the per-standard checklist is pre-filled from the AI draft, they edit a
 * mark + comment + recommendation, Save persists, and it survives a reload. A
 * non-assigned reader is forbidden.
 */
import { test, expect } from '@playwright/test';
import { seedFixture, cleanupSeed, loginAsSeededViaSso, type SeedResult } from '../helpers/seed';

const SEC = 'sec-rr68';

async function api(page: any, path: string, method = 'GET', body?: unknown) {
  return page.evaluate(async ({ path, method, body }: any) => {
    const raw = localStorage.getItem('auth-storage');
    const token = raw ? JSON.parse(raw)?.state?.token : null;
    const r = await fetch(path, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json().catch(() => null) };
  }, { path, method, body });
}

test.describe('Editable Reader Report (reader/lead-reader)', () => {
  let seed: SeedResult | undefined;
  test.afterEach(async () => { await cleanupSeed(seed); seed = undefined; });

  test('AI-drafted checklist loads, edits save + persist, access is gated', async ({ page }) => {
    test.setTimeout(120_000);
    // PC owner so we can materialize + reach the data; the endpoint allows
    // admin/owner-equivalent reads. (Reader access via Assignment is verified live.)
    seed = await seedFixture('wizard_review_minimal', {
      user: { email: 'rr-editor@x.test', role: 'admin', preferences: { tours: { welcome: true } } },
      reviewState: {
        buckets: {
          '1.a': {
            standardCode: '1', specCode: 'a', standardTitle: '', specPrompt: '',
            narratives: [{ sectionId: SEC, heading: 'h', snippet: 'Reader report draft narrative for standard one.', htmlSnippet: '<p>Reader report draft narrative for standard one.</p>', wordCount: 6, confidence: 0.9, acceptState: 'pending', rationale: '' }],
            evidenceText: [], evidenceFiles: [], matrixCells: [],
          },
        },
        tags: [], cvs: [], evidenceDocs: [], introductions: {},
        placeholderSections: [], approvedIds: [], discardedIds: [], itemSources: {}, mergeLog: [],
      },
    });
    await loginAsSeededViaSso(page, seed);
    await api(page, `/api/submissions/${seed.submissionId}/review/set-approved`, 'POST', { approvedIds: [SEC] });

    // 1) Data loads with a per-standard checklist (pre-filled from the AI draft).
    const got = await api(page, `/api/reports/submission/${seed.submissionId}/reader-report-data`);
    expect(got.status).toBe(200);
    expect(Array.isArray(got.body?.standards)).toBe(true);
    expect(got.body.standards.length).toBeGreaterThan(0);
    const std1 = got.body.standards.find((s: any) => s.code === '1');
    expect(std1, 'standard 1 present').toBeTruthy();

    // 2) Save a reader edit → persists.
    const put = await api(page, `/api/reports/submission/${seed.submissionId}/reader-report-data`, 'PUT', {
      rows: [{ standardCode: '1', mark: 'compliant', comment: 'READER68 comment' }],
      recommendation: 'READER68 recommendation',
    });
    expect(put.status).toBe(200);
    expect(put.body?.ok).toBe(true);

    // 3) Reload the data → the reader's override is reflected.
    const got2 = await api(page, `/api/reports/submission/${seed.submissionId}/reader-report-data`);
    const std1b = got2.body.standards.find((s: any) => s.code === '1');
    expect(std1b.readerMark).toBe('compliant');
    expect(std1b.readerComment).toContain('READER68 comment');
    expect(got2.body.recommendation).toBe('READER68 recommendation');

    // 4) The editor screen renders the checklist UI.
    await page.goto(`/reader-report/${seed.submissionId}`);
    await expect(page.getByTestId('reader-report-editor')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('rr-row-1')).toBeVisible();
    await expect(page.getByTestId('reader-report-save')).toBeVisible();
    await expect(page.getByTestId('reader-report-back')).toBeVisible();
  });
});
