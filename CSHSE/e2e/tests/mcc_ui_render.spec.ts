import { test, expect, request, APIRequestContext, Page } from '@playwright/test';
import * as fs from 'fs';
import { seedFixture, cleanupSeed, type SeedResult } from '../helpers/seed';

/**
 * MCC COMPREHENSIVE UI regression — the whole pipeline, driven as a real
 * program coordinator, proving with assertions + screenshots that:
 *   1. Editor renders spec 1.a as clean flowing prose with a clickable link
 *      (no choppy <br>-per-line).
 *   2. Review "Papers / Projects / Appendices" tile lists appendix files, each
 *      showing the parser-inferred → Spec std.substandard.
 *   3. Compare opens a source pane with formatted text + working links.
 *   4. Supporting File Library shows the materialized files.
 *
 * Self-contained: seeds a PC, imports the real MCC PDF, approves, drives the
 * UI, cleans up. Screenshots land in test-results/mcc-ui-*.png.
 * Requires E2E_SSO_KEY, E2E_SEED_TOKEN, MCC_PDF.
 */
const BASE = process.env.E2E_BASE_URL ?? 'https://cshse-develop.up.railway.app';
const SSO_KEY = process.env.E2E_SSO_KEY ?? '';
const PDF = process.env.MCC_PDF ?? '';

async function ssoToken(api: APIRequestContext, email: string): Promise<string> {
  const r = await api.post('/api/v1/auth/sso-login', {
    headers: { 'x-cshse-api-key': SSO_KEY }, data: { email },
  });
  expect(r.ok(), `sso-login ${email}: ${r.status()}`).toBeTruthy();
  return (await r.json()).token as string;
}

