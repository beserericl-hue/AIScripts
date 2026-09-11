import { test, expect, Page } from '@playwright/test';

/**
 * CR-074 — Reader Report DISPLAY-ORDER regression test.
 *
 * The per-spec "Files" dropdown kept getting painted BEHIND the next spec's
 * sticky "Reader's checklist" card (reported 3×). This test opens the Files
 * menu and uses document.elementFromPoint to assert the menu actually sits ON
 * TOP wherever it overlaps a checklist card — a true z-order check, not just a
 * "is visible" check (a covered element is still "visible").
 *
 * Env: E2E_BASE_URL, E2E_READER_TOKEN (a reader/lead JWT), E2E_SUBMISSION_ID,
 * and optionally E2E_IMPERSONATE_ID (X-Impersonated-User-Id, if the token is a
 * lead viewing their own report). Skips when not configured.
 */
const BASE = process.env.E2E_BASE_URL ?? 'https://cshse-develop.up.railway.app';
const TOKEN = process.env.E2E_READER_TOKEN ?? '';
const SUB = process.env.E2E_SUBMISSION_ID ?? '';

async function auth(page: Page, token: string) {
  await page.context().addInitScript((t) => {
    localStorage.setItem('auth-storage', JSON.stringify({
      state: { token: t, impersonation: { isImpersonating: false, originalUser: null, impersonatedRole: undefined, impersonatedUser: undefined }, needsImpersonationSelection: false },
      version: 0,
    }));
  }, token);
}

test.describe('CR-074 Reader Report display order', () => {
  test.skip(!TOKEN || !SUB, 'set E2E_READER_TOKEN + E2E_SUBMISSION_ID');

  test('Files menu paints ABOVE the checklist cards (z-order)', async ({ page }) => {
    test.setTimeout(90_000);
    await auth(page, TOKEN);
    await page.goto(`${BASE}/reader-report/${SUB}`, { waitUntil: 'load' });
    await expect(page.getByTestId('reader-report-editor')).toBeVisible({ timeout: 30000 });
    await page.waitForTimeout(2000); // rows render

    // First ENABLED Files button (a spec that actually has files).
    const filesBtn = page.locator('[data-testid^="rr-files-"]:not([disabled])').first();
    await expect(filesBtn).toBeVisible({ timeout: 20000 });
    await filesBtn.scrollIntoViewIfNeeded();
    await filesBtn.dispatchEvent('click');

    const menu = page.locator('[data-testid^="rr-files-menu-"]').first();
    await expect(menu).toBeVisible({ timeout: 10000 });
    const menuBox = await menu.boundingBox();
    expect(menuBox, 'menu has a box').not.toBeNull();

    // The z-order check: at several points inside the menu, the TOP element must
    // belong to the menu — not a checklist card underneath it.
    const result = await page.evaluate((mb) => {
      const menuEl = document.querySelector('[data-testid^="rr-files-menu-"]') as HTMLElement | null;
      if (!menuEl || !mb) return { ok: false, reason: 'no-menu' };
      const checklists = Array.from(document.querySelectorAll('[data-testid^="rr-check-"]')) as HTMLElement[];
      // Does the menu overlap ANY checklist card? (make the test meaningful)
      let overlaps = false;
      for (const c of checklists) {
        const r = c.getBoundingClientRect();
        if (r.left < mb.x + mb.width && r.right > mb.x && r.top < mb.y + mb.height && r.bottom > mb.y) { overlaps = true; break; }
      }
      // Sample points across the menu; the topmost element must be within the menu.
      const pts = [0.2, 0.5, 0.8];
      for (const fx of pts) for (const fy of [0.25, 0.6, 0.9]) {
        const x = mb.x + mb.width * fx;
        const y = mb.y + mb.height * fy;
        const top = document.elementFromPoint(x, y) as HTMLElement | null;
        if (!top) continue;
        if (!menuEl.contains(top)) {
          const cover = top.closest('[data-testid^="rr-check-"]');
          return { ok: false, reason: 'covered', at: { x: Math.round(x), y: Math.round(y) }, coveredBy: cover ? (cover as HTMLElement).getAttribute('data-testid') : top.tagName };
        }
      }
      return { ok: true, overlaps };
    }, menuBox);

    console.log('z-order result:', JSON.stringify(result));
    expect(result.ok, `Files menu was covered by ${JSON.stringify((result as any).coveredBy)} at ${JSON.stringify((result as any).at)}`).toBe(true);
  });
});
