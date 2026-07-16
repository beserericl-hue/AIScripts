import { test, expect, request, APIRequestContext } from '@playwright/test';
import { seedFixture, cleanupSeed, type SeedResult } from '../helpers/seed';

/**
 * Lead Reader Report to VPA (Request Board Action): a lead-reader/admin page that
 * assembles system sections (program info, courses from matrix, compiled
 * non-compliance) + editable fields, saves, and downloads DOCX/PDF. Driven as a
 * superuser (who satisfies the lead/admin gate) against a seeded submission.
 */
const BASE = process.env.E2E_BASE_URL ?? 'https://cshse-develop.up.railway.app';
const SSO_KEY = process.env.E2E_SSO_KEY ?? '';
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'eric@agileadtesting.com';
const RUN = Date.now().toString(36);

async function tok(api: APIRequestContext, email: string) {
  return (await (await api.post('/api/v1/auth/sso-login', { headers: { 'x-cshse-api-key': SSO_KEY }, data: { email } })).json()).token as string;
}

test('Lead Reader Report page: assemble, save, and download DOCX/PDF', async ({ page }) => {
  test.skip(!SSO_KEY, 'set E2E_SSO_KEY');
  test.setTimeout(90_000);
  const api = await request.newContext({ baseURL: BASE });
  let seed: SeedResult | undefined;
  try {
    seed = await seedFixture('wizard_review_minimal', {
      user: { institutionName: `LRR ${RUN}`, email: 'lrr-pc@test.local' },
      submission: { institutionName: `LRR ${RUN}` },
    });
    const sub = seed!.submissionId;
    const adminTok = await tok(api, ADMIN_EMAIL);
    const auth = { Authorization: `Bearer ${adminTok}` };

    // --- API: GET assembles system sections + null report ---
    const got = await (await api.get(`/api/submissions/${sub}/lead-reader-report`, { headers: auth })).json();
    expect(got.system, 'system sections present').toBeTruthy();
    expect(Object.keys(got.system)).toEqual(
      expect.arrayContaining(['generalEducationCourses', 'programCourses', 'nonCompliance', 'accreditationStatusDefault']),
    );

    // --- API: PUT saves + GET reflects ---
    const putRes = await api.put(`/api/submissions/${sub}/lead-reader-report`, {
      headers: auth,
      data: { recommendation: 'accredit_no_conditions', submittedByName: `E2E ${RUN}` },
    });
    expect(putRes.ok()).toBeTruthy();
    const got2 = await (await api.get(`/api/submissions/${sub}/lead-reader-report`, { headers: auth })).json();
    expect(got2.report?.recommendation).toBe('accredit_no_conditions');
    expect(got2.report?.submittedByName).toBe(`E2E ${RUN}`);

    // --- API: downloads are valid DOCX (PK) + PDF (%PDF) ---
    const docx = await api.get(`/api/submissions/${sub}/lead-reader-report/download?format=docx`, { headers: auth });
    expect(docx.status()).toBe(200);
    expect((await docx.body()).slice(0, 2).toString('latin1')).toBe('PK');
    const pdf = await api.get(`/api/submissions/${sub}/lead-reader-report/download?format=pdf`, { headers: auth });
    expect(pdf.status()).toBe(200);
    expect((await pdf.body()).slice(0, 5).toString('latin1')).toBe('%PDF-');

    // --- UI: the page renders and the download button works ---
    await page.goto(`${BASE}/self-study/${sub}?view=lead-reader-report#token=${encodeURIComponent(adminTok)}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('lead-reader-report-page'), 'page renders (no crash)').toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/Lead Reader Report to VPA/i)).toBeVisible();
    await expect(page.getByTestId('lrr-download-docx')).toBeVisible();
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 12000 }),
      page.getByTestId('lrr-download-pdf').click(),
    ]);
    expect(dl.suggestedFilename()).toMatch(/\.pdf$/);
    console.log('Lead Reader Report: page rendered + PDF downloaded ✓');
  } finally {
    await cleanupSeed(seed);
  }
});
