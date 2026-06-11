/**
 * A reader's queue must be ASSIGNMENT-scoped — a reader (or a superuser
 * impersonating one) can only see submissions they hold an active assignment to,
 * never every submission in the system. This seeds a reader who is NOT assigned
 * to the seeded submission and asserts /api/submissions excludes it.
 */
import { test, expect } from '@playwright/test';
import { seedFixture, cleanupSeed, loginAsSeededViaSso, type SeedResult } from '../helpers/seed';

async function api(page: any, path: string) {
  return page.evaluate(async (path: string) => {
    const raw = localStorage.getItem('auth-storage');
    const token = raw ? JSON.parse(raw)?.state?.token : null;
    const r = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
    return { status: r.status, body: await r.json().catch(() => null) };
  }, path);
}

test.describe('Reader queue is assignment-scoped (cannot see everything)', () => {
  let seed: SeedResult | undefined;
  test.afterEach(async () => { await cleanupSeed(seed); seed = undefined; });

  test('a reader does NOT see a submission they are not assigned to', async ({ page }) => {
    test.setTimeout(90_000);
    // Reader role, but NOT assigned to the seeded submission.
    seed = await seedFixture('wizard_review_minimal', {
      user: { email: 'reader-scope@x.test', role: 'reader' },
    });
    await loginAsSeededViaSso(page, seed);

    const list = await api(page, '/api/submissions?limit=50');
    expect(list.status).toBe(200);
    const subs: any[] = list.body?.submissions || [];
    // The reader has no assignment → the seeded submission must NOT appear.
    const ids = subs.map((s) => s._id || s.submissionId);
    expect(ids).not.toContain(seed.submissionId);

    // And opening it directly is forbidden (assignment-gated).
    const one = await api(page, `/api/submissions/${seed.submissionId}`);
    expect(one.status).toBe(403);
  });
});
