/**
 * Reader Report in the library (2026-06-09).
 *
 * On submit, the self-study + AI verdicts are compiled into a single reviewer
 * packet and stored in the Supporting File Library as BOTH a CSHSE-branded PDF
 * and DOCX (tagged reader-report:pdf / reader-report:docx) so assigned readers
 * can download them. This drives the explicit generate endpoint (the same code
 * the background worker runs on submit-drain) and asserts BOTH files land in the
 * library with the right mime types and non-empty content.
 */
import { test, expect } from '@playwright/test';
import { seedFixture, cleanupSeed, loginAsSeededViaSso, type SeedResult } from '../helpers/seed';

function narr(sectionId: string) {
  return {
    sectionId, heading: 'h',
    snippet: 'The program is part of Stevenson University, a regionally accredited institution accredited by the Middle States Commission on Higher Education, offering a Bachelor of Science in Human Services.',
    htmlSnippet: '<p>The program is part of a regionally accredited university (Middle States), offering a BS in Human Services.</p>',
    wordCount: 28, confidence: 0.9, acceptState: 'pending', rationale: '',
  };
}

async function api(page: any, path: string, method = 'GET', body?: unknown) {
  return page.evaluate(async ({ path, method, body }: any) => {
    const raw = localStorage.getItem('auth-storage');
    const token = raw ? JSON.parse(raw)?.state?.token : null;
    const r = await fetch(path, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  }, { path, method, body });
}

test.describe('Reader Report compiles to PDF + DOCX in the library', () => {
  let seed: SeedResult | undefined;
  test.afterEach(async () => { await cleanupSeed(seed); seed = undefined; });

  test('generate endpoint stores both a branded PDF and DOCX tagged reader-report', async ({ page }) => {
    test.setTimeout(120_000);
    const ids = ['sec63-1a', 'sec63-1b'];
    const buckets: Record<string, any> = {
      '1.a': { standardCode: '1', specCode: 'a', standardTitle: '', specPrompt: '', narratives: [narr(ids[0])], evidenceText: [], evidenceFiles: [], matrixCells: [] },
      '1.b': { standardCode: '1', specCode: 'b', standardTitle: '', specPrompt: '', narratives: [narr(ids[1])], evidenceText: [], evidenceFiles: [], matrixCells: [] },
    };
    seed = await seedFixture('wizard_review_minimal', {
      user: { email: 'reader-report@x.test', preferences: { tours: { welcome: true, 'self-study': true } } },
      reviewState: { buckets, tags: [], cvs: [], evidenceDocs: [], introductions: {}, placeholderSections: [], approvedIds: [], discardedIds: [], itemSources: {}, mergeLog: [] },
    });
    await loginAsSeededViaSso(page, seed);

    // Approve → materialize narratives into the submission (so the report has content).
    const setRes = await api(page, `/api/submissions/${seed.submissionId}/review/set-approved`, 'POST', { approvedIds: ids });
    expect(setRes.status).toBe(200);

    // Force an immediate Reader Report build (same code the worker runs on submit-drain).
    const gen = await api(page, `/api/reports/submission/${seed.submissionId}/reader-report/generate`, 'POST');
    expect(gen.status).toBe(200);
    expect(gen.body?.ok).toBe(true);
    expect(gen.body?.generated).toMatchObject({ pdf: true, docx: true });
    // The OFFICIAL CSHSE template (baccalaureate, since the seed is a bachelors program) is used.
    expect(gen.body?.generated?.templated, 'should fill the official template').toBe(true);
    expect(gen.body?.generated?.level).toBe('baccalaureate');

    // Both files now live in the Supporting File Library.
    const ev = await api(page, `/api/submissions/${seed.submissionId}/evidence`);
    const items: any[] = Array.isArray(ev.body) ? ev.body : (ev.body?.evidence || ev.body?.items || ev.body?.data || []);
    const reports = items.filter((i) => (i.tags || []).some((t: string) => String(t).startsWith('reader-report')));
    const pdf = reports.find((r) => (r.tags || []).includes('reader-report:pdf'));
    const docx = reports.find((r) => (r.tags || []).includes('reader-report:docx'));

    expect(pdf, 'a reader-report PDF should be in the library').toBeTruthy();
    expect(docx, 'a reader-report DOCX should be in the library').toBeTruthy();
    expect(pdf.file?.mimeType).toBe('application/pdf');
    expect(docx.file?.mimeType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    // Non-trivial content (a compiled self-study, not an empty stub).
    expect(Number(pdf.file?.size || 0)).toBeGreaterThan(800);
    expect(Number(docx.file?.size || 0)).toBeGreaterThan(800);

    // Idempotent: re-running upserts (does NOT duplicate) the two files.
    const gen2 = await api(page, `/api/reports/submission/${seed.submissionId}/reader-report/generate`, 'POST');
    expect(gen2.status).toBe(200);
    const ev2 = await api(page, `/api/submissions/${seed.submissionId}/evidence`);
    const items2: any[] = Array.isArray(ev2.body) ? ev2.body : (ev2.body?.evidence || ev2.body?.items || ev2.body?.data || []);
    const reports2 = items2.filter((i) => (i.tags || []).some((t: string) => String(t).startsWith('reader-report')));
    expect(reports2.length, 'still exactly 2 reader-report files after re-generate').toBe(2);
  });
});