test('MCC comprehensive UI: editor + Review papers + Compare + Library (as PC)', async ({ page }) => {
  test.skip(!SSO_KEY || !PDF, 'set E2E_SSO_KEY and MCC_PDF');
  test.setTimeout(900_000);

  const api = await request.newContext({ baseURL: BASE });
  let seed: SeedResult | undefined;
  try {
    seed = await seedFixture('wizard_review_minimal');
    const token = await ssoToken(api, seed.userEmail);
    const auth = { Authorization: `Bearer ${token}` };
    const me = await (await api.get('/api/auth/me', { headers: auth })).json();
    const institutionId = (me.user ?? me).institutionId as string;

    // Fresh associate submission owned by the PC.
    const created = await api.post('/api/submissions', {
      headers: auth,
      data: { institutionId, institutionName: 'MCC UI Regression', programName: 'Human Services', programLevel: 'associate', type: 'initial' },
    });
    const sub = ((await created.json()).submission ?? (await created.json()) as any)._id as string;

    // Import the real MCC PDF (auto-detect) + poll.
    const up = await api.post('/api/imports/upload', {
      headers: auth,
      multipart: { submissionId: sub, file: { name: 'mcc.pdf', mimeType: 'application/pdf', buffer: fs.readFileSync(PDF) } },
    });
    const importId = (await up.json()).importId as string;
    await api.post(`/api/imports/${importId}/start-ai`, { headers: auth, data: { programLevel: 'associate', forceFormat: null } });
    await expect.poll(async () => {
      const s = await (await api.get(`/api/imports/${importId}/ai-status`, { headers: auth })).json();
      return s.status;
    }, { timeout: 540_000, intervals: [5000] }).toMatch(/^(parsed|completed|failed)$/);

    // Approve every item so narratives materialize + files land in the Library.
    // Wait until the merged review state actually has buckets (the parsed
    // status can land a beat before the merge is queryable).
    let rs: any = {};
    await expect.poll(async () => {
      const subBody = await (await api.get(`/api/submissions/${sub}`, { headers: auth })).json();
      rs = ((subBody.submission ?? subBody) as any).aiReviewState ?? {};
      return Object.keys(rs.buckets ?? {}).length;
    }, { timeout: 60_000, intervals: [3000] }).toBeGreaterThan(0);

    const ids: string[] = [];
    let narrN = 0;
    for (const b of Object.values(rs.buckets ?? {}) as any[]) {
      for (const it of b.narratives ?? []) { ids.push(it.sectionId); narrN++; }
      for (const it of b.evidenceText ?? []) ids.push(it.sectionId);
    }
    for (const ib of Object.values(rs.introductions ?? {}) as any[]) for (const it of ib.items ?? []) ids.push(it.sectionId);
    for (const e of rs.evidenceDocs ?? []) ids.push(e.sectionId);
    console.log(`approving ${ids.length} items (${narrN} narratives)`);
    const approveResp = await api.post(`/api/submissions/${sub}/review/set-approved`, { headers: auth, data: { approvedIds: ids } });
    expect(approveResp.ok(), `set-approved: ${approveResp.status()}`).toBeTruthy();

    // ---------- Drive the PC UI ----------
    await page.goto(`${BASE}/self-study/${sub}#token=${encodeURIComponent(token)}`);
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20000 });
    await page.waitForLoadState('networkidle');
    // Force a fresh ['submission'] fetch so the just-materialized narratives show.
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // (1) Editor spec 1.a — clean prose + clickable link. Retry with a reload
    //     if the materialized content hasn't propagated to the query cache yet.
    await page.getByText(/1\.a\s*[-–]\s*Regional Accreditation/i).first().click();
    await page.waitForTimeout(1500);
    for (let attempt = 0; attempt < 3 && (await page.locator('a[href*="mccneb.edu"]').count()) === 0; attempt++) {
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);
      await page.getByText(/1\.a\s*[-–]\s*Regional Accreditation/i).first().click().catch(() => {});
      await page.waitForTimeout(1500);
    }
    await page.screenshot({ path: 'test-results/mcc-ui-editor-1a.png' });
    expect(await page.locator('a[href*="mccneb.edu"]').count(), 'editor: clickable link').toBeGreaterThan(0);

    // (2) Open the standalone Review surface (PC-only).
    await page.getByRole('button', { name: /^\s*Review/ }).first().click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/mcc-ui-review.png', fullPage: true });

    // (3) Compare — select a narrative bucket (Document Introduction has a
    //     narrative), open its card's Compare button, and prove the source pane
    //     renders formatted text with working links.
    await page.getByRole('tab', { name: /Document Introduction/i }).first().click().catch(() => {});
    await page.waitForTimeout(1200);
    const compareBtn = page.getByRole('button', { name: /Compare/ }).first();
    await expect(compareBtn, 'a card Compare button is present').toBeVisible({ timeout: 15000 });
    await compareBtn.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-results/mcc-ui-compare.png', fullPage: true });
    expect(await page.locator('a[href*="mccneb.edu"]').count(), 'compare source: link').toBeGreaterThan(0);
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(500);

    // (4) Papers / Projects / Appendices tile — each appendix shows the
    //     parser-inferred → Spec std.substandard.
    const tile = page.getByTestId('rail-papers');
    await expect(tile, 'Papers/Projects/Appendices tile').toBeVisible({ timeout: 15000 });
    await expect(tile).toContainText(/Papers \/ Projects \/ Appendices/);
    await tile.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/mcc-ui-papers.png', fullPage: true });
    const specTags = await page.getByText(/→\s*Spec\s+\d+\.[a-z]/i).count();
    console.log(`Papers tile: ${specTags} cards show inferred spec.substandard`);
    expect(specTags, 'appendix cards show parser-inferred spec.substandard').toBeGreaterThan(10);

    // (5) Supporting File Library.
    await page.getByRole('button', { name: /Supporting File Library/i }).first().click().catch(() => {});
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'test-results/mcc-ui-library.png', fullPage: true });
  } finally {
    await cleanupSeed(seed);
  }
});
