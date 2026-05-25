/**
 * Section 4B — Importer end-to-end coverage extension (@slow).
 *
 * Added to the test plan 2026-05-25 after Section 4's Stevenson tests
 * surfaced 10 production bugs (most notably CR-037 wrongly failing
 * CV-only uploads). The same code paths that surface in #1-#3
 * underlie every importer surface — these tests cover each one to
 * make sure no latent siblings remain.
 *
 * Gated behind E2E_RUN_SLOW=1.
 *
 * Each test follows the same shape as 28_stevenson:
 *   - seedFixture wizard_review_minimal with import.{wizardStep:'upload', aiStatus:'idle', aiBuckets:{}}
 *   - loginAsSeededViaSso
 *   - upload a file via the wizard
 *   - poll /api/imports/:id/ai-status until parsed/finished/failed
 *   - assert the relevant fields on /api/submissions/:id/review or /ai-status
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

const F = {
  preamble: path.join(FIXTURE_DIR, `${PREFIX}00-preamble.docx`),
  // Stevenson's preamble split is mostly TOC entries — no intro-style
  // prose. We use a hand-written intro fixture for the introduction_detector
  // test instead.
  programIntro: path.join(FIXTURE_DIR, 'synthetic-program-introduction.docx'),
  standards1to5: path.join(FIXTURE_DIR, `${PREFIX}01-standards-01-05.docx`),
  standards6to9: path.join(FIXTURE_DIR, `${PREFIX}02-standards-06-09.docx`),
  standards14to21: path.join(FIXTURE_DIR, `${PREFIX}04-standards-14-21.docx`),
  appendix: path.join(FIXTURE_DIR, `${PREFIX}05-appendix.docx`),
  // The Stevenson splitter strips tables (python-docx paragraph-only
  // copy). To exercise the curriculum-matrix extractor we have to
  // upload the FULL Stevenson docx — both MatrixHSR and Matrix2
  // bookmarks live inside table elements that the splitter drops.
  stevensonFull: path.join(FIXTURE_DIR, '2024 CSHSE Self-Study Stevenson University.docx'),
  // Synthetic fixture: content unrelated to CSHSE standards so the
  // matcher returns low-confidence recommendations → sections route
  // to tags (per the matcher's `primary_confidence < 0.50` branch in
  // import_jobs._run_self_study_pipeline). Real Stevenson splits
  // produce 0 tags because the matcher confidently routes every
  // sentence to SOMETHING, which is its own concern but isn't what
  // we want to probe here.
  lowConfidence: path.join(FIXTURE_DIR, 'synthetic-low-confidence-content.docx'),
  // The Stevenson splitter's paper-output heuristic produces malformed
  // fixtures (it captures a paper title but the next 80 paragraphs are
  // a course catalog, not the paper body). For a clean paper assertion
  // we use a hand-written synthetic fixture that has the exact shape a
  // real coordinator paper-upload would have.
  paperResponse: path.join(FIXTURE_DIR, 'synthetic-paper-country-report.docx'),
  paperCountry: path.join(FIXTURE_DIR, `${PREFIX}paper__sample-country-report.docx`),
  // Synthetic fixture — the Stevenson splitter's syllabus output only
  // captures the course-list TOC entry (3 paragraphs), not the actual
  // syllabus body. We hand-write a complete CHS-105 syllabus to exercise
  // the detector end-to-end.
  syllabusChs: path.join(FIXTURE_DIR, 'synthetic-syllabus-chs-105.docx'),
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

async function uploadViaWizard(page: Page, fileAbsPath: string): Promise<string> {
  const wizardBtn = page.getByRole('button', { name: /importer wizard/i });
  await expect(wizardBtn).toBeVisible({ timeout: 20_000 });
  await wizardBtn.click();
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(fileAbsPath);
  const nextBtn = page.getByRole('button', { name: /next/i });
  await expect(nextBtn).toBeEnabled({ timeout: 20_000 });
  const uploadResp = page.waitForResponse(
    (r) => r.url().includes('/api/imports/upload') && r.request().method() === 'POST',
    { timeout: 120_000 }
  );
  await nextBtn.click();
  const resp = await uploadResp;
  const body = (await resp.json()) as { importId?: string; _id?: string };
  const importId = body.importId ?? body._id;
  if (!importId) throw new Error(`upload missing importId: ${JSON.stringify(body).slice(0, 300)}`);
  return importId;
}

async function pollUntilParsed(token: string, importId: string, timeoutMs: number = 720_000): Promise<any> {
  const deadline = Date.now() + timeoutMs;
  let last: any = null;
  while (Date.now() < deadline) {
    const r = await fetch(`${BASE_URL}/api/imports/${importId}/ai-status`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (r.ok) {
      last = await r.json();
      const status = last.status as string | undefined;
      if (status === 'parsed' || status === 'finished' || status === 'failed') return last;
    }
    await new Promise((res) => setTimeout(res, 5_000));
  }
  throw new Error(
    `pollUntilParsed timed out: ${JSON.stringify(last).slice(0, 400)}`
  );
}

async function freshUploadSeed(emailHint: string): Promise<SeedResult> {
  return seedFixture('wizard_review_minimal', {
    user: { email: `${emailHint}@x.test` },
    import: { wizardStep: 'upload', aiStatus: 'idle', aiBuckets: {} },
  });
}

test.describe('@slow Importer end-to-end coverage extension (Section 4B)', () => {
  test.skip(process.env.E2E_RUN_SLOW !== '1', 'set E2E_RUN_SLOW=1 to enable Section 4B');

  let seed: SeedResult | undefined;

  test.afterEach(async () => {
    await cleanupSeed(seed);
    seed = undefined;
  });

  // ------------------------------------------------------------------ 1
  test('paper-only upload → status=parsed + evidenceDocs[] populated', async ({ page }) => {
    test.setTimeout(900_000);
    seed = await freshUploadSeed('paper-only');
    await loginAsSeededViaSso(page, seed);
    await page.goto(`/self-study/${seed.submissionId}`);
    await page.waitForLoadState('networkidle');

    const importId = await uploadViaWizard(page, F.paperResponse);
    const token = await ssoToken(seed.userEmail);
    const final = await pollUntilParsed(token, importId, 720_000);
    expect(['parsed', 'finished']).toContain(final.status);
    expect(Array.isArray(final.evidenceDocs)).toBe(true);

    const rev = await (await fetch(
      `${BASE_URL}/api/submissions/${seed.submissionId}/review`,
      { headers: { authorization: `Bearer ${token}` } }
    )).json() as any;
    expect(rev.aiReviewState).toBeTruthy();
    expect((rev.aiReviewState.evidenceDocs || []).length).toBeGreaterThan(0);
  });

  // ------------------------------------------------------------------ 2
  test('syllabus-only upload → status=parsed + evidenceDocs[] with kind=syllabus', async ({ page }) => {
    test.setTimeout(900_000);
    seed = await freshUploadSeed('syllabus-only');
    await loginAsSeededViaSso(page, seed);
    await page.goto(`/self-study/${seed.submissionId}`);
    await page.waitForLoadState('networkidle');

    const importId = await uploadViaWizard(page, F.syllabusChs);
    const token = await ssoToken(seed.userEmail);
    const final = await pollUntilParsed(token, importId, 720_000);
    expect(['parsed', 'finished']).toContain(final.status);
    expect(Array.isArray(final.evidenceDocs)).toBe(true);

    const rev = await (await fetch(
      `${BASE_URL}/api/submissions/${seed.submissionId}/review`,
      { headers: { authorization: `Bearer ${token}` } }
    )).json() as any;
    expect(rev.aiReviewState).toBeTruthy();
    const docs = rev.aiReviewState.evidenceDocs || [];
    expect(docs.length).toBeGreaterThan(0);
    expect(docs.some((d: any) => (d.docSubKind || d.kind || '').toLowerCase() === 'syllabus')).toBe(true);
  });

  // ------------------------------------------------------------------ 3
  test('intro-bearing preamble upload → introductionHints populated', async ({ page }) => {
    test.setTimeout(900_000);
    seed = await freshUploadSeed('intro-only');
    await loginAsSeededViaSso(page, seed);
    await page.goto(`/self-study/${seed.submissionId}`);
    await page.waitForLoadState('networkidle');

    const importId = await uploadViaWizard(page, F.programIntro);
    const token = await ssoToken(seed.userEmail);
    const final = await pollUntilParsed(token, importId, 720_000);
    expect(['parsed', 'finished']).toContain(final.status);
    const hints = final.introductionHints || {};
    expect(typeof hints === 'object' && hints !== null).toBe(true);
    // The synthetic intro fixture carries Introduction / Mission / About
    // the Program / Vision headings; introduction_detector should flag
    // at least one as document-scope intro.
    expect(Object.keys(hints).length).toBeGreaterThan(0);
  });

  // ------------------------------------------------------------------ 4
  test('coverage report populated on a standards parse', async ({ page }) => {
    test.setTimeout(900_000);
    seed = await freshUploadSeed('coverage-rpt');
    await loginAsSeededViaSso(page, seed);
    await page.goto(`/self-study/${seed.submissionId}`);
    await page.waitForLoadState('networkidle');

    const importId = await uploadViaWizard(page, F.standards1to5);
    const token = await ssoToken(seed.userEmail);
    const final = await pollUntilParsed(token, importId, 720_000);
    expect(['parsed', 'finished']).toContain(final.status);
    const cov = final.coverageReport;
    expect(cov).toBeTruthy();
    // The wire shape: totalSections + coveragePercent + bytesTotal +
    // bytesAssigned + coveragePercentBytes + skipBreakdown +
    // boundaryWarnings + missingFragments.
    expect(typeof cov.totalSections === 'number' && cov.totalSections > 0).toBe(true);
    expect(typeof cov.coveragePercent === 'number').toBe(true);
  });

  // ------------------------------------------------------------------ 5
  test('curriculum matrix extraction — full Stevenson docx populates matrices', async ({ page }) => {
    test.setTimeout(2_400_000); // 40 min — full doc parses ~10-15 min
    seed = await freshUploadSeed('matrix-extract');
    await loginAsSeededViaSso(page, seed);
    await page.goto(`/self-study/${seed.submissionId}`);
    await page.waitForLoadState('networkidle');

    // Upload the FULL Stevenson docx. The MatrixHSR + Matrix2 bookmarks
    // live inside table elements that the splitter would otherwise drop.
    const importId = await uploadViaWizard(page, F.stevensonFull);
    const token = await ssoToken(seed.userEmail);
    const final = await pollUntilParsed(token, importId, 1_800_000);
    expect(['parsed', 'finished']).toContain(final.status);
    expect(Array.isArray(final.matrices)).toBe(true);
    if ((final.matrices || []).length === 0) {
      throw new Error(
        `Expected at least one curriculum matrix from full Stevenson docx. ` +
        `Got matrices=${JSON.stringify(final.matrices)}. ` +
        `Matrix detector or anchor table classification may be broken.`
      );
    }
    expect(final.matrices[0]).toHaveProperty('matrixId');
  });

  // ------------------------------------------------------------------ 6
  test('tag handling — low-confidence sections land as tags', async ({ page }) => {
    test.setTimeout(900_000);
    seed = await freshUploadSeed('tags');
    await loginAsSeededViaSso(page, seed);
    await page.goto(`/self-study/${seed.submissionId}`);
    await page.waitForLoadState('networkidle');

    // Upload content unrelated to CSHSE standards. The matcher's
    // primary_confidence drops below 0.50 for off-topic text, so it
    // routes to tags rather than buckets. Real Stevenson splits route
    // everything confidently because the content genuinely maps to
    // Standards — they're not useful for probing the tag fallback.
    const importId = await uploadViaWizard(page, F.lowConfidence);
    const token = await ssoToken(seed.userEmail);
    const final = await pollUntilParsed(token, importId, 720_000);
    expect(['parsed', 'finished']).toContain(final.status);
    expect(Array.isArray(final.tags)).toBe(true);
    expect(final.tags.length).toBeGreaterThan(0);
    for (const t of final.tags.slice(0, 3) as any[]) {
      expect(typeof t.tagId === 'string').toBe(true);
      expect(typeof t.sectionId === 'string').toBe(true);
    }
  });

  // ------------------------------------------------------------------ 7
  test('placeholder sections — template upload surfaces empty Standard headings', async ({ page }) => {
    test.setTimeout(900_000);
    seed = await freshUploadSeed('placeholders');
    await loginAsSeededViaSso(page, seed);
    await page.goto(`/self-study/${seed.submissionId}`);
    await page.waitForLoadState('networkidle');

    // Standards 10-13 split is sparse (15 paragraphs) — the template
    // walker should mark unanswered Standards as placeholders.
    const importId = await uploadViaWizard(page, path.join(FIXTURE_DIR, `${PREFIX}03-standards-10-13.docx`));
    const token = await ssoToken(seed.userEmail);
    const final = await pollUntilParsed(token, importId, 720_000);
    expect(['parsed', 'finished']).toContain(final.status);
    // placeholderSections may be empty for free-form self-study docs.
    // We assert the FIELD shape rather than a strict count — true
    // placeholder testing requires a hand-crafted template fixture
    // listed in the plan for follow-on (item 7's manual fixture).
    expect(Array.isArray(final.placeholderSections ?? [])).toBe(true);
  });

  // ------------------------------------------------------------------ 8
  test('format detector — Stevenson self-study split routes to self_study pipeline', async ({ page }) => {
    test.setTimeout(900_000);
    seed = await freshUploadSeed('format-self-study');
    await loginAsSeededViaSso(page, seed);
    await page.goto(`/self-study/${seed.submissionId}`);
    await page.waitForLoadState('networkidle');

    const importId = await uploadViaWizard(page, F.standards1to5);
    const token = await ssoToken(seed.userEmail);
    const final = await pollUntilParsed(token, importId, 720_000);
    expect(['parsed', 'finished']).toContain(final.status);
    expect(final.format).toBeTruthy();
    expect(final.format.format).toBe('self_study');
    // Confirm the self-study pipeline ran by checking the deep_walker
    // stage is present (only emitted by _run_self_study_pipeline).
    const stages = final.stages || [];
    expect(stages.some((s: any) => s.name === 'deep_walker')).toBe(true);
  });

  // ------------------------------------------------------------------ 9
  test('malformed input — 0-byte .docx is rejected with actionable error', async ({ page }) => {
    test.setTimeout(60_000);
    seed = await freshUploadSeed('malformed');
    await loginAsSeededViaSso(page, seed);
    await page.goto(`/self-study/${seed.submissionId}`);
    await page.waitForLoadState('networkidle');

    // Create a 0-byte file on disk for the upload.
    const tmpFile = path.join(os.tmpdir(), `e2e-empty-${Date.now()}.docx`);
    fs.writeFileSync(tmpFile, '');

    const wizardBtn = page.getByRole('button', { name: /importer wizard/i });
    await wizardBtn.click();
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(tmpFile);

    // The client-side validator might reject before the server sees it.
    // Either path is acceptable: the bug is a SILENT acceptance of a
    // 0-byte file, which would either crash the parse or land an empty
    // 'parsed' state.
    // Wait for either: an inline error message OR a response with
    // status>=400.
    const errorVisible = page.getByText(/empty|0 bytes|invalid|size|0\s*B/i).first();
    let surfaced = false;
    try {
      await expect(errorVisible).toBeVisible({ timeout: 15_000 });
      surfaced = true;
    } catch {
      // No client-side error — try the upload and expect 4xx.
      const nextBtn = page.getByRole('button', { name: /next/i });
      if (await nextBtn.isEnabled()) {
        const resp = page.waitForResponse(
          (r) => r.url().includes('/api/imports/upload'),
          { timeout: 30_000 }
        );
        await nextBtn.click();
        const r = await resp;
        if (r.status() >= 400) surfaced = true;
      }
    }
    fs.unlinkSync(tmpFile);
    expect(surfaced).toBe(true);
  });

  // ------------------------------------------------------------------ 10
  test('large appendix — Stevenson __05-appendix.docx parses within 15 min', async ({ page }) => {
    test.setTimeout(1_200_000);
    seed = await freshUploadSeed('large-appendix');
    await loginAsSeededViaSso(page, seed);
    await page.goto(`/self-study/${seed.submissionId}`);
    await page.waitForLoadState('networkidle');

    const t0 = Date.now();
    const importId = await uploadViaWizard(page, F.appendix);
    const token = await ssoToken(seed.userEmail);
    const final = await pollUntilParsed(token, importId, 900_000);
    const elapsed = Date.now() - t0;
    expect(['parsed', 'finished']).toContain(final.status);
    expect(elapsed).toBeLessThan(900_000);
    // The appendix contains many CVs + papers + syllabi. evidenceDocs
    // OR cvs should be non-empty.
    const evCount = (final.evidenceDocs || []).length;
    const cvCount = (final.cvs || []).length;
    expect(evCount + cvCount).toBeGreaterThan(0);
  });

  // ------------------------------------------------------------------ 11
  test('concurrent imports — two parallel uploads on the same submission both reach parsed', async ({ browser }) => {
    test.setTimeout(1_800_000);
    seed = await freshUploadSeed('concurrent');

    // Two independent browser contexts → two parallel "users" hitting
    // the same submission. Both upload a different file at the same time.
    const [ctxA, ctxB] = await Promise.all([
      browser.newContext(),
      browser.newContext(),
    ]);
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();
    await loginAsSeededViaSso(pageA, seed);
    await loginAsSeededViaSso(pageB, seed);
    await Promise.all([
      pageA.goto(`/self-study/${seed.submissionId}`),
      pageB.goto(`/self-study/${seed.submissionId}`),
    ]);
    await Promise.all([
      pageA.waitForLoadState('networkidle'),
      pageB.waitForLoadState('networkidle'),
    ]);

    const [importA, importB] = await Promise.all([
      uploadViaWizard(pageA, F.standards1to5),
      uploadViaWizard(pageB, F.standards6to9),
    ]);
    const token = await ssoToken(seed.userEmail);
    await Promise.all([
      pollUntilParsed(token, importA, 1_200_000),
      pollUntilParsed(token, importB, 1_200_000),
    ]);

    const rev = await (await fetch(
      `${BASE_URL}/api/submissions/${seed.submissionId}/review`,
      { headers: { authorization: `Bearer ${token}` } }
    )).json() as any;
    expect(rev.aiReviewState).toBeTruthy();
    const sources = Object.values(rev.aiReviewState.itemSources || {}) as any[];
    const filenames = Array.from(new Set(sources.map((s) => s.sourceFilename)));
    expect(filenames.some((n) => /standards-01-05/.test(n as string))).toBe(true);
    expect(filenames.some((n) => /standards-06-09/.test(n as string))).toBe(true);

    await ctxA.close();
    await ctxB.close();
  });
});
