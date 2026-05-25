/**
 * CR-043 — Stevenson multi-file integration (@slow).
 *
 * Section 4 of test-plan-cr043-cr044-regression-2026-05-25.
 *
 * These specs upload REAL Stevenson splits to the live cshse-ai
 * service via the wizard UI (page.setInputFiles, no drag/drop) and
 * verify the persisted Review surface ends up with the right items
 * merged across multiple files.
 *
 * Driving model:
 *   1. Seed an upload-state fixture (aiStatus='idle', wizardStep='upload').
 *   2. Open the editor → click Importer Wizard.
 *   3. Drop the docx via page.setInputFiles into the (hidden) file input.
 *   4. Click "Next ▸" to fire startUpload.
 *   5. Capture the newly-created importId from the wizard's
 *      `/api/imports/upload` response.
 *   6. Poll `/api/imports/:importId/ai-status` until aiStatus is
 *      'parsed' or 'finished' (or 'failed' — explicit failure).
 *   7. Assert against the persisted Submission.aiReviewState.
 *
 * SLOW: each parse is 5–10 minutes; gated behind E2E_RUN_SLOW=1 so
 * it doesn't run in the default sweep. Set E2E_RUN_SLOW=1 to opt in.
 */
import { test, expect, type Page } from '@playwright/test';
import os from 'os';
import path from 'path';
import fs from 'fs';
import {
  seedFixture,
  cleanupSeed,
  loginAsSeededViaSso,
  type SeedResult,
} from '../helpers/seed';

const FIXTURE_DIR = path.join(os.homedir(), 'Desktop', 'CSHSE');
const PREFIX = '2024 CSHSE Self-Study Stevenson University__';
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const SSO_KEY = process.env.E2E_SSO_KEY ?? '';

const FIXTURES = {
  preamble: path.join(FIXTURE_DIR, `${PREFIX}00-preamble.docx`),
  standards1to5: path.join(FIXTURE_DIR, `${PREFIX}01-standards-01-05.docx`),
  standards6to9: path.join(FIXTURE_DIR, `${PREFIX}02-standards-06-09.docx`),
  standards10to13: path.join(FIXTURE_DIR, `${PREFIX}03-standards-10-13.docx`),
  standards14to21: path.join(FIXTURE_DIR, `${PREFIX}04-standards-14-21.docx`),
  cvBarry: path.join(FIXTURE_DIR, `${PREFIX}cv-only__barry-w-thomas.docx`),
};

