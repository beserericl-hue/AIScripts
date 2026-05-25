/**
 * Tier 1 — Upload step regression.
 *
 * Drives the Upload step against the deployed cshse-develop using
 * seedFixture overrides to land the wizard on Upload (status='idle',
 * wizardStep='upload', aiBuckets={}).
 *
 * The "cancel mid-upload" test is intentionally light — Playwright
 * doesn't have a deterministic way to throttle the network mid-POST
 * for a real S3 upload. We assert the dropzone reset path instead.
 */
import { test, expect } from '@playwright/test';
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
const SAMPLE_DOCX = path.join(FIXTURE_DIR, 'synthetic-program-introduction.docx');

async function freshUploadSeed(emailHint: string): Promise<SeedResult> {
  return seedFixture('wizard_review_minimal', {
    user: { email: `${emailHint}@x.test` },
    import: { wizardStep: 'upload', aiStatus: 'idle', aiBuckets: {} },
  });
}

test.describe('Upload step', () => {
  let seed: SeedResult | undefined;

  test.afterEach(async () => {
    await cleanupSeed(seed);
    seed = undefined;
  });

  test('Valid .docx advances to Parse', async ({ page }) => {
    test.setTimeout(120_000);
    seed = await freshUploadSeed('upload-valid');
    await loginAsSeededViaSso(page, seed);
    await page.goto(`/self-study/${seed.submissionId}`);
    await page.waitForLoadState('networkidle');

    // Open wizard, attach the synthetic docx, click Next.
    await page.getByRole('button', { name: /importer wizard/i }).click();
    const fileInput = page.locator('input[type="file"]').first();
    await expect(fileInput).toBeAttached({ timeout: 10_000 });
    if (!fs.existsSync(SAMPLE_DOCX)) {
      test.skip(true, `Missing fixture: ${SAMPLE_DOCX}. Re-run the splitter / synthetic generator.`);
    }
    await fileInput.setInputFiles(SAMPLE_DOCX);
    const nextBtn = page.getByRole('button', { name: /next/i });
    await expect(nextBtn).toBeEnabled({ timeout: 15_000 });
    await nextBtn.click();

    // The wizard transitions away from Upload — one of the Parse-step
    // indicators must show. ParseStep renders friendly stage names
    // (Document Reader / Reading structure / Matching to specifications).
    await expect(
      page.getByText(/Document Reader|Reading structure|Detecting format|Downloading document/i).first()
    ).toBeVisible({ timeout: 30_000 });
  });

  test('Uploading an unsupported file type surfaces a clear error', async ({ page }) => {
    test.setTimeout(60_000);
    seed = await freshUploadSeed('upload-bad-type');
    await loginAsSeededViaSso(page, seed);
    await page.goto(`/self-study/${seed.submissionId}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /importer wizard/i }).click();
    const fileInput = page.locator('input[type="file"]').first();
    await expect(fileInput).toBeAttached({ timeout: 10_000 });

    // Write a tiny .txt file and attempt to attach it.
    const tmp = path.join(os.tmpdir(), `e2e-bad-type-${Date.now()}.txt`);
    fs.writeFileSync(tmp, 'This is plain text — not a docx or pdf.');
    try {
      await fileInput.setInputFiles(tmp);
      // The UploadStep validates: 'We accept .docx (preferred) or .pdf'.
      await expect(
        page.getByText(/we accept\s*\.docx|accept .*docx|invalid|got: text/i)
      ).toBeVisible({ timeout: 10_000 });
    } finally {
      fs.unlinkSync(tmp);
    }
  });

  test('Re-attaching a file replaces the prior selection', async ({ page }) => {
    // Functional equivalent of "cancel mid-upload": before clicking Next,
    // re-attach a different file and confirm the dropzone label updates.
    // A true mid-upload cancel requires throttling the network at the
    // chromium-CDP layer, which Playwright doesn't expose cleanly and is
    // flake-prone — this is the deterministic substitute.
    test.setTimeout(60_000);
    seed = await freshUploadSeed('upload-replace');
    await loginAsSeededViaSso(page, seed);
    await page.goto(`/self-study/${seed.submissionId}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /importer wizard/i }).click();
    const fileInput = page.locator('input[type="file"]').first();
    await expect(fileInput).toBeAttached({ timeout: 10_000 });

    const tmpA = path.join(os.tmpdir(), `e2e-first-${Date.now()}.docx`);
    const tmpB = path.join(os.tmpdir(), `e2e-second-${Date.now()}.docx`);
    // python-docx-shaped minimal docx bytes are awkward; use the
    // synthetic fixture twice with different names.
    fs.copyFileSync(SAMPLE_DOCX, tmpA);
    fs.copyFileSync(SAMPLE_DOCX, tmpB);
    try {
      await fileInput.setInputFiles(tmpA);
      await expect(page.getByText(path.basename(tmpA))).toBeVisible({ timeout: 10_000 });
      await fileInput.setInputFiles(tmpB);
      await expect(page.getByText(path.basename(tmpB))).toBeVisible({ timeout: 10_000 });
    } finally {
      fs.unlinkSync(tmpA);
      fs.unlinkSync(tmpB);
    }
  });

  test('Re-entering wizard after Apply starts on Upload', async ({ page }) => {
    test.setTimeout(60_000);
    // Seed the wizard's persisted state at the END of a previous run
    // (status='applied', step='apply'). Per the CR-043 follow-on fix
    // in SelfStudyEditor.tsx, clicking 'Importer Wizard' from this state
    // must call startOver() so the next coordinator click lands on Upload.
    seed = await seedFixture('wizard_review_minimal', {
      user: { email: `upload-after-apply@x.test` },
      import: { wizardStep: 'apply', aiStatus: 'applied' },
    });
    await loginAsSeededViaSso(page, seed);
    await page.goto(`/self-study/${seed.submissionId}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /importer wizard/i }).click();
    // The Upload-step heading is the canonical Upload-screen signal.
    await expect(page.getByText(/upload your self-study document/i))
      .toBeVisible({ timeout: 15_000 });
    // The file input is present (so the coordinator can actually attach).
    await expect(page.locator('input[type="file"]').first()).toBeAttached();
  });
});
