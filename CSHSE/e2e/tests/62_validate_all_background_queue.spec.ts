/**
 * Background "Validate all" queue. Approving (and the explicit Validate-all
 * endpoint) enqueue EVERY spec-with-content for AI evaluation; a background
 * worker drains the queue in batches (calls cshse-ai), so the UI never blocks
 * and ALL specs get a verdict — not just the first 24 (the old synchronous cap).
 */
import { test, expect } from '@playwright/test';
import { seedFixture, cleanupSeed, loginAsSeededViaSso, type SeedResult } from '../helpers/seed';

const SPECS = ['a', 'b', 'c', 'd', 'e'];
const ids = SPECS.map((s) => `sec62-1${s}`);

function narr(sectionId: string) {
  return {
    sectionId, heading: 'h',
    snippet: 'The program is part of Stevenson University, a regionally accredited institution accredited by the Middle States Commission on Higher Education.',
    htmlSnippet: '<p>The program is part of a regionally accredited university (Middle States).</p>',
    wordCount: 20, confidence: 0.9, acceptState: 'pending', rationale: '',
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

test.describe('Validate-all background queue evaluates every spec', () => {
  let seed: SeedResult | undefined;
  test.afterEach(async () => { await cleanupSeed(seed); seed = undefined; });

  test('approve enqueues all specs; the worker drains the queue → every spec gets a verdict', async ({ page }) => {
    test.setTimeout(180_000);
    const buckets: Record<string, any> = {};
    SPECS.forEach((s, i) => {
      buckets[`1.${s}`] = { standardCode: '1', specCode: s, standardTitle: '', specPrompt: '', narratives: [narr(ids[i])], evidenceText: [], evidenceFiles: [], matrixCells: [] };
    });
    seed = await seedFixture('wizard_review_minimal', {
      user: { email: 'validate-all@x.test', preferences: { tours: { welcome: true, 'self-study': true } } },
      reviewState: { buckets, tags: [], cvs: [], evidenceDocs: [], introductions: {}, placeholderSections: [], approvedIds: [], discardedIds: [], itemSources: {}, mergeLog: [] },
    });
    await loginAsSeededViaSso(page, seed);

    // Approve all 5 → materializes narratives AND enqueues all 5 for background eval.
    const setRes = await api(page, `/api/submissions/${seed.submissionId}/review/set-approved`, 'POST', { approvedIds: ids });
    expect(setRes.status).toBe(200);
    expect(setRes.body.evalQueued).toBe(SPECS.length);

    // Progress endpoint reflects the queue and drains to done.
    await expect.poll(async () => {
      const p = (await api(page, `/api/submissions/${seed!.submissionId}/review/eval-progress`)).body;
      return p?.running === false && p?.done >= SPECS.length ? 'done' : `running ${p?.done}/${p?.total}`;
    }, { timeout: 150_000, intervals: [3000] }).toBe('done');

    // EVERY spec now has an AI verdict (the worker evaluated all of them).
    for (const s of SPECS) {
      const ev = (await api(page, `/api/submissions/${seed.submissionId}/standards/1/specs/${s}/evaluation`)).body?.evaluation;
      expect(ev, `spec 1.${s} should have a verdict`).toBeTruthy();
      expect(JSON.stringify(ev)).toMatch(/verdict|pass|needs_improvement|fail/i);
    }

    // The explicit "Validate all" endpoint re-queues every spec-with-content.
    const va = await api(page, `/api/submissions/${seed.submissionId}/review/evaluate-all`, 'POST');
    expect(va.status).toBe(200);
    expect(va.body.queued).toBe(SPECS.length);
  });
});
