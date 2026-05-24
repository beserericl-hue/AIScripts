/**
 * Tier 1 — Upload step regression.
 *
 * Status: SCAFFOLDED. Test bodies stubbed; flesh out per the assertion
 * targets in the comments. Requires a small ~50KB representative .docx
 * checked into e2e/fixtures/sample.docx (does not exist yet).
 */
import { test, expect } from '@playwright/test';
import { seedFixture, cleanupSeed, loginAsSeededViaSso, type SeedResult } from '../helpers/seed';

test.describe.skip('Upload step', () => {
  let seed: SeedResult | undefined;

  test.beforeEach(async () => {
    // Use the upload_clean fixture (user + empty submission, no import yet)
    seed = await seedFixture('wizard_upload_clean');
  });
  test.afterEach(async () => {
    await cleanupSeed(seed);
  });

  test('Valid .docx advances to Parse', async ({ page }) => {
    // TODO: locate file input, attach e2e/fixtures/sample.docx, click Start,
    // assert Parse step renders.
    expect(true).toBe(true);
  });

  test('Uploading a .pdf surfaces a clear error', async ({ page }) => {
    // TODO: attach a PDF, click Start, assert error banner, no crash.
    expect(true).toBe(true);
  });

  test('Cancel mid-upload returns to clean upload screen', async ({ page }) => {
    // TODO: attach large file, click cancel during upload, assert screen reset.
    expect(true).toBe(true);
  });

  test('Re-entering wizard after Apply starts on Upload', async ({ page }) => {
    // TODO: seed an applied state, navigate to wizard, assert Upload visible.
    expect(true).toBe(true);
  });
});
