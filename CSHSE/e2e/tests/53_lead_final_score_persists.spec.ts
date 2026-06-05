/**
 * Lead-reader-role persistence — the consolidated FINAL score (LeadFinalScore,
 * CR-009) is written to the DB and survives a reload. Runs live as a lead reader.
 */
import { test, expect } from '@playwright/test';
import { seedFixture, cleanupSeed, loginAsSeededViaSso, type SeedResult } from '../helpers/seed';

async function api(page: any, submissionId: string, method: string, path: string, body?: any) {
  return page.evaluate(
    async ({ submissionId, method, path, body }: any) => {
      const raw = localStorage.getItem('auth-storage');
      const token = raw ? JSON.parse(raw)?.state?.token : null;
      const r = await fetch(`/api/submissions/${submissionId}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: r.status, body: await r.json().catch(() => null) };
    },
    { submissionId, method, path, body }
  );
}

// GET /compilation (lead/admin) returns { rows: [{ standardCode, specCode,
// finalScore, ... }] }. Find the row for 1.a.
function finalScoreOf(body: any): number | null | undefined {
  const rows = body?.rows ?? [];
  const row = (rows as any[]).find((r) => r.standardCode === '1' && r.specCode === 'a');
  return row ? row.finalScore : undefined;
}

test.describe('Lead-reader role — final-score persistence', () => {
  let seed: SeedResult | undefined;
  test.afterEach(async () => {
    await cleanupSeed(seed);
    seed = undefined;
  });

  test('a lead reader sets a final score → persists across reload', async ({ page }) => {
    test.setTimeout(90_000);
    seed = await seedFixture('wizard_review_minimal', {
      user: { email: 'lead-final@x.test', role: 'lead_reader' },
    });
    await loginAsSeededViaSso(page, seed);

    // Set a consolidated final score as the lead reader.
    const put = await api(page, seed.submissionId, 'PUT', '/compilation/final-score', {
      standardCode: '1',
      specCode: 'a',
      score: 3,
      note: 'e2e final',
    });
    expect(put.status, JSON.stringify(put.body)).toBeLessThan(300);

    // Reload, then read it back via the lead-accessible compilation view.
    await page.reload();
    await page.waitForLoadState('networkidle');
    const got = await api(page, seed.submissionId, 'GET', '/compilation');
    expect(got.status, JSON.stringify(got.body)).toBe(200);
    expect(finalScoreOf(got.body), `no persisted final score in ${JSON.stringify(got.body)}`).toBe(3);

    // Clearing it also persists (DELETE).
    const del = await api(page, seed.submissionId, 'DELETE', '/compilation/final-score', {
      standardCode: '1',
      specCode: 'a',
    });
    expect(del.status).toBeLessThan(300);
    await page.reload();
    await page.waitForLoadState('networkidle');
    const got2 = await api(page, seed.submissionId, 'GET', '/compilation');
    // After a clear the 1.a row is dropped entirely (no reader votes, no final).
    expect(finalScoreOf(got2.body) ?? null, 'final score should be cleared').toBeFalsy();
  });
});
