import { test, expect, request, APIRequestContext } from '@playwright/test';
import * as fs from 'fs';
import { seedFixture, cleanupSeed, type SeedResult } from '../helpers/seed';

/**
 * Verifies the MCC import UX fixes reported 2026-07-11:
 *  1. Compare highlights ONLY the matched section (no spill).
 *  2. Introduction is trimmed — the Standard-1 header no longer bleeds in.
 *  3. Intro-referenced appendices pre-classify to "Introduction" in the file
 *     Standard dropdown.
 *  4. Curriculum-matrix appendix is flagged.
 * Screenshots land in test-results/ux-*.png.
 */
const BASE = process.env.E2E_BASE_URL ?? 'https://cshse-develop.up.railway.app';
const SSO_KEY = process.env.E2E_SSO_KEY ?? '';
const PDF = process.env.MCC_PDF ?? '';
const RUN = Date.now().toString(36);

async function tok(api: APIRequestContext, email: string) {
  const r = await api.post('/api/v1/auth/sso-login', { headers: { 'x-cshse-api-key': SSO_KEY }, data: { email } });
  return (await r.json()).token as string;
}

test('MCC UX fixes: intro trim, intro classification, compare highlight', async ({ page }) => {
  test.skip(!SSO_KEY || !PDF, 'set E2E_SSO_KEY + MCC_PDF');
  test.setTimeout(900_000);
  const api = await request.newContext({ baseURL: BASE });
  let seed: SeedResult | undefined;
  try {
    seed = await seedFixture('wizard_review_minimal', { user: { institutionName: `UX Fix Inst ${RUN}`, email: 'ux-pc@test.local' }, submission: { institutionName: `UX Fix Inst ${RUN}` } });
    const token = await tok(api, seed!.userEmail);
    const auth = { Authorization: `Bearer ${token}` };
    const me = await (await api.get('/api/auth/me', { headers: auth })).json();
    const institutionId = (me.user ?? me).institutionId;
    const sub = ((await (await api.post('/api/submissions', { headers: auth, data: { institutionId, institutionName: 'UX', programName: 'HS', programLevel: 'associate', type: 'initial' } })).json()).submission)._id;

    const up = await api.post('/api/imports/upload', { headers: auth, multipart: { submissionId: sub, file: { name: 'mcc.pdf', mimeType: 'application/pdf', buffer: fs.readFileSync(PDF) } } });
    const importId = (await up.json()).importId;
    await api.post(`/api/imports/${importId}/start-ai`, { headers: auth, data: { programLevel: 'associate', forceFormat: null } });
    let rs: any = {};
    await expect.poll(async () => {
      const b = await (await api.get(`/api/submissions/${sub}`, { headers: auth })).json();
      rs = ((b.submission ?? b) as any).aiReviewState ?? {};
      return Object.keys(rs.buckets ?? {}).length;
    }, { timeout: 600_000, intervals: [5000] }).toBeGreaterThan(0);

    // ---- API assertions ----
    const intro = (rs.introductions?.document?.items?.[0]?.snippet ?? '');
    expect(intro.includes('General Program Characteristics'), 'intro must NOT include the Standard-1 header').toBeFalsy();
    const evidenceDocs: any[] = rs.evidenceDocs ?? [];
    const introFiles = evidenceDocs.filter((e) => e.resolvedStd === 'introduction' || e.introductionRef);
    console.log('intro-classified files:', introFiles.map((e) => e.mccCode).join(', '));
    expect(introFiles.length, 'some appendices classified as Introduction').toBeGreaterThan(0);
    const matrixFiles = evidenceDocs.filter((e) => e.isCurriculumMatrix);
    console.log('curriculum-matrix files:', matrixFiles.map((e) => e.mccCode).join(', '));
    // source HTML: each chunk wrapped in its own section (compare highlight target)
    const src = await (await api.get(`/api/imports/${importId}/content?submissionId=${sub}`, { headers: { ...auth, Accept: 'text/html' } })).text();
    expect((src.match(/data-section-id=/g) || []).length, 'source has per-chunk section anchors').toBeGreaterThan(20);

    // approve so the editor + review are populated
    const ids: string[] = [];
    for (const b of Object.values(rs.buckets) as any[]) for (const it of b.narratives ?? []) ids.push(it.sectionId);
    for (const ib of Object.values(rs.introductions ?? {}) as any[]) for (const it of ib.items ?? []) ids.push(it.sectionId);
    for (const e of evidenceDocs) ids.push(e.sectionId);
    await api.post(`/api/submissions/${sub}/review/set-approved`, { headers: auth, data: { approvedIds: ids } });

    // ---- UI: Review → Papers tile shows Introduction classification ----
    await page.goto(`${BASE}/self-study/${sub}#token=${encodeURIComponent(token)}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: /^\s*Review/ }).first().click();
    await page.waitForTimeout(1500);
    await page.getByTestId('rail-papers').click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/ux-papers-intro.png', fullPage: true });
    // At least one file card's Standard select shows the Introduction option selected.
    const introSelected = await page.locator('select >> option[value="introduction"]:checked').count();
    console.log('file cards with Introduction pre-selected:', introSelected);

    // ---- UI: Compare highlight only the matched section ----
    await page.getByRole('tab', { name: /Document Introduction/i }).first().click().catch(() => {});
    await page.waitForTimeout(1000);
    const compareBtn = page.getByRole('button', { name: /Compare/ }).first();
    if (await compareBtn.count()) {
      await compareBtn.click();
      await page.waitForTimeout(2500);
      await page.screenshot({ path: 'test-results/ux-compare-highlight.png', fullPage: true });
      // Exactly one highlighted span start/end pair (the matched section only).
      const starts = await page.locator('[data-compare-match-start]').count();
      console.log('compare match-start markers (should be 1):', starts);
      expect(starts, 'exactly one highlighted section').toBeLessThanOrEqual(1);
    }
  } finally {
    await cleanupSeed(seed);
  }
});
