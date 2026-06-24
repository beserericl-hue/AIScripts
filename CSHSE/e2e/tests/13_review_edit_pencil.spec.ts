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

    // Phase 2c — the Compare toggle reveals the source document beside the
    // editor (split view), and the editor stays mounted (edits never lost).
    const compareToggle = page.getByTestId('compare-toggle');
    await expect(compareToggle).toBeVisible();
    await compareToggle.click();
    await expect(page.getByTestId('compare-source-pane')).toBeVisible();
    await expect(editor).toBeVisible(); // editor coexists with the source pane
    // Toggle Compare back off — source pane goes away, editor remains.
    await compareToggle.click();
    await expect(page.getByTestId('compare-source-pane')).toHaveCount(0);
    await expect(editor).toBeVisible();

    // APPEND text at the end (don't replace) so the link + bold are preserved
    // through the edit — this is what proves the rich format round-trips.
    await editor.click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.type(' — Phase 2b edit appended.');
    await page.waitForTimeout(400); // let the wide edit pane settle

    // Save. Click via the DOM — Playwright's "stable" actionability check
    // flaps on the focused contentEditable (caret blink / sub-pixel reflow),
    // which is invisible to a real user but makes a normal click() time out.
    await page.evaluate(() => {
      const save = Array.from(document.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'Save'
      );
      (save as HTMLButtonElement | undefined)?.click();
    });

    // "edited" badge appears.
    await expect(page.locator('text=/edited/i').first()).toBeVisible({ timeout: 5000 });

    // Wait for the store autosave to flush to the server (debounced) so the
    // edit is durable, not browser-only, before we reload.
    await expect(page.getByTestId('review-save-state')).toHaveAttribute(
      'data-state',
      'saved',
      { timeout: 15_000 }
    );

    // The persisted htmlSnippet is rich HTML, not flattened: the saved content
    // still carries the hyperlink AND the appended text.
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
    // Rich format round-trips: the saved HTML still contains the hyperlink.
    expect(String(edited.htmlSnippet || '')).toContain('href="https://e2e.test/handbook"');
    // And the edit was captured.
    expect(String(edited.snippet || '')).toContain('Phase 2b edit appended');

    // Hard refresh — the edit persists (server, not browser-only).
    await page.reload({ waitUntil: 'load' });
    await gotoReviewStep(page, seed!);
    await expect(page.locator('text=/edited/i').first()).toBeVisible({ timeout: 10000 });
  });
});
