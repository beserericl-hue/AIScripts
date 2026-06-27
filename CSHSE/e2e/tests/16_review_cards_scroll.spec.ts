/**
 * CR-068 regression — the Review cards pane must stay SCROLLABLE across view
 * modes. A flex child only scrolls if it (and its ancestors) carry `min-h-0`;
 * without it the container expands to its content height and stops being a
 * scroll viewport ("I lost the ability to scroll" after returning from the flat
 * list to normal mode).
 *
 * Functional check: at a viewport where content overflows, the cards container
 * must be a real scroll viewport — clientHeight < scrollHeight AND setting
 * scrollTop actually moves it — in the flat list AND after returning to normal
 * mode via the rail. With the bug the container expands (clientHeight ==
 * scrollHeight) and scrollTop stays 0.
 */
import { test, expect } from '@playwright/test';
import {
  seedFixture,
  cleanupSeed,
  loginAsSeededViaSso,
  gotoReviewStep,
  type SeedResult
} from '../helpers/seed';

test.describe('CR-068 — Review cards stay scrollable across view modes', () => {
  let seed: SeedResult | undefined;
  test.beforeEach(async () => { seed = await seedFixture('wizard_review_minimal'); });
  test.afterEach(async () => { await cleanupSeed(seed); });

  test('cards pane actually scrolls in list mode and after returning to normal', async ({ page }) => {
    test.setTimeout(60_000);
    // Viewport short enough that the cards overflow, tall enough to avoid a
    // degenerate squish of the surrounding chrome.
    await page.setViewportSize({ width: 1280, height: 650 });
    await loginAsSeededViaSso(page, seed!);
    await gotoReviewStep(page, seed!);

    const scroll = page.getByTestId('review-cards-scroll');
    await expect(scroll).toBeVisible();

    // Asserts the container is a REAL scroll viewport: content overflows it and
    // setting scrollTop actually moves (the bug = expanded container, scrollTop
    // stuck at 0).
    const assertScrolls = async (label: string) => {
      const r = await scroll.evaluate((el) => {
        el.scrollTop = 0;
        el.scrollTop = 400;
        return {
          overflowY: getComputedStyle(el).overflowY,
          clientHeight: el.clientHeight,
          scrollHeight: el.scrollHeight,
          scrollTop: el.scrollTop,
        };
      });
      expect(r.overflowY, `${label}: overflow-y auto/scroll`).toMatch(/auto|scroll/);
      expect(r.scrollHeight, `${label}: content overflows the viewport`).toBeGreaterThan(r.clientHeight);
      expect(r.scrollTop, `${label}: scrollTop actually moves`).toBeGreaterThan(0);
    };

    // Normal mode (a spec selected by the seed) — must scroll.
    await assertScrolls('normal mode (initial)');

    // Flat "all evidence" list — must scroll.
    await page.getByTestId('count-filter-evidence').click();
    await expect(page.getByText(/Showing all evidence across every spec/i)).toBeVisible();
    await assertScrolls('flat list mode');

    // Return to normal mode via the rail — the reported regression scenario.
    await page.getByRole('tab', { name: /^\d+\.[a-z]/i }).first().click();
    await expect(page.getByText(/Showing all evidence across every spec/i)).toHaveCount(0);
    await assertScrolls('normal mode (after returning from list)');
  });
});
