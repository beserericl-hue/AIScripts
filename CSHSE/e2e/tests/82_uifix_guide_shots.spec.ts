import { test, request } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

/** Capture prod screenshots for the end-user guide (full-screen + hamburger). */
const PROD = 'https://cshse.courseworx.media';
const SUB = '6a590c0fc01945aaab81f289'; // AACC
const PC = { id: '6a4d718362b2b773fb5e0302', email: 'nrwilliams1@aacc.edu', firstName: 'Nicole', lastName: 'Williams', role: 'program_coordinator' };
const SHOTS = path.resolve(__dirname, '../report/guide');

test('capture UI-fix guide screenshots on prod', async ({ page }) => {
  test.setTimeout(180_000);
  fs.mkdirSync(SHOTS, { recursive: true });
  const api = await request.newContext();
  const token = (await (await api.post(`${PROD}/api/auth/login`, { data: { email: 'eric@agileadtesting.com', password: 'Fr332bafami!y' } })).json()).token;
  await page.addInitScript(([t, pc]) => localStorage.setItem('auth-storage', JSON.stringify({ state: { token: t, needsImpersonationSelection: false, impersonation: { isImpersonating: true, impersonatedRole: 'program_coordinator', impersonatedUser: pc } }, version: 0 })), [token, PC] as any);

  const open = async () => { await page.goto(`${PROD}/self-study/${SUB}?view=standards`); await page.waitForTimeout(3000); };

  // 1) WIDE — the compact header with the "Full screen" button + full toolbar
  await page.setViewportSize({ width: 1680, height: 900 });
  await page.goto(`${PROD}/dashboard`); await page.waitForTimeout(1500);
  await open();
  await page.screenshot({ path: path.join(SHOTS, 'a-wide-header.png'), clip: { x: 0, y: 90, width: 1680, height: 130 } });

  // 2) NARROW — the header collapses; the "Menu" hamburger appears
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(SHOTS, 'b-narrow-hamburger.png'), clip: { x: 0, y: 90, width: 1200, height: 120 } });

  // 3) Menu open — the dropdown of views
  await page.getByTestId('toolbar-menu').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOTS, 'c-menu-open.png'), clip: { x: 0, y: 90, width: 1200, height: 430 } });
  await page.keyboard.press('Escape').catch(() => {});
  await page.mouse.click(600, 600);

  // 4) Full-screen button close-up (wide)
  await page.setViewportSize({ width: 1680, height: 900 }); await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(SHOTS, 'd-fullscreen-button.png'), clip: { x: 250, y: 100, width: 520, height: 110 } });

  // 5) Full-screen ACTIVE — the workspace takes over the whole window
  await page.getByTestId('focus-enter').click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(SHOTS, 'e-fullscreen-active.png'), fullPage: false });
  console.log('captured guide screenshots');
});
