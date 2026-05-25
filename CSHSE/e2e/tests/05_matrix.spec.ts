/**
 * Tier 1 — Matrix step regression (CR-029 / CR-035).
 *
 * Seeds aiMatrices on the import and aiMatrixState on the submission,
 * then exercises the wizard's Matrix step UI + the CR-035 Curriculum
 * Matrix tab population. Row-edit persistence rides on the
 * /api/submissions/:id/matrix-state endpoint already covered by
 * Section 2's integration tests.
 */
import { test, expect } from '@playwright/test';
import {
  seedFixture,
  cleanupSeed,
  loginAsSeededViaSso,
  type SeedResult,
} from '../helpers/seed';

const sampleMatrices = [
  {
    matrixId: 'matrix-hsr',
    name: 'Required Counseling & Human Services Courses',
    columnHeaders: ['HSR 101', 'HSR 201', 'HSR 301'],
    cells: [
      { std: '7', spec: 'a', columnIndex: 1, contentTypes: ['I'], depth: 'M', codeRaw: 'IM', specPrompt: '' },
      { std: '7', spec: 'b', columnIndex: 2, contentTypes: ['T'], depth: 'H', codeRaw: 'TH', specPrompt: '' },
    ],
    htmlSnippet: '<table><tr><th>HSR 101</th></tr><tr><td>IM</td></tr></table>',
  },
];

test.describe('Matrix step', () => {
  let seed: SeedResult | undefined;

  test.afterEach(async () => {
    await cleanupSeed(seed);
    seed = undefined;
  });

  test('Matrix toolbar surface renders when matrices are present', async ({ page }) => {
    test.setTimeout(60_000);
    seed = await seedFixture('wizard_review_minimal', {
      user: { email: 'matrix-render@x.test' },
      import: {
        wizardStep: 'review',
        aiStatus: 'parsed',
        aiMatrices: sampleMatrices,
      },
      matrixState: {
        matrices: sampleMatrices,
        matrixRowEdits: {},
      },
    });
    await loginAsSeededViaSso(page, seed);
    await page.goto(`/self-study/${seed.submissionId}`);
    await page.waitForLoadState('networkidle');

    // Matrix button enables only when aiMatrixState.matrices is non-empty
    // (per the post-CR-043 toolbar surface).
    const matrixBtn = page.getByRole('button', { name: /^Matrix/ });
    await expect(matrixBtn).toBeEnabled({ timeout: 15_000 });
    await matrixBtn.click();
    await expect(page.getByRole('heading', { name: /Matrix \(CR-043\)/i })).toBeVisible({
      timeout: 10_000,
    });
  });

  test('Matrix row-edit persists through the API', async ({ page }) => {
    test.setTimeout(60_000);
    seed = await seedFixture('wizard_review_minimal', {
      user: { email: 'matrix-rowedit@x.test' },
      import: {
        wizardStep: 'review',
        aiStatus: 'parsed',
        aiMatrices: sampleMatrices,
      },
      matrixState: { matrices: sampleMatrices, matrixRowEdits: {} },
    });
    await loginAsSeededViaSso(page, seed);
    const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
    const SSO_KEY = process.env.E2E_SSO_KEY ?? '';
    const tokenRes = await fetch(`${BASE_URL}/api/v1/auth/sso-login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-cshse-api-key': SSO_KEY },
      body: JSON.stringify({ email: seed.userEmail }),
    });
    const { token } = (await tokenRes.json()) as { token: string };

    // POST a Keep-this-row edit and confirm it persists.
    const post = await fetch(
      `${BASE_URL}/api/submissions/${seed.submissionId}/matrix-state`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          matrixSlug: 'matrix-hsr',
          rowAnchor: '7.a',
          edit: { kind: 'keep', spec: '7.a' },
        }),
      }
    );
    expect(post.status).toBe(200);

    const get = await (await fetch(
      `${BASE_URL}/api/submissions/${seed.submissionId}/matrix-state`,
      { headers: { authorization: `Bearer ${token}` } }
    )).json() as any;
    expect(get.aiMatrixState.matrixRowEdits?.['matrix-hsr|7.a']).toEqual({
      kind: 'keep',
      spec: '7.a',
    });
  });

  test('Remove + Restore — row edit cleared via edit=null', async ({ page }) => {
    test.setTimeout(60_000);
    seed = await seedFixture('wizard_review_minimal', {
      user: { email: 'matrix-remove-restore@x.test' },
      import: {
        wizardStep: 'review',
        aiStatus: 'parsed',
        aiMatrices: sampleMatrices,
      },
      matrixState: {
        matrices: sampleMatrices,
        matrixRowEdits: { 'matrix-hsr|7.b': { kind: 'remove' } },
      },
    });
    const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
    const SSO_KEY = process.env.E2E_SSO_KEY ?? '';
    const tokenRes = await fetch(`${BASE_URL}/api/v1/auth/sso-login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-cshse-api-key': SSO_KEY },
      body: JSON.stringify({ email: seed.userEmail }),
    });
    const { token } = (await tokenRes.json()) as { token: string };
    // Restore = POST with edit=null.
    const post = await fetch(
      `${BASE_URL}/api/submissions/${seed.submissionId}/matrix-state`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ matrixSlug: 'matrix-hsr', rowAnchor: '7.b', edit: null }),
      }
    );
    expect(post.status).toBe(200);
    const after = await (await fetch(
      `${BASE_URL}/api/submissions/${seed.submissionId}/matrix-state`,
      { headers: { authorization: `Bearer ${token}` } }
    )).json() as any;
    expect(after.aiMatrixState?.matrixRowEdits?.['matrix-hsr|7.b']).toBeUndefined();
  });

  test('Hard refresh keeps the Matrix surface populated', async ({ page }) => {
    test.setTimeout(60_000);
    seed = await seedFixture('wizard_review_minimal', {
      user: { email: 'matrix-refresh@x.test' },
      import: {
        wizardStep: 'review',
        aiStatus: 'parsed',
        aiMatrices: sampleMatrices,
      },
      matrixState: { matrices: sampleMatrices, matrixRowEdits: {} },
    });
    await loginAsSeededViaSso(page, seed);
    await page.goto(`/self-study/${seed.submissionId}`);
    await page.waitForLoadState('networkidle');

    const matrixBtn = page.getByRole('button', { name: /^Matrix/ });
    await expect(matrixBtn).toBeEnabled({ timeout: 15_000 });
    await matrixBtn.click();
    await expect(page.getByRole('heading', { name: /Matrix \(CR-043\)/i })).toBeVisible({ timeout: 10_000 });
    await page.reload();
    await page.waitForLoadState('networkidle');
    // Toolbar's Matrix button still enabled after refresh — submission-
    // scoped aiMatrixState survived.
    await expect(page.getByRole('button', { name: /^Matrix/ })).toBeEnabled({ timeout: 15_000 });
  });
});
