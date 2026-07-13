import { test, expect, request, APIRequestContext } from '@playwright/test';
import { seedFixture, cleanupSeed, type SeedResult } from '../helpers/seed';

/**
 * Regression (prod): the "Approve all of Standard N → editor" button froze on
 * "Approving…" forever when the shared save-state chain hung. This test STALLS
 * the save-state POST and asserts the button still re-enables (the flush is
 * best-effort; the AI-review enqueue still runs), so the coordinator is never
 * stuck. Seeds review buckets directly (no 15-min MCC import).
 */
const BASE = process.env.E2E_BASE_URL ?? 'https://cshse-develop.up.railway.app';
const SSO_KEY = process.env.E2E_SSO_KEY ?? '';
const RUN = Date.now().toString(36);

async function tok(api: APIRequestContext, email: string) {
  return (await (await api.post('/api/v1/auth/sso-login', { headers: { 'x-cshse-api-key': SSO_KEY }, data: { email } })).json()).token as string;
}

function bucket(std: string, spec: string) {
  return {
    standardCode: std,
    specCode: spec,
    standardTitle: 'Program Identity',
    specPrompt: `Specification ${std}.${spec}`,
    narratives: [
      {
        sectionId: `n-${std}-${spec}-${RUN}`,
        heading: `${spec}. Seeded`,
        snippet: `Seeded narrative for ${std}.${spec}.`,
        htmlSnippet: `<p>Seeded narrative for ${std}.${spec}.</p>`,
        wordCount: 5,
        confidence: 0.95,
        acceptState: 'review_unknown',
      },
    ],
    evidenceText: [], evidenceFiles: [], matrixCells: [],
    coverageScore: null, coverageCovered: null, coverageGaps: [], coverageStrengths: [],
  };
}

test('Approve-all button re-enables even when save-state stalls', async ({ page }) => {
  test.skip(!SSO_KEY, 'set E2E_SSO_KEY');
  test.setTimeout(120_000);
  const api = await request.newContext({ baseURL: BASE });
  let seed: SeedResult | undefined;
  try {
    const buckets: Record<string, unknown> = {};
    for (const s of ['a', 'b', 'c', 'd', 'e', 'f']) buckets[`1.${s}`] = bucket('1', s);
    seed = await seedFixture('wizard_review_minimal', {
      user: { institutionName: `Recover ${RUN}`, email: 'recover-pc@test.local' },
      submission: { institutionName: `Recover ${RUN}` },
      reviewState: { buckets, cvs: [], tags: [], introductions: {}, placeholderSections: [], matrices: [] },
    });
    const token = await tok(api, seed!.userEmail);
    const sub = seed!.submissionId;

    // STALL every save-state POST for 40s (longer than the 12s best-effort cap)
    // to simulate the prod hang; let everything else through.
    await page.route('**/review/save-state', async (route) => {
      await new Promise((r) => setTimeout(r, 40000));
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });

    await page.goto(`${BASE}/self-study/${sub}?view=review#token=${encodeURIComponent(token)}`);
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20000 });
    await page.waitForLoadState('networkidle');
    // Select spec 1.a so the standard-scoped Approve button appears.
    const spec1a = page.locator('button[role="tab"][title^="1.a —"]').first();
    await spec1a.waitFor({ state: 'visible', timeout: 30000 });
    await spec1a.click();

    const approveBtn = page.getByTestId('approve-all');
    await expect(approveBtn).toBeVisible({ timeout: 10000 });
    await expect(approveBtn).toContainText(/Approve all of Standard 1 → editor/);
    await approveBtn.click();

    // It disables + shows in-progress while the (stalled) round-trip runs…
    await expect(approveBtn).toBeDisabled({ timeout: 5000 });
    await expect(approveBtn).toContainText(/Approving Standard 1…/, { timeout: 5000 });

    // …and MUST re-enable well before the 90s safety net (the 12s flush cap +
    // set-approved), even though save-state is still stalled — proving the fix.
    await expect(approveBtn, 're-enables despite stalled save-state').toBeEnabled({ timeout: 45000 });
    await expect(approveBtn).toContainText(/Approve all of Standard 1 → editor/);

    // And the approve actually materialized (AI-review enqueue path ran).
    const auth = { Authorization: `Bearer ${token}` };
    const body = await (await api.get(`/api/submissions/${sub}`, { headers: auth })).json();
    const s = (body.submission ?? body) as any;
    const specs = new Set((s.narrativeContent ?? []).filter((n: any) => String(n.standardCode) === '1' && (n.content || '').trim()).map((n: any) => n.specCode));
    console.log('materialized standard-1 specs despite stalled save:', [...specs].sort().join(','));
    expect(specs.size, 'standard 1 materialized despite stalled save-state').toBeGreaterThan(0);
  } finally {
    await cleanupSeed(seed);
  }
});
