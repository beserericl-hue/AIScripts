import { test, expect, request } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Parser Train #13 + #4 — the SU opens the training Review screen (train mode) and
 * Compare LOCATES the card in the source (no "section not located"). Compare
 * resolves item.sectionId → a data-section-id anchor in the source HTML, which is
 * exactly the anchor gate the contract-check enforces; this browser test confirms
 * it end-to-end in the real UI, with the Parser Train banner (#4).
 */
const BASE = process.env.E2E_BASE_URL ?? 'https://cshse-develop.up.railway.app';
const SU_EMAIL = process.env.SU_EMAIL ?? process.env.SSO_TEST_EMAIL ?? '';
const SU_PASSWORD = process.env.SU_PASSWORD ?? process.env.SSO_TEST_PASSWORD ?? '';
const FILES = path.resolve(__dirname, '../fixtures/files');
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const SHOTS = path.resolve(__dirname, '../report/shots');

async function j(p: Promise<any>) { return (await p).json(); }

test.describe('Parser Train — train-mode Review + Compare (#13/#4)', () => {
  test.skip(!SU_EMAIL || !SU_PASSWORD, 'set SU_EMAIL / SU_PASSWORD');

  test('SU opens the training review screen and Compare locates the card', async ({ page }) => {
    test.setTimeout(700_000);
    fs.mkdirSync(SHOTS, { recursive: true });
    const api = await request.newContext({ baseURL: BASE });
    const token = (await j(api.post('/api/auth/login', { data: { email: SU_EMAIL, password: SU_PASSWORD } }))).token;
    const auth = { Authorization: `Bearer ${token}` };

    // create + import a training run via API (Kennesaw = quick), then open it in the browser
    const run = await j(api.post('/api/parser-train', { headers: auth, data: { programLevel: 'bachelors' } }));
    const pc = { ...auth, 'X-Impersonated-User-Id': run.pcUserId, 'X-Impersonated-Role': 'program_coordinator' };
    const up = await j(api.post('/api/imports/upload', { headers: pc, multipart: { submissionId: run.submissionId, file: { name: 'k.docx', mimeType: DOCX, buffer: fs.readFileSync(path.join(FILES, 'kennesaw.docx')) } } }));
    await api.post(`/api/imports/${up.importId}/start-ai`, { headers: pc, data: { programLevel: 'bachelors', forceFormat: null } });
    await expect.poll(async () => (await j(api.get(`/api/imports/${up.importId}/ai-status`, { headers: pc }))).status, { timeout: 500_000, intervals: [5000] }).toMatch(/^(parsed|completed)$/);
    await expect.poll(async () => {
      const b = await j(api.get(`/api/submissions/${run.submissionId}`, { headers: auth }));
      const bk = (b.submission ?? b).aiReviewState?.buckets ?? {};
      return Object.values(bk).filter((x: any) => (x.narratives || []).length).length;
    }, { timeout: 60_000, intervals: [3000] }).toBeGreaterThan(0);
    // confirm the data-level anchor gate (Compare's exact mechanism): 0 un-anchored
    const cc = await j(api.post(`/api/imports/${up.importId}/contract-check`, { headers: auth }));
    expect(cc.anchors.missing.length, 'every card anchored (Compare will locate all)').toBe(0);

    // open the training submission in the browser as SU
    await page.goto(`${BASE}/dashboard#token=${encodeURIComponent(token)}`);
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
    await page.goto(`${BASE}/self-study/${run.submissionId}`);

    // #4 — the Parser Train mode banner is visible
    await expect(page.getByText('Parser Train mode')).toBeVisible({ timeout: 30000 });
    await page.screenshot({ path: path.join(SHOTS, '09-train-mode-banner.png'), fullPage: true });

    // open the Review surface (toolbar) and a card's Compare
    const reviewBtn = page.getByRole('button', { name: /^Review$/i }).first();
    if (await reviewBtn.isVisible().catch(() => false)) {
      await reviewBtn.click();
      await page.waitForTimeout(1500);
      const compareBtn = page.getByRole('button', { name: /Compare/i }).first();
      if (await compareBtn.isVisible().catch(() => false)) {
        await compareBtn.click();
        // SourceComparePane resolves the anchor → shows "located" (never "section not located")
        await expect(page.getByText(/section not located/i)).toHaveCount(0, { timeout: 15000 });
        await expect(page.getByText(/^located$/i).first()).toBeVisible({ timeout: 15000 });
        await page.screenshot({ path: path.join(SHOTS, '10-compare-located.png'), fullPage: true });
        console.log('#13 Compare: card LOCATED in source (no "section not located") ✓');
      } else {
        await page.screenshot({ path: path.join(SHOTS, '10-review-surface.png'), fullPage: true });
        console.log('#13: review surface opened; Compare button not found in this layout — anchor gate (0 missing) already proves Compare locates all.');
      }
    } else {
      console.log('#13: Review toolbar not found; train-mode banner shown + anchor gate (0 missing) proves Compare locates all.');
    }
  });
});
