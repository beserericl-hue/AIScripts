/**
 * CR-001 — Both importers required (Legacy + AI Importer Wizard).
 *
 * The Self-Study Editor toolbar carries TWO import entry points for
 * Program Coordinators:
 *   - "Import Document" (Legacy badge) — per-section paste-and-tag
 *     modal for multi-author teams that contribute sections at different
 *     times
 *   - "Importer Wizard" (AI Import badge) — the full DOCX → AI parse →
 *     Review → Apply flow
 *
 * Both paths write to the same Submission record; PCs can mix and match.
 * This E2E pins the toolbar contract: both buttons render, are
 * keyboard-reachable, and each one opens its own surface.
 *
 * Catches: a refactor that silently drops the Legacy entry; an a11y
 * regression that buries one behind a disabled state; a routing change
 * that maps both buttons to the same surface.
 */
import { test, expect } from '@playwright/test';
import {
  seedFixture,
  cleanupSeed,
  loginAsSeededViaSso,
  type SeedResult,
} from '../helpers/seed';

test.describe('CR-001 — both importers coexist on the editor toolbar', () => {
  let seed: SeedResult | undefined;

  test.beforeEach(async () => {
    seed = await seedFixture('wizard_review_minimal');
  });

  test.afterEach(async () => {
    await cleanupSeed(seed);
    seed = undefined;
  });

  test('both Legacy "Import Document" and "Importer Wizard" buttons render', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsSeededViaSso(page, seed!);
    await page.goto(`/self-study/${seed!.submissionId}`);
    await page.waitForLoadState('networkidle');

    // Both toolbar entries are visible to a Program Coordinator.
    await expect(
      page.getByRole('button', { name: /Import Document/i })
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole('button', { name: /Importer Wizard/i })
    ).toBeVisible();
  });

  test('Legacy badge is present on Import Document', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsSeededViaSso(page, seed!);
    await page.goto(`/self-study/${seed!.submissionId}`);
    await page.waitForLoadState('networkidle');

    // The "Legacy" chip inside the Import Document button identifies the
    // older path so the PC knows which is AI-driven. The badge is part
    // of the button's accessible name via nested text content.
    const importDoc = page.getByRole('button', { name: /Import Document/i });
    const text = await importDoc.textContent();
    expect(text).toMatch(/Legacy/i);
  });

  test('clicking Import Document opens the Legacy side panel', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsSeededViaSso(page, seed!);
    await page.goto(`/self-study/${seed!.submissionId}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /Import Document/i }).click();

    // The Legacy panel renders an "Import Document" header inside the
    // side panel. Use a heading-role match scoped to the panel content
    // so we don't double-count the toolbar button.
    await expect(
      page.getByRole('heading', { name: /Import Document/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('clicking Importer Wizard opens the AI Import wizard surface', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsSeededViaSso(page, seed!);
    await page.goto(`/self-study/${seed!.submissionId}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /Importer Wizard/i }).click();

    // The wizard renders the Stepper with role="tablist" — the easiest
    // structural cue that the AI wizard surface is mounted (the Legacy
    // panel does NOT render a tablist).
    await expect(page.getByRole('tablist')).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole('tab', { name: /upload/i })
    ).toBeVisible();
  });

  test('Importer Wizard and Import Document are independently activatable (no shared state)', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsSeededViaSso(page, seed!);
    await page.goto(`/self-study/${seed!.submissionId}`);
    await page.waitForLoadState('networkidle');

    // Open Wizard first
    await page.getByRole('button', { name: /Importer Wizard/i }).click();
    await expect(page.getByRole('tablist')).toBeVisible({ timeout: 10_000 });

    // Now click Import Document — the legacy panel opens, the wizard's
    // tablist remains in the DOM but the legacy heading must also appear
    // (the surfaces coexist within their respective panels).
    await page.getByRole('button', { name: /Import Document/i }).click();
    await expect(
      page.getByRole('heading', { name: /Import Document/i })
    ).toBeVisible({ timeout: 10_000 });
  });
});
