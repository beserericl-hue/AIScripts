/**
 * Editable card name on the Review surface (2026-06-09).
 *
 * Each Review card's name is coordinator-editable. A table-derived item that the
 * splitter stamped "(data table)" must:
 *   1) show an AUTO-DERIVED name from its content (the first table heading),
 *      never the raw "(data table)" placeholder;
 *   2) let the coordinator type an override (pencil → input → Enter), which shows
 *      immediately + a "named" badge;
 *   3) PERSIST that override across a full page reload (save-state round-trip);
 *   4) RESET to the auto-derived name when the override is cleared.
 *
 * Drives the real UI end-to-end (no fetch shortcuts for the rename itself).
 */
import { test, expect, type Page } from '@playwright/test';
import { seedFixture, cleanupSeed, loginAsSeededViaSso, type SeedResult } from '../helpers/seed';

const SEC = 'sec-rename-64';
const DERIVED = 'PhilBaseHeading64';            // first table cell → auto-derived name
const CUSTOM = 'My Faculty Roster 64';          // coordinator-typed override

async function gotoReviewSpec2a(page: Page, seed: SeedResult) {
  await page.goto(`/self-study/${seed.submissionId}`);
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /^Review\b/i }).first().click();
  await expect(page.getByRole('heading', { name: /^Review$/i })).toBeVisible({ timeout: 20_000 });
  await page.waitForLoadState('networkidle');
  // Only spec 2.a has a card in this seed — select it explicitly.
  const tab2a = page
    .getByRole('complementary', { name: /specifications/i })
    .getByRole('tab', { name: /^2\.a/i })
    .first();
  await expect(tab2a).toBeVisible({ timeout: 20_000 });
  await tab2a.click({ force: true });
  // The card renders.
  await expect(page.locator(`[data-section-id="${SEC}"]`)).toBeVisible({ timeout: 30_000 });
}

test.describe('Review card — editable name (derive, override, persist, reset)', () => {
  let seed: SeedResult | undefined;
  test.afterEach(async () => { await cleanupSeed(seed); seed = undefined; });

  test('auto-derived name → typed override → survives reload → reset', async ({ page }) => {
    test.setTimeout(180_000);

    seed = await seedFixture('wizard_review_minimal', {
      user: { email: 'card-rename@x.test', preferences: { tours: { welcome: true, 'self-study': true } } },
      reviewState: {
        buckets: {
          '2.a': {
            standardCode: '2', specCode: 'a', standardTitle: '', specPrompt: '',
            narratives: [],
            evidenceText: [
              {
                sectionId: SEC,
                heading: '(data table)', // the placeholder the splitter stamps
                snippet: `${DERIVED}\nrow one\nrow two`,
                htmlSnippet: `<table><tr><td>${DERIVED}</td><td>Role</td></tr><tr><td>Jane Doe</td><td>Director</td></tr></table>`,
                wordCount: 6, confidence: 0.92, acceptState: 'pending', rationale: '',
              },
            ],
            evidenceFiles: [], matrixCells: [],
          },
        },
        tags: [], cvs: [], evidenceDocs: [], introductions: {},
        placeholderSections: [], approvedIds: [], discardedIds: [], itemSources: {}, mergeLog: [],
      },
    });

    await loginAsSeededViaSso(page, seed);
    await gotoReviewSpec2a(page, seed);

    const card = page.locator(`[data-section-id="${SEC}"]`);
    const name = page.getByTestId(`card-name-${SEC}`); // the label span only (not the table body)

    // --- 1) Auto-derived name (NOT the "(data table)" placeholder). ---
    await expect(name).toHaveText(DERIVED, { timeout: 15_000 });
    await expect(card).not.toContainText('(data table)');
    await expect(card.getByText('named', { exact: true })).toHaveCount(0); // no override yet

    // --- 2) Type an override: pencil → input → Enter. Wait for the save-state POST. ---
    await card.hover();
    await card.getByTestId(`rename-open-${SEC}`).click({ force: true });
    const input = card.getByTestId(`rename-input-${SEC}`);
    await expect(input).toBeVisible({ timeout: 10_000 });
    await input.fill(CUSTOM);
    const save1 = page.waitForResponse(
      (r) => r.url().includes('/review/save-state') && r.request().method() === 'POST' && r.status() < 400,
      { timeout: 20_000 }
    );
    await input.press('Enter');
    await save1;

    await expect(page.getByTestId(`card-name-${SEC}`)).toHaveText(CUSTOM, { timeout: 10_000 });
    await expect(card.getByText('named', { exact: true })).toBeVisible();

    // --- 3) PERSISTENCE: full reload → the override is still there. ---
    await gotoReviewSpec2a(page, seed);
    const card2 = page.locator(`[data-section-id="${SEC}"]`);
    await expect(page.getByTestId(`card-name-${SEC}`)).toHaveText(CUSTOM, { timeout: 20_000 });
    await expect(card2.getByText('named', { exact: true })).toBeVisible();

    // Belt-and-suspenders: server state actually carries the customLabel.
    const persisted = await page.evaluate(async ({ id }) => {
      const raw = localStorage.getItem('auth-storage');
      const token = raw ? JSON.parse(raw)?.state?.token : null;
      const r = await fetch(`/api/submissions/${id}/review`, { headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      const b = (d.aiReviewState || d).buckets['2.a'];
      const it = (b.evidenceText || []).find((x: any) => x.sectionId === 'sec-rename-64');
      return it?.customLabel || null;
    }, { id: seed.submissionId });
    expect(persisted).toBe(CUSTOM);

    // --- 4) RESET: clear the override → back to the auto-derived name. ---
    await card2.hover();
    await card2.getByTestId(`rename-open-${SEC}`).click({ force: true });
    const input2 = card2.getByTestId(`rename-input-${SEC}`);
    await expect(input2).toBeVisible({ timeout: 10_000 });
    await input2.fill('');
    const save2 = page.waitForResponse(
      (r) => r.url().includes('/review/save-state') && r.request().method() === 'POST' && r.status() < 400,
      { timeout: 20_000 }
    );
    await input2.press('Enter');
    await save2;

    await expect(page.getByTestId(`card-name-${SEC}`)).toHaveText(DERIVED, { timeout: 10_000 });
    await expect(card2.getByText('named', { exact: true })).toHaveCount(0);
  });
});
