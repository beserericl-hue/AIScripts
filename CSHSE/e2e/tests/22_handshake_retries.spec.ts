/**
 * Tier 1 — CR-036 ai-service handshake retries.
 *
 * Status: SCAFFOLDED. Requires CR-036 code + a way to inject a 503 into
 * the cshse-server → ai-service handshake (e.g., a query param on
 * /api/test/inject-failure?next-handshake=503&count=2).
 */
import { test, expect } from '@playwright/test';

test.describe.skip('CR-036 — ai-service handshake retries', () => {
  test('yellow "Connecting…" banner appears during retries', async ({ page }) => {
    // TODO: inject 2x 503 on next handshake, click Start, assert yellow banner
    // visible, no red banner. Wait for success, assert banner clears.
    expect(true).toBe(true);
  });

  test('exhausted retries shows red banner with attempt count', async ({ page }) => {
    // TODO: inject 5x 503, click Start, wait for red banner mentioning "5 attempts".
    expect(true).toBe(true);
  });

  test('rapid retry clicks do not create duplicate ai-service jobs', async ({ page }) => {
    // TODO: click Start, then Start again before first completes. Assert
    // ai-service shows one job, not two.
    expect(true).toBe(true);
  });
});
