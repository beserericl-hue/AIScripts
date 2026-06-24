/**
 * Tier 1 — Review "Compare" editing (CR-032 successor).
 *
 * Editing now happens in a full-screen Compare overlay opened from a card's
 * "Compare" button: a big side-by-side with the editable imported content on
 * the left and the source document on the right. Rich format (links, images,
 * tables) renders in BOTH the card and the editor.
 *
 * Verifies: the card renders the hyperlink (URLs visible in the middle pane);
 * "Compare" opens the overlay with the editor + source pane; the editor shows
 * the link + bold; editing preserves the rich HTML; Save persists it (the
 * server htmlSnippet still carries the href); the overlay closes; Cancel does
 * NOT break the layout; the edit survives a hard refresh.
 */
import { test, expect } from '@playwright/test';
import {
  seedFixture,
  cleanupSeed,
  loginAsSeededViaSso,
  gotoReviewStep,
  type SeedResult
} from '../helpers/seed';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

test.describe('Review — Compare overlay editing', () => {
  let seed: SeedResult | undefined;

  test.beforeEach(async () => {
    seed = await seedFixture('wizard_review_minimal');
  });
  test.afterEach(async () => {
    await cleanupSeed(seed);
  });

  test('card shows URLs; Compare opens side-by-side; edit persists rich HTML', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsSeededViaSso(page, seed!);
    await gotoReviewStep(page, seed!);

    // Dismiss any onboarding tour that auto-starts on the review surface — its
    // overlay would intercept clicks on the cards.
    for (let i = 0; i < 4; i++) {
      const skip = page.getByTestId('tour-tooltip-skip');
      if (await skip.isVisible().catch(() => false)) {
        await skip.click().catch(() => {});
        await page.waitForTimeout(300);
      } else {
        break;
      }
    }

    // URLs are visible in the MIDDLE pane: the card renders the rich htmlSnippet,
    // so the hyperlink shows (not flattened to plain text).
    await expect(
      page.locator('a[href="https://e2e.test/handbook"]').first()
    ).toBeVisible({ timeout: 10_000 });

    // Open the Compare overlay from the card's "Compare" button.
    await page.getByRole('button', { name: /^compare$/i }).first().click();
    const overlay = page.getByTestId('compare-overlay');
    await expect(overlay).toBeVisible({ timeout: 5000 });

    // Side-by-side: editable imported content (left) + source document (right).
    const editor = page.getByTestId('compare-editor');
    await expect(editor).toBeVisible();
    await expect(page.getByTestId('compare-source-pane')).toBeVisible();
    // The editor renders the faithful HTML: hyperlink + bold survive.
    await expect(editor.locator('a[href="https://e2e.test/handbook"]')).toBeVisible();
    await expect(editor.locator('strong')).toBeVisible();

    // APPEND text (don't replace) so the link survives the edit.
    await editor.click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type(' — Compare edit appended.');

    // Save (DOM click — Playwright's stability check flaps on a focused
    // contentEditable). The overlay closes on save.
    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="compare-save"]') as HTMLButtonElement | null;
      el?.click();
    });
    await expect(overlay).toHaveCount(0, { timeout: 5000 });

    // "edited" badge appears; autosave flushes to the server.
    await expect(page.locator('text=/edited/i').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('review-save-state')).toHaveAttribute(
      'data-state',
      'saved',
      { timeout: 15_000 }
    );

    // The persisted htmlSnippet is rich HTML — still carries the hyperlink.
    const reviewState = await page.evaluate(async ({ base, subId }) => {
      let token = '';
      try {
        token = JSON.parse(localStorage.getItem('auth-storage') || '{}')?.state?.token || '';
      } catch {
        token = '';
      }
      const r = await fetch(`${base}/api/submissions/${subId}/review`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include'
      });
      return r.ok ? r.json() : null;
    }, { base: BASE_URL, subId: seed!.submissionId });

    expect(reviewState?.aiReviewState?.buckets, 'review state fetched').toBeTruthy();
    const all: any[] = [];
    for (const b of Object.values(reviewState.aiReviewState.buckets) as any[]) {
      all.push(...(b.narratives || []));
    }
    const edited = all.find((i) => i.sectionId === 'seed-narr-001');
    expect(edited).toBeTruthy();
    expect(edited.editedAt).toBeTruthy();
    expect(String(edited.htmlSnippet || '')).toContain('href="https://e2e.test/handbook"');
    expect(String(edited.snippet || '')).toContain('Compare edit appended');

    // Cancel must NOT break the layout: re-open, Cancel, and confirm the
    // review pane (the spec rail) is still intact and the overlay is gone.
    await page.getByRole('button', { name: /^compare$/i }).first().click();
    await expect(page.getByTestId('compare-overlay')).toBeVisible();
    await page.getByRole('button', { name: /^cancel$/i }).first().click();
    await expect(page.getByTestId('compare-overlay')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /^Review$/i })).toBeVisible();
    await expect(page.locator('a[href="https://e2e.test/handbook"]').first()).toBeVisible();

    // Hard refresh — the edit persists (server, not browser-only).
    await page.reload({ waitUntil: 'load' });
    await gotoReviewStep(page, seed!);
    await expect(page.locator('text=/edited/i').first()).toBeVisible({ timeout: 10000 });
  });
});
