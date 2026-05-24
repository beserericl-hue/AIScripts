/**
 * CR-034 — Test helpers that drive the /api/test/seed endpoint.
 *
 * Usage:
 *
 *   import { seedFixture, cleanupSeed, loginAsSeeded, gotoReviewStep } from '../helpers/seed';
 *
 *   test('Discard removes a card', async ({ page }) => {
 *     const seed = await seedFixture('wizard_review_minimal');
 *     try {
 *       await loginAsSeeded(page, seed);
 *       await gotoReviewStep(page, seed);
 *       // ... assertions ...
 *     } finally {
 *       await cleanupSeed(seed);
 *     }
 *   });
 *
 * Env vars consumed:
 *   E2E_BASE_URL      — deployed app URL (default http://localhost:3000)
 *   E2E_SEED_TOKEN    — must match the server's E2E_SEED_TOKEN
 *
 * The seed endpoint is mounted ONLY when the server has
 * E2E_SEED_ENABLED=1. If the endpoint returns 404, the tests will skip with
 * a clear message instead of failing.
 */
import { Page, test, expect } from '@playwright/test';
import { loginViaUI } from './auth';
import { loginViaSso } from './sso';

export type SeedResult = {
  cleanupToken: string;
  userId: string;
  userEmail: string;
  userPassword: string;
  submissionId: string;
  submissionDocumentId: string;
  importId: string;
  fixture: string;
  localStorageKey: string;
  localStorageValue: unknown;
};

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const TOKEN = process.env.E2E_SEED_TOKEN ?? '';

/**
 * Seed a fixture. Returns the IDs + credentials needed to drive the rest
 * of the test. Skips the test with a helpful message if the endpoint is
 * not mounted on the target server.
 */
export async function seedFixture(
  name: string,
  overrides?: Record<string, unknown>
): Promise<SeedResult> {
  if (!TOKEN) {
    test.skip(true, 'E2E_SEED_TOKEN not set — cannot use seed endpoint.');
  }
  const r = await fetch(`${BASE_URL}/api/test/seed`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-e2e-seed-token': TOKEN
    },
    body: JSON.stringify({ fixture: name, overrides: overrides ?? {} })
  });
  if (r.status === 404) {
    test.skip(
      true,
      `Seed endpoint not mounted on ${BASE_URL} — set E2E_SEED_ENABLED=1 on the server.`
    );
  }
  if (!r.ok) {
    const body = await r.text();
    throw new Error(
      `seedFixture(${name}) failed: HTTP ${r.status} — ${body.slice(0, 400)}`
    );
  }
  return (await r.json()) as SeedResult;
}

/**
 * Reverse a seed. Safe to call multiple times — second call returns 404
 * which we treat as already-cleaned-up.
 */
export async function cleanupSeed(seed: SeedResult | undefined): Promise<void> {
  if (!seed?.cleanupToken) return;
  if (!TOKEN) return;
  try {
    await fetch(`${BASE_URL}/api/test/seed`, {
      method: 'DELETE',
      headers: {
        'content-type': 'application/json',
        'x-e2e-seed-token': TOKEN
      },
      body: JSON.stringify({ cleanupToken: seed.cleanupToken })
    });
  } catch {
    // Best effort — the janitor sweeps stragglers anyway.
  }
}

/**
 * Log a Playwright page in as a seeded user using the standard login UI.
 *
 * NOTE: prefer `loginAsSeededViaSso` (CR-042) for any new spec — it's ~30x
 * faster and doesn't depend on the login-form DOM. This helper stays for
 * the few specs that explicitly exercise the password login flow.
 */
export async function loginAsSeeded(page: Page, seed: SeedResult): Promise<void> {
  await loginViaUI(page, seed.userEmail, seed.userPassword);
}

/**
 * CR-042 Slice 3 — log in as a seeded user via the SSO API instead of the
 * password form. The seeded user must already exist in the DB (created
 * during `seedFixture`); no auto-provision is involved.
 *
 * Also plants the seed's `localStorageValue` (the Zustand
 * `ai-import-storage` snapshot built by the seed endpoint) so the wizard
 * lands on its requested step with buckets/tags/matrices populated. Without
 * this, every spec that calls gotoReviewStep stalls on the Upload tab.
 */
export async function loginAsSeededViaSso(page: Page, seed: SeedResult): Promise<void> {
  await loginViaSso(page, seed.userEmail);
  if (seed.localStorageValue) {
    const key = seed.localStorageKey;
    const value = JSON.stringify(seed.localStorageValue);
    await page.context().addInitScript(
      ({ key, value }) => {
        window.localStorage.setItem(key, value);
      },
      { key, value }
    );
    // Also patch the open page (loginViaSso already navigated to baseOrigin).
    try {
      await page.evaluate(
        ({ key, value }) => {
          window.localStorage.setItem(key, value);
        },
        { key, value }
      );
    } catch {
      // First evaluate can fail if page hasn't loaded yet; the init script
      // covers every subsequent navigation.
    }
  }
}

/**
 * Navigate to the wizard's Review step for a seeded import. Assumes the
 * fixture's aiStatus was 'finished' — the wizard will short-circuit Parse
 * and Match and render the Review screen directly.
 */
export async function gotoReviewStep(page: Page, seed: SeedResult): Promise<void> {
  await page.goto(`/self-study/${seed.submissionId}`);
  await page.waitForLoadState('networkidle');

  // Open the Importer Wizard
  const wizardBtn = page.getByRole('button', { name: /importer wizard/i });
  await expect(wizardBtn).toBeVisible({ timeout: 20_000 });
  await wizardBtn.click();

  // The wizard's step rail uses role=tab with names like "3 Review".
  // Tabs may be `[disabled]` if upstream state isn't ready — but with the
  // CR-034 Zustand seed injected by loginAsSeededViaSso, status='finished'
  // unlocks Review and beyond.
  const reviewTab = page.getByRole('tab', { name: /review/i });
  await expect(reviewTab).toBeVisible({ timeout: 30_000 });
  await reviewTab.click();

  // Wait for at least one Review card to render
  await expect(
    page.getByRole('button', { name: /^edit$/i }).first()
  ).toBeVisible({ timeout: 30_000 });
}
