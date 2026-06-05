/**
 * Reader-role persistence — a reader's 0–3 rubric score is written to the DB
 * (Score model) and survives a reload. Runs live as an authenticated reader.
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

test.describe('Reader role — score persistence', () => {
  let seed: SeedResult | undefined;
  test.afterEach(async () => {
    await cleanupSeed(seed);
    seed = undefined;
  });

  test('a reader scores a spec → persists across reload', async ({ page }) => {
    test.setTimeout(90_000);
    seed = await seedFixture('wizard_review_minimal', {
      user: { email: 'reader-score@x.test', role: 'reader' },
    });
    await loginAsSeededViaSso(page, seed);

    // Write a score as the reader.
    const put = await api(page, seed.submissionId, 'PUT', '/scores', {
      standardCode: '1',
      specCode: 'a',
      score: 2,
    });
    expect(put.status, JSON.stringify(put.body)).toBeLessThan(300);

    // Reload, then read it back — the reader's score survived.
    await page.reload();
    await page.waitForLoadState('networkidle');
    const got = await api(page, seed.submissionId, 'GET', '/scores');
    expect(got.status).toBe(200);
    const list = got.body?.scores ?? got.body ?? [];
    const mine = (list as any[]).find((s) => s.standardCode === '1' && s.specCode === 'a');
    expect(mine, `no persisted score in ${JSON.stringify(got.body)}`).toBeTruthy();
    expect(mine.score).toBe(2);

    // Update it (re-score) and confirm the upsert persists.
    const put2 = await api(page, seed.submissionId, 'PUT', '/scores', {
      standardCode: '1',
      specCode: 'a',
      score: 3,
    });
    expect(put2.status).toBeLessThan(300);
    await page.reload();
    await page.waitForLoadState('networkidle');
    const got2 = await api(page, seed.submissionId, 'GET', '/scores');
    const mine2 = ((got2.body?.scores ?? got2.body ?? []) as any[]).find(
      (s) => s.standardCode === '1' && s.specCode === 'a'
    );
    expect(mine2.score).toBe(3);
  });
});
