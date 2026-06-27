/**
 * CR-068 regression — the Review cards pane must stay SCROLLABLE across view
 * modes. A flex child only scrolls if it (and its ancestors) carry `min-h-0`;
 * without it the container expands to its content height past the viewport and
 * the scrollbar becomes unreachable ("I lost the ability to scroll" after
 * returning from the flat list to normal mode).
 *
 * This test forces overflow with a short viewport and asserts the scroll
 * container is BOUNDED (never taller than its <main>) and actually scrolls, in
 * both the flat list AND after returning to normal mode via the rail.
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

  test('cards pane is bounded + scrollable in list mode and after returning to normal', async ({ page }) => {
    test.setTimeout(60_000);
    // Short viewport so even modest content overflows the cards pane.
    await page.setViewportSize({ width: 1280, height: 460 });
    await loginAsSeededViaSso(page, seed!);
    await gotoReviewStep(page, seed!);

    const scroll = page.getByTestId('review-cards-scroll');
    await expect(scroll).toBeVisible();

    const measure = () =>
      scroll.evaluate((el) => {
        const main = el.closest('main') as HTMLElement;
        return {
          overflowY: getComputedStyle(el).overflowY,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
          mainClient: main.clientHeight,
          bottom: el.getBoundingClientRect().bottom,
          mainBottom: main.getBoundingClientRect().bottom,
        };
      });

    const assertBounded = (m: Awaited<ReturnType<typeof measure>>, label: string) => {
      expect(m.overflowY, `${label}: overflow-y is auto/scroll`).toMatch(/auto|scroll/);
      // THE regression check: the scroll viewport must never be taller than its
      // <main> parent. With the bug it expands to content height → unreachable
      // scrollbar.
      expect(m.clientHeight, `${label}: clientHeight <= main clientHeight`).toBeLessThanOrEqual(
        m.mainClient + 2
      );
      expect(m.bottom, `${label}: bottom within main`).toBeLessThanOrEqual(m.mainBottom + 2);
    };

    const assertScrolls = async (label: string) => {
      await scroll.evaluate((el) => {
        el.scrollTop = 0;
        el.scrollTop = 300;
      });
      expect(await scroll.evaluate((el) => el.scrollTop), `${label}: actually scrolls`).toBeGreaterThan(0);
    };

    // 1) Flat "all evidence" list — guaranteed to overflow → must scroll.
    await page.getByTestId('count-filter-evidence').click();
    await expect(page.getByText(/Showing all evidence across every spec/i)).toBeVisible();
    let m = await measure();
    assertBounded(m, 'list mode');
    expect(m.scrollHeight, 'list mode overflows').toBeGreaterThan(m.clientHeight);
    await assertScrolls('list mode');

    // 2) Return to normal mode via the rail — the reported regression scenario.
    await page.getByRole('tab', { name: /^\d+\.[a-z]/i }).first().click();
    await expect(page.getByText(/Showing all evidence across every spec/i)).toHaveCount(0);
    m = await measure();
    assertBounded(m, 'normal mode');
    if (m.scrollHeight > m.clientHeight + 2) {
      await assertScrolls('normal mode');
    }
  });
});
