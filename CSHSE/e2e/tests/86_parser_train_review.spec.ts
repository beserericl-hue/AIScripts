import { test, expect, request, Page } from '@playwright/test';

/**
 * Parser Train — the results button must open the REVIEW screen (cards +
 * Compare against the original), NOT the Self-Study Standards editor.
 * Dev-only (Parser Train is a superuser sandbox that never ships to prod).
 * Env: BASE (dev), SU_EMAIL/SU_PASSWORD.
 */
const BASE = process.env.BASE ?? 'https://cshse-develop.up.railway.app';
const SU_EMAIL = process.env.SU_EMAIL ?? 'eric@agileadtesting.com';
const SU_PASSWORD = process.env.SU_PASSWORD ?? 'Fr332bafami!y';

async function j(p: Promise<any>) { return (await p).json(); }
async function signIn(page: Page, token: string) {
  await page.goto(`${BASE}/dashboard#token=${encodeURIComponent(token)}`);
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
}

test('Open Review screen from Parser Train shows the REVIEW surface, not the Standards editor', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1600, height: 950 });
  const api = await request.newContext();
  const token = (await j(api.post(`${BASE}/api/auth/login`, { data: { email: SU_EMAIL, password: SU_PASSWORD } }))).token;
  await signIn(page, token);

  await page.goto(`${BASE}/parser-train`);
  // Load the most recent past run into the Verify section.
  const openResults = page.getByRole('button', { name: /Open results/ }).first();
  await expect(openResults).toBeVisible({ timeout: 30000 });
  await openResults.click();

  // The results button that opens the review.
  const openReview = page.getByTestId('pt-open-review');
  await expect(openReview).toBeVisible({ timeout: 60000 });
  const href = await openReview.getAttribute('href');
  expect(href, 'the results link must target the review screen').toContain('view=review');

  await openReview.click();

  // We must land on the REVIEW surface: URL carries ?view=review, the review
  // chrome (Check coverage button) + the specification rail with card tabs are
  // present — and the Standards empty-state is NOT.
  await expect(page).toHaveURL(/\/self-study\/[a-z0-9]+\?view=review/i, { timeout: 30000 });
  await expect(page.getByTestId('check-coverage-cta')).toBeVisible({ timeout: 120000 });
  const rail = page.locator('aside[aria-label="Specifications"]');
  await expect(rail).toBeVisible({ timeout: 30000 });
  await expect(rail.getByRole('tab').first()).toBeVisible();
  await expect(page.getByText(/This specification has no content yet/i)).toHaveCount(0);

  console.log('✓ Parser Train "Open Review screen" → review surface (cards + Compare), not the Standards editor');
});
