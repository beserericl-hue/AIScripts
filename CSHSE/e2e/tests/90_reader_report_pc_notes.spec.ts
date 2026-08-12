import { test, expect } from '@playwright/test';

/**
 * CR-074 — the Program Coordinator's submit-time notes are surfaced on the
 * Reader Report screen (they explain why each AI "needs improvement" flag
 * stands). Browser E2E via the #token= SSO handoff (authStore consumes it at
 * load), driving the real ReaderReportEditor as the assigned lead reader.
 *
 * Prep: scratchpad/prep_pcnotes.cjs (in-container) → E2E_PCNOTES_JSON =
 *   {sub, leadToken, notes:["1.a","2.a"]}.
 *
 * Verifies: (1) the top "Program Coordinator notes (N)" navigator appears;
 * (2) "Jump to first note" reveals the first flagged spec's checklist note card;
 * (3) "next" walks to the second note.
 */
const BASE = process.env.E2E_BASE_URL ?? 'https://cshse-develop.up.railway.app';
let cfg: any = {};
try { cfg = JSON.parse(process.env.E2E_PCNOTES_JSON ?? ''); } catch { /* skipped */ }

test.describe('CR-074 reader report — PC notes surfaced', () => {
  test.skip(!cfg.sub || !cfg.leadToken, 'set E2E_PCNOTES_JSON (run scratchpad/prep_pcnotes.cjs in-container first)');

  test('PC notes navigator + per-spec checklist cards render + navigate', async ({ page, context }) => {
    test.setTimeout(90_000);
    // Authenticate BEFORE load (the #token hash handoff races the router and
    // lands on /dashboard). Seed the persisted auth-storage; checkAuth then
    // authenticates the lead reader from the token.
    await context.addInitScript((token) => {
      localStorage.setItem('auth-storage', JSON.stringify({
        state: {
          token,
          impersonation: { isImpersonating: false, originalUser: null, impersonatedRole: undefined, impersonatedUser: undefined },
          needsImpersonationSelection: false,
        },
        version: 0,
      }));
    }, cfg.leadToken);
    // Reach the reader report the way a real reader does: land on the dashboard
    // (the new "Reader Self Study" panel), then click into the study's report.
    // A direct deep-link full-reload races the router's catch-all → /dashboard.
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'load' });
    await expect(page.getByTestId('reader-self-study-panel')).toBeVisible({ timeout: 20000 });
    await page.getByTestId(`reader-open-report-${cfg.sub}`).dispatchEvent('click');
    await expect(page.getByRole('heading', { name: /Reader Report/i })).toBeVisible({ timeout: 30000 });

    // The navigator (proves the PC notes loaded + are surfaced).
    const nav = page.getByTestId('rr-pc-notes-nav');
    await expect(nav).toBeVisible({ timeout: 20000 });
    await expect(nav).toContainText(`Program Coordinator notes (${cfg.notes.length})`);

    // Jump to the first note → its spec's checklist card is visible with content.
    // (dispatchEvent triggers the React onClick directly — a real click is
    // intercepted by the floating help-chat widget in this headless context.)
    await page.getByTestId('rr-pc-notes-first').dispatchEvent('click');
    const first = cfg.notes[0].replace('.', '-'); // "1.a" → "1-a"
    const firstCard = page.getByTestId(`rr-pc-note-${first}`);
    await expect(firstCard).toBeVisible({ timeout: 10000 });
    await expect(firstCard).toContainText(/Program Coordinator/i);
    // The actual PC note text renders (a snippet passed in, so this is portable
    // across the dev fixture and the real AACC data).
    if (cfg.firstNote) await expect(firstCard).toContainText(cfg.firstNote);

    // Next → the second note's card.
    if (cfg.notes.length > 1) {
      await page.getByTestId('rr-pc-notes-next').dispatchEvent('click');
      const second = cfg.notes[1].replace('.', '-');
      await expect(page.getByTestId(`rr-pc-note-${second}`)).toBeVisible({ timeout: 10000 });
    }
  });
});
