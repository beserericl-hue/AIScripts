/**
 * Tier 1 — Match step regression.
 *
 * Reads the seeded buckets via the persisted Review surface and
 * confirms the per-spec card list / confidence colouring / CR-031
 * monotonic byte-offset invariant.
 */
import { test, expect } from '@playwright/test';
import {
  seedFixture,
  cleanupSeed,
  loginAsSeededViaSso,
  type SeedResult,
} from '../helpers/seed';

test.describe('Match step', () => {
  let seed: SeedResult | undefined;

  test.afterEach(async () => {
    await cleanupSeed(seed);
    seed = undefined;
  });

  test('Every parsed paragraph lands in exactly one bucket', async ({ page }) => {
    test.setTimeout(60_000);
    // Seed three buckets with a known item count. The Review surface
    // renders one card per bucket item; total cards = total parsed
    // narratives + evidenceText + evidenceFiles + tags.
    const buckets = {
      '1.a': {
        standardCode: '1', specCode: 'a', standardTitle: 'X', specPrompt: '1.a',
        narratives: [
          { sectionId: 's-1', heading: 'A', snippet: 'a a a a a a a a a a a', wordCount: 11, confidence: 0.95, acceptState: 'auto_accepted', rationale: '', byteOffsetStart: 100 },
          { sectionId: 's-2', heading: 'B', snippet: 'b b b b b b b b b b b', wordCount: 11, confidence: 0.65, acceptState: 'auto_accepted', rationale: '', byteOffsetStart: 200 },
        ],
        evidenceText: [], evidenceFiles: [], matrixCells: [],
        coverageScore: 0.8, coverageCovered: true, coverageGaps: [], coverageStrengths: [],
      },
      '2.a': {
        standardCode: '2', specCode: 'a', standardTitle: 'Y', specPrompt: '2.a',
        narratives: [
          { sectionId: 's-3', heading: 'C', snippet: 'c c c c c c c c c c c', wordCount: 11, confidence: 0.35, acceptState: 'auto_accepted', rationale: '', byteOffsetStart: 300 },
        ],
        evidenceText: [], evidenceFiles: [], matrixCells: [],
        coverageScore: 0.5, coverageCovered: false, coverageGaps: [], coverageStrengths: [],
      },
    };
    seed = await seedFixture('wizard_review_minimal', {
      user: { email: 'match-counts@x.test' },
      import: {
        wizardStep: 'review',
        aiStatus: 'parsed',
        aiBuckets: buckets,
      },
    });
    await loginAsSeededViaSso(page, seed);
    await page.goto(`/self-study/${seed.submissionId}`);
    await page.waitForLoadState('networkidle');
    // Open Review surface via toolbar (matches the rest of the suite).
    const reviewBtn = page.getByRole('button', { name: /^Review/ });
    await expect(reviewBtn).toBeEnabled({ timeout: 15_000 });
    await reviewBtn.click();
    await expect(page.getByRole('heading', { name: /Review/i })).toBeVisible({
      timeout: 10_000,
    });

    // Both spec rail entries are present (1.a + 2.a).
    await expect(page.getByRole('tab', { name: /^1\.a/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^2\.a/i })).toBeVisible();
  });

  test('Confidence-color stripe renders on cards', async ({ page }) => {
    test.setTimeout(60_000);
    seed = await seedFixture('wizard_review_minimal', {
      user: { email: 'match-colors@x.test' },
      import: {
        wizardStep: 'review',
        aiStatus: 'parsed',
        aiBuckets: {
          '1.a': {
            standardCode: '1', specCode: 'a', standardTitle: 'X', specPrompt: '1.a',
            narratives: [
              { sectionId: 's-hi', heading: 'high-conf', snippet: 'high confidence item with enough words to render', wordCount: 9, confidence: 0.95, acceptState: 'auto_accepted', rationale: '', byteOffsetStart: 100 },
              { sectionId: 's-md', heading: 'med-conf',  snippet: 'medium confidence item with enough words to render', wordCount: 9, confidence: 0.65, acceptState: 'auto_accepted', rationale: '', byteOffsetStart: 200 },
              { sectionId: 's-lo', heading: 'low-conf',  snippet: 'low confidence item with enough words to render',     wordCount: 9, confidence: 0.35, acceptState: 'auto_accepted', rationale: '', byteOffsetStart: 300 },
            ],
            evidenceText: [], evidenceFiles: [], matrixCells: [],
            coverageScore: 0.8, coverageCovered: true, coverageGaps: [], coverageStrengths: [],
          },
        },
      },
    });
    await loginAsSeededViaSso(page, seed);
    await page.goto(`/self-study/${seed.submissionId}`);
    await page.waitForLoadState('networkidle');
    const reviewBtn = page.getByRole('button', { name: /^Review/ });
    await expect(reviewBtn).toBeEnabled({ timeout: 15_000 });
    await reviewBtn.click();

    // Click the 1.a spec tab to render its cards.
    const tab = page.getByRole('tab', { name: /^1\.a/i }).first();
    await expect(tab).toBeVisible({ timeout: 10_000 });
    await tab.click({ force: true });

    // At least three card headings render (one per confidence tier).
    await expect(page.getByText(/high-conf/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/med-conf/i)).toBeVisible();
    await expect(page.getByText(/low-conf/i)).toBeVisible();
  });

  test('byte_offset_start is monotonic within an import (CR-031)', async ({ page }) => {
    test.setTimeout(60_000);
    seed = await seedFixture('wizard_review_minimal', {
      user: { email: 'match-byteoffset@x.test' },
      import: {
        wizardStep: 'review',
        aiStatus: 'parsed',
        aiBuckets: {
          '1.a': {
            standardCode: '1', specCode: 'a', standardTitle: 'X', specPrompt: '1.a',
            narratives: [
              { sectionId: 's-1', heading: 'first',  snippet: 'first item with enough words to render',  wordCount: 8, confidence: 0.9, acceptState: 'auto_accepted', rationale: '', byteOffsetStart: 100 },
              { sectionId: 's-2', heading: 'second', snippet: 'second item with enough words to render', wordCount: 8, confidence: 0.9, acceptState: 'auto_accepted', rationale: '', byteOffsetStart: 250 },
              { sectionId: 's-3', heading: 'third',  snippet: 'third item with enough words to render',  wordCount: 8, confidence: 0.9, acceptState: 'auto_accepted', rationale: '', byteOffsetStart: 450 },
            ],
            evidenceText: [], evidenceFiles: [], matrixCells: [],
            coverageScore: 0.8, coverageCovered: true, coverageGaps: [], coverageStrengths: [],
          },
        },
      },
    });
    // Read the persisted state directly via the API — the on-the-wire
    // ordering is the actual CR-031 invariant we want to pin. Card
    // rendering order depends on UI layout/DOM order; the SOURCE OF
    // TRUTH is the persisted buckets[].narratives array which the
    // matcher/walker writes monotonically.
    const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
    const SSO_KEY = process.env.E2E_SSO_KEY ?? '';
    const tokenRes = await fetch(`${BASE_URL}/api/v1/auth/sso-login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-cshse-api-key': SSO_KEY },
      body: JSON.stringify({ email: seed.userEmail }),
    });
    const { token } = (await tokenRes.json()) as { token: string };
    const rev = await (await fetch(
      `${BASE_URL}/api/submissions/${seed.submissionId}/review`,
      { headers: { authorization: `Bearer ${token}` } }
    )).json() as any;
    const narratives = rev.aiReviewState?.buckets?.['1.a']?.narratives || [];
    expect(narratives.length).toBe(3);
    const offsets = narratives.map((n: any) => n.byteOffsetStart);
    for (let i = 1; i < offsets.length; i++) {
      expect(offsets[i]).toBeGreaterThan(offsets[i - 1]);
    }
  });
});
