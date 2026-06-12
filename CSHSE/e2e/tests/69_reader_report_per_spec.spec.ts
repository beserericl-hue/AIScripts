/**
 * Per-SPECIFICATION reader-report checklist. The reader report renders, under
 * each specification, that spec's checklist (Compliant / Non-Compliant /
 * Reader's Comments). This test proves:
 *   1. reader-report-data returns per-SPEC reader fields (specs[].readerMark/Comment).
 *   2. Saving per-spec rows (standardCode + specCode) persists INDEPENDENTLY per spec.
 *   3. The official Word template still downloads (per-spec marks roll up).
 *   4. The screen renders the labelled per-spec checklist + the self-study nav,
 *      and an in-UI checkbox click AUTOSAVES and survives a reload.
 */
import { test, expect } from '@playwright/test';
import { seedFixture, cleanupSeed, loginAsSeededViaSso, type SeedResult } from '../helpers/seed';

const SEC_A = 'sec-rr69a';
const SEC_B = 'sec-rr69b';

async function api(page: any, path: string, method = 'GET', body?: unknown) {
  return page.evaluate(async ({ path, method, body }: any) => {
    const raw = localStorage.getItem('auth-storage');
    const token = raw ? JSON.parse(raw)?.state?.token : null;
    const r = await fetch(path, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
    const ct = r.headers.get('content-type') || '';
    return { status: r.status, contentType: ct, body: ct.includes('application/json') ? await r.json().catch(() => null) : null };
  }, { path, method, body });
}

test.describe('Reader Report — per-specification checklist', () => {
  let seed: SeedResult | undefined;
  test.afterEach(async () => { await cleanupSeed(seed); seed = undefined; });

  test('per-spec checklist loads, saves independently, downloads, autosaves in UI', async ({ page }) => {
    test.setTimeout(150_000);
    seed = await seedFixture('wizard_review_minimal', {
      user: { email: 'rr-perspec@x.test', role: 'admin', preferences: { tours: { welcome: true, 'reader-report': true } } },
      reviewState: {
        buckets: {
          '1.a': {
            standardCode: '1', specCode: 'a', standardTitle: '', specPrompt: '',
            narratives: [{ sectionId: SEC_A, heading: 'h', snippet: 'Spec 1.a narrative.', htmlSnippet: '<p>Spec 1.a narrative.</p>', wordCount: 3, confidence: 0.9, acceptState: 'pending', rationale: '' }],
            evidenceText: [], evidenceFiles: [], matrixCells: [],
          },
          '1.b': {
            standardCode: '1', specCode: 'b', standardTitle: '', specPrompt: '',
            narratives: [{ sectionId: SEC_B, heading: 'h', snippet: 'Spec 1.b narrative.', htmlSnippet: '<p>Spec 1.b narrative.</p>', wordCount: 3, confidence: 0.9, acceptState: 'pending', rationale: '' }],
            evidenceText: [], evidenceFiles: [], matrixCells: [],
          },
        },
        tags: [], cvs: [], evidenceDocs: [], introductions: {},
        placeholderSections: [], approvedIds: [], discardedIds: [], itemSources: {}, mergeLog: [],
      },
    });
    await loginAsSeededViaSso(page, seed);
    await api(page, `/api/submissions/${seed.submissionId}/review/set-approved`, 'POST', { approvedIds: [SEC_A, SEC_B] });

    // 1) Data carries per-SPEC reader fields.
    const got = await api(page, `/api/reports/submission/${seed.submissionId}/reader-report-data`);
    expect(got.status).toBe(200);
    const std1 = got.body.standards.find((s: any) => s.code === '1');
    expect(std1, 'standard 1 present').toBeTruthy();
    const specA = std1.specs.find((sp: any) => sp.specCode === 'a');
    const specB = std1.specs.find((sp: any) => sp.specCode === 'b');
    expect(specA, 'spec 1.a present').toBeTruthy();
    expect(specB, 'spec 1.b present').toBeTruthy();
    // Per-spec reader fields exist on the spec (not just the standard).
    expect(specA).toHaveProperty('readerMark');
    expect(specA).toHaveProperty('readerComment');

    // 2) Save per-spec rows → each spec persists INDEPENDENTLY.
    const put = await api(page, `/api/reports/submission/${seed.submissionId}/reader-report-data`, 'PUT', {
      rows: [
        { standardCode: '1', specCode: 'a', mark: 'noncompliant', comment: 'SPEC69A note' },
        { standardCode: '1', specCode: 'b', mark: 'compliant', comment: 'SPEC69B note' },
      ],
      recommendation: 'REC69',
    });
    expect(put.status).toBe(200);
    expect(put.body?.ok).toBe(true);

    const got2 = await api(page, `/api/reports/submission/${seed.submissionId}/reader-report-data`);
    const s1 = got2.body.standards.find((s: any) => s.code === '1');
    const a2 = s1.specs.find((sp: any) => sp.specCode === 'a');
    const b2 = s1.specs.find((sp: any) => sp.specCode === 'b');
    expect(a2.readerMark).toBe('noncompliant');
    expect(a2.readerComment).toContain('SPEC69A');
    expect(b2.readerMark).toBe('compliant');
    expect(b2.readerComment).toContain('SPEC69B');
    expect(got2.body.recommendation).toBe('REC69');

    // 3) The official Word template still downloads (per-spec rolled up).
    const dl = await api(page, `/api/reports/submission/${seed.submissionId}/reader-report/download?format=docx`);
    expect(dl.status).toBe(200);

    // 4) UI renders the labelled per-spec checklist + the self-study nav.
    await page.goto(`/reader-report/${seed.submissionId}`);
    await expect(page.getByTestId('reader-report-editor')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('rr-row-1')).toBeVisible();
    await expect(page.getByTestId('rr-nav-introduction')).toBeVisible();
    await expect(page.getByTestId('rr-check-1-a')).toBeVisible();
    await expect(page.getByTestId('rr-check-1-b')).toBeVisible();

    // 4b) Clear spec a's mark in the UI, let it AUTOSAVE, reload → it stuck.
    const compA = page.getByTestId('rr-c-1-a'); // currently checked (noncompliant set above? no — 'a' is noncompliant)
    const nonA = page.getByTestId('rr-n-1-a');
    await expect(nonA).toBeChecked();            // reflects the saved 'noncompliant'
    await page.getByTestId('rr-c-1-a').click();  // switch spec a to Compliant
    await expect(compA).toBeChecked();
    // Wait for the debounced autosave (1.2s) + network to land.
    await page.waitForTimeout(2500);
    await page.reload();
    await expect(page.getByTestId('reader-report-editor')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('rr-c-1-a')).toBeChecked(); // autosaved switch survived reload
  });
});
