import { test, expect, request } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const BASE = process.env.E2E_BASE_URL ?? 'https://cshse-develop.up.railway.app';
const SU_EMAIL = process.env.SU_EMAIL ?? 'eric@agileadtesting.com';
const SU_PASSWORD = process.env.SU_PASSWORD ?? 'Fr332bafami!y';
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const FILES = path.resolve(__dirname, '../fixtures/files');
const SHOTS = path.resolve(__dirname, '../report/verify');
async function j(p: Promise<any>) { return (await p).json(); }

test('SU opens the Parser Train review panel and sees parsed sections', async ({ page }) => {
  test.setTimeout(700_000);
  fs.mkdirSync(SHOTS, { recursive: true });
  const api = await request.newContext({ baseURL: BASE });
  const token = (await j(api.post('/api/auth/login', { data: { email: SU_EMAIL, password: SU_PASSWORD } }))).token;
  const auth = { Authorization: `Bearer ${token}` };
  const run = await j(api.post('/api/parser-train', { headers: auth, data: { programLevel: 'bachelors' } }));
  const pc = { ...auth, 'X-Impersonated-User-Id': run.pcUserId, 'X-Impersonated-Role': 'program_coordinator' };
  const up = await j(api.post('/api/imports/upload', { headers: pc, multipart: { submissionId: run.submissionId, file: { name: 'k.docx', mimeType: DOCX, buffer: fs.readFileSync(path.join(FILES, 'kennesaw.docx')) } } }));
  await api.post(`/api/imports/${up.importId}/start-ai`, { headers: pc, data: { programLevel: 'bachelors', forceFormat: null } });
  await expect.poll(async () => (await j(api.get(`/api/imports/${up.importId}/ai-status`, { headers: pc }))).status, { timeout: 500_000, intervals: [5000] }).toMatch(/^(parsed|completed)$/);
  await expect.poll(async () => {
    const b = await j(api.get(`/api/submissions/${run.submissionId}`, { headers: auth }));
    return Object.keys((b.submission ?? b).aiReviewState?.buckets ?? {}).length;
  }, { timeout: 60_000, intervals: [3000] }).toBeGreaterThan(0);

  // open the review panel AS SUPERUSER (no PC impersonation)
  await page.goto(`${BASE}/dashboard#token=${encodeURIComponent(token)}`);
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
  await page.goto(`${BASE}/self-study/${run.submissionId}?view=review`);
  await expect(page.getByRole('complementary', { name: 'Specifications' })).toBeVisible({ timeout: 45000 });
  await page.screenshot({ path: path.join(SHOTS, 'su-review-panel.png'), fullPage: true });
  console.log('SU review panel rendered (SpecRail visible) ✓ — sub=' + run.submissionId);
});
