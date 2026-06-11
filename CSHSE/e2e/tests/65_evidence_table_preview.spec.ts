/**
 * Tabular evidence must preview as a real TABLE, not a run-on paragraph.
 *
 * Evidence files are frequently tables. materializeApprovedToEditor builds the
 * stored .docx from the item's htmlSnippet — when that HTML has a <table> it must
 * emit a REAL Word table so the File-Library preview (mammoth → <table>) is
 * readable. This drives the API end-to-end: seed a table evidence file → approve
 * (materialize) → the /preview endpoint returns html containing <table> + the
 * cell values.
 */
import { test, expect } from '@playwright/test';
import { seedFixture, cleanupSeed, loginAsSeededViaSso, type SeedResult } from '../helpers/seed';

const SEC = 'sec-tblprev-65';
const TABLE_HTML =
  '<table><tr><td>Course</td><td>Credits</td></tr>' +
  '<tr><td>HUMS 110 Introduction to Human Services</td><td>3</td></tr>' +
  '<tr><td>PSY 101 General Psychology</td><td>3</td></tr></table>';

async function api(page: any, path: string, method = 'GET', body?: unknown) {
  return page.evaluate(async ({ path, method, body }: any) => {
    const raw = localStorage.getItem('auth-storage');
    const token = raw ? JSON.parse(raw)?.state?.token : null;
    const r = await fetch(path, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  }, { path, method, body });
}

test.describe('Tabular evidence previews as a real table', () => {
  let seed: SeedResult | undefined;
  test.afterEach(async () => { await cleanupSeed(seed); seed = undefined; });

  test('approve a table evidence file → preview html contains <table> + cells', async ({ page }) => {
    test.setTimeout(150_000);

    seed = await seedFixture('wizard_review_minimal', {
      user: { email: 'tbl-preview@x.test', preferences: { tours: { welcome: true, 'self-study': true } } },
      reviewState: {
        buckets: {
          '1.a': {
            standardCode: '1', specCode: 'a', standardTitle: '', specPrompt: '',
            narratives: [], evidenceText: [],
            evidenceFiles: [
              {
                sectionId: SEC,
                heading: '(data table)',
                snippet: '(data table)',
                htmlSnippet: TABLE_HTML,
                wordCount: 12, confidence: 0.9, acceptState: 'pending', rationale: '',
              },
            ],
            matrixCells: [],
          },
        },
        tags: [], cvs: [], evidenceDocs: [], introductions: {},
        placeholderSections: [], approvedIds: [], discardedIds: [], itemSources: {}, mergeLog: [],
      },
    });

    await loginAsSeededViaSso(page, seed);

    // Approve → materialize the evidence file (now built with a REAL Word table).
    const setRes = await api(page, `/api/submissions/${seed.submissionId}/review/set-approved`, 'POST', { approvedIds: [SEC] });
    expect(setRes.status).toBe(200);

    // Find the materialized file in the library (tagged rev:<sectionId>).
    const ev = await api(page, `/api/submissions/${seed.submissionId}/evidence`);
    const items: any[] = Array.isArray(ev.body) ? ev.body : (ev.body?.evidence || ev.body?.items || []);
    const file = items.find((i) => (i.tags || []).includes(`rev:${SEC}`));
    expect(file, 'materialized evidence file should exist').toBeTruthy();

    // The preview renders the .docx as HTML — it must contain a real <table>.
    const prev = await api(page, `/api/submissions/${seed.submissionId}/evidence/${file._id}/preview`);
    expect(prev.status).toBe(200);
    expect(prev.body?.previewable).toBe(true);
    expect(prev.body?.contentType).toBe('document');
    const html: string = prev.body?.html || '';
    expect(html, 'preview html should contain a real <table>').toContain('<table');
    expect((html.match(/<tr>/g) || []).length, 'table should have multiple rows').toBeGreaterThanOrEqual(3);
    expect(html).toContain('HUMS 110 Introduction to Human Services');
    expect(html).toContain('PSY 101 General Psychology');
  });
});
