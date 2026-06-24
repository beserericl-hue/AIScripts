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
    // IMPORTANT: addInitScript runs on EVERY page load (including post-
    // page.reload()). If we unconditionally setItem, a refresh would
    // overwrite the user's edits with the original seeded state. Plant
    // only when the key is absent — covers the first load, preserves
    // local edits across subsequent refreshes within the same test.
    await page.context().addInitScript(
      ({ key, value }) => {
        if (!window.localStorage.getItem(key)) {
          window.localStorage.setItem(key, value);
        }
      },
      { key, value }
    );
    // Also patch the open page (loginViaSso already navigated to baseOrigin).
    try {
      await page.evaluate(
        ({ key, value }) => {
          if (!window.localStorage.getItem(key)) {
            window.localStorage.setItem(key, value);
          }
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
 * Navigate to the Review surface for a seeded import.
 *
 * CR-043 follow-on (2026-05-26) — Review is no longer a wizard step.
 * It's a first-class toolbar button on the Self-Study Editor that
 * opens a standalone ReviewSurface backed by the persisted
 * `Submission.aiReviewState`. This helper opens that surface.
 *
 * Assumes the fixture's aiStatus was 'parsed' or later — the toolbar
 * Review button is enabled by the seeded localStorage Zustand snapshot
 * (buckets/tags/etc.) so it lights up without needing the server-side
 * merge to have fired.
 */
export async function gotoReviewStep(page: Page, seed: SeedResult): Promise<void> {
  await page.goto(`/self-study/${seed.submissionId}`);
  await page.waitForLoadState('networkidle');

  // The onboarding tour (react-joyride) auto-starts on first visit and its
  // overlay intercepts pointer events. Skip it if present so nav clicks land.
  const tourSkip = page.getByTestId('tour-tooltip-skip');
  if (await tourSkip.isVisible().catch(() => false)) {
    await tourSkip.click().catch(() => {});
    await page.waitForTimeout(300);
  }

  // The editor auto-opens on the Review surface when un-triaged drafts remain
  // (SelfStudyEditor deriveStepFromStatus), which the wizard_review_minimal
  // fixture always has. Only navigate if it didn't land there on its own.
  const reviewHeading = page.getByRole('heading', { name: /^Review$/i });
  if (!(await reviewHeading.isVisible().catch(() => false))) {
    // Nav (2026-06) — /self-study/:id lands on the submission hub
    // (WorkflowSummary). Its "Spec items" tile calls onOpenReview() → the
    // Review surface. Prefer it; fall back to the editor toolbar / More menu.
    const specItemsTile = page.getByRole('button', { name: /Spec items/i }).first();
    if (await specItemsTile.isVisible().catch(() => false)) {
      await specItemsTile.click();
    } else {
      let reviewBtn = page.getByRole('button', { name: /^Review\b/i }).first();
      if (!(await reviewBtn.isVisible().catch(() => false))) {
        const moreBtn = page.getByTestId('nav-more');
        if (await moreBtn.isVisible().catch(() => false)) {
          await moreBtn.click();
          await page.waitForTimeout(200);
          reviewBtn = page
            .getByTestId('nav-more-menu')
            .getByRole('button', { name: /Review/i })
            .first();
        }
      }
      await expect(reviewBtn).toBeVisible({ timeout: 20_000 });
      await reviewBtn.click();
    }
  }

  // Wait for the Review surface's heading to appear.
  await expect(reviewHeading).toBeVisible({ timeout: 15_000 });

  // The Review pane is master/detail: left rail lists specs, middle
  // pane shows cards for the currently-selected spec. Pick a tab whose
  // accessible name starts with a real spec id ("1.a", "2.a", etc.)
  // so the middle pane has cards to bind against.
  await page.waitForLoadState('networkidle');
  const specsTabList = page
    .getByRole('complementary', { name: /specifications/i })
    .getByRole('tab', { name: /^\d+\.[a-z]/i })
    .first();
  await expect(specsTabList).toBeVisible({ timeout: 15_000 });
  // force: true skips Playwright's element-stability check, which
  // mis-fires when React re-renders the rail mid-click.
  await specsTabList.click({ force: true });

  // Wait for at least one Review card to render.
  await expect(
    page.getByRole('button', { name: /^edit$/i }).first()
  ).toBeVisible({ timeout: 30_000 });
}
