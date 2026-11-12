/**
 * Reader-role persistence — a reader's Compliant / Non-compliant mark on their
 * Reader Report (ReaderReport.rows[].mark) is written to the DB and survives a
 * reload. Runs live as an authenticated reader. (Replaces the retired 0-3
 * /scores persistence spec — Lauri CR, Nov 2026.)
 */
import { test, expect } from '@playwright/test';
import { seedFixture, cleanupSeed, loginAsSeededViaSso, type SeedResult } from '../helpers/seed';

async function api(page: any, method: string, path: string, body?: any) {
  return page.evaluate(
    async ({ method, path, body }: any) => {
      const raw = localStorage.getItem('auth-storage');
      const token = raw ? JSON.parse(raw)?.state?.token : null;
      const r = await fetch(path, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: r.status, body: await r.json().catch(() => null) };
    },
    { method, path, body }
  );
}

// GET reader-report-data returns { standards: [{ code, specs: [{ specCode, readerMark }] }] }.
function markOf(body: any): string | undefined {
  const std = ((body?.standards ?? []) as any[]).find((s) => String(s.code) === '1');
  const spec = ((std?.specs ?? []) as any[]).find((sp) => sp.specCode === 'a');
  return spec?.readerMark;
}

test.describe('Reader role — Reader Report mark persistence', () => {
  let seed: SeedResult | undefined;
  test.afterEach(async () => {
    await cleanupSeed(seed);
    seed = undefined;
  });

  test('a reader marks a spec Non-compliant → persists across reload; the old /scores API is gone', async ({ page }) => {
    test.setTimeout(90_000);
    seed = await seedFixture('wizard_review_minimal', {
      user: { email: 'reader-mark@x.test', role: 'reader' },
    });
    await loginAsSeededViaSso(page, seed);
    const dataPath = `/api/reports/submission/${seed.submissionId}/reader-report-data`;

    const put = await api(page, 'PUT', dataPath, {
      rows: [{ standardCode: '1', specCode: 'a', mark: 'noncompliant', comment: 'e2e' }],
    });
    expect(put.status, JSON.stringify(put.body)).toBeLessThan(300);

    await page.reload();
    await page.waitForLoadState('networkidle');
    const got = await api(page, 'GET', dataPath);
    expect(got.status).toBe(200);
    expect(markOf(got.body), `no persisted mark in ${JSON.stringify(got.body).slice(0, 500)}`).toBe('noncompliant');

    // Negative — the retired 0-3 score endpoint no longer exists.
    const legacy = await api(page, 'PUT', `/api/submissions/${seed.submissionId}/scores`, {
      standardCode: '1', specCode: 'a', score: 2,
    });
    expect(legacy.status).toBe(404);
  });
});