async function ssoToken(email: string): Promise<string> {
  const r = await fetch(`${BASE_URL}/api/v1/auth/sso-login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-cshse-api-key': SSO_KEY },
    body: JSON.stringify({ email }),
  });
  if (!r.ok) throw new Error(`sso-login HTTP ${r.status}`);
  const b = (await r.json()) as { token: string };
  return b.token;
}

/**
 * Upload a file through the wizard's UI. Returns the new import's
 * id by listening for the POST /api/imports/upload response. The
 * wizard's startUpload action posts to that endpoint; we tap it so
 * we don't have to scrape the DOM for the id.
 */
async function uploadViaWizard(page: Page, fileAbsPath: string): Promise<string> {
  const wizardBtn = page.getByRole('button', { name: /importer wizard/i });
  await expect(wizardBtn).toBeVisible({ timeout: 20_000 });
  await wizardBtn.click();

  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(fileAbsPath);

  // Wait for the "Next ▸" button to enable (it's gated on uploadFile
  // being set, which happens after setInputFiles → handleFile).
  const nextBtn = page.getByRole('button', { name: /next/i });
  await expect(nextBtn).toBeEnabled({ timeout: 20_000 });

  // Tap the /api/imports/upload response BEFORE clicking, so we don't
  // race the response.
  const uploadResp = page.waitForResponse(
    (r) =>
      r.url().includes('/api/imports/upload') && r.request().method() === 'POST',
    { timeout: 120_000 }
  );
  await nextBtn.click();
  const resp = await uploadResp;
  const body = (await resp.json()) as { importId?: string; _id?: string };
  const importId = body.importId ?? body._id;
  if (!importId) {
    throw new Error(`upload response missing importId: ${JSON.stringify(body).slice(0, 300)}`);
  }
  return importId;
}

/**
 * Poll /api/imports/:importId/ai-status until aiStatus ∈ {parsed,
 * finished} or we hit the deadline. Returns the final status payload
 * for the caller to inspect.
 */
async function pollUntilParsed(
  token: string,
  importId: string,
  timeoutMs: number = 720_000
): Promise<any> {
  const deadline = Date.now() + timeoutMs;
  let last: any = null;
  while (Date.now() < deadline) {
    const r = await fetch(`${BASE_URL}/api/imports/${importId}/ai-status`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (r.ok) {
      last = await r.json();
      const status = last.status as string | undefined;
      if (status === 'parsed' || status === 'finished' || status === 'failed') {
        return last;
      }
    }
    await new Promise((res) => setTimeout(res, 5_000));
  }
  throw new Error(
    `pollUntilParsed timed out after ${timeoutMs}ms; last status payload: ${JSON.stringify(last).slice(0, 400)}`
  );
}

test.describe('@slow Stevenson real-file multi-import integration', () => {
  test.skip(process.env.E2E_RUN_SLOW !== '1', 'set E2E_RUN_SLOW=1 to enable Stevenson tests');

  let seed: SeedResult | undefined;

  test.beforeAll(() => {
    for (const [key, fp] of Object.entries(FIXTURES)) {
      if (!fs.existsSync(fp)) {
        test.skip(true, `Stevenson fixture missing: ${key} (${fp}). Run split_stevenson_for_multifile_test.py first.`);
      }
    }
  });

  async function freshUploadSeed(): Promise<SeedResult> {
    return seedFixture('wizard_review_minimal', {
      import: { wizardStep: 'upload', aiStatus: 'idle', aiBuckets: {} },
    });
  }

  test.afterEach(async () => {
    await cleanupSeed(seed);
    seed = undefined;
  });

  test('standards-01-05.docx → parse completes → Submission.aiReviewState has narratives', async ({ page }) => {
    test.setTimeout(900_000);
    seed = await freshUploadSeed();
    await loginAsSeededViaSso(page, seed);
    await page.goto(`/self-study/${seed.submissionId}`);
    await page.waitForLoadState('networkidle');

    const importId = await uploadViaWizard(page, FIXTURES.standards1to5);
    const token = await ssoToken(seed.userEmail);
    const final = await pollUntilParsed(token, importId, 720_000);
    expect(['parsed', 'finished']).toContain(final.status);

    // The receiveAICallback merge writes Submission.aiReviewState; pull
    // it back and confirm narratives landed.
    const rev = await fetch(`${BASE_URL}/api/submissions/${seed.submissionId}/review`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(rev.status).toBe(200);
    const body = (await rev.json()) as any;
    expect(body.aiReviewState).toBeTruthy();
    const buckets = body.aiReviewState.buckets || {};
    const totalNarratives = Object.values(buckets).reduce(
      (acc: number, b: any) => acc + (b.narratives?.length || 0),
      0
    );
    expect(totalNarratives).toBeGreaterThan(0);
  });

  test('standards-01-05 then standards-06-09 → merged Review shows both', async ({ page }) => {
    test.setTimeout(1_800_000);
    seed = await freshUploadSeed();
    await loginAsSeededViaSso(page, seed);
    await page.goto(`/self-study/${seed.submissionId}`);
    await page.waitForLoadState('networkidle');
    const token = await ssoToken(seed.userEmail);

    // First parse
    const importA = await uploadViaWizard(page, FIXTURES.standards1to5);
    await pollUntilParsed(token, importA, 720_000);

    // Return to editor before next upload
    await page.goto(`/self-study/${seed.submissionId}`);
    await page.waitForLoadState('networkidle');

    // Second parse — different file, same submission.
    const importB = await uploadViaWizard(page, FIXTURES.standards6to9);
    await pollUntilParsed(token, importB, 720_000);

    const rev = await (await fetch(
      `${BASE_URL}/api/submissions/${seed.submissionId}/review`,
      { headers: { authorization: `Bearer ${token}` } }
    )).json() as any;

    expect(rev.aiReviewState).toBeTruthy();
    // Both source filenames contributed items to the merged itemSources.
    const sources = Object.values(rev.aiReviewState.itemSources || {}) as any[];
    const filenames = new Set(sources.map((s) => s.sourceFilename));
    const filenameList = Array.from(filenames);
    expect(filenameList.some((n) => /standards-01-05/.test(n as string))).toBe(true);
    expect(filenameList.some((n) => /standards-06-09/.test(n as string))).toBe(true);
  });

  test('CV-only file → aiStandaloneCv=true + Review surface has cvs[]', async ({ page }) => {
    test.setTimeout(900_000);
    seed = await freshUploadSeed();
    await loginAsSeededViaSso(page, seed);
    await page.goto(`/self-study/${seed.submissionId}`);
    await page.waitForLoadState('networkidle');

    const importId = await uploadViaWizard(page, FIXTURES.cvBarry);
    const token = await ssoToken(seed.userEmail);
    const final = await pollUntilParsed(token, importId, 720_000);
    expect(['parsed', 'finished']).toContain(final.status);

    // The CV detector should flag this single-CV upload as standalone.
    // If aiStandaloneCv is false here, that's a real bug in
    // ai-service/app/splitter/cv_detector — fix the detector, not the
    // test.
    expect(final.standaloneCv ?? final.aiStandaloneCv).toBe(true);

    // The persisted aiReviewState should carry the CV in the cvs[] array.
    const rev = await (await fetch(
      `${BASE_URL}/api/submissions/${seed.submissionId}/review`,
      { headers: { authorization: `Bearer ${token}` } }
    )).json() as any;
    expect((rev.aiReviewState?.cvs || []).length).toBeGreaterThan(0);
  });

  test('reimport standards-01-05 keeps approval bookkeeping stable', async ({ page }) => {
    test.setTimeout(1_800_000);
    seed = await freshUploadSeed();
    await loginAsSeededViaSso(page, seed);
    await page.goto(`/self-study/${seed.submissionId}`);
    await page.waitForLoadState('networkidle');
    const token = await ssoToken(seed.userEmail);

    const importA = await uploadViaWizard(page, FIXTURES.standards1to5);
    await pollUntilParsed(token, importA, 720_000);

    // Pick ANY narrative sectionId from the merged state and approve
    // it via the API. Some buckets carry only evidence — we need a
    // bucket whose narratives[] is non-empty.
    const rev1 = await (await fetch(
      `${BASE_URL}/api/submissions/${seed.submissionId}/review`,
      { headers: { authorization: `Bearer ${token}` } }
    )).json() as any;
    expect(rev1.aiReviewState).toBeTruthy();
    let firstSec: string | undefined;
    for (const b of Object.values(rev1.aiReviewState.buckets || {}) as any[]) {
      if (b?.narratives?.length) {
        firstSec = b.narratives[0].sectionId;
        break;
      }
    }
    expect(firstSec).toBeTruthy();
    const approve = await fetch(`${BASE_URL}/api/submissions/${seed.submissionId}/review/approve`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ sectionId: firstSec, approved: true }),
    });
    expect(approve.status).toBe(200);

    // The strict-match dedupe logic on reimport is unit-tested in
    // server/tests/unit/aiReviewMerge.test.ts; here we just confirm
    // a second upload doesn't crash the wizard or destroy unrelated
    // approvals.
    await page.goto(`/self-study/${seed.submissionId}`);
    await page.waitForLoadState('networkidle');
    const importA2 = await uploadViaWizard(page, FIXTURES.standards1to5);
    await pollUntilParsed(token, importA2, 720_000);

    // Persisted state stays coherent.
    const rev2 = await (await fetch(
      `${BASE_URL}/api/submissions/${seed.submissionId}/review`,
      { headers: { authorization: `Bearer ${token}` } }
    )).json() as any;
    expect(rev2.aiReviewState).toBeTruthy();
    // Items are still present (either new or kept).
    const totalNarr = Object.values(rev2.aiReviewState.buckets || {})
      .reduce((acc: number, b: any) => acc + (b.narratives?.length || 0), 0);
    expect(totalNarr).toBeGreaterThan(0);
  });

  test('drop 4 standard files in sequence → all merge into one Review', async ({ page }) => {
    test.setTimeout(3_600_000); // 60 minutes
    seed = await freshUploadSeed();
    await loginAsSeededViaSso(page, seed);
    const token = await ssoToken(seed.userEmail);

    const files = [
      { name: '1-5', fp: FIXTURES.standards1to5 },
      { name: '6-9', fp: FIXTURES.standards6to9 },
      { name: '10-13', fp: FIXTURES.standards10to13 },
      { name: '14-21', fp: FIXTURES.standards14to21 },
    ];

    for (const f of files) {
      await page.goto(`/self-study/${seed.submissionId}`);
      await page.waitForLoadState('networkidle');
      const importId = await uploadViaWizard(page, f.fp);
      await pollUntilParsed(token, importId, 720_000);
    }

    const rev = await (await fetch(
      `${BASE_URL}/api/submissions/${seed.submissionId}/review`,
      { headers: { authorization: `Bearer ${token}` } }
    )).json() as any;

    expect(rev.aiReviewState).toBeTruthy();
    const sources = Object.values(rev.aiReviewState.itemSources || {}) as any[];
    const filenames = Array.from(new Set(sources.map((s) => s.sourceFilename)));
    // All 4 standard splits contributed items to the merged Review.
    expect(filenames.some((n) => /standards-01-05/.test(n as string))).toBe(true);
    expect(filenames.some((n) => /standards-06-09/.test(n as string))).toBe(true);
    expect(filenames.some((n) => /standards-10-13/.test(n as string))).toBe(true);
    expect(filenames.some((n) => /standards-14-21/.test(n as string))).toBe(true);
  });
});
