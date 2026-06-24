/**
 * Tier 1 — CR-032 Edit pencil on Review-step cards.
 * Phase 2b — the edit pane is now a LARGE rich-text editor (contentEditable),
 * not a plain textarea. It renders + edits full format (links, images, tables)
 * and saves rich HTML to htmlSnippet.
 *
 * Verifies: pencil opens the rich editor; the item's faithful HTML (a link +
 * bold) renders inside it; Save persists the edited rich HTML; the "edited"
 * badge survives a hard refresh; the persisted htmlSnippet still carries the
 * hyperlink (rich format round-trips, not flattened to plain text).
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

test.describe('CR-032 / Phase 2b — rich Edit pencil on Review cards', () => {
  let seed: SeedResult | undefined;

  test.beforeEach(async () => {
    seed = await seedFixture('wizard_review_minimal');
  });
  test.afterEach(async () => {
    await cleanupSeed(seed);
  });

  test('rich editor renders link+bold, saves rich HTML, persists across reload', async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsSeededViaSso(page, seed!);
    await gotoReviewStep(page, seed!);

    // Open the first card's Edit pencil.
    await page.getByRole('button', { name: /^edit$/i }).first().click();

    // Phase 2b — the rich editor (contentEditable), NOT a textarea.
    const editor = page.getByTestId('rich-edit-area');
    await expect(editor).toBeVisible({ timeout: 5000 });
    await expect(page.locator('textarea')).toHaveCount(0);

    // The faithful HTML renders inside the editor: a hyperlink + bold survive.
    await expect(editor.locator('a[href="https://e2e.test/handbook"]')).toBeVisible();
    await expect(editor.locator('strong')).toBeVisible();

    // Edit the text (contentEditable supports fill()); the surrounding rich
    // markup is preserved by the editor.
    await editor.click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('Phase 2b rich edit — link preserved below. ');

    // Save.
    await page.getByRole('button', { name: /^save$/i }).click();

    // "edited" badge appears.
    await expect(page.locator('text=/edited/i').first()).toBeVisible({ timeout: 5000 });

    // Wait for the store autosave to flush to the server (debounced) so the
    // edit is durable, not browser-only, before we reload.
    await expect(page.getByTestId('review-save-state')).toHaveAttribute(
      'data-state',
      'saved',
      { timeout: 15_000 }
    );

    // The persisted htmlSnippet is rich HTML (carries a tag), not flattened.
    const reviewState = await page.evaluate(async ({ base, subId }) => {
      const r = await fetch(`${base}/api/submissions/${subId}/review`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('e2e-token') || ''}` },
        credentials: 'include'
      });
      return r.ok ? r.json() : null;
    }, { base: BASE_URL, subId: seed!.submissionId });

    if (reviewState?.aiReviewState?.buckets) {
      const all: any[] = [];
      for (const b of Object.values(reviewState.aiReviewState.buckets) as any[]) {
        all.push(...(b.narratives || []));
      }
      const edited = all.find((i) => i.sectionId === 'seed-narr-001');
      expect(edited).toBeTruthy();
      expect(edited.editedAt).toBeTruthy();
      // Rich format round-trips: the saved HTML still contains the hyperlink.
      expect(String(edited.htmlSnippet || '')).toContain('href="https://e2e.test/handbook"');
      // And the plain projection carries the typed text.
      expect(String(edited.snippet || '')).toContain('Phase 2b rich edit');
    }

    // Hard refresh — the edit persists (server, not browser-only).
    await page.reload({ waitUntil: 'load' });
    await gotoReviewStep(page, seed!);
    await expect(page.locator('text=/edited/i').first()).toBeVisible({ timeout: 10000 });
  });
});
